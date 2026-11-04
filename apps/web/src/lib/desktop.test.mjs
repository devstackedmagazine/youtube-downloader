// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { releaseStatusFrom } from "./desktop.ts";

test("published release", () => {
  assert.deepEqual(releaseStatusFrom(200, { tag_name: "desktop-v0.1.0" }), { state: "available", version: "0.1.0" });
});

test("no published release yet (GitHub answers 404)", () => {
  assert.deepEqual(releaseStatusFrom(404, null), { state: "none" });
});

test("rate limit or odd reply is unknown, not 'none'", () => {
  assert.deepEqual(releaseStatusFrom(403, null), { state: "unknown" });
  assert.deepEqual(releaseStatusFrom(200, {}), { state: "unknown" });
});
