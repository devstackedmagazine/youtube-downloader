from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.dependencies import get_db
from app.models.download import Download
from app.models.user import User
from app.dependencies import get_current_user as current_user
from app.schemas.download import DownloadCreate, DownloadResponse, DownloadStatusResponse, DownloadListResponse
from app.services.youtube import get_video_metadata, validate_youtube_url
from app.tasks.convert_video import convert_video_task

router = APIRouter()

@router.post("/download", response_model=DownloadResponse)
async def create_download(
    download_req: DownloadCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user)
):
    """
    Initializes a new download job.
    1. Validates the YouTube URL.
    2. Fetches metadata (title, duration, thumbnail).
    3. Creates a `Download` record in PostgreSQL (status="pending").
    4. Triggers `convert_video_task` in Celery.
    """
    url = str(download_req.youtube_url)
    
    # 1. Validate the URL
    if not validate_youtube_url(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    # 2. Extract metadata synchronously via yt-dlp
    try:
        metadata = get_video_metadata(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 3. Create database record
    new_download = Download(
        id=str(uuid.uuid4()),
        user_id=user.id,
        youtube_url=url,
        title=metadata.get('title', 'Unknown Title'),
        format=download_req.format,
        quality=download_req.quality,
        status="pending",
        progress=0.0
    )
    db.add(new_download)
    await db.commit()
    await db.refresh(new_download)

    # 4. Enqueue the task with Celery
    convert_video_task.delay(new_download.id)

    return DownloadResponse.model_validate(new_download)

@router.get("/download/{download_id}/status", response_model=DownloadStatusResponse)
async def get_download_status(
    download_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user)
):
    """
    Returns the current status of a specific download job.
    """
    result = await db.execute(select(Download).filter(Download.id == download_id, Download.user_id == user.id))
    download = result.scalar_one_or_none()

    if not download:
        raise HTTPException(status_code=404, detail="Download not found")

    response_data = {
        "id": download.id,
        "status": download.status,
        "progress": download.progress,
        "error_message": download.error_message
    }
    
    # Expose the download URL only if completed
    if download.status == "completed" and download.file_path:
        response_data["download_url"] = f"/downloads/{download.id}/file" # Implement file serving route later

    return DownloadStatusResponse(**response_data)

@router.get("/downloads", response_model=DownloadListResponse)
async def list_downloads(
    skip: int = 0,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user)
):
    """
    Lists all previous downloads with basic pagination.
    """
    result = await db.execute(
        select(Download)
        .filter(Download.user_id == user.id)
        .order_by(Download.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    downloads = result.scalars().all()

    # Get total count
    count_result = await db.execute(
        select(db.func.count(Download.id)).filter(Download.user_id == user.id)
    )
    total = count_result.scalar_one()

    return DownloadListResponse(
        items=[DownloadResponse.model_validate(d) for d in downloads],
        total=total
    )

@router.delete("/downloads/{download_id}")
async def delete_download(
    download_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user)
):
    """
    Deletes the database record of a download.
    (Ideally should also remove the file from storage if it exists).
    """
    result = await db.execute(select(Download).filter(Download.id == download_id, Download.user_id == user.id))
    download = result.scalar_one_or_none()

    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
        
    import os
    # Small cleanup step
    if download.file_path and os.path.exists(download.file_path):
        try:
            os.remove(download.file_path)
        except Exception as e:
            print(f"Error removing file {download.file_path}: {e}")

    await db.delete(download)
    await db.commit()

    return {"detail": "Download record deleted"}
