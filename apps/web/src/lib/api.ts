"use client";
import { VideoMetadata, DownloadJob, VideoFormat, DownloadQuality } from "../types";

export const fetchMetadata = async (url: string): Promise<VideoMetadata> => {
  const req = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
  if (!req.ok) throw new Error("Failed to fetch metadata");
  return req.json();
};

export const startDownload = async (url: string, format: VideoFormat, quality: DownloadQuality): Promise<DownloadJob> => {
  const req = await fetch(`/api/download`, {
    method: "POST",
    headers: {
       "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, format, quality }),
  });
  if (!req.ok) throw new Error("Failed to start download");
  return req.json();
};

export const getDownloadStatus = async (jobId: string): Promise<DownloadJob> => {
  const req = await fetch(`/api/download/${jobId}`);
  if (!req.ok) throw new Error("Failed to get download status");
  return req.json();
};
