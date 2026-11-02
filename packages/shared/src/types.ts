// Types shared by apps/web and apps/desktop.

export type VideoFormat = "mp4" | "mp3";
export type DownloadScope = "single" | "playlist";

/** Heights prefer H.264 + AAC (plays everywhere); "best" takes any codec (often AV1/VP9). */
export type QualityMp4 = "1080p" | "720p" | "480p" | "360p" | "best";
export type QualityMp3 = "320kbps" | "256kbps" | "128kbps";

export type DownloadQuality = QualityMp4 | QualityMp3;

export const MP4_QUALITIES: QualityMp4[] = ["1080p", "720p", "480p", "360p", "best"];

export const QUALITY_LABELS: Partial<Record<DownloadQuality, string>> = {
  best: "Best quality (may be AV1/VP9, may not play in older players)",
};
export const MP3_QUALITIES: QualityMp3[] = ["320kbps", "256kbps", "128kbps"];

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
  is_live?: boolean;
  is_playlist?: boolean;
  playlist_count?: number;
  playlist_title?: string | null;
  /** Longest video or section (seconds) the server will process. */
  max_duration_seconds?: number;
}

/** Optional section of a single video, in seconds. null = from the start / to the end. */
export interface ClipRange {
  start_time: number | null;
  end_time: number | null;
}
