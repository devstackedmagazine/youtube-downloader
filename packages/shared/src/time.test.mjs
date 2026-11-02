// Run with: npm test (Node's built-in test runner + type stripping, no extra deps).
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkClip, formatTime, parseTime } from "./time.ts";

test("parseTime accepts ss, mm:ss, hh:mm:ss", () => {
  assert.equal(parseTime("5"), 5);
  assert.equal(parseTime("90"), 90);
  assert.equal(parseTime("1:15"), 75);
  assert.equal(parseTime("01:02:05"), 3725);
  assert.equal(parseTime(" 0:05.5 "), 5.5);
});

test("parseTime rejects malformed input", () => {
  for (const bad of ["", "abc", "1:60", "1:2:3:4", "-5", "1.5:00", "1::2", "1:61:00"]) {
    assert.equal(parseTime(bad), null, bad);
  }
});

test("formatTime", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(75), "1:15");
  assert.equal(formatTime(3725), "1:02:05");
  assert.equal(formatTime(-3), "0:00");
});

test("checkClip: valid section", () => {
  assert.deepEqual(checkClip({ start: "0:05", end: "12" }, 19), { start_time: 5, end_time: 12, length: 7, error: null });
});

test("checkClip: empty start/end mean video boundaries", () => {
  assert.deepEqual(checkClip({ start: "5", end: "" }, 19), { start_time: 5, end_time: null, length: 14, error: null });
  assert.deepEqual(checkClip({ start: "", end: "12" }, 19), { start_time: null, end_time: 12, length: 12, error: null });
  assert.equal(checkClip({ start: "0", end: "19.5" }, 19).end_time, null);
});

test("checkClip: errors mirror the API rules", () => {
  const error = (start, end, duration = 19, max) => checkClip({ start, end }, duration, max).error;
  assert.match(error("x", "5"), /Start time/);
  assert.match(error("1", "1:99"), /End time/);
  assert.match(error("12", "5"), /before end/);
  assert.match(error("5", "5.5"), /at least 1 second/);
  assert.match(error("5", "25"), /past the end/);
  assert.match(error("19", ""), /past the end/);
  assert.equal(error("5", "19.8"), null); // within tolerance
  assert.match(error("0", "700", 3600, 600), /at most 10:00/);
  assert.equal(error("20:00", "21:00", 3600, 600), null); // short clip of a long video
});
