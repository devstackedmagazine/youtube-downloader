// Pure display helpers for the queue and history.
import { formatTime } from "@dltube/shared/time";

export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export const formatSpeed = (bytesPerSecond: number | null) => (bytesPerSecond ? `${formatBytes(bytesPerSecond)}/s` : "");

export const formatEta = (seconds: number | null) => (seconds === null ? "" : `${formatTime(seconds)} left`);

/** "0:05–0:12" for a section, "" for a whole video. */
export function sectionLabel(start: number | null, end: number | null, duration: number): string {
  if (start === null && end === null) return "";
  return `${formatTime(start ?? 0)}–${end === null ? (duration ? formatTime(duration) : "end") : formatTime(end)}`;
}
