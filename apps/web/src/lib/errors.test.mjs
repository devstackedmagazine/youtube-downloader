// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { UNREACHABLE_MESSAGE, YOUTUBE_BLOCKED_MESSAGE, friendlyError } from "./errors.ts";

test("no response at all means the server is unreachable", () => {
  assert.equal(friendlyError(null, null, "x"), UNREACHABLE_MESSAGE);
});

test("a proxy's non-JSON 502-504 means the server is unreachable", () => {
  for (const status of [502, 503, 504]) assert.equal(friendlyError(status, null, "x"), UNREACHABLE_MESSAGE);
});

test("the API's YouTube-blocked 503 gets the friendly explanation", () => {
  const detail = "YouTube is blocking downloads from our server right now. Please try again later.";
  assert.equal(friendlyError(503, detail, "x"), YOUTUBE_BLOCKED_MESSAGE);
});

test("other API errors keep their own message, or the fallback", () => {
  assert.equal(friendlyError(503, "The service is temporarily unavailable. Please try again shortly.", "x"),
    "The service is temporarily unavailable. Please try again shortly.");
  assert.equal(friendlyError(400, "Invalid YouTube URL", "x"), "Invalid YouTube URL");
  assert.equal(friendlyError(500, null, "Failed to fetch metadata"), "Failed to fetch metadata");
});
