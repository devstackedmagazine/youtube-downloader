import os
from celery import Celery

# Redis connection details from environment variables or defaults
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Initialize Celery app
celery_app = Celery(
    "ytdl_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.convert_video"]
)

# Optional configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
)
