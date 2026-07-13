import tempfile
import unittest
from pathlib import Path

from app.tasks.convert_video import download_options, settings


class DownloadOptionsTests(unittest.TestCase):
    def test_playlist_download_enables_playlist_and_applies_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            options = download_options(
                "job-1",
                {"format": "mp4", "quality": "720p", "scope": "playlist"},
                Path(directory),
            )

        self.assertFalse(options["noplaylist"])
        self.assertEqual(options["playlistend"], settings.MAX_PLAYLIST_ITEMS)
        self.assertIn("%(playlist_index)03d", options["outtmpl"])

    def test_single_download_remains_single_item(self):
        with tempfile.TemporaryDirectory() as directory:
            options = download_options(
                "job-2",
                {"format": "mp4", "quality": "720p", "scope": "single"},
                Path(directory),
            )

        self.assertTrue(options["noplaylist"])
        self.assertNotIn("playlistend", options)
        self.assertTrue(options["outtmpl"].endswith("media.%(ext)s"))


if __name__ == "__main__":
    unittest.main()
