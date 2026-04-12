from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.responses import APIResponse
from app.models.user import User
from app.models.download import Download
from app.dependencies import get_db, get_current_user
from app.security import hash_password
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/user", tags=["user"])

@router.get("/profile", response_model=APIResponse)
async def get_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user profile.
    """
    return APIResponse(
        data=UserResponse.from_orm(current_user),
        message="Profile retrieved"
    )

@router.put("/profile", response_model=APIResponse)
async def update_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user email or password.
    """
    try:
        if user_update.email:
            # Check if new email already exists
            result = await db.execute(
                select(User).where(User.email == user_update.email)
            )
            if result.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already in use"
                )
            current_user.email = user_update.email
        
        if user_update.password:
            current_user.password_hash = hash_password(user_update.password)
        
        current_user.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(current_user)
        
        logger.info(f"Profile updated for user: {current_user.id}")
        
        return APIResponse(
            data=UserResponse.from_orm(current_user),
            message="Profile updated successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profile update failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update failed"
        )

@router.get("/remaining-downloads", response_model=APIResponse)
async def get_remaining_downloads(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get remaining downloads for today.
    
    Free users: 5 downloads/day
    Premium users: unlimited (return infinity)
    """
    try:
        # Premium users have unlimited
        if current_user.is_premium:
            return APIResponse(
                data={
                    "remaining": float('inf'),
                    "limit": None,
                    "reset_at": None,
                    "is_premium": True
                },
                message="Unlimited downloads (premium)"
            )
        
        # Check downloads created today
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_start = today_start + timedelta(days=1)
        
        result = await db.execute(
            select(func.count(Download.id)).where(
                Download.user_id == current_user.id,
                Download.created_at >= today_start
            )
        )
        downloads_today = result.scalar() or 0
        
        remaining = max(0, 5 - downloads_today)
        
        return APIResponse(
            data={
                "remaining": remaining,
                "limit": 5,
                "reset_at": tomorrow_start.isoformat(),
                "is_premium": False
            },
            message=f"{remaining} downloads remaining today"
        )
    
    except Exception as e:
        logger.error(f"Failed to get remaining downloads: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch download limit"
        )
