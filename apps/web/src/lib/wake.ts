/**
 * Render's free tier puts the API to sleep after 15 minutes without traffic, and waking takes about a minute.
 * Meanwhile Render's proxy answers with an HTML page that has no CORS headers, so fetch throws or returns a
 * non-JSON 502-504. Retry only those until the deadline; the API's own errors are JSON and come back at once.
 */
export async function fetchWhileWaking(url: string, init?: RequestInit, deadlineMs = 90_000, delayMs = 3_000): Promise<Response> {
  const giveUpAt = Date.now() + deadlineMs;
  for (;;) {
    try {
      const response = await fetch(url, init);
      const waking = response.status >= 502 && response.status <= 504 && !response.headers.get("content-type")?.includes("json");
      if (!waking || Date.now() >= giveUpAt) return response;
    } catch (error) {
      if (Date.now() >= giveUpAt) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
