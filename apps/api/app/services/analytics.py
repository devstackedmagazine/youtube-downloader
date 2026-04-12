from sqlalchemy.ext.asyncio import AsyncSession
from app.models.analytics import Analytics
from uuid import UUID
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)

async def log_event(
    db: AsyncSession,
    event_type: str,
    user_id: UUID = None,
    metadata: dict = None
):
    """
    Log an analytics event to database.
    
    Examples:
    - log_event(db, "signup", user_id=user.id)
    - log_event(db, "download_started", user_id=user.id, 
                metadata={"format": "mp4", "quality": "720p"})
    """
    try:
        # the model is using metadata_json instead of metadata because of collisions with SQLAlchemy Base
        event = Analytics(
            user_id=user_id,
            event_type=event_type,
            metadata_json=metadata or {},
            timestamp=datetime.utcnow()
        )
        db.add(event)
        await db.commit()
        logger.info(f"Event logged: {event_type} for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to log event: {str(e)}")
        # Don't raise - analytics failures shouldn't break main flow
