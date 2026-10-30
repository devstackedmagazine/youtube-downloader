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

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)" || exit 1

CMD ["/app/start.sh"]
