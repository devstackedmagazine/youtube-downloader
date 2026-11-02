export * from "@dltube/shared/types";

export type DownloadStatus = 
  | "idle" // User hasn't inputted anything
  | "fetching" // Fetching metadata
  | "ready" // Metadata fetched, ready to select format/quality
  | "processing" // Selected, sent to backend, waiting for conversion
  | "completed" // Done, link available
  | "failed"; // Error state

export interface DownloadJob {
  id: string;
  status: DownloadStatus;
  progress: number;
  eta: string;
  error_message?: string;
  download_link?: string;
  start_time?: number | null;
  end_time?: number | null;
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
}
