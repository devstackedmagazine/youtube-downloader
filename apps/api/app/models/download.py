from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base

class Download(Base):
    __tablename__ = "downloads"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    youtube_url = Column(String(255), nullable=False)
    video_id = Column(String(50), index=True)
    title = Column(String(500), nullable=False)
    format = Column(Enum("mp4", "mp3", name="format_enum"), nullable=False)
    quality = Column(String(20))  # "1080p", "720p", etc.
    file_size = Column(Integer)  # bytes
    status = Column(Enum("pending", "processing", "completed", "failed", name="status_enum"), default="pending")
    download_link = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer)
    thumbnail_url = Column(String(500), nullable=True)
    error_message = Column(String(500), nullable=True)
