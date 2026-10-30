#!/usr/bin/env bash
# Runs the Celery worker (with embedded beat) and the API in one container.
# If either process exits, the other is stopped and the container exits so the
# platform restarts it. SIGTERM stops both cleanly.
set -eu

celery -A app.tasks.celery_app.celery_app worker \
  --loglevel=info \
  --concurrency=1 \
  --max-memory-per-child="${CELERY_MAX_MEMORY_KB:-150000}" \
  --without-gossip --without-mingle --without-heartbeat \
  -B --schedule=/tmp/celerybeat-schedule &
celery_pid=$!

uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" &
uvicorn_pid=$!

stop() { kill -TERM "$celery_pid" "$uvicorn_pid" 2>/dev/null || true; }
trap stop TERM INT

status=0
wait -n || status=$?
echo "start.sh: a process exited (status $status); stopping the other" >&2
stop
wait || true
exit "$status"
