# dltube desktop app: report

Branch `agent/desktop-app`, based on `agent/stabilize-and-clip` (PR #27 was still open, not merged into master, on 2026-11-02).

## Summary

dltube now has a desktop app for Windows 10/11 x64 and Linux x64 (`apps/desktop`, Tauri v2). Everything happens on the user's computer, with their own IP: no server and no costs. The app bundles pinned, checksum-verified copies of yt-dlp, ffmpeg/ffprobe and Deno, keeps yt-dlp up to date by itself, and links to new app releases on GitHub.

Does it work?

- **Linux: yes, tested.** Real downloads through the app's own Rust code worked on this machine (results below). I built the `.deb` and AppImage locally in an Ubuntu 22.04 container and launched the AppImage under Xvfb. It started cleanly, copied yt-dlp into its data folder, ran its update check, and rendered the UI.
- **Windows: builds and packages in CI (143 MiB NSIS installer). I couldn't run it**: I have no Windows machine.
- The website has a new `/download-app` page, linked from the home page. The existing web downloader is unchanged.

## Architecture

```
apps/desktop/
  sidecars.json              pinned tool versions + SHA-256 (single source of truth)
  scripts/fetch-sidecars.mjs downloads + verifies the tools into src-tauri/binaries/ (gitignored)
  scripts/third-party-deps.mjs regenerates the dependency license list
  THIRD_PARTY_NOTICES.md     shown in About, shipped as a file too
  src/                       Vite + React + Tailwind UI (looks like the web app)
  src-tauri/
    core/                    dltube-core: all yt-dlp logic, no Tauri dependency
      src/args.rs            yt-dlp command lines (allow-list, URL after --)
      src/runner.rs          spawn, stream output, cancel (kills process tree), metadata, download, AAC fix, move files
      src/update.rs          managed yt-dlp copy, daily update, SHA2-256SUMS, atomic swap + rollback, app update check
      src/{url,clip,filename,progress,errors,version,checksum}.rs
      src/bin/dltube-cli.rs  headless harness used for the real-download tests
    src/lib.rs               Tauri glue: queue/worker, history, settings, commands
    tauri.conf.json (+ tauri.linux/windows.conf.json for the per-OS tool resources)
packages/shared/             @dltube/shared: parseTime/formatTime/checkClip + shared types (used by web and desktop)
```

How a download runs: UI → `enqueue` command (Rust validates the URL, quality and section again) → a single worker thread runs one job at a time → `dltube-core` spawns the managed yt-dlp with `--ffmpeg-location <bundled ffmpeg>` and `--js-runtimes deno:<bundled deno>`. It writes into a private `.dltube-partial-*` folder inside the download folder and parses `--progress-template` lines. When finished, the file is moved to `Title [00m05s-00m12s].mp4`, or the playlist items into a `<Playlist title>/` subfolder. The partial folder is always deleted: on success, failure or cancel.

Ported from `apps/api` (same behaviour): format selection, `--download-sections` + `--force-keyframes-at-cuts` + `ffmpeg_o:-preset veryfast`, MP3 extraction, AAC fix-up for MP4 audio (ffprobe), filename rules, section validation (start < end, ≥ 1 s, end ≤ duration + 1 s, no sections for playlists or live), live/upcoming detection, `player_skip=js` for fast metadata, flat playlist metadata. Dropped the server-only limits (MAX_DURATION_SECONDS, rate limits). Kept guards: URL ≤ 2048 chars and YouTube hosts only, ≤ 1000 playlist items, quality allow-list.

### Security and privacy

- yt-dlp arguments are built only in `core/src/args.rs`. Quality values are mapped from an allow-list, and the URL must pass `is_youtube_url` (http/https, youtube.com/*.youtube.com/youtu.be, no userinfo, no whitespace). It is always the last argument, after `--`. Every call adds `--ignore-config --no-plugin-dirs --use-extractors youtube --no-js-runtimes`, so a user's own yt-dlp config, plugins or other JS runtimes are never used. Tools are only ever started by absolute path from the app's own folder, never from PATH.
- The web view has **no** shell, filesystem, opener, dialog or HTTP permission. Its capability only allows listening to events. Rust opens files only by history ID (paths come from the history, not from the UI), and opens only URLs under this repo's releases page.
- CSP: `default-src 'self'`, scripts and styles self-only, images only from `i.ytimg.com`/`i9.ytimg.com` (thumbnails), connections only to Tauri IPC, no frames or objects. No remote web content is loaded. The UI has no external links except the release-page button.
- No analytics, telemetry, crash reporting, cookies or accounts. posthog/stripe are not dependencies of the desktop app (its JS bundle contains React, `@tauri-apps/api` and our code only). Network use: YouTube via yt-dlp, `api.github.com` and `github.com` for the daily yt-dlp check and the app update check.
- yt-dlp updates: download from the GitHub release over HTTPS → SHA-256 must match that release's `SHA2-256SUMS` → `--version` must print the expected version → current goes to `yt-dlp.previous`, the new one takes its place → `--version` again, with rollback on failure. It never swaps while a download is running (a read/write lock).

## Changes by file

| Path | Change |
|---|---|
| `packages/shared/*` | New workspace package `@dltube/shared`. `src/time.ts` and `src/time.test.mjs` moved from `apps/web/src/lib/` (git rename, unchanged rules). `src/types.ts` holds the shared types and `MP4_QUALITIES`/`MP3_QUALITIES`. |
| `apps/web/src/lib/time.ts`, `src/types/index.ts` | Re-export from `@dltube/shared`. Web behaviour unchanged. |
| `apps/web/src/components/FormatSelector.tsx` | Uses the shared quality lists (same values). |
| `apps/web/next.config.ts`, `apps/web/package.json` | `transpilePackages: ["@dltube/shared"]`, workspace dependency. |
| `apps/web/src/app/download-app/page.tsx`, `src/lib/desktop.ts`, `src/app/page.tsx` | New download page, one config value for the release repo (`DESKTOP_REPO`, overridable with `NEXT_PUBLIC_DESKTOP_REPO`), link in the home hero. |
| `package.json` (root) | `--if-present` on the workspace scripts, so packages without a `build`/`dev`/`start` script don't break `npm run build`. |
| `apps/desktop/**` | The app (see Architecture). |
| `.github/workflows/desktop.yml` | CI: tests → Windows + Linux installers as artifacts; on `desktop-v*` tags, a draft release with SHA256SUMS. |
| `docs/desktop/RELEASE.md` | Release runbook and how to bump the pinned tools. |
| `package-lock.json` | Only additions (desktop dependencies). I checked that no existing package version changed. |

## Test results

### Automated (all pass locally and in CI's test job)

| Suite | Result |
|---|---|
| `dltube-core` Rust unit tests | 39 passed: URL allow-list, argument building (`--` + URL last, rejects option-like/foreign URLs, quality allow-list, ignore-config/no-plugins, bundled tool paths, MP4/MP3/section/playlist variants), progress parsing, section rules, filenames (sanitizing, reserved names, never overwrite), version comparison (yt-dlp dates and app semver), checksum parsing and file hashing, release-JSON parsing (fixtures, no network), daily-check timing, managed copy + install/rollback with fake binaries, process-group kill on cancel (grandchild killed), timeout, missing binary, friendly error mapping, metadata parsing. |
| `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check` | Clean (including the Tauri crate, compiled in an Ubuntu 22.04 container). |
| `packages/shared` (node:test) | 6 passed. typecheck clean. |
| `apps/desktop` frontend | 3 tests passed (formatting helpers). typecheck, eslint, vite build clean. JS bundle 213 kB (67 kB gzip), CSS 18 kB. |
| `apps/web` | tests 3 passed, typecheck clean, `next build` OK (`/download-app` prerendered static), lint: 0 errors, 1 warning (pre-existing `<img>` in MotionShowcase). |

### Real downloads (this machine, through `dltube-cli`, the same `runner::download` code the app uses)

Each harness run does a metadata lookup and then the download. "Peak memory" is the max RSS of the process tree (`/usr/bin/time`), so mostly yt-dlp or ffmpeg.

| Test | Wall time | Peak memory | Result (ffprobe) |
|---|---|---|---|
| Metadata, 19 s video | 3.0 s | 85 MB | title, channel, duration 19, thumbnail OK |
| Full 19 s video, MP4 1080p | 10.0 s | 325 MB | `Me at the zoo.mp4`, 19.01 s, 686 KB, AV1 240p + AAC |
| 19 s video, section 5→12 s, MP3 320 kbps | 7.6 s | 325 MB | `Me at the zoo [00m05s-00m12s].mp3`, **7.00 s**, 322 kb/s |
| Big Buck Bunny, section 5:00→5:30, MP4 1080p | 48.2 s | 411 MB | `… [05m00s-05m30s].mp4`, **30.00 s**, 12.5 MB, H.264 1080p + AAC, both streams start at 0 |
| Big Buck Bunny whole, MP4 1080p, cancelled after 8 s | 11.8 s | 327 MB | cancelled at 12% downloaded. No partial folder left, no yt-dlp/ffmpeg processes left. |

All durations are within ±1 s. Budget used: 8 of 20 metadata lookups and 4 of 10 downloads. 3 of those lookups went to diagnosing the rate limit below.

**Important finding:** at first, YouTube answered this machine with `HTTP Error 429: Too Many Requests` and then "Sign in to confirm you're not a bot". So a home IP can also be temporarily rate-limited, probably after the many tests from this machine the day before. It cleared by itself within about 2.5 hours. The app now shows a clear message for this case ("YouTube is temporarily limiting requests from your internet connection. Wait a while…").

### Packaging (built locally in an Ubuntu 22.04 container, identical to CI)

| Artifact | Size |
|---|---|
| `dltube_0.1.0_amd64.AppImage` | 274 MiB |
| `dltube_0.1.0_amd64.deb` | 217 MiB download, 470 MiB installed |
| App binary itself (`/usr/bin/dltube`) | 9.9 MB; the rest is ffmpeg 173 MB, ffprobe 173 MB, Deno 96 MB, yt-dlp 41 MB |
| `dltube_0.1.0_x64-setup.exe` (Windows NSIS, built in CI) | 143 MiB |

`.deb` layout check: the tools are in `/usr/lib/dltube/tools/` with their exec bits; `/usr/bin` only contains `dltube`. Depends: `libwebkit2gtk-4.1-0, libgtk-3-0`.

AppImage under Xvfb (fresh user, fresh container): it starts with no errors in its log and creates `~/.local/share/app.dltube.desktop/yt-dlp/{yt-dlp,state.json}`. The daily yt-dlp check ran (2026.10.26 is the latest, so nothing changed). The UI renders under the strict CSP. Memory at idle: app 152 MB RSS, WebKit web process 278 MB, WebKit network process 56 MB.

## What couldn't be tested, and why

- **Windows installer and app at runtime:** no Windows machine. CI builds it. Not verified: NSIS install/uninstall, the WebView2 bootstrapper, `taskkill /T` cancellation, the console-free spawning (`CREATE_NO_WINDOW`), and yt-dlp self-update on Windows. These code paths compile in CI but have never run.
- **Clicking through the real UI end to end** (Tauri window + IPC + a real download): the host has no WebKitGTK dev headers, so I didn't install anything there. I only launched the AppImage under Xvfb and took a screenshot. The download path itself was tested through the same Rust functions with the CLI harness.
- **Playlist download:** not run against YouTube, because of the download budget (only the two test videos were allowed). The playlist arguments and file moving are unit-tested; the playlist item counter comes from `info.playlist_index`/`n_entries`.
- **A real yt-dlp self-update:** the bundled 2026.10.26 is the newest release, so nothing was swapped. The verify/swap/rollback logic is tested with fake binaries; the GitHub JSON parsing is tested with fixtures.

## Decisions (and why)

1. **Base branch:** `agent/stabilize-and-clip`, because PR #27 isn't merged.
2. **Tools as bundle resources, not `externalBin` sidecars.** Tauri's `.deb` installs `externalBin` into `/usr/bin`, which would put `/usr/bin/ffmpeg` and `/usr/bin/yt-dlp` on users' systems and clash with Ubuntu's `ffmpeg`/`yt-dlp` packages (dpkg refuses the install). Resources go into `/usr/lib/dltube/tools/` (Windows: `<install dir>\tools\`). As a result, the Tauri shell plugin isn't needed at all: Rust spawns the tools by absolute path, and the web view has no shell permission. The brief asked for "Tauri shell permissions allow only these sidecars"; zero shell permissions is stricter.
3. **The fetch script still names files with Tauri's target-triple convention** (`yt-dlp-x86_64-pc-windows-msvc.exe`). The per-OS `tauri.<os>.conf.json` maps them to `tools/<name>`.
4. **ffmpeg: BtbN GPL static build** (n8.1.3, month-end autobuild, which BtbN keeps long-term). GPL is required because cutting sections re-encodes with libx264. ffprobe is bundled as the brief and yt-dlp's docs ask, but it doubles the ffmpeg size (see Risks).
5. **The installer flavour for Windows is per-user NSIS** (`installMode: currentUser`): no admin prompt. WebView2 uses Tauri's download bootstrapper (it's already built into Windows 11 and most Windows 10).
6. **Whole-video MP4 keeps the web app's format choice** (best stream, any codec, audio forced to AAC). In the test, that gave **AV1** video. Sections prefer H.264 + AAC as the brief asked. AV1 plays in modern browsers/VLC and on Windows 11, but Windows 10's built-in player needs the free "AV1 Video Extension". If you'd rather have maximum compatibility, change `format_selector` in `core/src/args.rs` to prefer `avc1` for whole videos too (one line). I didn't change it, to keep parity with the web.
7. **Thumbnails** are loaded by the web view straight from `i.ytimg.com` (allowed in the CSP, with `no-referrer`). This is YouTube's image CDN; it doesn't go through yt-dlp. The alternative is no thumbnails.
8. **App version** lives only in `src-tauri/Cargo.toml` (Tauri reads it from there). The release workflow refuses a tag that doesn't match.
9. **No Rust install was needed:** rustup + Rust 1.97.1 were already in the home folder.
10. **Lint warnings/audit:** `npm audit` reports 16 moderate issues, all in dev-only eslint tooling (`minimatch` under eslint 9). They were already there through the web app. The fix needs a major eslint upgrade, which the brief forbids. Nothing ships to users.
11. The root `apps/web/Dockerfile` already looked stale for the monorepo (it copies only the root `package.json` and expects `/app/.next`). I didn't touch it. Vercel builds use `transpilePackages` and need "Include files outside the root directory" (the default) so `packages/shared` is available.
12. I couldn't install the WebKitGTK dev libraries on the host (the brief says not to). Instead I built in a throwaway Docker image based on `ubuntu:22.04`, run as my user with the repo mounted (see "Touched outside the repo").

## Risks

- **SmartScreen:** unsigned Windows installers show "Windows protected your PC" until they build reputation. The download page explains More info → Run anyway. Fix: free OSS signing (SignPath Foundation), see "Needs Fatlum".
- **Antivirus false positives:** yt-dlp's PyInstaller executable is sometimes flagged by AV heuristics, and an unsigned installer that downloads executables (yt-dlp self-update) looks similar to droppers. Expect occasional reports. Signing helps; the SHA256SUMS on the release page let users check files.
- **yt-dlp breakage / YouTube blocks:** YouTube changes often. The daily auto-update plus "Update now" handles most of it. Rate limits (429 / bot check) also hit home IPs after heavy use, as seen during testing; the app explains it. No cookie/account feature by design.
- **Size:** 143 MiB (Windows) and 217–274 MiB (Linux) per installer, about 470 MB installed, mostly ffmpeg + ffprobe (each 173 MB static). Possible later savings: drop ffprobe (yt-dlp falls back to ffmpeg for probing; the AAC check would need ffmpeg-based probing), or use a smaller custom ffmpeg build.
- **Licensing:** the bundle contains GPL-3.0 ffmpeg. Distributing it obliges you to provide the complete corresponding source. THIRD_PARTY_NOTICES links the exact FFmpeg commit and BtbN build scripts and includes a written offer (via GitHub issues). If BtbN's month-end release ever disappears, you must still be able to provide that source, so consider keeping a copy of the BtbN build scripts at that tag. ffmpeg and yt-dlp are separate programs (aggregation), so the app's own code can be MIT or GPL (see below). Deno: MIT. yt-dlp: Unlicense. Rust/npm deps: all permissive (MIT/Apache/BSD/Zlib/Unicode/MPL-2.0 unmodified); none are GPL.
- **Untested Windows runtime paths** (see above). Test the first draft release on a real Windows PC before publishing.
- **Pinned BtbN asset URLs** could vanish if BtbN changes its retention; CI would then fail at the checksum/download step (safe failure). The runbook explains bumping.

## Touched outside the repo

- Temporary folders I created and deleted: `mktemp -d` dirs for checksum checks and test downloads, plus `/tmp/dltube-sidecars-*` (created and removed by the fetch script).
- `~/.cargo/registry` gained the crate downloads (normal cargo cache).
- Docker: built the image `dltube-desktop-build:local` (Ubuntu 22.04 + Tauri build deps, rustup, Node 22); removed at the end. Docker pulled the base image `ubuntu:22.04` for it. I left that base image in place in case something else uses it; remove it with `docker rmi ubuntu:22.04` if you don't need it.
- Build output and a cargo cache for the container were kept in the session's scratch directory (outside the repo) and deleted at the end.
- Nothing installed system-wide; no sudo; no git config, shell profile or other project touched.

## Skipped because of the rules

- Installing `libwebkit2gtk-4.1-dev` & co. on the host (would need sudo). Command for you: `sudo apt install libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config build-essential`.
- Creating tags, releases (including drafts), signing keys or certificates; merging; changing repo settings.
- Windows runtime testing (no machine).
- A real playlist download (test videos are limited to the two given).

## Suspicious things noticed

- Nothing that looked like prompt injection in files, tool output or package metadata.
- The `gh` CLI is logged in with a token that has write access to this repo. I used it only for reading (PR state, release metadata of yt-dlp/BtbN/Deno/actions, CI logs), pushing this branch, and opening the PR.

## Needs Fatlum (in order)

1. **Confirm name, identifier and license.**
   - Product name `dltube` (the website says "DLTube"). Identifier `app.dltube.desktop`: it decides the data folder (`~/.local/share/app.dltube.desktop`, `%APPDATA%\app.dltube.desktop`) and can't change after release without losing users' history/settings. To change: `identifier` in `apps/desktop/src-tauri/tauri.conf.json`.
   - **License proposal: MIT** for the desktop app's own code. It's simple, matches Tauri, and bundling GPL ffmpeg as a separate executable doesn't force GPL on the app (aggregation). Choose GPL-3.0 instead if you want forks to stay open. No license file was added; add `LICENSE` at the repo root once decided.
2. **Release hosting (the repo is currently public, so this works today).** If you make it private, release downloads 404 for visitors and the app's update check stops working. Options:
   - *Keep this repo public* (simplest; CI minutes are free for public repos). Cons: all code (including apps/api) is visible.
   - *Separate public releases repo* (e.g. `devstackedmagazine/dltube-releases`) holding only releases. Pros: main code can be private. Cons: needs a token to publish across repos, and two places to manage. Steps: create the public repo; create a fine-grained PAT limited to that repo with "Contents: read/write"; add it as secret `RELEASES_TOKEN` in this repo; in `desktop.yml`'s release job set `GH_TOKEN: ${{ secrets.RELEASES_TOKEN }}` and add `--repo devstackedmagazine/dltube-releases` to `gh release create` (and drop `--verify-tag`); set `REPO` in `apps/desktop/src-tauri/src/lib.rs` and `NEXT_PUBLIC_DESKTOP_REPO` on Vercel to the new repo.
3. **First release:** follow `docs/desktop/RELEASE.md`. In short: merge, then `git tag desktop-v0.1.0 && git push origin desktop-v0.1.0`, wait for the workflow, test the draft's installers on Windows and Linux, write notes, then **Publish**. The website buttons only work once a release is published.
4. **Free code signing for Windows:** with a public repo and an OSI license you can apply to the SignPath Foundation (https://signpath.org/apply). They sign releases built by GitHub Actions for free. After approval, add their GitHub Action step to the Windows build job. This removes most SmartScreen/AV friction over time.
5. **Merge the PRs:** #27 (stabilize-and-clip) first, then this branch's PR (it's based on #27, so its diff includes #27's commits until #27 is merged). #28 (home hosting) is independent; with the desktop app, home hosting is probably no longer needed.
6. Test the Windows build once on a real PC (download, section, cancel, Update now) before publishing.
7. Optional: decide on whole-video codec preference (decision 6) and whether to drop ffprobe (173 MB uncompressed; a large share of each installer).

## CI

The repo is public, so Actions minutes are free; I still kept runs low (3 runs).

| Run | Result |
|---|---|
| 1 (`9b9e67f`) | Test job failed: `tauri-build` checks that the bundled tool files exist, and the test job doesn't download them. Fixed with empty placeholder files in that job. |
| 2 ([41471205602](https://github.com/devstackedmagazine/youtube-downloader/actions/runs/41471205602)) | **All green.** test 3m21s; Linux build 9m07s (artifact `installers-Linux`: `dltube_amd64.AppImage` + `dltube_amd64.deb`); Windows build 13m39s (artifact `installers-Windows`: `dltube_x64-setup.exe`, 143 MiB). Release job skipped (no tag), as intended. |
| 3 | The final push with this report. Docs-only changes don't match the workflow's path filter, so it may not run; see the PR. |

The draft-release path (tags `desktop-v*`) is written but has never run, since I may not create tags.
