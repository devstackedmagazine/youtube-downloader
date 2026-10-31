import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from redis.exceptions import RedisError
from starlette.datastructures import Headers
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import get_settings
from app.routes import downloads

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()
STARTUP_REDIS_ATTEMPTS = 5


async def wait_for_redis(client: Redis) -> None:
    """Retry with backoff, then start anyway: /api/ready reports the failure instead of a crash loop."""
    for attempt in range(1, STARTUP_REDIS_ATTEMPTS + 1):
        try:
            await client.ping()
            logger.info("Redis connection OK")
            return
        except Exception as error:
            delay = 2 ** (attempt - 1)
            logger.warning("Redis not reachable (attempt %d/%d): %r; retrying in %ds", attempt, STARTUP_REDIS_ATTEMPTS, error, delay)
            await asyncio.sleep(delay)
    logger.error("Redis still unreachable after %d attempts; starting anyway, /api/ready will return 503", STARTUP_REDIS_ATTEMPTS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    await wait_for_redis(app.state.redis)
    yield
    await app.state.redis.aclose()


class LoggingTrustedHostMiddleware(TrustedHostMiddleware):
    """Starlette's TrustedHostMiddleware, plus a log line saying which Host was rejected.

    /api/health is exempt: the platform's health checker may not send the public Host.
    """

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"] == "/api/health":
            await self.app(scope, receive, send)
            return
        if scope["type"] in ("http", "websocket") and not self.allow_any:
            host = Headers(scope=scope).get("host", "").split(":")[0]
            if not any(host == pattern or (pattern.startswith("*") and host.endswith(pattern[1:])) for pattern in self.allowed_hosts):
                logger.warning("Rejected request with Host %r; add it to TRUSTED_HOSTS if it is legitimate", host)
        await super().__call__(scope, receive, send)


app = FastAPI(
    title="YouTube Downloader API",
    description="Download YouTube videos as MP4 or MP3",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(LoggingTrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    # The frontend sends no cookies or auth headers.
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(downloads.router, prefix="/api")


@app.get("/api/health")
async def health():
    """Liveness only: no dependencies, so a Redis outage doesn't restart the container.

    ``commit`` (set by Render) shows which deploy is live.
    """
    return {"status": "ok", "commit": os.environ.get("RENDER_GIT_COMMIT", "")[:7]}


@app.get("/api/ready")
async def ready(request: Request):
    try:
        await asyncio.wait_for(request.app.state.redis.ping(), timeout=3)
    except Exception as error:
        logger.warning("Readiness check failed: Redis unreachable: %r", error)
        return JSONResponse(status_code=503, content={"status": "unavailable", "detail": "Redis is unreachable", "redis": "error"})
    return {"status": "ok", "redis": "ok"}


# Every error response is {"detail": "<human readable message>"}.
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    messages = []
    for error in exc.errors():
        message = str(error.get("msg", "Invalid value")).removeprefix("Value error, ")
        field = ".".join(str(part) for part in error.get("loc", ()) if part not in ("body", "query", "path"))
        messages.append(f"{field}: {message}" if field else message)
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages) or "Invalid request"})


@app.exception_handler(RedisError)
async def redis_exception_handler(request: Request, exc: RedisError):
    logger.error("Redis error on %s %s: %r", request.method, request.url.path, exc)
    return JSONResponse(status_code=503, content={"detail": "The service is temporarily unavailable. Please try again shortly."})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
