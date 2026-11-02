# Third-party notices

dltube bundles the following programs. They are separate executables that dltube runs as child processes; each keeps its own license. Exact versions are pinned in `apps/desktop/sidecars.json`.

## yt-dlp

- Version: see Settings → yt-dlp (the bundled copy is 2026.10.26; dltube may update it from the official releases).
- License: The Unlicense (public domain dedication). Some bundled dependencies in the standalone executable have their own licenses, listed in yt-dlp's `THIRD_PARTY_LICENSES.txt`.
- Source: https://github.com/yt-dlp/yt-dlp (tag 2026.10.26)
- Binaries: https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.26

## FFmpeg (ffmpeg and ffprobe)

- Version: n8.1.3-27-g8dca1586f4, static GPL build by BtbN (release `autobuild-2026-10-31-12-59`).
- License: GNU General Public License version 3 or later (the build includes GPL components such as libx264, which dltube uses to cut sections precisely).
- Binaries: https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-10-31-12-59
- Complete corresponding source:
  - FFmpeg at commit `8dca1586f4`: https://github.com/FFmpeg/FFmpeg/tree/8dca1586f4 (release/8.1 branch)
  - Build scripts and the exact versions of every bundled library: https://github.com/BtbN/FFmpeg-Builds (the scripts in that repository at the release above)
- Written offer: for three years after we distribute a dltube version, you can ask us for the complete corresponding source of the FFmpeg build it contains by opening an issue at https://github.com/devstackedmagazine/youtube-downloader/issues.

The GPL text: https://www.gnu.org/licenses/gpl-3.0.html

## Deno

- Version: 2.9.8. yt-dlp uses it to run YouTube's JavaScript challenges.
- License: MIT. Copyright 2018-2026 the Deno authors.
- Source: https://github.com/denoland/deno/tree/v2.9.8

## Tauri and Rust crates

The dltube application itself is built with Tauri (MIT or Apache-2.0) and the Rust crates and npm packages listed below with their declared licenses.
