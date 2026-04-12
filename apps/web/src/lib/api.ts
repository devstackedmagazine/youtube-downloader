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

// Mock Authentication Services
import { User } from "../types";

const mockDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockSignup = async (email: string, password: string): Promise<{ user: User; token: string }> => {
  await mockDelay(1000);
  const user: User = { id: Math.random().toString(36).substr(2, 9), email, createdAt: new Date().toISOString() };
  return { user, token: "mock-jwt-token" };
};

export const mockLogin = async (email: string, password: string): Promise<{ user: User; token: string }> => {
  await mockDelay(1000);
  const user: User = { id: "mock_user_1", email, createdAt: new Date().toISOString() };
  return { user, token: "mock-jwt-token" };
};

export const mockLogout = async (): Promise<void> => {
  await mockDelay(500);
};

export const mockResetPassword = async (email: string, code?: string, newPassword?: string): Promise<void> => {
  await mockDelay(1000);
};
