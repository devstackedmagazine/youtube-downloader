from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.schemas.user import (
    UserCreate, UserLogin, UserResponse, PasswordResetRequest,
    PasswordResetConfirm, RefreshTokenRequest, TokenResponse, AuthResponse
)
from app.schemas.responses import APIResponse
from app.models.user import User
from app.security import hash_password, verify_password, create_access_token, create_refresh_token, verify_token
from app.dependencies import get_db, get_current_user
from app.config import get_settings
from app.services.analytics import log_event
from uuid import UUID
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup", status_code=201, response_model=APIResponse)
async def signup(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    settings = Depends(get_settings)
):
    """
    Create new user account.
    
    Requirements:
    - Email must be unique
    - Password min 8 chars, uppercase + number
    - Send welcome email (Celery task)
    - Return user + tokens
    """
    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    existing_user = result.scalars().first()
    
    if existing_user:
        logger.warning(f"Signup attempt with existing email: {user_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    try:
        # Create new user
        new_user = User(
            email=user_data.email,
            password_hash=hash_password(user_data.password)
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        logger.info(f"New user created: {new_user.id}")
        
        # Create tokens
        access_token = create_access_token(str(new_user.id), settings)
        refresh_token = create_refresh_token(str(new_user.id), settings)
        
        # Log analytics event
        await log_event(db, "signup", user_id=new_user.id)
        
        # TODO: Queue welcome email (Celery task)
        # send_welcome_email.delay(user_data.email)
        
        return APIResponse(
            data=AuthResponse(
                user=UserResponse.from_orm(new_user),
                tokens=TokenResponse(
                    access_token=access_token,
                    refresh_token=refresh_token,
                    expires_in=settings.JWT_EXPIRY
                )
            ),
            message="User created successfully"
        )
    
    except Exception as e:
        logger.error(f"Signup failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

@router.post("/login", response_model=APIResponse)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db),
    settings = Depends(get_settings)
):
    """
    Authenticate user and return tokens.
    """
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == credentials.email)
    )
    user = result.scalars().first()
    
    # Verify credentials
    if not user or not verify_password(credentials.password, user.password_hash):
        logger.warning(f"Failed login attempt for: {credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    try:
        # Create tokens
        access_token = create_access_token(str(user.id), settings)
        refresh_token = create_refresh_token(str(user.id), settings)
        
        # Log analytics
        await log_event(db, "login", user_id=user.id)
        
        logger.info(f"User logged in: {user.id}")
        
        return APIResponse(
            data=AuthResponse(
                user=UserResponse.from_orm(user),
                tokens=TokenResponse(
                    access_token=access_token,
                    refresh_token=refresh_token,
                    expires_in=settings.JWT_EXPIRY
                )
            ),
            message="Login successful"
        )
    
    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/refresh-token", response_model=APIResponse)
async def refresh_token_endpoint(
    refresh_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
    settings = Depends(get_settings)
):
    """
    Generate new access token using refresh token.
    """
    try:
        # Verify refresh token
        payload = verify_token(refresh_data.refresh_token, settings)
        
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
        
        user_id = payload.get("sub")
        
        if not user_id:
            raise ValueError("Invalid token payload")
        
        # Verify user still exists
        result = await db.execute(
            select(User).where(User.id == UUID(user_id))
        )
        user = result.scalars().first()
        
        if not user:
            raise ValueError("User not found")
        
        # Generate new access token
        access_token = create_access_token(user_id, settings)
        
        logger.info(f"Token refreshed for user: {user_id}")
        
        return APIResponse(
            data={"access_token": access_token, "token_type": "bearer"},
            message="Token refreshed"
        )
    
    except ValueError as e:
        logger.warning(f"Token refresh failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )

@router.post("/password-reset", response_model=APIResponse)
async def request_password_reset(
    reset_data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    settings = Depends(get_settings)
):
    """
    Request password reset.
    Send email with reset link (but DON'T reveal if email exists).
    """
    try:
        result = await db.execute(
            select(User).where(User.email == reset_data.email)
        )
        user = result.scalars().first()
        
        if user:
            # Generate reset token (short-lived)
            reset_token = create_access_token(str(user.id), settings)
            
            # TODO: Send email with reset link
            # send_password_reset_email.delay(reset_data.email, reset_token)
            
            logger.info(f"Password reset requested for: {reset_data.email}")
        else:
            # Don't reveal if email exists (security best practice)
            logger.info(f"Password reset requested for non-existent email: {reset_data.email}")
        
        # Always return same message (security)
        return APIResponse(
            message="If email exists, password reset link sent"
        )
    
    except Exception as e:
        logger.error(f"Password reset request failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset request failed"
        )

@router.post("/reset-password-confirm", response_model=APIResponse)
async def confirm_password_reset(
    reset_data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
    settings = Depends(get_settings)
):
    """
    Complete password reset with token.
    """
    try:
        # Verify reset token
        payload = verify_token(reset_data.token, settings)
        user_id = payload.get("sub")
        
        if not user_id:
            raise ValueError("Invalid token")
        
        # Get user
        result = await db.execute(
            select(User).where(User.id == UUID(user_id))
        )
        user = result.scalars().first()
        
        if not user:
            raise ValueError("User not found")
        
        # Update password
        user.password_hash = hash_password(reset_data.new_password)
        await db.commit()
        
        logger.info(f"Password reset for user: {user_id}")
        
        return APIResponse(
            message="Password reset successful"
        )
    
    except ValueError as e:
        logger.warning(f"Password reset failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset token"
        )
    except Exception as e:
        logger.error(f"Password reset error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed"
        )
