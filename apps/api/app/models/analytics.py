from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base

class Analytics(Base):
    __tablename__ = "analytics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    event_type = Column(String(50), index=True)  # "signup", "download", "error", etc.
    metadata_json = Column(JSON, nullable=True) # Changed from generic 'metadata' to avoid conflict with Base.metadata
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
