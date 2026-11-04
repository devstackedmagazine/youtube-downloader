from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

MIN_CLIP_SECONDS = 1


class FormatEnum(str, Enum):
    mp4 = "mp4"
    mp3 = "mp3"


class DownloadScopeEnum(str, Enum):
    single = "single"
    playlist = "playlist"


class DownloadCreate(BaseModel):
    youtube_url: str = Field(..., min_length=5, max_length=2048, description="YouTube video URL")
    format: FormatEnum
    quality: str = Field(..., max_length=20)
    scope: DownloadScopeEnum = DownloadScopeEnum.single
    # Optional section in seconds. Start only = until the end; end only = from 0.
    start_time: Optional[float] = Field(None, ge=0)
    end_time: Optional[float] = Field(None, ge=0)

    @field_validator("youtube_url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        if not value or len(value.strip()) < 5:
            raise ValueError("Invalid YouTube URL")
        return value.strip()

    @property
    def is_clip(self) -> bool:
        return self.start_time is not None or self.end_time is not None

    @model_validator(mode="after")
    def validate_clip(self) -> "DownloadCreate":
        if not self.is_clip:
            return self
        if self.scope != DownloadScopeEnum.single:
            raise ValueError("Sections can only be downloaded from a single video, not a playlist")
        if self.end_time is not None:
            start = self.start_time or 0
            if start >= self.end_time:
                raise ValueError("Start time must be before end time")
            if self.end_time - start < MIN_CLIP_SECONDS:
                raise ValueError(f"The section must be at least {MIN_CLIP_SECONDS} second long")
        return self


class JobResponse(BaseModel):
    id: str
    status: str
    progress: int = 0
    eta_seconds: Optional[int] = None
    error_message: Optional[str] = None
    download_link: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
