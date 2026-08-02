#!/bin/sh
set -e

# Run migrations
alembic upgrade head

# Start Celery worker in background
celery -A app.tasks.celery_app.celery_app worker --loglevel=info --concurrency=2 &

# Start FastAPI
uvicorn app.main:app --host 0.0.0.0 --port 8000
