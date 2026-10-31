import unittest
from unittest.mock import patch

from app.services.youtube import YouTubeBlockedError, get_video_metadata, settings


class GetVideoMetadataTests(unittest.TestCase):
    @patch("app.services.youtube.yt_dlp.YoutubeDL")
    def test_playlist_metadata_uses_bounded_flat_extraction(self, youtube_dl):
        downloader = youtube_dl.return_value.__enter__.return_value
        downloader.extract_info.return_value = {
            "_type": "playlist",
            "id": "PL123",
            "title": "Test playlist",
            "playlist_count": 68,
            "entries": [{"id": "video-1"}, {"id": "video-2"}],
        }

        metadata = get_video_metadata("https://www.youtube.com/playlist?list=PL123")

        options = youtube_dl.call_args.args[0]
        self.assertEqual(options["extract_flat"], "in_playlist")
        self.assertEqual(options["playlistend"], settings.MAX_PLAYLIST_ITEMS)
        self.assertTrue(options["skip_download"])
        self.assertTrue(metadata["is_playlist"])
        self.assertEqual(metadata["playlist_count"], 68)
        self.assertEqual(metadata["formats"], [])

    @patch("app.services.youtube.yt_dlp.YoutubeDL")
    def test_single_video_metadata_still_returns_formats(self, youtube_dl):
        downloader = youtube_dl.return_value.__enter__.return_value
        downloader.extract_info.return_value = {
            "_type": "video",
            "id": "video-1",
            "title": "Test video",
            "duration": 42,
            "thumbnail": "https://example.com/thumb.jpg",
            "uploader": "Test channel",
            "formats": [
                {"format_id": "137", "ext": "mp4", "height": 1080, "filesize": 1000},
                {"format_id": "251", "ext": "webm", "abr": 160},
            ],
        }

        metadata = get_video_metadata("https://www.youtube.com/watch?v=video-1")

        self.assertFalse(metadata["is_playlist"])
        self.assertEqual(metadata["playlist_count"], 0)
        self.assertEqual(metadata["thumbnail"], "https://example.com/thumb.jpg")
        self.assertFalse(metadata["is_live"])
        self.assertEqual(metadata["formats"], [{
            "format_id": "137",
            "resolution": "1080p",
            "quality": 1080,
            "ext": "mp4",
            "filesize": 1000,
        }])


    @patch("app.services.youtube.yt_dlp.YoutubeDL")
    def test_single_flag_ignores_playlist_and_restricts_extractors(self, youtube_dl):
        youtube_dl.return_value.__enter__.return_value.extract_info.return_value = {"id": "v", "live_status": "is_live"}

        metadata = get_video_metadata("https://www.youtube.com/watch?v=v&list=PL1", single=True)

        options = youtube_dl.call_args.args[0]
        self.assertTrue(options["noplaylist"])
        self.assertEqual(options["allowed_extractors"], ["youtube", "youtube:.*"])
        self.assertEqual(options["extractor_args"]["youtube"]["player_skip"], ["js"])
        self.assertTrue(metadata["is_live"])

    @patch("app.services.youtube.yt_dlp.YoutubeDL")
    def test_errors_become_value_error(self, youtube_dl):
        youtube_dl.return_value.__enter__.return_value.extract_info.side_effect = RuntimeError("Video unavailable")
        with self.assertRaisesRegex(ValueError, "Video unavailable"):
            get_video_metadata("https://www.youtube.com/watch?v=v")


    @patch("app.services.youtube.yt_dlp.YoutubeDL")
    def test_bot_check_becomes_youtube_blocked(self, youtube_dl):
        youtube_dl.return_value.__enter__.return_value.extract_info.side_effect = RuntimeError('ERROR: [youtube] jNQXAC9IVRw: Sign in to confirm you’re not a bot. This helps protect our community. Use --cookies-from-browser or --cookies for the authentication.')
        with self.assertRaises(YouTubeBlockedError) as raised:
            get_video_metadata("https://www.youtube.com/watch?v=v")
        self.assertNotIn("cookies", str(raised.exception))


    def test_proxy_only_when_configured(self):
        from app.services.youtube import base_ydl_options
        self.assertNotIn("proxy", base_ydl_options())
        with patch.object(settings, "YT_PROXY", "http://user:pw@proxy.example:8080"):
            self.assertEqual(base_ydl_options()["proxy"], "http://user:pw@proxy.example:8080")


    @patch("app.services.youtube.yt_dlp.YoutubeDL")
    def test_proxy_credentials_never_reach_the_error(self, youtube_dl):
        proxy = "http://user:s3cret@proxy.example:8080"
        youtube_dl.return_value.__enter__.return_value.extract_info.side_effect = RuntimeError(f"Unable to connect to proxy {proxy}")
        with patch.object(settings, "YT_PROXY", proxy), self.assertRaises(ValueError) as raised, self.assertLogs("app.services.youtube") as logs:
            get_video_metadata("https://www.youtube.com/watch?v=v")
        self.assertNotIn("s3cret", str(raised.exception))
        self.assertNotIn("s3cret", "".join(logs.output))
        # Any other URL with credentials is masked too.
        from app.services.youtube import redact
        self.assertEqual(redact("via https://a:b@other.example/x"), "via https://***@other.example/x")


if __name__ == "__main__":
    unittest.main()
