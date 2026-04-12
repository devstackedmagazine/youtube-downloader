export type VideoFormat = "mp4" | "mp3";

export type QualityMp4 = "1440p" | "1080p" | "720p" | "480p" | "360p";
export type QualityMp3 = "320kbps" | "256kbps" | "128kbps";

export type DownloadQuality = QualityMp4 | QualityMp3;

export interface VideoMetadata {
  id: string;
  title: string;
  duration: number; // in seconds
  thumbnail: string;
  channel: string;
  formats: {
    format_id: string;
    ext: string;
    resolution: string;
    quality: number;
  }[];
}

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
}
