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

## Operational notes

- Keep Redis private; the compose configuration intentionally does not publish its port.
- Download files remain available for up to 24 hours. The included Celery Beat service removes expired job files hourly.
- Only download content you are authorized to save and distribute.
