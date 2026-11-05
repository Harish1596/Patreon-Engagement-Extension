const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.resolve(__dirname, "../../extension/background/retention.js"), "utf8");

function fixture() {
  let time = 1000;
  let windows = 1;
  let cleared = 0;
  let swept = 0;
  let deadline = time + 2 * 60 * 60_000;
  let data = ["synthetic export source"];
  const preferences = { readerEnabled: true, readerPreferences: { font: "georgia", fontSize: 22 } };
  const events = {};
  const alarms = new Map();
  const browser = {
    runtime: { onStartup: { addListener: fn => { events.startup = fn; } } },
    alarms: {
      async get(name) { return alarms.get(name); },
      async clear(name) { return alarms.delete(name); },
      async create(name, { when }) { alarms.set(name, { name, scheduledTime: when }); },
      onAlarm: { addListener: fn => { events.alarm = fn; } }
    },
    windows: {
      async getAll() { return Array.from({ length: windows }, (_, id) => ({ id, type: "normal" })); },
      onRemoved: { addListener: fn => { events.removed = fn; } },
      onCreated: { addListener: fn => { events.created = fn; } }
    },
    storage: { local: { async clear() { throw new Error("Reader preferences must not be cleared"); } } }
  };
  let retention;
  function restartWorker() {
    const scope = { browser };
    vm.runInNewContext(source, scope);
    retention = scope.PatreonExportRetention.create({ now: () => time });
    retention.register({ ready: Promise.resolve(), deadline: () => deadline,
      async sweep() { swept++; if (deadline <= time) { data = []; deadline = Infinity; } },
      async clear() { cleared++; data = []; deadline = Infinity; }
    });
    return retention;
  }
  restartWorker();
  async function flush() { await retention.wait(); await new Promise(resolve => setImmediate(resolve)); }
  return { api: browser, events, alarms, preferences, restartWorker, flush,
    controller: () => retention, data: () => data, cleared: () => cleared, swept: () => swept,
    advance: milliseconds => { time += milliseconds; }, windows: count => { windows = count; } };
}

test("an expiry alarm cleans idle export data without user action and disarms when empty", async () => {
  const h = fixture();
  await h.flush();
  const alarm = h.alarms.get("patreon-export-expiry");
  assert.equal(alarm.scheduledTime, 1000 + 2 * 60 * 60_000);
  h.advance(2 * 60 * 60_000);
  h.events.alarm(alarm);
  await h.flush();
  assert.equal(h.swept(), 1);
  assert.deepEqual(h.data(), []);
  assert.equal(h.alarms.size, 0);
});

test("only closing the last window clears export data and opening a new window resumes requests", async () => {
  const h = fixture();
  h.windows(1);
  h.events.removed();
  await h.flush();
  assert.equal(h.cleared(), 0);
  h.windows(0);
  h.events.removed();
  await h.flush();
  assert.equal(h.cleared(), 1);
  assert.equal(h.controller().isClosed(), true);
  assert.deepEqual(h.preferences, { readerEnabled: true, readerPreferences: { font: "georgia", fontSize: 22 } });
  h.windows(1);
  h.events.created();
  await h.flush();
  assert.equal(h.controller().isClosed(), false);
});

test("idle worker restart preserves live caches; browser startup clears leftovers without changing preferences", async () => {
  const h = fixture();
  await h.flush();
  h.restartWorker();
  await h.flush();
  assert.equal(h.data().length, 1);
  assert.equal(h.cleared(), 0);
  h.events.startup();
  await h.flush();
  assert.deepEqual(h.data(), []);
  assert.equal(h.cleared(), 1);
  assert.equal(h.preferences.readerEnabled, true);
  assert.equal(h.preferences.readerPreferences.font, "georgia");
});

test("overlapping cleanup and alarm scheduling leave no stale wakeup after data is cleared", async () => {
  const h = fixture();
  const original = h.api.alarms.get;
  let entered;
  let release;
  let held = false;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  h.api.alarms.get = async name => {
    if (!held) { held = true; entered(); await gate; }
    return original(name);
  };
  await started;
  h.events.startup();
  await h.controller().wait();
  release();
  await h.flush();
  assert.deepEqual(h.data(), []);
  assert.equal(h.alarms.size, 0);
});
