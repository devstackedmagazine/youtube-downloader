import asyncio
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from redis.asyncio import Redis

from app.config import get_settings
from app.schemas.download import DownloadCreate, JobResponse
from app.services.youtube import get_video_metadata, validate_youtube_url
from app.tasks.convert_video import convert_video_task

router = APIRouter()
JOB_TTL_SECONDS = 24 * 60 * 60


async def get_redis(settings=Depends(get_settings)):
    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


def job_key(job_id: str) -> str:
    return f"download:job:{job_id}"


@router.get("/metadata")
async def metadata(url: str):
    if not validate_youtube_url(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    try:
        data = await asyncio.wait_for(asyncio.to_thread(get_video_metadata, url), timeout=30)
    except TimeoutError as error:
        raise HTTPException(status_code=504, detail="Metadata lookup timed out. Please try again.") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return {
        "id": data.get("id"),
        "title": data.get("title", "Unknown Title"),
        "duration": data.get("duration", 0),
        "thumbnail": data.get("thumbnail_url"),
        "channel": data.get("channel", "Unknown Channel"),
        "formats": data.get("formats", []),
        "is_playlist": data.get("is_playlist", False),
        "playlist_count": data.get("playlist_count", 0),
        "playlist_title": data.get("playlist_title"),
    }


@router.post("/download", response_model=JobResponse)
async def create_download(download_req: DownloadCreate, redis: Redis = Depends(get_redis)):
    url = download_req.youtube_url
    if not validate_youtube_url(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    job_id = str(uuid.uuid4())
    key = job_key(job_id)
    await redis.hset(key, mapping={
        "id": job_id,
        "youtube_url": url,
        "format": download_req.format.value,
        "quality": download_req.quality,
        "scope": download_req.scope.value,
        "status": "pending",
        "progress": "0",
        "error_message": "",
    })
    await redis.expire(key, JOB_TTL_SECONDS)

    try:
        convert_video_task.delay(job_id)
    except Exception as error:
        await redis.hset(key, mapping={"status": "failed", "error_message": "Could not queue the download. Please try again."})
        raise HTTPException(status_code=503, detail="Could not queue the download. Please try again.") from error

    return JobResponse(id=job_id, status="pending", progress=0)


@router.get("/download/{download_id}/status", response_model=JobResponse)
async def get_download_status(download_id: str, redis: Redis = Depends(get_redis)):
    job = await redis.hgetall(job_key(download_id))
    if not job:
        raise HTTPException(status_code=404, detail="Download not found")

    download_url = None
    if job.get("status") == "completed" and job.get("file_path") and os.path.isfile(job["file_path"]):
        download_url = f"/api/downloads/{download_id}/file"

    return JobResponse(
        id=download_id,
        status=job.get("status", "processing"),
        progress=int(float(job.get("progress", 0))),
        error_message=job.get("error_message") or None,
        download_link=download_url,
    )


@router.get("/downloads/{download_id}/file")
async def download_file(download_id: str, redis: Redis = Depends(get_redis)):
    job = await redis.hgetall(job_key(download_id))
    if not job or job.get("status") != "completed" or not job.get("file_path"):
        raise HTTPException(status_code=404, detail="File not found")
    output_path = os.path.realpath(job["file_path"])
    download_root = os.path.realpath(get_settings().DOWNLOAD_DIR)
    if not output_path.startswith(download_root + os.sep) or not os.path.isfile(output_path):
        raise HTTPException(status_code=410, detail="File has expired")

    is_playlist = job.get("scope") == "playlist"
    media_type = "application/zip" if is_playlist else ("audio/mpeg" if job.get("format") == "mp3" else "video/mp4")
    extension = "zip" if is_playlist else job.get("format", "mp4")
    filename = f"{job.get('title', 'download')}.{extension}".replace("/", "-").replace("\\", "-")
    return FileResponse(output_path, media_type=media_type, filename=filename)
