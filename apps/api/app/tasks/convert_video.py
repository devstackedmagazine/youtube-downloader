import glob
import json
import logging
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

import redis
import yt_dlp
from yt_dlp.utils import download_range_func, sanitize_filename

from app.config import get_settings
from app.services.youtube import base_ydl_options, is_live
from app.tasks.celery_app import celery_app
from app.tasks.cleanup import remove_expired_downloads

logger = logging.getLogger(__name__)
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
                capture_output=True, text=True, timeout=600, check=True,
            )
            path.unlink()
            fixed.rename(path)
    except Exception as error:
        logger.warning("AAC re-encode skipped for %s: %r", path, error)
    return path


def format_selector(format_value: str, quality_value: str) -> str:
    if format_value == "mp3":
        return "bestaudio/best"
    max_height = re.sub(r"\D", "", quality_value) or "720"
    # Best quality regardless of codec. Audio is re-encoded to AAC after download.
    return f"bv*[height<={max_height}]+ba/b[height<={max_height}]/b"


def parse_range(job: dict[str, str]) -> tuple[float | None, float | None]:
    start, end = job.get("start_time") or "", job.get("end_time") or ""
    return (float(start) if start else None, float(end) if end else None)


def clip_options(start: float | None, end: float | None) -> dict[str, Any]:
    """yt-dlp options that fetch only [start, end) of a video. Empty if no range."""
    if start is None and end is None:
        return {}
    return {
        "download_ranges": download_range_func(None, [(start or 0, float("inf") if end is None else end)]),
        # Re-encode around the cut points so the clip starts/ends exactly, not on the nearest keyframe.
        "force_keyframes_at_cuts": True,
        # That re-encode uses libx264 defaults (preset medium, one thread per host core), which
        # got the 256 MB container OOM-killed. One thread is all 0.1 vCPU offers anyway.
        "external_downloader_args": {"ffmpeg_o": ["-threads", "1", "-preset", "veryfast"]},
    }


def format_offset(seconds: float) -> str:
    seconds = int(seconds)
    h, m, s = seconds // 3600, seconds // 60 % 60, seconds % 60
    return f"{h}h{m:02d}m{s:02d}s" if h else f"{m:02d}m{s:02d}s"


def output_filename(title: str, extension: str, start: float | None, end: float | None, duration: float | None) -> str:
    """e.g. "Title [00m05s-00m12s].mp4" for a clip, "Title.mp4" otherwise."""
    name = sanitize_filename(title or "download").strip() or "download"
    name = name[:150]
    if start is not None or end is not None:
        stop = end if end is not None else duration
        name += f" [{format_offset(start or 0)}-{format_offset(stop) if stop else 'end'}]"
    return f"{name}.{extension}"


def clip_length(start: float | None, end: float | None, duration: float) -> float:
    """Seconds actually processed for a video of ``duration`` (end is clamped to it)."""
    stop = duration if end is None else min(end, duration)
    return max(0.0, stop - (start or 0))


def make_match_filter(start: float | None, end: float | None):
    """Last line of defence for the length limit (playlist items aren't pre-checked by the API)."""
    def reject(info: dict[str, Any], *, incomplete: bool = False) -> str | None:
        if info.get("_type") == "playlist":
            return None  # entries are checked individually
        if is_live(info):
            return "Live streams are not supported"
        duration = info.get("duration")
        if not duration:
            # Flat playlist entries may lack it; the full entry is checked again later.
            return None if incomplete else "Video length is unknown"
        if clip_length(start, end, duration) > settings.MAX_DURATION_SECONDS:
            return f"Longer than the {settings.MAX_DURATION_SECONDS}-second limit"
        return None
    return reject


def download_options(job_id: str, job: dict[str, str], job_dir: Path) -> dict[str, Any]:
    format_value = job["format"]
    is_playlist = job.get("scope") == "playlist"
    preferred_quality = re.sub(r"\D", "", job.get("quality", "192")) or "192"
    start, end = parse_range(job)
    is_clip = start is not None or end is not None
    state = {"progress": 5}

    def set_progress(value: int) -> None:
        # Monotonic and only on visible changes: yt-dlp calls hooks many times per
        # second, and every write is two Redis commands (Upstash quota).
        value = min(90, value)
        if value >= state["progress"] + 3:
            state["progress"] = value
            update_job(job_id, progress=value)

    def report_progress(data: dict[str, Any]) -> None:
        if data.get("status") == "downloading":
            total = data.get("total_bytes") or data.get("total_bytes_estimate") or 0
            if total:
                # Keep room for ffmpeg post-processing and archive creation.
                set_progress(int((data.get("downloaded_bytes") or 0) / total * 80) + 10)
        elif data.get("status") == "finished" and is_clip:
            # Range downloads run through ffmpeg, which reports no byte progress;
            # advance per finished stream instead (video, then audio).
            set_progress(state["progress"] + 35)

    name_template = "%(playlist_index)03d - %(title).180B.%(ext)s" if is_playlist else "media.%(ext)s"
    options: dict[str, Any] = {
        **base_ydl_options(),
        "format": format_selector(format_value, job.get("quality", "720p")),
        "outtmpl": str(job_dir / name_template),
        "noplaylist": not is_playlist,
        "merge_output_format": "mp4" if format_value == "mp4" else None,
        "ignoreerrors": "only_download" if is_playlist else False,
        "restrictfilenames": True,
        "windowsfilenames": True,
        "noprogress": True,
        "progress_hooks": [report_progress],
        "match_filter": make_match_filter(start, end),
        # noplaylist doesn't stop a pure playlist URL; cap single jobs at one item.
        "playlistend": settings.MAX_PLAYLIST_ITEMS if is_playlist else 1,
        **clip_options(start, end),
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
        # Instead of a separate beat process (no memory for it in 256 MB): files only
        # appear when jobs run, so cleaning up before each job keeps the disk bounded.
        remove_expired_downloads()
        job_dir.mkdir(parents=True, exist_ok=True)
        update_job(job_id, status="processing", progress=5, error_message="")

        with yt_dlp.YoutubeDL(download_options(job_id, job, job_dir)) as ydl:
            info = ydl.extract_info(job["youtube_url"], download=True)
        if not info:
            raise RuntimeError("This video can't be downloaded (it may be live or too long).")

        update_job(job_id, progress=92)
        start, end = parse_range(job)

        if job.get("scope") == "playlist":
            if not any(job_dir.iterdir()):
                raise FileNotFoundError("yt-dlp could not download any playlist items")
            archive_base = job_dir.parent / f"{job_id}_playlist"
            archive_path = Path(shutil.make_archive(str(archive_base), "zip", root_dir=job_dir))
            shutil.rmtree(job_dir)
            output_path = archive_path
            extension = "zip"
        else:
            matches = [Path(path) for path in glob.glob(str(job_dir / "media.*")) if not path.endswith((".part", ".ytdl"))]
            if not matches:
                raise FileNotFoundError("yt-dlp did not create a downloadable media file")
            output_path = matches[0]
            extension = job.get("format", "mp4")
            if extension == "mp4":
                ensure_aac_in_mp4(output_path)

        filename = output_filename(info.get("title"), extension, start, end, info.get("duration"))
        update_job(job_id, status="completed", progress=100, file_path=str(output_path), title=info.get("title") or "", filename=filename)
    except Exception as error:
        logger.warning("Download job %s failed: %r", job_id, error)
        update_job(job_id, status="failed", error_message=str(error), progress=0)
