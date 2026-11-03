# DLTube

DLTube downloads YouTube videos, exact sections and playlists as MP4 or MP3. It is a desktop app for Windows and Linux, MIT licensed.

| Path | What |
|---|---|
| `apps/desktop` | The desktop app (Tauri). Release runbook: [docs/desktop/RELEASE.md](docs/desktop/RELEASE.md). |
| `apps/web` | The website (https://dltube.vercel.app): the app's landing and download page. It has no backend. |
| `packages/shared` | Time parsing and quality types used by the desktop app. |
| `apps/api` | The retired server-side downloader (FastAPI + Redis). The website no longer uses it; the notes below are kept for self-hosting. |

## The retired server downloader

### Run locally

Install Docker Desktop, start it, then run from the repository root:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The website is at `http://localhost:3000` (landing page only). The API health endpoint is `http://localhost:8000/api/health`.

To stop the stack:

```powershell
docker compose down
```

### Deploy the API on Render

The production API runs on Render's free tier from `render.yaml`; see [RENDER_DEPLOY.md](RENDER_DEPLOY.md).

### Deploy with Docker

1. Copy `.env.example` to `.env` on the server.
2. Set these values to your public HTTPS domains:

```dotenv
FRONTEND_URL=https://downloads.example.com
TRUSTED_HOSTS=api.downloads.example.com
```

3. Put a TLS-terminating reverse proxy in front of ports `3000` and `8000` (or restrict those ports to the proxy), then run:

```bash
docker compose up --build -d
```

Rate limiting keys on the socket address unless `CLIENT_IP_HEADER` names a header your proxy always overwrites with the client address. For nginx: `proxy_set_header X-Real-IP $remote_addr;` and `CLIENT_IP_HEADER=x-real-ip`. Keep port `8000` unreachable except through the proxy.

### Operational notes

- Keep Redis private; the compose configuration intentionally does not publish its port.
- Download files remain available for up to 24 hours. The worker removes expired job files before each new job.
- Only download content you are authorized to save and distribute.
