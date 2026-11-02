// The one place that says where desktop installers are published (GitHub owner/repo).
// Override with NEXT_PUBLIC_DESKTOP_REPO, e.g. if releases move to a separate public repo.
export const DESKTOP_REPO = process.env.NEXT_PUBLIC_DESKTOP_REPO || "devstackedmagazine/youtube-downloader";

const latest = `https://github.com/${DESKTOP_REPO}/releases/latest`;

/** Stable asset names produced by .github/workflows/desktop.yml. */
export const desktopDownloads = {
  windows: `${latest}/download/dltube_x64-setup.exe`,
  appImage: `${latest}/download/dltube_amd64.AppImage`,
  deb: `${latest}/download/dltube_amd64.deb`,
  checksums: `${latest}/download/SHA256SUMS`,
  releases: latest,
};
