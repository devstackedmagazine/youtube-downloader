#!/usr/bin/env bash
# Runs the Celery worker and the API in one container.
# If either process exits, the other is stopped and the container exits so the
# platform restarts it. SIGTERM stops both cleanly.
set -eu

celery -A app.tasks.celery_app.celery_app worker \
  --loglevel=info \
  --concurrency=1 \
  --max-memory-per-child="${CELERY_MAX_MEMORY_KB:-150000}" \
  --without-gossip --without-mingle --without-heartbeat &
celery_pid=$!

uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" &
uvicorn_pid=$!

# Celery gets QUIT (cold shutdown): a warm shutdown waits out the 30s broker poll,
# and an in-flight job can't survive a container stop anyway (ephemeral disk).
stop() {
  kill -TERM "$uvicorn_pid" 2>/dev/null || true
  kill -QUIT "$celery_pid" 2>/dev/null || true
}
trap stop TERM INT

status=0
wait -n || status=$?
echo "start.sh: a process exited (status $status); stopping the other" >&2
stop
# After its cold shutdown the worker may still sit in a blocking BRPOP (up to the
# 30s broker poll); nothing is left to clean up, so don't make the platform wait.
( sleep 5; kill -KILL "$celery_pid" 2>/dev/null ) &
wait "$celery_pid" "$uvicorn_pid" 2>/dev/null || true
exit "$status"
