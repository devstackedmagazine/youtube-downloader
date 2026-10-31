# Deploy the API on Render (free tier)

The API (FastAPI and the Celery worker in one Docker container) runs on Render from `render.yaml`. The frontend stays on Vercel and Redis stays on Upstash. Nothing here needs a password or token from the repo. You paste the only secrets (the Upstash URL) into Render's form.

**What the free tier means for users:**
- The service sleeps after 15 minutes without requests. The first visit after that waits about a minute while it wakes.
  - The download page pings the API as soon as it opens.
  - The first metadata lookup keeps retrying for up to 90 s while Render wakes the service.
- The disk is wiped whenever the service restarts or sleeps, so finished files are lost then.
  - Users must save their file soon after it's ready.
  - An old job whose file is gone now reports "This file has expired. Please convert it again."
- One service running all month uses about 744 of the 750 free instance hours, so keep only this one free service in the workspace.

## 1. Create the service from the Blueprint

1. Go to <https://dashboard.render.com> and sign in with GitHub.
2. Click **New +** (top right), then **Blueprint**.
3. Under **Connect a repository**, pick the dltube repo. If it's missing, click **Configure account** / **Connect GitHub** and give Render access to that repo.
4. **Blueprint Name:** `dltube`.
5. **Branch:** `agent/stabilize-and-clip` to try the API before merging the PR. If you merge first, pick `master` instead. Render reads `render.yaml` from the repo root and shows one resource: **dltube-api**, Web Service, Docker, Free, Frankfurt.
6. Render asks for the three values marked `sync: false`. Paste them (formats below; real values come from the Upstash console → your database → **Connect** → the `rediss://` URL):

   | Name | Format |
   |---|---|
   | `REDIS_URL` | `rediss://default:<token>@<name>.upstash.io:6379` (must start with `rediss://`, two s) |
   | `CELERY_BROKER_URL` | the same `rediss://` URL |
   | `CELERY_RESULT_BACKEND` | the same `rediss://` URL |

7. Click **Apply** (or **Deploy Blueprint**). The first build takes several minutes because it installs ffmpeg and Deno.
8. When it's done, open the service. Its URL appears under the name, e.g. `https://dltube-api.onrender.com`. Render adds a suffix if the name is taken, so copy the URL exactly.

The other variables come from `render.yaml` and need no input. Check them under the service → **Environment**:

| Name | Value | Notes |
|---|---|---|
| `ENVIRONMENT` | `production` | |
| `FRONTEND_URL` | `https://dltube.vercel.app` | Browser origin allowed by CORS; no trailing slash. Comma-separate extra origins. If the site gets a custom domain, put it first. |
| `TRUSTED_HOSTS` | `localhost,127.0.0.1` | Leave as is. The API also trusts the `onrender.com` host automatically, through `RENDER_EXTERNAL_HOSTNAME`, which Render sets itself. If you attach a custom domain to the API (e.g. `api.example.com`), add it here: `api.example.com,localhost,127.0.0.1`. |
| `DOWNLOAD_DIR` | `/app/tmp_downloads` | |
| `MAX_DURATION_SECONDS`, `MAX_PLAYLIST_ITEMS`, `METADATA_TIMEOUT_SECONDS`, `RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW_SECONDS`, `CELERY_MAX_MEMORY_KB` | `1800`, `100`, `30`, `30`, `60`, `150000` | Safety limits; the defaults are fine. |
| optional: `CORS_ORIGIN_REGEX` | e.g. `^https://dltube-[a-z0-9-]+-<team-slug>\.vercel\.app$` | Only if Vercel preview deployments should be able to call the API. |

Do not set `PORT`. Render sets it (10000) and the container listens on it. Do not set `DATABASE_URL`, because there is no database.

## 2. Verify the API

Replace the host below with your service URL.

```bash
curl https://dltube-api.onrender.com/api/health   # {"status":"ok"}
curl https://dltube-api.onrender.com/api/ready    # {"status":"ok","redis":"ok"}
```

In Render → the service → **Logs**, a good start looks like this:

- `Uvicorn running on http://0.0.0.0:10000`, about 50 s after start on the free CPU.
- `Redis connection OK`
- `Connected to rediss://…` followed by `celery@… ready.`, which comes about 30 s after uvicorn because the worker starts once the port is open.

Lines that mean trouble:

- `Redis not reachable (attempt n/5)`, or `/api/ready` returning 503: `REDIS_URL` is wrong or isn't `rediss://`.
- `Rejected request with Host '…'`: someone used a host that isn't trusted. Add it to `TRUSTED_HOSTS` if it's legitimate, for example a custom domain.
- `start.sh: a process exited`: a process crashed; read the lines above it.
- `Out of memory` in **Events**: report it. The local test at 512 MB peaked at 332 MiB.

## 3. Point the frontend at Render

1. Vercel → the dltube project → **Settings** → **Environment Variables**.
2. Edit `NEXT_PUBLIC_API_URL` for **Production** (and Preview if you use it). Set it to the Render URL with no trailing slash, e.g. `https://dltube-api.onrender.com`.
3. The value is compiled into the browser bundle, so it only applies after a new build:
   - If you merge the PR now, Vercel builds `master` with the new value.
   - Otherwise go to **Deployments** → latest production deployment → **⋯** → **Redeploy**.
4. Merge the PR `agent/stabilize-and-clip` → `master`. Merge only after the API checks in step 2 pass, because the new frontend needs the new API.
5. If the Blueprint used `agent/stabilize-and-clip`, switch it to `master` after the merge, so future pushes to `master` deploy. Two ways:
   - Render → **Blueprints** → `dltube` → **Settings**, and change the branch.
   - Or the service → **Settings** → **Build & Deploy** → **Branch**.

## 4. Smoke test

On <https://dltube.vercel.app> with `https://www.youtube.com/watch?v=jNQXAC9IVRw`:

1. Whole video as MP4.
2. **Download a section** 0:05 → 0:12 as MP4.
3. The same section as MP3. Each file should play, and both clips should be 7 s long.
4. Try `https://example.com`; it should show "That does not look like a YouTube link".
5. Cold start: leave the site alone for 20 minutes, then load `/download` and look up the video. The first lookup can take about a minute, but it should succeed without an error.

## 5. Roll back

- **API code:** Render → the service → **Events**, find the last good deploy, then **Rollback**. To stop it entirely: **Settings** → **Suspend Web Service**.
- **Frontend:** Vercel → **Deployments** → previous production deployment → **⋯** → **Instant Rollback**. Or `git revert -m 1 <merge-commit>` and push.
- **Back to the old API host:** set `NEXT_PUBLIC_API_URL` in Vercel back to the old URL and redeploy. Note that the old Northflank service was returning 503 when last checked.
- **Remove everything:** Render → **Blueprints** → `dltube` → **Settings** → delete the Blueprint and its service. Nothing else depends on it, and Upstash data is untouched.
