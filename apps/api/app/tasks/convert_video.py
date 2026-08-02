import glob
import re
import shutil
import subprocess
import json
from pathlib import Path
from typing import Any

import redis
import yt_dlp
from yt_dlp.utils import sanitize_filename

from app.config import get_settings
from app.tasks.celery_app import celery_app

JOB_TTL_SECONDS = 24 * 60 * 60
settings = get_settings()
redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


def job_key(job_id: str) -> str:
    return f"download:job:{job_id}"


def update_job(job_id: str, **values: object) -> None:
    redis_client.hset(job_key(job_id), mapping={key: str(value) for key, value in values.items()})
    redis_client.expire(job_key(job_id), JOB_TTL_SECONDS)


def ensure_aac_in_mp4(path: Path) -> Path:
    """Re-encode audio to AAC if the file has a non-AAC audio codec."""
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", str(path)],
            capture_output=True, text=True, timeout=30,
        )
        streams = json.loads(probe.stdout).get("streams", [])
        audio_codec = next((s["codec_name"] for s in streams if s["codec_type"] == "audio"), None)
        if audio_codec and audio_codec.lower() != "aac":
            fixed = path.with_stem(path.stem + "_temp")
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(path), "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", str(fixed)],
                capture_output=True, text=True, timeout=600,
            )
            path.unlink()
            fixed.rename(path)
    except Exception:
        pass
    return path


def format_selector(format_value: str, quality_value: str) -> str:
    if format_value == "mp3":
        return "bestaudio/best"
    max_height = re.sub(r"\D", "", quality_value) or "720"
    # Best quality regardless of codec. Audio is re-encoded to AAC after download.
    return f"bv*[height<={max_height}]+ba/b[height<={max_height}]/b"


def download_options(job_id: str, job: dict[str, str], job_dir: Path) -> dict[str, Any]:
    format_value = job["format"]
    is_playlist = job.get("scope") == "playlist"
    preferred_quality = re.sub(r"\D", "", job.get("quality", "192")) or "192"

    def report_progress(data: dict[str, Any]) -> None:
        if data.get("status") != "downloading":
            return
        total = data.get("total_bytes") or data.get("total_bytes_estimate") or 0
        downloaded = data.get("downloaded_bytes") or 0
        if total:
            # Keep room for ffmpeg post-processing and archive creation.
            update_job(job_id, progress=min(90, max(10, int(downloaded / total * 80) + 10)))

    name_template = "%(playlist_index)03d - %(title).180B.%(ext)s" if is_playlist else "media.%(ext)s"
    options: dict[str, Any] = {
        "format": format_selector(format_value, job.get("quality", "720p")),
        "outtmpl": str(job_dir / name_template),
        "noplaylist": not is_playlist,
        "merge_output_format": "mp4" if format_value == "mp4" else None,
        "quiet": True,
        "no_warnings": True,
        "ignoreerrors": "only_download" if is_playlist else False,
        "restrictfilenames": True,
        "windowsfilenames": True,
        "progress_hooks": [report_progress],
        "extractor_args": {"youtube": {"player_client": ["android", "web"]}},
        "socket_timeout": 30,
        "playlistend": settings.MAX_PLAYLIST_ITEMS if is_playlist else None,
    }
    if format_value == "mp3":
        options["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": preferred_quality,
        }]
    return {key: value for key, value in options.items() if value is not None}


@celery_app.task(bind=True)
def convert_video_task(self, job_id: str) -> None:
    job = redis_client.hgetall(job_key(job_id))
    if not job:
        return

    job_dir = Path(settings.DOWNLOAD_DIR).resolve() / job_id
    try:
        job_dir.mkdir(parents=True, exist_ok=True)
        update_job(job_id, status="processing", progress=5, error_message="")

        with yt_dlp.YoutubeDL(download_options(job_id, job, job_dir)) as ydl:
            info = ydl.extract_info(job["youtube_url"], download=True)

        title = sanitize_filename(info.get("title") or "download", restricted=True)
        update_job(job_id, title=title, progress=92)

        if job.get("scope") == "playlist":
            if not any(job_dir.iterdir()):
                raise FileNotFoundError("yt-dlp could not download any playlist items")
            archive_base = job_dir.parent / f"{job_id}_playlist"
            archive_path = Path(shutil.make_archive(str(archive_base), "zip", root_dir=job_dir))
            shutil.rmtree(job_dir)
            output_path = archive_path
        else:
            matches = [Path(path) for path in glob.glob(str(job_dir / "media.*")) if not path.endswith((".part", ".ytdl"))]
            if not matches:
                raise FileNotFoundError("yt-dlp did not create a downloadable media file")
            output_path = matches[0]
            if job.get("format") == "mp4":
                ensure_aac_in_mp4(output_path)

        update_job(job_id, status="completed", progress=100, file_path=str(output_path))
    except Exception as error:
        update_job(job_id, status="failed", error_message=str(error), progress=0)
