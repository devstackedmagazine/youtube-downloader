export const UNREACHABLE_MESSAGE =
  "Our download server isn't reachable right now. It may be starting up or offline. Please try again in a minute.";
export const YOUTUBE_BLOCKED_MESSAGE =
  "YouTube is blocking our download server at the moment, so downloads can't start. Your link is fine; please try again later.";

/**
 * The message to show for a failed API call. `detail` is the API's JSON message, or null
 * when the body wasn't the API's JSON (a hosting proxy's error page, or no response at all).
 */
export function friendlyError(status: number | null, detail: string | null, fallback: string): string {
  if (status === null || (status >= 502 && status <= 504 && detail === null)) return UNREACHABLE_MESSAGE;
  // shortcut: matches the API's YouTubeBlockedError text; switch to an error code if more 503 kinds appear.
  if (status === 503 && detail && /youtube is blocking/i.test(detail)) return YOUTUBE_BLOCKED_MESSAGE;
  return detail || fallback;
}
