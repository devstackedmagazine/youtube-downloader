FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# The yt-dlp "deno" extra installs the Deno binary; fail the build if it's missing.
RUN pip install -r requirements.txt && deno --version

# Writable home for yt-dlp/Deno caches; only the download dir is writable in /app.
RUN addgroup --system app && adduser --system --ingroup app --home /home/app app \
    && mkdir -p /app/tmp_downloads && chown app:app /app/tmp_downloads

COPY . .

# yt-dlp's YouTube challenge solver (Deno) needs ~215 MB RSS, more than a 256 MB
# container has left. Cap the heap so it fails fast (yt-dlp then falls back to
# formats that need no solving) instead of the kernel OOM-killing another process.
# Raise or clear this when the container has >= 512 MB.
ENV DENO_V8_FLAGS=--max-old-space-size=64

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)" || exit 1

CMD ["/app/start.sh"]
