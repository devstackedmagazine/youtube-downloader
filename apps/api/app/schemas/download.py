from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class FormatEnum(str, Enum):
    mp4 = "mp4"
    mp3 = "mp3"


class DownloadScopeEnum(str, Enum):
    single = "single"
    playlist = "playlist"


class DownloadCreate(BaseModel):
    youtube_url: str = Field(..., description="YouTube video URL")
    format: FormatEnum
    quality: str
    scope: DownloadScopeEnum = DownloadScopeEnum.single

    @field_validator("youtube_url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        if not value or len(value.strip()) < 5:
            raise ValueError("Invalid YouTube URL")
        return value.strip()


class JobResponse(BaseModel):
    id: str
    status: str
    progress: int = 0
    eta_seconds: Optional[int] = None
    error_message: Optional[str] = None
    download_link: Optional[str] = None
