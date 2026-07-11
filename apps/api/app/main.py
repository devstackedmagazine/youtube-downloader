from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from redis.asyncio import Redis
from app.config import get_settings
from app.routes import downloads
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Fail fast when the queue backend is unavailable."""
    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        await client.ping()
        yield
    finally:
        await client.aclose()

# Create app
app = FastAPI(
    title="YouTube Downloader API",
    description="Download YouTube videos as MP4 or MP3",
    version="1.0.0",
    docs_url=None if settings.ENVIRONMENT == "production" else "/api/docs",
    redoc_url=None if settings.ENVIRONMENT == "production" else "/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[host.strip() for host in settings.TRUSTED_HOSTS.split(",") if host.strip()],
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(downloads.router, prefix="/api")

# Health check
@app.get("/api/health")
async def health():
    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        await client.ping()
    except Exception as error:
        logger.warning("Health check failed: %s", error)
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    finally:
        await client.aclose()
    return {"status": "ok"}


# Validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={
            "data": None,
            "error": "Validation error",
            "message": str(exc.errors())
        },
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
