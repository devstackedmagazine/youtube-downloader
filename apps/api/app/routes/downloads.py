import asyncio
import logging
import os
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from redis.asyncio import Redis

from app.config import Settings, get_settings
from app.schemas.download import MIN_CLIP_SECONDS, DownloadCreate, DownloadScopeEnum, JobResponse
from app.services.youtube import get_video_metadata, validate_youtube_url
from app.tasks.convert_video import clip_length, convert_video_task

logger = logging.getLogger(__name__)
router = APIRouter()
JOB_TTL_SECONDS = 24 * 60 * 60
# Duration reported by YouTube is rounded; allow a little slack on the end time.
DURATION_TOLERANCE_SECONDS = 1


def get_redis(request: Request) -> Redis:
    return request.app.state.redis


def job_key(job_id: str) -> str:
    return f"download:job:{job_id}"


def optional_float(value: str | None) -> float | None:
    return float(value) if value else None


async def enforce_rate_limit(request: Request, redis: Redis = Depends(get_redis), settings: Settings = Depends(get_settings)):
    """Bound expensive anonymous metadata and conversion requests.

    Use the direct peer address instead of client-controlled forwarding headers.
    Deployments behind a proxy should configure the proxy/server to preserve the
    real client address before enabling proxy header handling.
    If Redis is unreachable the request is refused with 503 (fail closed) rather
    than letting unbounded yt-dlp/ffmpeg work through.
    """
    client = request.client.host if request.client else "unknown"
    key = f"download:rate:{client}"
    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, settings.RATE_LIMIT_WINDOW_SECONDS)
    except Exception as error:
        logger.error("Rate limiting unavailable, Redis error: %r", error)
        raise HTTPException(status_code=503, detail="The service is temporarily unavailable. Please try again shortly.") from error
    if count > settings.RATE_LIMIT_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again shortly.")


async def fetch_metadata(url: str, settings: Settings, single: bool = False) -> dict[str, Any]:
    try:
        # yt-dlp is blocking; keep it off the event loop. A timed-out thread keeps
        # running in the background until yt-dlp's own socket timeout ends it.
        return await asyncio.wait_for(
            asyncio.to_thread(get_video_metadata, url, single), timeout=settings.METADATA_TIMEOUT_SECONDS
        )
    except TimeoutError as error:
        raise HTTPException(status_code=504, detail="Looking up the video timed out. Please try again.") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


def format_clock(seconds: float) -> str:
    seconds = int(seconds)
    h, m, s = seconds // 3600, seconds // 60 % 60, seconds % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def check_against_video(req: DownloadCreate, info: dict[str, Any], max_duration: int) -> str | None:
    """Rules that need the video's metadata. Returns an error message or None."""
    if info.get("is_live"):
        return "Live streams can't be downloaded. Try again after the stream has ended."
    if info.get("is_playlist"):
        return "This link is a playlist. Choose \"Whole playlist\" to download it."
    duration = info.get("duration") or 0
    if not duration:
        # Fail closed: without a duration the length limit can't be enforced.
        return "Couldn't determine the length of this video, so it can't be downloaded."
    if req.is_clip and duration:
        if req.end_time is not None and req.end_time > duration + DURATION_TOLERANCE_SECONDS:
            return f"End time is past the end of the video ({format_clock(duration)})."
        if req.start_time is not None and req.start_time >= duration:
            return f"Start time is past the end of the video ({format_clock(duration)})."
    length = clip_length(req.start_time, req.end_time, duration)
    if req.is_clip and length < MIN_CLIP_SECONDS:
        return f"The section must be at least {MIN_CLIP_SECONDS} second long."
    if length > max_duration:
        what = "section" if req.is_clip else "video"
        return f"This {what} is {format_clock(length)} long; the limit is {format_clock(max_duration)}. Choose a shorter section."
    return None


@router.get("/metadata")
async def metadata(
    url: str = Query(..., max_length=2048),
    settings: Settings = Depends(get_settings),
    _: None = Depends(enforce_rate_limit),
):
    if not validate_youtube_url(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    data = await fetch_metadata(url, settings)
    data["max_duration_seconds"] = settings.MAX_DURATION_SECONDS
    return data


@router.post("/download", response_model=JobResponse)
async def create_download(
    download_req: DownloadCreate,
    redis: Redis = Depends(get_redis),
    settings: Settings = Depends(get_settings),
    _: None = Depends(enforce_rate_limit),
):
    url = download_req.youtube_url
    if not validate_youtube_url(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    # Playlists are checked per item by the worker; a single video is checked
    # up front so the user gets an immediate, specific error.
    if download_req.scope == DownloadScopeEnum.single:
        info = await fetch_metadata(url, settings, single=True)
        problem = check_against_video(download_req, info, settings.MAX_DURATION_SECONDS)
        if problem:
            raise HTTPException(status_code=422, detail=problem)

    job_id = str(uuid.uuid4())
    key = job_key(job_id)
    try:
        await redis.hset(key, mapping={
            "id": job_id,
            "youtube_url": url,
            "format": download_req.format.value,
            "quality": download_req.quality,
            "scope": download_req.scope.value,
            "start_time": "" if download_req.start_time is None else str(download_req.start_time),
            "end_time": "" if download_req.end_time is None else str(download_req.end_time),
            "status": "pending",
            "progress": "0",
            "error_message": "",
        })
        await redis.expire(key, JOB_TTL_SECONDS)
        convert_video_task.delay(job_id)
    except Exception as error:
        logger.error("Could not queue download %s: %r", job_id, error)
        raise HTTPException(status_code=503, detail="Could not queue the download. Please try again.") from error

    return JobResponse(
        id=job_id, status="pending", progress=0,
        start_time=download_req.start_time, end_time=download_req.end_time,
    )


@router.get("/download/{download_id}/status", response_model=JobResponse)
async def get_download_status(download_id: uuid.UUID, redis: Redis = Depends(get_redis)):
    job = await redis.hgetall(job_key(str(download_id)))
    if not job:
        raise HTTPException(status_code=404, detail="Download not found")

    download_url = None
    if job.get("status") == "completed" and job.get("file_path") and os.path.isfile(job["file_path"]):
        download_url = f"/api/downloads/{download_id}/file"

    return JobResponse(
        id=str(download_id),
        status=job.get("status", "processing"),
        progress=int(float(job.get("progress") or 0)),
        error_message=job.get("error_message") or None,
        download_link=download_url,
        start_time=optional_float(job.get("start_time")),
        end_time=optional_float(job.get("end_time")),
    )


@router.get("/downloads/{download_id}/file")
async def download_file(download_id: uuid.UUID, redis: Redis = Depends(get_redis), settings: Settings = Depends(get_settings)):
    job = await redis.hgetall(job_key(str(download_id)))
    if not job or job.get("status") != "completed" or not job.get("file_path"):
        raise HTTPException(status_code=404, detail="File not found")
    output_path = os.path.realpath(job["file_path"])
    download_root = os.path.realpath(settings.DOWNLOAD_DIR)
    if not output_path.startswith(download_root + os.sep) or not os.path.isfile(output_path):
        raise HTTPException(status_code=410, detail="File has expired")

    is_playlist = job.get("scope") == "playlist"
    media_type = "application/zip" if is_playlist else ("audio/mpeg" if job.get("format") == "mp3" else "video/mp4")
    # The worker stores a sanitized filename; Starlette encodes non-ASCII via filename*=.
    filename = job.get("filename") or f"download.{'zip' if is_playlist else job.get('format', 'mp4')}"
    return FileResponse(output_path, media_type=media_type, filename=filename)
