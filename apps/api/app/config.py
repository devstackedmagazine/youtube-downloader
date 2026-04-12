from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "YouTube Downloader API"
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str
    
    JWT_SECRET: str = "your-super-secret-jwt-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY: int = 3600
    REFRESH_TOKEN_EXPIRY: int = 604800
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings():
    return Settings()

settings = get_settings()

