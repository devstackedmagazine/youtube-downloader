import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBytes, formatEta, formatSpeed, sectionLabel } from "./format.ts";

test("formatBytes", () => {
  assert.equal(formatBytes(null), "");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
  assert.equal(formatBytes(3 * 1024 ** 4), "3072.0 GB");
});

test("speed and eta", () => {
  assert.equal(formatSpeed(null), "");
  assert.equal(formatSpeed(2048), "2.0 KB/s");
  assert.equal(formatEta(null), "");
  assert.equal(formatEta(75), "1:15 left");
});

test("sectionLabel", () => {
  assert.equal(sectionLabel(null, null, 19), "");
  assert.equal(sectionLabel(5, 12, 19), "0:05–0:12");
  assert.equal(sectionLabel(300, null, 596), "5:00–9:56");
  assert.equal(sectionLabel(null, 30, 0), "0:00–0:30");
  assert.equal(sectionLabel(5, null, 0), "0:05–end");
});
