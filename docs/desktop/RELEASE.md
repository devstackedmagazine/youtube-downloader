# Desktop app: release runbook

The desktop app lives in `apps/desktop`. CI is `.github/workflows/desktop.yml`.

## What CI does

| Trigger | Result |
|---|---|
| Push to `master` touching `apps/desktop/**`, `packages/**`, `package-lock.json` or the workflow; every push to a PR whose diff touches those | Tests (shared package, desktop frontend, web, Rust fmt/clippy/tests), then builds the Windows and Linux installers, uploads them as workflow artifacts (kept 14 days), and smoke-tests them (below). |
| Push of a tag `desktop-v<version>` | The same, plus a **draft** GitHub Release with `dltube_x64-setup.exe`, `dltube_amd64.AppImage`, `dltube_amd64.deb` and `SHA256SUMS`. The tag must equal `desktop-v` + the version in `apps/desktop/src-tauri/Cargo.toml`. |

Smoke tests in the build job (a failure blocks the draft release):

- **Linux:** unpacks the `.deb`, runs the bundled `yt-dlp --version`, `ffmpeg -version`, `deno --version`, then the local cut test.
- **Windows:** installs `dltube_x64-setup.exe` silently into `C:\dltube-test`, checks `tools\*.exe` and their versions, runs the local cut test with the installed tools, launches `dltube.exe` and checks it is still running after 20 s with WebView2 started, saves a screenshot (artifact **`windows-smoke-screenshot`**), closes the app and uninstalls silently.
- **Local cut test** (`apps/desktop/scripts/smoke-cut.mjs`): makes a 20 s test video with the bundled ffmpeg, serves it on `127.0.0.1`, and cuts 5–12 s as MP4 (must be H.264 + AAC) and MP3 through `dltube-cli`, i.e. the app's real `runner::download` code. `dltube-cli` is built with the CI-only cargo feature `local-test`, which lets it accept `http://127.0.0.1` media instead of YouTube links. The app itself never has that feature.
- **YouTube from the runner:** one metadata lookup on Windows, only to record in the run summary whether YouTube blocks CI IPs. It never fails the build.

Asset names never contain the version, so `https://github.com/<owner>/<repo>/releases/latest/download/dltube_x64-setup.exe` always points at the newest published release. The website reads `<owner>/<repo>` from `apps/web/src/lib/desktop.ts` (or `NEXT_PUBLIC_DESKTOP_REPO`).

Releases only work for visitors while the repository is **public** (it is, by decision). Until the first release is published, the website shows "Coming soon" and links to the releases page; it checks GitHub's "latest release" at build time and then every 10 minutes, so a newly published release shows up on the site within about 10 minutes, without a redeploy.

## Cut a release

1. Bump the version in **`apps/desktop/src-tauri/Cargo.toml`** (Tauri reads the app version from there; `tauri.conf.json` has none). Also bump `apps/desktop/package.json` to match. Run `cargo check` in `apps/desktop/src-tauri` so `Cargo.lock` updates. Commit and merge to `master`.
2. Tag the merge commit and push the tag:
   ```sh
   git tag desktop-v0.1.0
   git push origin desktop-v0.1.0
   ```
3. Wait for the `desktop` workflow run for the tag (Actions tab). It ends with a draft release.
4. Review the draft (Releases → Drafts):
   - Look at the run's `windows-smoke-screenshot` artifact: the app window should show the Download tab.
   - Download each installer. Check it against `SHA256SUMS` (`sha256sum -c SHA256SUMS --ignore-missing`, or `Get-FileHash` on Windows).
   - Windows: install, then download a short video and a section. Linux: run the AppImage and install the .deb, same check.
   - Edit the notes (what changed).
5. Click **Publish release**. The app's update check (GitHub "latest release") and the website buttons pick it up right away. Users get a "New version available" banner that opens the release page. Nothing auto-installs.

If something is wrong with a draft: delete the draft and the tag, fix, and tag again.

## Bump the bundled tools

All pinned versions and SHA-256 hashes are in **`apps/desktop/sidecars.json`**. `scripts/fetch-sidecars.mjs` downloads exactly those files and refuses anything whose hash differs.

Users' yt-dlp updates itself daily from the official releases, so bumping it in the app only matters for fresh installs. Bump it every release anyway.

### yt-dlp

1. Find the latest release: https://github.com/yt-dlp/yt-dlp/releases/latest (tag like `2026.11.15`).
2. Open its `SHA2-256SUMS` asset and copy the hashes for `yt-dlp_linux` and `yt-dlp.exe`.
3. In `sidecars.json` update `yt-dlp.version`, `source`, both `url`s (the tag is in the path) and both `sha256`.
4. Update the yt-dlp section of `THIRD_PARTY_NOTICES.md` (version/tag).

### FFmpeg (BtbN static builds)

1. Use a **month-end** release from https://github.com/BtbN/FFmpeg-Builds/releases (`autobuild-YYYY-MM-<last day>-…`). BtbN deletes most daily builds after a few weeks but keeps month-end ones.
2. Pick the versioned GPL assets: `ffmpeg-n<ver>-…-linux64-gpl-<branch>.tar.xz` and `…-win64-gpl-<branch>.zip`. Keep the **GPL** variant: it contains libx264, which cutting sections needs.
3. Copy their hashes from that release's `checksums.sha256`.
4. Update `ffmpeg.version`, `source`, `url`s and `sha256` in `sidecars.json`, and the FFmpeg section (version, commit, release link) in `THIRD_PARTY_NOTICES.md`.

### Deno

1. Latest release: https://github.com/denoland/deno/releases/latest.
2. Hashes are in `deno-x86_64-unknown-linux-gnu.zip.sha256sum` and `deno-x86_64-pc-windows-msvc.zip.sha256sum` (lowercase them).
3. Update `deno.*` in `sidecars.json` and the Deno section of `THIRD_PARTY_NOTICES.md`.

### Then

```sh
cd apps/desktop
node scripts/fetch-sidecars.mjs --force            # verifies every hash
src-tauri/binaries/yt-dlp-x86_64-unknown-linux-gnu --version
# offline check of the cut/convert path (same as CI):
(cd src-tauri && cargo build --release -p dltube-core --features local-test --bin dltube-cli)
node scripts/smoke-cut.mjs src-tauri/target/release/dltube-cli src-tauri/binaries "$(mktemp -d)"
# quick real check through the same code as the app (normal build, real YouTube):
cd src-tauri && cargo run --release -p dltube-core --bin dltube-cli -- binaries "$(mktemp -d)" download "https://www.youtube.com/watch?v=jNQXAC9IVRw" mp3 128kbps 5 12
```

## Other dependencies

- npm: `npm install` at the repo root, then `npm run build -w apps/desktop`.
- Rust: edit the pinned versions (`=x.y.z`) in `src-tauri/Cargo.toml` / `core/Cargo.toml`, run `cargo update -p <crate>`, then `cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace`. The Tauri crates and `@tauri-apps/cli`/`@tauri-apps/api` should move together (same minor version).
- After any dependency change: `node apps/desktop/scripts/third-party-deps.mjs` to refresh the license list, and commit it.

## Local development

```sh
npm install                                   # repo root
cd apps/desktop
node scripts/fetch-sidecars.mjs               # ~240 MB on Linux, once
npx tauri dev                                 # needs the Linux libraries below
```

Linux build dependencies (Ubuntu/Debian):

```sh
sudo apt install libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config build-essential
```

The core logic builds and tests without them: `cd apps/desktop/src-tauri && cargo test -p dltube-core`.
