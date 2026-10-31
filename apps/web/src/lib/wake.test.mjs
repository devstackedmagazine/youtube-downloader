// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchWhileWaking } from "./wake.ts";

function stubFetch(replies) {
  let calls = 0;
  globalThis.fetch = async () => {
    const reply = replies[Math.min(calls++, replies.length - 1)];
    if (reply === "network") throw new TypeError("Failed to fetch");
    return new Response(reply.body, { status: reply.status, headers: { "content-type": reply.type } });
  };
  return () => calls;
}

test("retries while the proxy is waking the API, then returns the API response", async () => {
  const calls = stubFetch(["network", { status: 503, type: "text/html", body: "<html>" }, { status: 200, type: "application/json", body: "{}" }]);
  const response = await fetchWhileWaking("https://api.test/x", undefined, 1000, 1);
  assert.equal(response.status, 200);
  assert.equal(calls(), 3);
});

test("does not retry the API's own JSON errors", async () => {
  const calls = stubFetch([{ status: 503, type: "application/json", body: '{"detail":"Redis down"}' }]);
  assert.equal((await fetchWhileWaking("https://api.test/x", undefined, 1000, 1)).status, 503);
  assert.equal(calls(), 1);
});

test("gives up after the deadline", async () => {
  stubFetch(["network"]);
  await assert.rejects(fetchWhileWaking("https://api.test/x", undefined, 20, 5), TypeError);
});
