"""Maintenance tasks for files not covered by Redis key expiry."""

import shutil
import time
from pathlib import Path

from app.config import get_settings
from app.tasks.celery_app import celery_app

JOB_TTL_SECONDS = 24 * 60 * 60


@celery_app.task(name="app.tasks.cleanup.remove_expired_downloads")
def remove_expired_downloads() -> int:
    """Remove completed and abandoned job files after their download window expires."""
    root = Path(get_settings().DOWNLOAD_DIR).resolve()
    if not root.exists():
        return 0

    cutoff = time.time() - JOB_TTL_SECONDS
    removed = 0
    for entry in root.iterdir():
        try:
            if entry.stat().st_mtime >= cutoff:
                continue
            if entry.is_dir():
                shutil.rmtree(entry)
            else:
                entry.unlink()
            removed += 1
        except FileNotFoundError:
            continue
    return removed
