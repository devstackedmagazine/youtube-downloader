from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from enum import Enum

class FormatEnum(str, Enum):
    mp4 = "mp4"
    mp3 = "mp3"

class QualityEnum(str, Enum):
    # MP4 qualities
    quality_1080p = "1080p"
    quality_720p = "720p"
    quality_480p = "480p"
    quality_360p = "360p"
    quality_240p = "240p"
    # MP3 bitrates
    bitrate_320 = "320kbps"
    bitrate_256 = "256kbps"
    bitrate_128 = "128kbps"

class DownloadCreate(BaseModel):
    youtube_url: str = Field(..., description="YouTube video URL")
    format: FormatEnum
    quality: str  # Will validate based on format
    
    @validator('youtube_url')
    def validate_url(cls, v):
        if not v or len(v) < 5:
            raise ValueError('Invalid YouTube URL')
        return v.strip()

class DownloadResponse(BaseModel):
    id: UUID
    title: str
    format: str
    quality: str
    status: str
    created_at: datetime
    duration_seconds: Optional[int] = None
    thumbnail_url: Optional[str] = None
    download_link: Optional[str] = None
    file_size: Optional[int] = None
    error_message: Optional[str] = None
    
    class Config:
        from_attributes = True

class DownloadStatusResponse(BaseModel):
    id: UUID
    status: str
    progress: int  # 0-100
    eta_seconds: Optional[int] = None
    error_message: Optional[str] = None
    download_link: Optional[str] = None

class DownloadListResponse(BaseModel):
    downloads: List[DownloadResponse]
    pagination: dict  # {page, limit, total, pages}
