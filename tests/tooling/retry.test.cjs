const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const scope = { AbortController, Error, Set, Date, Math, setTimeout, clearTimeout };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../extension/shared/retry.js"), "utf8"), scope);
const retry = scope.PatreonRetry;
const response = (status, after) => ({ status, headers: { get: () => after } });

test("transient reads back off twice, preserve successful values, and stop at three attempts", async () => {
  const waits = [], updates = []; let calls = 0;
  const value = await retry.run(async () => { if (++calls < 3) throw retry.httpError(response(503), "Synthetic failure"); return "complete"; }, {
    sleep: async ms => waits.push(ms), random: () => 0, onRetry: update => updates.push(update)
  });
  assert.equal(value, "complete"); assert.equal(calls, 3); assert.deepEqual(waits, [1000, 2000]);
  assert.deepEqual(updates.map(update => update.attempt), [2, 3]);
  calls = 0;
  await assert.rejects(retry.run(async () => { calls++; throw retry.networkError(new TypeError("Synthetic network failure")); }, { sleep: async () => {}, random: () => 0 }), /network failure/);
  assert.equal(calls, 3);
});

test("permanent errors, permissions, validation and cancellation are never auto-retried", async () => {
  for (const error of [retry.httpError(response(401), "Access"), retry.httpError(response(403), "Access"), retry.httpError(response(404), "Missing"),
    new Error("Permission denied"), new Error("Unsupported content"), new Error("Storage full"), new Error("Invalid image")]) {
    let calls = 0;
    await assert.rejects(retry.run(async () => { calls++; throw error; }, { sleep: async () => assert.fail("Unexpected delay") }));
    assert.equal(calls, 1);
  }
  const controller = new AbortController(); let attempts = 0;
  await assert.rejects(retry.run(async () => { attempts++; throw retry.httpError(response(503), "Server"); }, {
    signal: controller.signal, onRetry: () => controller.abort(new Error("Cancelled during backoff")), sleep: async () => assert.fail("Unexpected delay")
  }), /Cancelled/);
  assert.equal(attempts, 1);
});

test("Retry-After supports seconds and HTTP dates and does not shorten long server waits", async () => {
  assert.equal(retry.httpError(response(429, "10"), "Rate limit").retryAfterMs, 10_000);
  const future = new Date(Date.now() + 20_000).toUTCString();
  assert.ok(retry.httpError(response(503, future), "Server").retryAfterMs >= 19_000);
  const waits = []; let calls = 0;
  await retry.run(async () => { if (++calls === 1) throw retry.httpError(response(429, "5"), "Rate limit"); return true; }, { random: () => 0, sleep: async ms => waits.push(ms) });
  assert.deepEqual(waits, [5000]);
  calls = 0;
  await assert.rejects(retry.run(async () => { calls++; throw retry.httpError(response(429, "120"), "Rate limit"); }, { sleep: async () => assert.fail("Long wait must be manual") }));
  assert.equal(calls, 1);
});

test("timeouts retry boundedly and a cancelled backoff wakes immediately", async () => {
  let calls = 0;
  await assert.rejects(retry.run(async ({ signal }) => { calls++; return new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })); }, {
    timeoutMs: 1, sleep: async () => {}
  }), /timed out/);
  assert.equal(calls, 3);
  const controller = new AbortController(); const waiting = retry.wait(60_000, controller.signal);
  controller.abort(new Error("Cancelled")); await assert.rejects(waiting, /Cancelled/);
});
