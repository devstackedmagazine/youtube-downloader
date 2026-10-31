# DLTube

DLTube downloads individual YouTube videos or playlists as MP4 or MP3 files. Playlist downloads are packaged as a ZIP archive.

## Run locally

Install Docker Desktop, start it, then run from the repository root:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open `http://localhost:3000`. The API health endpoint is `http://localhost:8000/api/health`.

To stop the stack:

```powershell
docker compose down
```

## Deploy the API on Render

The production API runs on Render's free tier from `render.yaml`; see [RENDER_DEPLOY.md](RENDER_DEPLOY.md).

## Host the API at home

Free alternative to Render if YouTube blocks the cloud IP: Docker + Tailscale Funnel, see [HOME_HOSTING.md](HOME_HOSTING.md).

## Deploy with Docker

1. Copy `.env.example` to `.env` on the server.
2. Set these values to your public HTTPS domains:

```dotenv
FRONTEND_URL=https://downloads.example.com
NEXT_PUBLIC_API_URL=https://api.downloads.example.com
TRUSTED_HOSTS=api.downloads.example.com
```

3. Put a TLS-terminating reverse proxy in front of ports `3000` and `8000` (or restrict those ports to the proxy), then run:

```bash
docker compose up --build -d
```

`NEXT_PUBLIC_API_URL` is compiled into the browser bundle. Rebuild the `web` service whenever it changes.

Rate limiting keys on the socket address unless `CLIENT_IP_HEADER` names a header your proxy always overwrites with the client address. For nginx: `proxy_set_header X-Real-IP $remote_addr;` and `CLIENT_IP_HEADER=x-real-ip`. Keep port `8000` unreachable except through the proxy.

## Operational notes

- Keep Redis private; the compose configuration intentionally does not publish its port.
- Download files remain available for up to 24 hours. The worker removes expired job files before each new job.
- Only download content you are authorized to save and distribute.
