// Typed wrappers around the Rust commands in src-tauri/src/lib.rs.
import { invoke } from "@tauri-apps/api/core";
import type { DownloadQuality, VideoFormat } from "@dltube/shared/types";

export interface Metadata {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  channel: string;
  is_live: boolean;
  is_playlist: boolean;
  playlist_count: number;
  playlist_title: string | null;
}

export interface DownloadRequest {
  url: string;
  format: VideoFormat;
  quality: DownloadQuality;
  playlist: boolean;
  start: number | null;
  end: number | null;
  title: string;
  duration: number;
}

export interface Progress {
  percent: number | null;
  downloaded_bytes: number | null;
  total_bytes: number | null;
  speed: number | null;
  eta_seconds: number | null;
  item: number | null;
  items: number | null;
  status: string;
}

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface Job {
  id: number;
  request: DownloadRequest;
  status: JobStatus;
  progress: Progress | null;
  error: string | null;
  output: string | null;
}

export interface HistoryEntry {
  id: number;
  title: string;
  format: VideoFormat;
  quality: string;
  start: number | null;
  end: number | null;
  playlist: boolean;
  items: number;
  path: string;
  date: number;
}

export interface Settings {
  output_dir: string;
  ytdlp_version: string;
  auto_update: boolean;
  last_check: number;
  app_version: string;
}

export interface AppRelease {
  version: string;
  url: string;
}

interface SidecarSpec {
  version: string;
  license: string;
  source: string;
}

export interface About {
  version: string;
  license: string;
  notices: string;
  sidecars: Record<string, SidecarSpec | string>;
}

/** Rust returns errors as plain strings. */
export const errorText = (error: unknown) => (typeof error === "string" ? error : error instanceof Error ? error.message : "Something went wrong.");

export const api = {
  metadata: (url: string, single: boolean) => invoke<Metadata>("get_metadata", { url, single }),
  enqueue: (request: DownloadRequest) => invoke<number>("enqueue", { request }),
  cancel: (id: number) => invoke<void>("cancel", { id }),
  jobs: () => invoke<Job[]>("jobs"),
  clearFinished: () => invoke<void>("clear_finished"),
  history: () => invoke<HistoryEntry[]>("history"),
  clearHistory: () => invoke<void>("clear_history"),
  openEntry: (id: number, reveal: boolean) => invoke<void>("open_entry", { id, reveal }),
  settings: () => invoke<Settings>("settings"),
  chooseOutputDir: () => invoke<string | null>("choose_output_dir"),
  setAutoUpdate: (enabled: boolean) => invoke<void>("set_auto_update", { enabled }),
  updateYtdlp: () => invoke<string>("update_ytdlp"),
  checkAppUpdate: () => invoke<AppRelease | null>("check_app_update"),
  openRelease: (url: string) => invoke<void>("open_release", { url }),
  about: () => invoke<About>("about"),
};
