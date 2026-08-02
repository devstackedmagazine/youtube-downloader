"use client";
import { VideoMetadata, DownloadJob, VideoFormat, DownloadQuality, DownloadScope, DownloadStatus } from "../types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

type DownloadApiResponse = {
  id: string;
  status: string;
  progress?: number;
  eta_seconds?: number;
  download_url?: string;
  thumbnail_url?: string;
  download_link?: string;
  error_message?: string;
};

function normalizeJob(data: DownloadApiResponse): DownloadJob {
  const status = (data.status === "pending" ? "processing" : data.status) as DownloadStatus;
  const rawDownloadLink = data.download_link ?? data.download_url;
  return {
    id: data.id,
    status,
    progress: Number(data.progress ?? 0),
    eta: data.eta_seconds ? `${data.eta_seconds}s` : data.status === "pending" ? "Queued" : "Calculating...",
    error_message: data.error_message,
    download_link: rawDownloadLink?.startsWith("/") ? `${API_BASE}${rawDownloadLink}` : rawDownloadLink,
  };
}

export const fetchMetadata = async (url: string): Promise<VideoMetadata> => {
  const req = await fetch(`${API_BASE}/api/metadata?url=${encodeURIComponent(url)}`);
  const data = await req.json().catch(() => null);
  if (!req.ok) throw new Error(data?.detail || "Failed to fetch metadata");
  return {
    id: data.id,
    title: data.title,
    duration: data.duration,
    thumbnail: data.thumbnail || data.thumbnail_url,
    channel: data.channel,
    formats: data.formats || [],
    is_playlist: Boolean(data.is_playlist),
    playlist_count: Number(data.playlist_count || 0),
    playlist_title: data.playlist_title || null,
  };
};

export const startDownload = async (url: string, format: VideoFormat, quality: DownloadQuality, scope: DownloadScope = "single"): Promise<DownloadJob> => {
  const req = await fetch(`${API_BASE}/api/download`, {
    method: "POST",
    headers: {
       "Content-Type": "application/json",
    },
    body: JSON.stringify({ youtube_url: url, format, quality, scope }),
  });
  const data = await req.json().catch(() => null);
  if (!req.ok) throw new Error(data?.detail || "Failed to start download");
  return normalizeJob(data);
};

export const getDownloadStatus = async (jobId: string): Promise<DownloadJob> => {
  const req = await fetch(`${API_BASE}/api/download/${jobId}/status`);
  const data = await req.json().catch(() => null);
  if (!req.ok) throw new Error(data?.detail || "Failed to get download status");
  return normalizeJob(data);
};
