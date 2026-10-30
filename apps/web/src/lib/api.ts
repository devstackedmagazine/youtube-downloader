"use client";
import { VideoMetadata, DownloadJob, VideoFormat, DownloadQuality, DownloadScope, DownloadStatus, ClipRange } from "../types";

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
  start_time?: number | null;
  end_time?: number | null;
};

/** The API sends {detail}; accept message/error too, and FastAPI's list-shaped detail. */
function errorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const body = data as { detail?: unknown; message?: unknown; error?: unknown };
  for (const value of [body.detail, body.message, body.error]) {
    if (typeof value === "string" && value) return value;
    if (Array.isArray(value) && value.length) {
      return value.map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : String(item))).join("; ");
    }
  }
  return fallback;
}

async function request<T>(path: string, fallbackError: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error("We could not reach the server. Check your connection and try again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(data, fallbackError));
  return data as T;
}

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
    start_time: data.start_time ?? null,
    end_time: data.end_time ?? null,
  };
}

export const fetchMetadata = async (url: string): Promise<VideoMetadata> => {
  const data = await request<VideoMetadata & { thumbnail_url?: string }>(
    `/api/metadata?url=${encodeURIComponent(url)}`, "Failed to fetch metadata",
  );
  return {
    id: data.id,
    title: data.title,
    duration: data.duration,
    thumbnail: data.thumbnail || data.thumbnail_url || "",
    channel: data.channel,
    formats: data.formats || [],
    is_live: Boolean(data.is_live),
    is_playlist: Boolean(data.is_playlist),
    playlist_count: Number(data.playlist_count || 0),
    playlist_title: data.playlist_title || null,
    max_duration_seconds: data.max_duration_seconds,
  };
};

export const startDownload = async (
  url: string, format: VideoFormat, quality: DownloadQuality, scope: DownloadScope = "single", clip?: ClipRange,
): Promise<DownloadJob> => {
  const data = await request<DownloadApiResponse>("/api/download", "Failed to start download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ youtube_url: url, format, quality, scope, ...clip }),
  });
  return normalizeJob(data);
};

export const getDownloadStatus = async (jobId: string): Promise<DownloadJob> => {
  const data = await request<DownloadApiResponse>(`/api/download/${encodeURIComponent(jobId)}/status`, "Failed to get download status");
  return normalizeJob(data);
};
