# Agent report: stabilize dltube and add section downloads

Branch: `agent/stabilize-and-clip` (from `master` @ `1e0e310`). Date: 2026-10-30. No secrets appear anywhere in this report.

## 1. Summary

- **What I found.** The API container could not start. `start.sh` runs `alembic upgrade head` under `set -e`, but the Postgres/SQLAlchemy/Alembic layer was **deliberately removed** in `e32a518` (job state moved to Redis) and Alembic is no longer installed, so the container exited right away. Production `/api/health` returned **HTTP 503 with an empty body** (Northflank's edge, so no healthy container), which matches this.
- **The rebase.** It did **not** lose any fix that still matters. Fatlum's commit `812082d` (asyncpg, psycopg2, metadata endpoint) patched the old DB-backed code. The Redis-only version that won already had a better metadata endpoint and needs no DB drivers.
- **Other breakage.**
  - Celery read `REDIS_URL` directly and had no TLS settings, so `rediss://` would fail.
  - The progress hook wrote to Redis on every chunk callback (Upstash quota).
  - CORS used an invalid wildcard.
  - TrustedHost had been removed.
  - Errors came in two shapes.
  - Nothing ran the cleanup schedule.
- **What I changed.** A working image and start script, hardened config/Redis/CORS/error handling, a yt-dlp extractor allow-list (SSRF), a duration limit, `/api/ready`, and the new **"download a section"** feature on both API and web. There are 75 backend tests and 6 frontend utility tests.
- **Does it work now?** Locally yes. With the production image and `--memory=256m`, the full MP4, clip MP4 and clip MP3 all completed and the clip lengths are exact. The main open risk is the **256 MB limit**: YouTube's JS challenge solver (Deno) needs about 215 MB, so on this plan yt-dlp runs in a degraded mode where some formats may be missing (section 5, "Not fixed").

## 2. How a request flows

```
/download page (app/download/page.tsx)
 └ URLInput → fetchMetadata()          lib/api.ts → GET  {API}/api/metadata?url=
     routes/downloads.metadata → rate limit (Redis INCR/EXPIRE) → yt-dlp in a thread (30 s timeout,
     YouTube extractors only, player JS skipped) → JSON
 └ FormatSelector (+ SectionPicker) → startDownload()  → POST {API}/api/download
     DownloadCreate (pydantic: format, scope, start/end rules) → rate limit
     → single video: one metadata lookup (live? playlist? duration? clip ≤ duration? length ≤ MAX_DURATION_SECONDS?)
     → Redis HSET download:job:<uuid> (TTL 24 h) → convert_video_task.delay(id)  (Celery, Redis broker)
 └ Celery worker (same container): removes expired files → yt-dlp download
     (download_ranges + force_keyframes_at_cuts for sections) → mp3 extract / AAC fix → zip for playlists
     → progress and final state written to the Redis job hash (file_path, filename)
 └ page polls getDownloadStatus() every 1.2 s → GET {API}/api/download/<uuid>/status
 └ "Save the file" link → GET {API}/api/downloads/<uuid>/file   (path confined to DOWNLOAD_DIR,
     Content-Disposition built from the stored sanitized filename)
 └ cleanup: files older than 24 h are deleted before each new job; Redis keys expire after 24 h
```

There is **no database**. The brief describes Postgres, asyncpg/psycopg2, Alembic migrations, a Postgres service in docker-compose, mock auth functions in api.ts, `packages/types` and `apps/web/apps`. None of these exist in the current code, apart from empty, untracked directories. Section 6, decision 1 covers what that means.

### Frontend ↔ backend contract

Every API error body is now `{"detail": "<message>"}`. The one exception is a rejected Host header, which gets Starlette's plain-text `Invalid host header`. `api.ts` reads `detail`, then `message`, then `error` (including FastAPI's list-shaped `detail`), and shows a network-error message if the request never reaches the server.

| Frontend call | Method + path | Request | Success response | Errors |
|---|---|---|---|---|
| `fetchMetadata` | GET `/api/metadata?url=` | `url` (≤ 2048 chars) | `{id, title, duration, thumbnail, channel, formats[], is_live, is_playlist, playlist_count, playlist_title, max_duration_seconds}` | 400 bad/non-YouTube URL or yt-dlp error · 422 · 429 · 503 Redis down · 504 timeout |
| `startDownload` | POST `/api/download` | `{youtube_url, format: mp4\|mp3, quality, scope: single\|playlist, start_time?, end_time?}`, times in seconds ≥ 0 or null | `{id, status:"pending", progress, eta_seconds, error_message, download_link, start_time, end_time}` | 400 · 422 (clip rules, live, playlist-as-single, too long, unknown length) · 429 · 503 (Redis/queue) · 504 |
| `getDownloadStatus` | GET `/api/download/{uuid}/status` | none | same job shape; `download_link` is set when completed | 404 unknown · 422 not a UUID · 503 |
| `<a download>` | GET `/api/downloads/{uuid}/file` | none | the file (`video/mp4`, `audio/mpeg`, `application/zip`) | 404 · 410 expired or outside the download dir · 422 |
| none (ops) | GET `/api/health` | none | `{"status":"ok"}`, no dependencies | none |
| none (ops) | GET `/api/ready` | none | `{"status":"ok","redis":"ok"}` | 503 `{"status":"unavailable","detail":"Redis is unreachable","redis":"error"}` |

Before this branch: validation errors returned `{data, error, message}`, which api.ts ignored (users only ever saw "Failed to …"), and job IDs were not validated.

## 3. Changes by file

| File | Change and reason |
|---|---|
| `apps/api/start.sh` | Removed `alembic upgrade head`, which is why the container crashed on start. It now runs the Celery worker (`--concurrency=1`, `--max-memory-per-child`, `--without-gossip/mingle/heartbeat`) and uvicorn. If either process exits, the other is stopped and the container exits with that status. SIGTERM stops uvicorn and cold-stops Celery, and Celery is killed if it's still blocked 5 s later. Stop time went from 20 s plus SIGKILL to 5.2 s. |
| `apps/api/Dockerfile` | Non-root user again (it had been dropped in `1e0e310`); HEALTHCHECK restored (docker-compose's `web` service depended on it); env for no .pyc and unbuffered output; build fails if Deno is missing; `DENO_V8_FLAGS=--max-old-space-size=64` (section 6, decision 4). |
| `apps/api/requirements.txt` | Deduplicated and pinned, with no major-version bumps. FastAPI 0.162, uvicorn 0.54, pydantic 2.14, pydantic-settings 2.16, celery 5.6.3, redis 5.3.1 (kept on 5.x), and `yt-dlp[default,deno]==2026.10.26`. The `default` extra brings yt-dlp-ejs/requests/certifi; `deno` installs the Deno runtime, the officially supported way. Dropped unused stripe, sendgrid, ffmpeg-python and python-dotenv (pydantic-settings pulls it in itself). |
| `apps/api/requirements-dev.txt` | New: pytest and httpx, kept out of the image. |
| `apps/api/.dockerignore`, `/.gitignore` | Exclude venvs, caches, logs, tmp_downloads, `.env*` and tests from the image; ignore runtime and build output in git. Nothing junk was tracked. |
| `apps/api/.env.example` | Every setting with dummy values only, including a scoped `CORS_ORIGIN_REGEX` example and the TRUSTED_HOSTS format. |
| `app/config.py` | Single source of settings. Celery URLs fall back to `REDIS_URL`; `redis_ssl_options()` adds `ssl_cert_reqs=CERT_REQUIRED` for `rediss://` (Celery refuses `rediss://` without it). New settings: `CORS_ORIGIN_REGEX`, `MAX_DURATION_SECONDS` (1800), `METADATA_TIMEOUT_SECONDS`. `FRONTEND_URL` takes a comma-separated list. `YT_PLAYER_CLIENTS` was hard-coded and ignored; it's now used, and empty means yt-dlp's maintained defaults. |
| `app/main.py` | Startup retries Redis 5 times with backoff and logs it, then starts anyway. One shared Redis pool. `/api/ready`. TrustedHost re-enabled and logs rejected hosts; localhost is always allowed. CORS lists origins explicitly, with optional regex, `allow_credentials=False`, and GET/POST only. Handlers for 422, RedisError (→ 503) and 500. |
| `app/routes/downloads.py` | Section fields, validation against the video (`check_against_video`), fail-closed checks (playlist submitted as single, unknown duration), UUID path params, filename stored by the worker, queue/Redis failures → 503 with a log line. yt-dlp runs in a thread with a timeout; one lookup per request. |
| `app/schemas/download.py` | `start_time`/`end_time` (≥ 0); request-level rules: start < end, at least 1 s, single scope only. |
| `app/services/youtube.py` | `base_ydl_options()` shared by API and worker: `allowed_extractors=["youtube","youtube:.*"]` (SSRF), socket timeout, player clients. Metadata skips player JS (no Deno in the API process); `single=True` ignores `&list=`; reports `is_live`. |
| `app/tasks/celery_app.py` | Broker/backend from settings plus TLS options; `task_ignore_result`, `result_expires`, `polling_interval=30`, remote control off, prefetch 1. The beat schedule was removed (section 6, decision 2). |
| `app/tasks/convert_video.py` | `clip_options()` (download_ranges + force_keyframes_at_cuts + single-thread veryfast x264); `output_filename()` gives `Title [00m05s-00m12s].mp4`; `make_match_filter()` enforces live/length limits per item; progress is monotonic and throttled, and advances per finished stream for clips; single jobs are capped at one playlist item; `noprogress`; cleanup runs before each job; failures are logged. |
| `apps/api/tests/*` | 75 tests: config/TLS/CORS, health/ready, metadata, download plus every clip rule, status and file serving (traversal, filename header), yt-dlp option builders, filename and match filter. yt-dlp and Celery are mocked; Redis is an in-memory fake (no new dependency). |
| removed | `apps/api/main.py`, `app/middleware.py` and `alembic/env.py` (all empty); `app/api.py` and `services/converter.py` (never imported); `apps/web/src/app/api/*` proxy routes (unused, since api.ts calls the API directly); `dependabot-alerts.json` (a saved GitHub "401 Requires authentication" response). |
| `docker-compose.yml`, `README.md` | `api` runs worker and API like production, so the duplicate `worker`/`beat` services that would double-consume jobs are gone. README note on cleanup updated. `apps/web/Dockerfile` **kept**: docker-compose's `web` service uses it. |
| `apps/web/src/lib/time.ts` (+ `time.test.mjs`) | Pure `parseTime` (ss, mm:ss, hh:mm:ss), `formatTime`, and `checkClip`, which mirrors the API rules. |
| `apps/web/src/components/SectionPicker.tsx` | Labelled start/end inputs, "From the start" and "To the end" buttons, two labelled range sliders with `aria-valuetext`, and a live length/error message (`aria-live`). |
| `apps/web/src/components/FormatSelector.tsx` | "Whole video / Download a section" toggle (`aria-pressed`), hidden for playlists, live streams and unknown durations. The download button is disabled while input is invalid. Videos over the server limit get a "download a section instead" message. Its private `formatDuration` was replaced by `formatTime`. |
| `apps/web/src/lib/api.ts`, `types/index.ts`, `app/download/page.tsx` | Shared error-message reader; sends `start_time`/`end_time`; types for `is_live`, `max_duration_seconds` and `ClipRange`. |
| `apps/web/package.json` | Added `test` (Node's built-in runner with type stripping, no new dependency) and `typecheck` scripts. |

Commits: `6d62a43` hygiene · `2e52ed9` image/start · `78776ee` hardening + section feature · `0c2369a` length-limit bypass fix (flagged by an automated security review during the session) · `6bc4cee` web feature · `35554d1` 256 MB / shutdown fixes · this report.

## 4. Test results

| What | Result |
|---|---|
| Backend pytest, Python 3.12 venv and **Python 3.11 inside the production image** | **75 passed** (1 harmless Starlette/httpx TestClient deprecation warning) |
| Frontend `node --test` on `time.ts` | **6 passed** (parsing, formatting, every clip rule, tolerance, long video with short clip) |
| `npm run lint` | 0 errors; 1 existing warning (`MotionShowcase.tsx` `<img>`), not touched |
| `tsc --noEmit` | passes |
| `next build` with `NEXT_PUBLIC_API_URL=https://api.example.invalid` | passes, 3 static routes |
| yt-dlp in the image | `JS runtimes: deno-2.9.8`; `yt_dlp_ejs-0.8.0` present; ffmpeg 7.1.5; runs as uid `app` |
| Local stack (`docker compose -p dltube-agent`, Redis + API image, **`mem_limit: 256m`**) | health 200; ready 200; non-YouTube and look-alike URLs 400; clip start>end 422; clip on playlist 422; non-UUID 422; bad Host 400 plus log line; CORS allows the configured origin and refuses others |
| Redis outage (Redis container stopped) | `/api/health` 200; `/api/ready` 503 naming Redis; metadata and status give clean 503 JSON plus log lines; no restart; Celery reconnected 2 s after Redis returned |
| Live: metadata (test video) | 200 in **5.4 s** (duration 19, not live) |
| Live: full MP4 | POST 5.9 s, job **13.7 s**, progress 0→5→92→100, ffprobe **19.02 s** (AV1 320×240 + AAC; the source is 240p), `filename*=…Me%20at%20the%20zoo.mp4` |
| Live: clip MP4 5→12 s | POST 7.1 s, job **9.8 s**, progress 0→5→40→100, ffprobe **7.000 s** (H.264), filename `Me at the zoo [00m05s-00m12s].mp4` |
| Live: clip MP3 5→12 s | POST 7.2 s, job **8.1 s**, ffprobe **7.032 s**, filename `… [00m05s-00m12s].mp3` |
| Memory at idle (cgroup) | 160 MiB with embedded beat → 134 MiB without → **127 MiB** final |
| Memory under load | **OOM at 256 MiB, twice.** Run 1: libx264 defaults plus beat → the kernel killed **uvicorn**; `start.sh` stopped the worker and exited as designed. Run 2: after the x264 and beat fixes, both clip jobs completed, but **Deno (~215 MiB RSS) was OOM-killed 4×** and yt-dlp continued degraded. Peak was 256 MiB both times. |
| Deno probe (1 run, no memory limit, heap capped at 96 MB) | the solver ran out of V8 heap; yt-dlp warned `n challenge solving failed: Some formats may be missing` and still exited 0. |
| Idle Redis traffic (app connections only, 180 s) | 6 BRPOP + about 5 housekeeping commands, about **5–6k commands/day (~160–180k/month)**. With kombu's default 1 s polling it would be ~86k/day (~2.6 M/month) from BRPOP alone. |
| Shutdown | `docker stop` **5.2 s**, exit 143 (it was 20 s and SIGKILL). uvicorn killed → container exits in 5 s with its status. |
| Production | One GET `https://p01--…code.run/api/health` at 14:51 UTC: **HTTP 503, empty body, 0.76 s**. |

**Not tested, and why:**
- **Live calls were capped at about 10 YouTube requests, and I used 10.** As a result, the last two changes (skipping player JS for metadata; Deno heap cap of 64 MB) are covered by unit tests and an offline Deno check, but not by a live job.
- **Peak memory of the final image during a clip job was not measured**, for the same reason. The expected outcome is that Deno aborts at its 64 MB heap instead of the kernel choosing a victim. Please watch this on the first production jobs.
- **No browser run of the new UI.** I did not drive a browser, so mobile width and keyboard-only use were checked by code review only: every control is a native, labelled `input`/`button`, the toggles use `aria-pressed`, and the layout is one column below `sm`. Also covered by build, typecheck and lint.
- **Migrations:** not applicable, because there is no database (section 6, decision 1).

## 5. Issues found

### Fixed
| Severity | Issue |
|---|---|
| Critical | Container exits on start (`alembic upgrade head` with no Alembic or DB). |
| Critical | Celery ignored `CELERY_BROKER_URL` and had no `rediss://` SSL options, so queueing fails on Upstash ("Could not queue the download"). |
| High | Upstash quota: a 1 s idle BRPOP (~2.6 M/month) and a Redis write on every yt-dlp progress callback. Celery results were stored but never read. |
| High | OOM at 256 MB during clip re-encode (libx264 defaults on every core) and from the beat process. |
| High | SSRF / resource abuse: yt-dlp accepted any extractor once the regex passed, and there was no duration limit. Live streams were not rejected. |
| Medium | Length limit bypass (single scope with a pure playlist URL, or unknown duration); found by the security review during the session and fixed in `0c2369a`. |
| Medium | Invalid CORS wildcard `https://*.vercel.app`, plus `allow_credentials=True`. |
| Medium | Nothing ran the cleanup task, so the 1 GB disk would fill. |
| Medium | Two error shapes, so users never saw the real message. |
| Medium | Progress went backwards (separate video and audio streams). |
| Low | Non-root user and HEALTHCHECK had been dropped; docker-compose had duplicate worker/beat services; job IDs not validated; `YT_PLAYER_CLIENTS` ignored. |
| Low | Dead files, unused proxy routes, the committed 401 JSON. |

### Not fixed
| Severity | Issue | Recommendation |
|---|---|---|
| **High** | **256 MB is too small for yt-dlp's YouTube challenge solver (~215 MB).** Downloads work in degraded mode ("some formats may be missing"). If YouTube makes the challenge mandatory for all formats, downloads will fail. | More RAM (≥ 512 MB) or a separate worker service; both are paid or architectural, so see "Needs Fatlum". Then clear `DENO_V8_FLAGS`. |
| Medium | **Rate limiting may group all users together.** Behind Northflank's proxy, `request.client.host` is probably the proxy IP (uvicorn only trusts `X-Forwarded-For` from 127.0.0.1), so everyone may share 30 requests/minute. Not verified. | Find Northflank's ingress IP range and set `FORWARDED_ALLOW_IPS` to it. Don't use `*`, which lets clients spoof the header. |
| Medium | If the container restarts mid-job, the job stays "processing" until its 24 h TTL, and the page keeps polling (Redis commands). | Mark stale jobs failed after `task_time_limit`, and stop polling after N minutes. |
| Medium | API and worker share 0.1 vCPU, so the API is slow while ffmpeg runs. | Separate worker service. |
| Low | Full MP4s can be AV1 ("best regardless of codec"), which some players (older iOS/QuickTime) can't play. Existing behavior. | Prefer `vcodec:h264` via `format_sort`. |
| Low | Unhandled 500 responses lack CORS headers (Starlette limitation); Host rejection is plain text. | Acceptable. |
| Low | A metadata lookup that times out keeps its thread running until yt-dlp's socket timeout. | Acceptable at this scale. |
| Info | Locally installed `next` is 16.2.10 while package.json says `^16.2.11`; Vercel installs from the lockfile. Empty untracked dirs `packages/types`, `apps/web/apps/web/src/...`, `.github/workflows` were left alone. | `npm ci` locally if wanted; delete the empty dirs if unwanted. |

## 6. Decisions I made on my own

1. **Kept Redis-only job storage and did not bring Postgres back.** The code removed it on purpose, and reintroducing it would be an architecture change. As a result, `DATABASE_URL` is ignored, `/api/ready` checks only Redis, and section start/end are stored in the Redis job hash instead of an Alembic revision.
2. **Removed `-B` (embedded beat), contrary to the brief.** Beat is a whole extra Python process; dropping it saved ~26 MiB, which mattered at 256 MB. Expired files are now removed at the start of every job instead. Files only appear when jobs run, so disk use stays bounded.
3. **Accurate cuts stay on** (`force_keyframes_at_cuts=True`), with ffmpeg `-threads 1 -preset veryfast`. On 0.1 vCPU, extra threads add memory, not speed. The 7 s clip took 9.8 s end to end. Long sections re-encode at roughly real time or slower on 0.1 vCPU, which is why `MAX_DURATION_SECONDS` defaults to 30 minutes.
4. **Deno heap is capped by default** (`DENO_V8_FLAGS=--max-old-space-size=64`), and metadata lookups skip player JS. A clean, fast solver failure is better than the kernel OOM-killing uvicorn or ffmpeg, which happened in run 1.
5. **Clip progress is stage-based.** yt-dlp's ffmpeg range downloader reports no byte progress, so progress goes 5 → 40 → 75 → 92 → 100.
6. **Celery cold shutdown plus a 5 s kill on stop.** The alternative was a shorter broker poll, which would cost Upstash commands.
7. **`https://dltube.vercel.app` stays allowed in CORS** even if `FRONTEND_URL` is wrong. It was the production fix that had been added before.
8. **TrustedHost re-enabled** (the brief asked to keep it), with 127.0.0.1 and localhost always allowed so health checks work. **This makes the `TRUSTED_HOSTS` value in Northflank critical** (runbook step 1).
9. Proxy routes removed; `apps/web/Dockerfile` kept (docker-compose uses it); the Node built-in test runner instead of adding Jest or Vitest.
10. Python dependencies stay within current major versions (redis-py held at 5.x); yt-dlp is the latest release (2026.10.26).

## 7. Needs Fatlum (in this order)

- [ ] **1. Northflank env vars** (names and formats only; set values in the dashboard):
  - `TRUSTED_HOSTS` **must contain** `p01--youtube-downloader--q9m2bv5gvkfq.code.run`. Otherwise every request gets 400 and the log says `Rejected request with Host …`. Comma-separated; `*` disables the check.
  - `REDIS_URL` = `rediss://default:<token>@<host>.upstash.io:6379` (must be `rediss://`).
  - `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`: delete them (they fall back to `REDIS_URL`) or set them to the same `rediss://` URL.
  - `FRONTEND_URL` = `https://dltube.vercel.app`.
  - Optional: `MAX_DURATION_SECONDS` (default 1800), `CORS_ORIGIN_REGEX`, for example `^https://dltube-[a-z0-9-]+-<your-vercel-team-slug>\.vercel\.app$` for previews.
  - `DATABASE_URL` is unused and can be removed.
  - Health check: HTTP `/api/health` on port 8000 for liveness; `/api/ready` for readiness if Northflank lets you set one.
- [ ] **2. Vercel:** no change. `NEXT_PUBLIC_API_URL` stays the Northflank URL.
- [ ] **3. Credentials:** I found **no secrets committed** in the repo or its history. The hits for `sk_test`, `SG.`, `JWT_SECRET` and `postgresql://` in `5145899`, `d302c06` and `e32a518` are placeholder or localhost values in `.env.example`/defaults. No rotation is needed because of the repo. Rotate the Upstash token only if it was pasted anywhere during earlier debugging.
- [ ] **4. Review the PR** `agent/stabilize-and-clip` → `master`, and **deploy the backend before merging** (runbook). The new frontend sends `start_time`/`end_time`; the old backend would silently ignore them and download the whole video.
- [ ] **5. Decide on capacity** (paid; I did not change anything): ≥ 512 MB RAM or a separate worker service, so the YouTube challenge solver can run. Then set `DENO_V8_FLAGS` to empty.
- [ ] **6. Optional:** find Northflank's ingress IP range for `FORWARDED_ALLOW_IPS` (per-user rate limiting).
- [ ] **7. Optional:** the Postgres addon is unused. Since the free plan allows one addon, a Northflank Redis addon could replace Upstash and remove the monthly command cap. That's an infrastructure decision.

## 8. Deploy runbook

1. **Build and push** (from the repo root, logged in to ghcr as usual):
   ```bash
   # note the current digest for rollback
   docker buildx imagetools inspect ghcr.io/devstackedmagazine/yt-downloader-api:latest | grep Digest
   cd apps/api
   SHA=$(git rev-parse --short HEAD)
   docker build -t ghcr.io/devstackedmagazine/yt-downloader-api:$SHA -t ghcr.io/devstackedmagazine/yt-downloader-api:latest .
   docker push ghcr.io/devstackedmagazine/yt-downloader-api:$SHA
   docker push ghcr.io/devstackedmagazine/yt-downloader-api:latest
   ```
2. **Northflank:** set the env vars (step 1 above), then rollout restart. Lines that mean success:
   - `Connected to rediss://…`
   - `celery@… ready.`
   - `Redis connection OK`
   - `Application startup complete.`
   - `Uvicorn running on http://0.0.0.0:8000`

   Lines that mean trouble:
   - `Redis not reachable (attempt n/5)`: URL or TLS problem.
   - `Rejected request with Host '…'`: `TRUSTED_HOSTS` is wrong.
   - `start.sh: a process exited`: a process crashed; check the lines above it.
3. **Check it:**
   - `curl https://p01--youtube-downloader--q9m2bv5gvkfq.code.run/api/health` → `{"status":"ok"}`
   - `curl …/api/ready` → `{"status":"ok","redis":"ok"}`
4. **Merge the PR**; Vercel deploys `master` automatically.
5. **Smoke test** on https://dltube.vercel.app with `https://www.youtube.com/watch?v=jNQXAC9IVRw`: whole video as MP4, then "Download a section" 0:05 → 0:12 as MP4 and as MP3. Each file should play and the clips should be 7 s long. Also try `https://example.com`, which should show "That does not look like a YouTube link". Watch the logs for `n challenge solving failed` and for OOM.
6. **Roll back:**
   - Backend: in Northflank, point the service at the previous digest (`ghcr.io/…@sha256:<old>`) or re-tag the old digest as `latest`, push, and restart.
   - Frontend: Vercel → Deployments → previous production deployment → "Instant Rollback", or `git revert -m 1 <merge-commit>` and push.

## 9. Risks and next steps

- **Upstash quota:** idle is about 160–180k commands/month. Each download costs about 60–100 more: rate limit 2, job create ~4, Celery queue ~5, worker writes ~10–30, and the page's status polling every 1.2 s for as long as the job runs. That leaves room for roughly 3–5k downloads a month. Slower polling (e.g. 2 s) or a Northflank Redis addon would give more headroom.
- **256 MB:** fine at idle (127 MiB), but the YouTube solver doesn't fit. Give the worker its own service or more memory before traffic grows.
- **yt-dlp updates:** YouTube breaks older versions within weeks. Dependabot already opens yt-dlp PRs; rebuild and redeploy the image whenever yt-dlp releases (`yt-dlp[default,deno]` keeps yt-dlp-ejs and Deno in sync).
- Further ideas: an H.264 preference for MP4; marking stale jobs failed; real per-client rate limiting; a CI workflow running `pytest` and `npm run lint/typecheck/test/build`.
