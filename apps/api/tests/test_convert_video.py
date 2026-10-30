import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.tasks.convert_video import clip_length, clip_options, download_options, make_match_filter, output_filename, settings


def options_for(job):
    with tempfile.TemporaryDirectory() as directory:
        return download_options("job-1", {"format": "mp4", "quality": "720p", "scope": "single", **job}, Path(directory))


class DownloadOptionsTests(unittest.TestCase):
    def test_playlist_download_enables_playlist_and_applies_limit(self):
        options = options_for({"scope": "playlist"})
        self.assertFalse(options["noplaylist"])
        self.assertEqual(options["playlistend"], settings.MAX_PLAYLIST_ITEMS)
        self.assertIn("%(playlist_index)03d", options["outtmpl"])

    def test_single_download_remains_single_item(self):
        options = options_for({})
        self.assertTrue(options["noplaylist"])
        self.assertEqual(options["playlistend"], 1)
        self.assertTrue(options["outtmpl"].endswith("media.%(ext)s"))

    def test_only_youtube_extractors_allowed(self):
        self.assertEqual(options_for({})["allowed_extractors"], ["youtube", "youtube:.*"])

    def test_full_download_has_no_ranges(self):
        options = options_for({"start_time": "", "end_time": ""})
        self.assertNotIn("download_ranges", options)
        self.assertNotIn("force_keyframes_at_cuts", options)

    def test_clip_job_adds_ranges(self):
        options = options_for({"start_time": "5.0", "end_time": "12.0"})
        self.assertTrue(options["force_keyframes_at_cuts"])
        self.assertEqual(list(options["download_ranges"]({}, None)), [{"start_time": 5.0, "end_time": 12.0}])

    def test_progress_is_monotonic_and_throttled(self):
        options = options_for({})
        with patch("app.tasks.convert_video.update_job") as update:
            hook = options["progress_hooks"][0]
            for done in range(0, 101):
                hook({"status": "downloading", "downloaded_bytes": done, "total_bytes": 100})
            # second stream (audio) restarts at 0 bytes: must not move progress backwards
            hook({"status": "downloading", "downloaded_bytes": 1, "total_bytes": 100})
        values = [call.kwargs["progress"] for call in update.call_args_list]
        self.assertEqual(values, sorted(values))
        self.assertLess(len(values), 35)
        self.assertLessEqual(values[-1], 90)

    def test_clip_progress_advances_on_finished_streams(self):
        options = options_for({"start_time": "5", "end_time": "12"})
        with patch("app.tasks.convert_video.update_job") as update:
            hook = options["progress_hooks"][0]
            hook({"status": "finished"})
            hook({"status": "finished"})
        self.assertEqual([c.kwargs["progress"] for c in update.call_args_list], [40, 75])


class ClipOptionsTests(unittest.TestCase):
    def test_no_range(self):
        self.assertEqual(clip_options(None, None), {})

    def test_start_and_end(self):
        ranges = list(clip_options(5, 12)["download_ranges"]({}, None))
        self.assertEqual(ranges, [{"start_time": 5, "end_time": 12}])

    def test_start_only_runs_to_end(self):
        ranges = list(clip_options(5, None)["download_ranges"]({}, None))
        self.assertEqual(ranges, [{"start_time": 5, "end_time": float("inf")}])

    def test_end_only_starts_at_zero(self):
        ranges = list(clip_options(None, 12)["download_ranges"]({}, None))
        self.assertEqual(ranges, [{"start_time": 0, "end_time": 12}])


class FilenameTests(unittest.TestCase):
    def test_full_video(self):
        self.assertEqual(output_filename("Me at the zoo", "mp4", None, None, 19), "Me at the zoo.mp4")

    def test_clip(self):
        self.assertEqual(output_filename("Me at the zoo", "mp4", 5, 12, 19), "Me at the zoo [00m05s-00m12s].mp4")

    def test_start_only_uses_duration_and_hours(self):
        self.assertEqual(output_filename("Talk", "mp3", 3725, None, 7200), "Talk [1h02m05s-2h00m00s].mp3")

    def test_unsafe_characters_removed(self):
        name = output_filename('../a/b\\c:"d"', "mp4", None, None, None)
        self.assertNotIn("/", name)
        self.assertNotIn("\\", name)
        self.assertTrue(name.endswith(".mp4"))

    def test_empty_title(self):
        self.assertEqual(output_filename("", "mp4", None, None, None), "download.mp4")


class MatchFilterTests(unittest.TestCase):
    MAX = settings.MAX_DURATION_SECONDS

    def test_rejects_live(self):
        self.assertIsNotNone(make_match_filter(None, None)({"live_status": "is_live"}))

    def test_rejects_too_long_full_video(self):
        self.assertIsNotNone(make_match_filter(None, None)({"duration": self.MAX + 1}))

    def test_short_clip_of_long_video_allowed(self):
        self.assertIsNone(make_match_filter(10, 70)({"duration": self.MAX * 10}))

    def test_long_clip_rejected(self):
        self.assertIsNotNone(make_match_filter(0, self.MAX + 5)({"duration": self.MAX * 10}))
        self.assertIsNotNone(make_match_filter(5, None)({"duration": self.MAX * 10}))

    def test_unknown_duration_rejected_unless_incomplete(self):
        self.assertIsNotNone(make_match_filter(None, None)({"id": "x"}))
        self.assertIsNone(make_match_filter(None, None)({"id": "x"}, incomplete=True))

    def test_playlist_container_passes_and_normal_video_allowed(self):
        self.assertIsNone(make_match_filter(None, None)({"_type": "playlist"}))
        self.assertIsNone(make_match_filter(None, None)({"duration": 19}))


class ClipLengthTests(unittest.TestCase):
    def test_clip_length(self):
        self.assertEqual(clip_length(None, None, 19), 19)
        self.assertEqual(clip_length(5, 12, 19), 7)
        self.assertEqual(clip_length(5, 25, 19), 14)
        self.assertEqual(clip_length(19, None, 19), 0)


if __name__ == "__main__":
    unittest.main()
