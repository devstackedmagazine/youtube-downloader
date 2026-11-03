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
  releases: `https://github.com/${DESKTOP_REPO}/releases`,
};

/** "available": a published release exists. "none": not yet (drafts don't count). "unknown": GitHub didn't say. */
export type ReleaseStatus = { state: "available"; version: string } | { state: "none" } | { state: "unknown" };

export function releaseStatusFrom(httpStatus: number, body: unknown): ReleaseStatus {
  if (httpStatus === 404) return { state: "none" };
  const tag = httpStatus === 200 && typeof body === "object" && body !== null ? (body as { tag_name?: unknown }).tag_name : null;
  return typeof tag === "string" ? { state: "available", version: tag.replace(/^desktop-v/, "") } : { state: "unknown" };
}

/** Checked at build time and then at most every 10 minutes (ISR), so visitors never hit GitHub's API. */
export async function getReleaseStatus(): Promise<ReleaseStatus> {
  try {
    const res = await fetch(`https://api.github.com/repos/${DESKTOP_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 600 },
    });
    return releaseStatusFrom(res.status, res.ok ? await res.json() : null);
  } catch {
    return { state: "unknown" };
  }
}
