// Pure helpers for the "download a section" form. Keep the rules in sync with
// check_against_video / DownloadCreate in apps/api.

export const MIN_CLIP_SECONDS = 1;
// YouTube reports whole seconds; the API accepts an end time this far past it.
export const DURATION_TOLERANCE_SECONDS = 1;

/** Parse "ss", "mm:ss" or "hh:mm:ss" (seconds may have decimals). Returns null if invalid. */
export function parseTime(input: string): number | null {
  const parts = input.trim().split(":");
  if (parts.length > 3 || parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  const numbers = parts.map(Number);
  // Only the last part may have decimals; minutes/seconds after the first part must be < 60.
  if (numbers.slice(0, -1).some((n) => !Number.isInteger(n))) return null;
  if (numbers.slice(1).some((n) => n >= 60)) return null;
  return numbers.reduce((total, n) => total * 60 + n, 0);
}

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export interface ClipInput {
  start: string;
  end: string;
}

export interface ClipResult {
  /** Seconds to send to the API; null means "from the start" / "to the end". */
  start_time: number | null;
  end_time: number | null;
  length: number;
  error: string | null;
}

/** Validate the section form. Empty start = from 0, empty end = to the end of the video. */
export function checkClip({ start, end }: ClipInput, duration: number, maxDuration?: number): ClipResult {
  const startValue = start.trim() === "" ? 0 : parseTime(start);
  const endValue = end.trim() === "" ? duration : parseTime(end);
  const fail = (error: string): ClipResult => ({ start_time: null, end_time: null, length: 0, error });

  if (startValue === null) return fail("Start time: use ss, mm:ss or hh:mm:ss.");
  if (endValue === null) return fail("End time: use ss, mm:ss or hh:mm:ss.");
  if (duration && endValue > duration + DURATION_TOLERANCE_SECONDS) return fail(`End time is past the end of the video (${formatTime(duration)}).`);
  if (duration && startValue >= duration) return fail(`Start time is past the end of the video (${formatTime(duration)}).`);
  if (startValue >= endValue) return fail("Start time must be before end time.");

  const length = Math.min(endValue, duration || endValue) - startValue;
  if (length < MIN_CLIP_SECONDS) return fail(`The section must be at least ${MIN_CLIP_SECONDS} second long.`);
  if (maxDuration && length > maxDuration) return fail(`Sections can be at most ${formatTime(maxDuration)} long.`);

  return {
    start_time: startValue > 0 ? startValue : null,
    end_time: duration && endValue >= duration ? null : endValue,
    length,
    error: null,
  };
}
