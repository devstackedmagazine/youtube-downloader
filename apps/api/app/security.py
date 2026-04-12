from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.config import Settings
import logging
import bcrypt

logger = logging.getLogger(__name__)

def hash_password(password: str) -> str:
    """Hash password with bcrypt."""
    salt = bcrypt.gensalt()
    pwd_bytes = password.encode('utf-8')
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    pwd_bytes = plain_password.encode('utf-8')
    hash_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(pwd_bytes, hash_bytes)


def create_access_token(user_id: str, settings: Settings) -> str:
    """
    Create JWT access token (1 hour expiry).
    
    Payload: {
        "sub": user_id,
        "iat": issued_at_timestamp,
        "exp": expiry_timestamp
    }
    """
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=settings.JWT_EXPIRY)
    
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp())
    }
    
    token = jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    
    logger.info(f"Access token created for user {user_id}")
    return token

def create_refresh_token(user_id: str, settings: Settings) -> str:
    """
    Create JWT refresh token (7 day expiry).
    """
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=settings.REFRESH_TOKEN_EXPIRY)
    
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp())
    }
    
    token = jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return token

def verify_token(token: str, settings: Settings) -> dict:
    """
    Verify JWT token and return payload.
    Raises ValueError if token invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        logger.error(f"Token verification failed: {str(e)}")
        raise ValueError(f"Invalid token: {str(e)}")
