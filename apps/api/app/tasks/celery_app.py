from celery import Celery

from app.config import get_settings, redis_ssl_options

settings = get_settings()

celery_app = Celery(
    "ytdl_tasks",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.convert_video", "app.tasks.cleanup"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_time_limit=3600,  # 1 hour max
    # Job state lives in our own Redis hash; nobody reads Celery results, so
    # don't store them (saves Upstash commands and memory).
    task_ignore_result=True,
    result_expires=3600,
    worker_prefetch_multiplier=1,
    # The remote-control mailbox is unused and costs Redis traffic.
    worker_enable_remote_control=False,
    broker_connection_retry_on_startup=True,
    # An idle worker issues one BRPOP per polling interval (kombu default: 1s,
    # ~86k commands/day). A blocking BRPOP still returns as soon as a job arrives.
    broker_transport_options={"polling_interval": 30},
    # No beat_schedule: expired files are removed at the start of each job
    # (app.tasks.convert_video), which avoids a separate beat process.
    broker_use_ssl=redis_ssl_options(settings.celery_broker_url),
    redis_backend_use_ssl=redis_ssl_options(settings.celery_result_backend),
)
