from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    REDIS_URL: str = "redis://localhost:6379/0"
    PROJECT_NAME: str = "YouTube Downloader API"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    FRONTEND_URL: str = "http://localhost:3000"
    DOWNLOAD_DIR: str = "tmp_downloads"
    MAX_PLAYLIST_ITEMS: int = 100
    RATE_LIMIT_REQUESTS: int = 30
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    YT_PLAYER_CLIENTS: str = "android,web"
    TRUSTED_HOSTS: str = "localhost,127.0.0.1"

    @field_validator("FRONTEND_URL")
    @classmethod
    def normalize_frontend_url(cls, value: str) -> str:
        return value.rstrip("/")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings():
    return Settings()

settings = get_settings()

