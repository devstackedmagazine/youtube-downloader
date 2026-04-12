from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.security import verify_token
from app.database import DatabaseManager
from sqlalchemy import select
from app.models.user import User
from uuid import UUID
import logging

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_db() -> AsyncSession:
    """Database session dependency."""
    settings = get_settings()
    db_manager = DatabaseManager(settings.DATABASE_URL)
    async with db_manager.async_session() as session:
        yield session

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    settings = Depends(get_settings)
) -> User:
    """
    Extract user from JWT token.
    Raises 401 if token invalid or user not found.
    """
    try:
        payload = verify_token(token, settings)
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Query database for user
        result = await db.execute(
            select(User).where(User.id == UUID(user_id))
        )
        user = result.scalars().first()
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    
    except Exception as e:
        logger.error(f"Auth error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
