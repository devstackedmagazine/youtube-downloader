# PO-token provider for yt-dlp (bgutil, Deno "script" mode): only its server sources and
# production node_modules are kept; Node itself stays in this build stage.
FROM node:22-bookworm-slim AS pot
ARG BGUTIL_COMMIT=26475e9d3665b972c4aeb83b4dbaafcf64b88438
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && git clone --filter=blob:none https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /src \
    && git -C /src checkout --quiet "$BGUTIL_COMMIT"
WORKDIR /src/server
RUN npm ci --omit=dev --no-audit --no-fund

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

# The plugin's default server_home; it runs `deno run src/generate_once.ts` per token.
COPY --from=pot --chown=app:app /src/server/package.json /src/server/deno.json /src/server/deno.lock /src/server/tsconfig.json /home/app/bgutil-ytdlp-pot-provider/server/
COPY --from=pot --chown=app:app /src/server/src /home/app/bgutil-ytdlp-pot-provider/server/src
COPY --from=pot --chown=app:app /src/server/types /home/app/bgutil-ytdlp-pot-provider/server/types
COPY --from=pot --chown=app:app /src/server/node_modules /home/app/bgutil-ytdlp-pot-provider/server/node_modules
# Pre-compile so the first token isn't slowed by type-checking/caching on 0.1 CPU.
RUN cd /home/app/bgutil-ytdlp-pot-provider/server && su app -s /bin/sh -c "HOME=/home/app deno cache --frozen src/generate_once.ts"

COPY . .

# yt-dlp's YouTube challenge solver (Deno) needs ~215 MB RSS. It runs uncapped: at
# 512 MB the whole container peaked at 332 MiB. On a 256 MB host set
# DENO_V8_FLAGS=--max-old-space-size=64 so it fails fast instead of being OOM-killed.

USER app
# Render sets PORT (default 10000); start.sh falls back to 8000.
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/api/health', timeout=3)" || exit 1

CMD ["/app/start.sh"]
