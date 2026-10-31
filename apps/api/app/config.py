import ssl
from functools import lru_cache
from typing import Literal
from urllib.parse import parse_qs, urlparse

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def redis_ssl_options(url: str) -> dict | None:
    """SSL options Celery/kombu need for a rediss:// URL that doesn't set ssl_cert_reqs itself.

    redis-py verifies certificates by default for rediss://, but Celery refuses a
    rediss:// URL without an explicit ssl_cert_reqs, so we supply CERT_REQUIRED.
    """
    parsed = urlparse(url)
    if parsed.scheme != "rediss" or "ssl_cert_reqs" in parse_qs(parsed.query):
        return None
    return {"ssl_cert_reqs": ssl.CERT_REQUIRED}


class Settings(BaseSettings):
    PROJECT_NAME: str = "YouTube Downloader API"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"

    # Redis is used for job state, rate limiting and as the Celery broker.
    # Use rediss:// for TLS (required by Upstash).
    REDIS_URL: str = "redis://localhost:6379/0"
    # Empty means "use REDIS_URL".
    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""

    # Comma-separated list; the first entry is the production frontend.
    FRONTEND_URL: str = "http://localhost:3000"
    # Optional regex for extra origins (e.g. Vercel previews). Empty disables it.
    CORS_ORIGIN_REGEX: str = ""
    # Comma-separated Host headers accepted by the API ("*" disables the check).
    TRUSTED_HOSTS: str = "localhost,127.0.0.1"
    # Set by Render to the service's onrender.com host; always trusted when present.
    RENDER_EXTERNAL_HOSTNAME: str = ""

    DOWNLOAD_DIR: str = "tmp_downloads"
    MAX_PLAYLIST_ITEMS: int = 100
    # Longest video (or clip) the server will process, in seconds.
    MAX_DURATION_SECONDS: int = 1800
    METADATA_TIMEOUT_SECONDS: int = 30
    RATE_LIMIT_REQUESTS: int = 30
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    # Comma-separated yt-dlp YouTube player clients. Empty uses yt-dlp's defaults.
    YT_PLAYER_CLIENTS: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("FRONTEND_URL")
    @classmethod
    def normalize_frontend_url(cls, value: str) -> str:
        return ",".join(origin.rstrip("/") for origin in split_csv(value))

    @property
    def celery_broker_url(self) -> str:
        return self.CELERY_BROKER_URL or self.REDIS_URL

    @property
    def celery_result_backend(self) -> str:
        return self.CELERY_RESULT_BACKEND or self.REDIS_URL

    @property
    def cors_origins(self) -> list[str]:
        # The production origin stays allowed even if FRONTEND_URL is misconfigured.
        always = ["https://dltube.vercel.app", "http://localhost:3000", "http://localhost:3001"]
        return list(dict.fromkeys(split_csv(self.FRONTEND_URL) + always))

    @property
    def trusted_hosts(self) -> list[str]:
        hosts = split_csv(self.TRUSTED_HOSTS)
        if not hosts or "*" in hosts:
            return ["*"]
        # Local hosts are always allowed so container health checks keep working.
        return list(dict.fromkeys(hosts + split_csv(self.RENDER_EXTERNAL_HOSTNAME) + ["localhost", "127.0.0.1"]))

    @property
    def yt_player_clients(self) -> list[str]:
        return split_csv(self.YT_PLAYER_CLIENTS)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
