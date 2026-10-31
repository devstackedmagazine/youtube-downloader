# Production test report: dltube API on Render

Date: 2026-10-31, 22:13–22:37 UTC. Target: `https://dltube-api.onrender.com` and `https://dltube.vercel.app`. Tools: curl from one residential client. No logins, no setting changes, no deploys.

## Summary

- **Blocker: YouTube refuses Render's IP.** Every lookup for both test videos fails with *"Sign in to confirm you're not a bot"*. No download can run in production. This is not a code bug. YouTube blocks many datacenter IPs, and Render's shared egress IP is one of them. Fixing it needs a decision from Fatlum (see "Fixes").
- **Bug: rate limiting doesn't work in production.** It never triggered, not even for plain requests without fake headers. Behind Render, Cloudflare appends its own edge IP to `X-Forwarded-For`, so each request got a different key. Fixed on branch **`agent/prod-fixes`**: the key is now Cloudflare's `CF-Connecting-IP`.
- **Bug: users see yt-dlp's raw bot-check text**, including its advice to "use --cookies-from-browser", as a 400. Fixed on `agent/prod-fixes`: it's now a 503 with "YouTube is blocking downloads from our server right now. Please try again later." The worker reports the same text.
- Working correctly: health/ready, CORS, URL validation, the section rules, cold start, and the API URL compiled into the frontend.
- **Versions:** the frontend is the **old master build**. It has no section feature and no wake-up/retry code, but its API URL already points at Render. The API runs this branch: `render.yaml` and the Render setup exist only here, and behaviour matches it (e.g. the section validation messages).

## Results

| # | Test | Result | Details |
|---|---|---|---|
| 1 | `/api/health`, `/api/ready` | **PASS** | `{"status":"ok"}` 200 in 0.19 s; `{"status":"ok","redis":"ok"}` 200 in 0.20 s. Served via `server: cloudflare`, `x-render-origin-server: uvicorn`. |
| 2 | CORS, allowed origin | **PASS** | Preflight 200 0.37 s with `access-control-allow-origin: https://dltube.vercel.app`, methods `GET, POST`, `vary: Origin`. GET also returns the header (the body was the bot-check 400). |
| 2 | CORS, `https://evil.example` | **PASS** | Preflight **400** with no `access-control-allow-origin`; the GET response has no allow-origin header either, so a browser blocks it. |
| 3 | Metadata, 19 s video | **FAIL (blocked)** | 400 in 2.8 s and 1.3 s: `Could not fetch video information: ERROR: [youtube] jNQXAC9IVRw: Sign in to confirm you're not a bot … Use --cookies-from-browser or --cookies …` |
| 3 | Metadata, Big Buck Bunny `aqz-KE-bpKQ` | **FAIL (blocked)** | 400 in 1.4 s, same message. Availability can't be judged from Render; the block is per IP, not per video. |
| 3 | Non-YouTube URL / invalid URL | **PASS** | `https://example.com/watch?v=…` → 400 `{"detail":"Invalid YouTube URL"}` in 0.27 s; `not a url` → same, 0.42 s. |
| 4a | 19 s full MP4 | **FAIL (blocked)** | `POST /api/download` → 400 in 1.1 s with the bot-check text; no job created. |
| 4b | 19 s section 5→12 s MP3 | **NOT RUN** | It would fail the same way at the same up-front lookup. Not spending the budget on a known failure. |
| 4c | BBB section 5:00→5:30 MP4 | **NOT RUN** | Same reason. |
| 5 | start ≥ end | **PASS** | 422 in 0.27 s, `{"detail":"Start time must be before end time"}`, no job id. |
| 5 | section on a playlist | **PASS** | `scope: "playlist"` with a section → 422 in 0.30 s, `{"detail":"Sections can only be downloaded from a single video, not a playlist"}`, no job id. |
| 5 | end > video duration | **FAIL (blocked)** | Needs the video's duration: 400 in 1.4 s with the bot-check text instead of 422. The rule itself is unit-tested. |
| 6 | Rate limit with fake `X-Forwarded-For` | **FAIL (bug, fixed in `agent/prod-fixes`)** | 31 requests with a different fake XFF each, then one more: **all 400, no 429.** Control: 31 plain requests with no fake header also gave **all 400, no 429**. |
| 7 | Cold start | **PASS** | 22.5 s to the first 200 after ~17 min idle; request held, CORS intact. Details below. |
| 8 | Frontend version and API URL | **PASS / old build** | `/download` and `/` return 200 (0.58 s). The 9 JS chunks contain `https://dltube-api.onrender.com` once; no `code.run` or `localhost:8000`. The old build is missing `start_time`, "Download a section" and the `/api/health` wake-up ping. |

Requests used (limits: 6 jobs, 15 metadata):
- **Jobs: 0 created.** 4 download POSTs: 2 rejected by schema rules, 2 rejected at the blocked lookup.
- **Metadata: 6 real lookups** (2 in test 2, 3 in test 3, 1 in test 7).
- **Rate-limit probes: 63** to `/api/metadata?url=not a url`. The rate limiter runs before URL validation, so none reached YouTube. That's 31 plus 1 for test 6, and 31 for the control. I ran the control because test 6 alone couldn't tell "spoofing works" apart from "the limiter never works".

### 7. Cold start

**PASS.** There were no requests from 22:17:53 to 22:34:43 (16 min 50 s).

- First `GET /api/health` (with `Origin: https://dltube.vercel.app`, `Accept: */*`): **HTTP 200 after 22.5 s** (TTFB 22.54 s, warm 0.19 s). Render **held the request** until the app was up and returned the app's own JSON with `access-control-allow-origin`. No loading page reached curl.
- First metadata request, sent straight after: 4.3 s (the bot-check 400, because of the block). Warm requests take 1.3–2.8 s.
- Startup was much faster than the local `--cpus=0.1` test (52 s until the port opened), so Render's CPU limit apparently allows bursting at startup.
- Frontend retry logic (on `agent/stabilize-and-clip`, not deployed to Vercel yet): it retries for up to 90 s, so a 22.5 s wake is well covered. On this evidence a held request needs no retry at all.
  - The retry still matters if a browser gets Render's HTML loading page instead; Render documents that for browsers. I couldn't test a real browser `fetch` without a browser session.
  - The **currently deployed old frontend has no wake-up ping or retry**. It relies on the request being held, which it was here.

## Why the rate limit failed

Cloudflare sits in front of Render (`server: cloudflare`). Reported Render behaviour, consistent with what I saw:
- The service receives `X-Forwarded-For: <whatever the client sent>, <real client IP>, <Cloudflare edge IP>`.
- The last entry is a Cloudflare edge IP, and that changes between connections. Each curl opened a new connection, so each request had a new key.
- The first entry is whatever the client chose to send.

So no entry of `X-Forwarded-For` identifies the client. Cloudflare sets `CF-Connecting-IP` to the real client IP and overwrites any value the client sends.

I couldn't see the headers server-side, because that would need a deploy. The explanation fits both runs: the spoofed run and the plain run alike never got a 429.

**Fix (`agent/prod-fixes`, not deployed):**
- `CLIENT_IP_HEADER` names the header to trust, and `render.yaml` sets it to `cf-connecting-ip`.
- The default is the socket peer. That keeps self-hosted setups without Cloudflare safe, where a client could send `CF-Connecting-IP` itself.
- Tests:
  - per-client budgets
  - a varying `X-Forwarded-For` with a stable `CF-Connecting-IP` is limited
  - client headers are ignored when nothing is configured
  - socket fallback

## Fixes and what Fatlum has to do

### A. Deploy the two code fixes (rate limit, clean bot-check error)

The fixes are on **`agent/prod-fixes`**, which branches from `agent/stabilize-and-clip`. They aren't pushed to the branch Render deploys from, because that would auto-deploy them.

1. Review and merge them: `git checkout agent/stabilize-and-clip && git merge --ff-only origin/agent/prod-fixes && git push`. Alternatively, open a PR from `agent/prod-fixes` into `agent/stabilize-and-clip`. That push deploys if auto-deploy is on, and the `render.yaml` change syncs `CLIENT_IP_HEADER` if Blueprint sync is on.
2. Check that the Render service has `CLIENT_IP_HEADER` = `cf-connecting-ip` under **Environment**. It comes from `render.yaml` if Blueprint sync is on; otherwise add it by hand.
3. If nothing deployed automatically: Render → service → **Manual Deploy** → **Deploy latest commit**.
4. Verify with one person's requests:
   ```bash
   for i in $(seq 1 31); do curl -s -o /dev/null -w '%{http_code} ' \
     -H "X-Forwarded-For: 10.0.$i.1" -H "CF-Connecting-IP: 10.9.$i.1" \
     -G --data-urlencode 'url=not a url' https://dltube-api.onrender.com/api/metadata; done; echo
   ```
   Expected: 30 × `400`, then `429`.
   - If it still never shows 429, `CF-Connecting-IP` isn't reaching the app. Then try `true-client-ip`, or ask Render support which header carries the client IP.
   - The fake `CF-Connecting-IP` above also proves Cloudflare overwrites client values. If the run gives 31 × `400`, Cloudflare is passing client values through and must not be trusted.

### B. Get past YouTube's block (pick one; each needs Fatlum's decision)

| Option | Cost / risk | Work |
|---|---|---|
| **1. Residential/ISP proxy** for YouTube traffic (recommended) | Paid (per GB). Reliable, and no YouTube account is at risk. | Set `YT_PROXY` = `http://user:pass@host:port` as a secret under Render → **Environment**, then redeploy. Already supported in `agent/prod-fixes`: yt-dlp and its ffmpeg section downloads both use it. A plain `HTTPS_PROXY` would **not** reach ffmpeg, so sections would still be blocked. |
| 2. Cookies from a throwaway YouTube account | Free. Against YouTube's terms; the account can be flagged; cookies expire and need re-exporting. | Not implemented. It needs a Render Secret File, copied to a writable path at start (yt-dlp writes cookies back), plus a `cookiefile` option. About 10 lines; ask if wanted. |
| 3. Run the worker somewhere with a residential IP | Free but needs an always-on machine. | Architecture change: the worker only needs Redis access. |
| 4. PO-token provider plugin (bgutil) | Free, extra process. | Often not enough against an IP-level block. Not recommended on 512 MB. |

After any of these, run the downloads from this report (4a–4c) again.

### C. Frontend

Merge PR #27 when the backend is ready. Vercel then serves the build with the section feature and the cold-start wake-up/retry; its API URL is already correct.

## Unexpected findings

- `render.yaml` paths: my original used repo-root relative `dockerContext`/`dockerfilePath`, per Render's spec page. Fatlum's `ca97a0d` changed them to rootDir-relative (`.` and `./Dockerfile`). The comment now says so.
- Pushing changes under `apps/api` to the branch Render deploys from will auto-deploy them, if auto-deploy is on. That's why the code fixes are on `agent/prod-fixes`. This report and the doc fixes are on `agent/stabilize-and-clip`; they're root-level files outside `rootDir: apps/api`, so no build.
