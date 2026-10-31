# Host the API at home with Tailscale Funnel (free)

YouTube blocks Render's server IP ("Sign in to confirm you're not a bot"), but not a home internet connection. This guide runs the same API container on your Linux machine. Tailscale Funnel gives it a public HTTPS address (`https://<machine>.<tailnet>.ts.net`) without opening ports on your router. The frontend stays on Vercel and Redis stays on Upstash. Everything here is free.

**Things to know first**
- The site only works while this machine is on, awake and online. Turn off sleep/suspend.
- Downloads use your home connection's bandwidth. YouTube sees your home IP.
- **Run only one backend at a time.** Render and the home server would share the same Upstash queue, and either one's worker could take the other's jobs. Step 6 suspends Render.

Commands marked `sudo` change your system; run them yourself. Replace `<machine>.<tailnet>.ts.net` with your real Funnel host (step 4 prints it).

## 1. Prerequisites

- Docker with the Compose plugin (`docker compose version` should print v2 or later).
- Docker starts on boot, so the API comes back after a reboot:
  ```bash
  sudo systemctl enable --now docker
  ```
- The repo checked out on this machine, on the branch you want to run (`agent/home-hosting` until it's merged).

## 2. Configure and start the API

```bash
cd youtube-downloader
cp apps/api/.env.home.example apps/api/.env.home
chmod 600 apps/api/.env.home        # it will hold your Upstash token
```

Edit `apps/api/.env.home`:
- `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`: your Upstash URL, `rediss://default:<token>@<name>.upstash.io:6379`. It's the same value as in Render.
- `TRUSTED_HOSTS`: put your Funnel host first. Leave it as the placeholder until step 4, then edit it and restart.
- Leave `FRONTEND_URL=https://dltube.vercel.app` and `CLIENT_IP_HEADER=x-forwarded-for` as they are.

Start it:

```bash
docker compose -f docker-compose.home.yml up -d --build
curl http://127.0.0.1:8000/api/health    # {"status":"ok","commit":""}
curl http://127.0.0.1:8000/api/ready     # {"status":"ok","redis":"ok"}
```

What this sets up:
- The API listens on `127.0.0.1:8000` only, so nothing on your network can reach it directly.
- `restart: unless-stopped` brings it back after crashes and reboots.
- Limits: 1 GB RAM and 2 CPUs. In the local test it peaked at 712 MiB, page cache included.

## 3. Install Tailscale and sign up (free Personal plan)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo systemctl enable --now tailscaled
sudo tailscale up
```

`tailscale up` prints a login URL. Open it and sign up with any login provider; the free Personal plan is enough. The machine then appears at <https://login.tailscale.com/admin/machines>.

## 4. Turn on Funnel for the API

Funnel needs MagicDNS and HTTPS certificates for your tailnet, plus a policy entry that allows Funnel. The first `funnel` command offers to set all of this up:

```bash
sudo tailscale funnel --bg http://127.0.0.1:8000
```

- If it prints a link saying Funnel or HTTPS isn't enabled, open the link, approve, and run the command again.
- `--bg` keeps Funnel on after the terminal closes, and it comes back after reboots.
- Check it:
  ```bash
  tailscale funnel status
  ```
  This shows `https://<machine>.<tailnet>.ts.net (Funnel on)` proxying to `http://127.0.0.1:8000`.

Now put that host into `apps/api/.env.home` (`TRUSTED_HOSTS=<machine>.<tailnet>.ts.net,localhost,127.0.0.1`) and apply it:

```bash
docker compose -f docker-compose.home.yml up -d
```

Check from outside the machine, for example on your phone over mobile data:
- `https://<machine>.<tailnet>.ts.net/api/health` should return `{"status":"ok",...}`.
- `/api/ready` should return `{"status":"ok","redis":"ok"}`.

The first certificate can take up to a minute.

## 5. Point Vercel at the home API

1. Vercel → the dltube project → **Settings** → **Environment Variables**.
2. Set `NEXT_PUBLIC_API_URL` (Production) to `https://<machine>.<tailnet>.ts.net`, with no trailing slash.
3. **Deployments** → latest production deployment → **⋯** → **Redeploy**. The value is compiled in, so it needs a new build.

## 6. Suspend the Render service

Render → `dltube-api` → **Settings** → **Suspend Web Service**. Two reasons:
- It stops the Render worker from taking jobs off the shared Upstash queue.
- It keeps the old URL from serving a blocked API.

## 7. Verify

1. Rate limit, from any machine. Funnel replaces `X-Forwarded-For` with your real IP, so the fake one below must not help:
   ```bash
   for i in $(seq 1 31); do curl -s -o /dev/null -w '%{http_code} ' -H "X-Forwarded-For: 10.0.$i.1" \
     -G --data-urlencode 'url=not a url' https://<machine>.<tailnet>.ts.net/api/metadata; done; echo
   ```
   Expected: 30 × `400`, then `429`. Wait a minute afterwards.
2. On <https://dltube.vercel.app/download>, with `https://www.youtube.com/watch?v=jNQXAC9IVRw`:
   - whole video as MP4
   - **Download a section** 0:05 → 0:12 as MP4 and as MP3. Each clip should be 7 s long.
3. Logs, if something's wrong:
   ```bash
   docker compose -f docker-compose.home.yml logs -f api
   ```
   The success and trouble lines are the same as in RENDER_DEPLOY.md, step 2.

## Updating

YouTube breaks old yt-dlp versions every few weeks. After pulling new code:

```bash
git pull
docker compose -f docker-compose.home.yml up -d --build
```

## Switch back to Render

1. Render → `dltube-api` → **Resume Web Service**.
2. Vercel: set `NEXT_PUBLIC_API_URL` back to `https://dltube-api.onrender.com` and redeploy.
3. Stop the home API: `docker compose -f docker-compose.home.yml down`. Optionally also turn Funnel off (next section).

## Shut everything off

```bash
sudo tailscale funnel reset                          # the public URL stops working immediately
docker compose -f docker-compose.home.yml down       # stops the API
sudo tailscale down                                  # optional: take the machine off your tailnet
```

The site then shows "Our download server isn't reachable right now" until Vercel points at a running backend again.

## Security

- **What's public:** Funnel publishes **only** `https://<machine>.<tailnet>.ts.net` (port 443) → `127.0.0.1:8000`.
  - No router ports are opened and no other service on the machine is exposed.
  - The API container never binds to your LAN. Keep the `127.0.0.1:` prefix in `docker-compose.home.yml`. Without it, devices on your network could reach the API directly and fake `X-Forwarded-For` to dodge the rate limit.
- **Container hardening:**
  - It runs as a non-root user, with `no-new-privileges`, and limits on memory, CPU and processes.
  - Only YouTube URLs are accepted (yt-dlp is restricted to YouTube extractors).
  - Downloads are deleted after 24 h.
- **Secrets:** `apps/api/.env.home` holds your Upstash token.
  - It's gitignored; keep it `chmod 600` and never commit or paste it anywhere.
  - Rotate the token in Upstash if it leaks.
- **Abuse:** anyone can use the API. The limits are 30 requests per minute per client IP, one job at a time, and sections or videos up to 30 min. Heavy use costs your bandwidth and can get your home IP rate-limited by YouTube. Turn Funnel off (`sudo tailscale funnel reset`) if you see abuse in the logs.
- **Visibility:** visitors see the Tailscale host name, not your home IP address. Tailscale terminates TLS on your machine.
- **Updates:** keep the OS, Docker and Tailscale updated (`sudo apt upgrade` or your distro's equivalent).
