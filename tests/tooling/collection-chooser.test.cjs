const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.resolve(__dirname, "../../extension/export/collection-chooser.js"), "utf8");

async function chooserHarness({ missingAtLoad = false } = {}) {
  let missing = missingAtLoad;
  const reports = [], calls = [];
  const buttons = ["epub", "markdown"].map(format => ({ dataset: { format }, disabled: true,
    addEventListener(event, listener) { this.click = listener; } }));
  vm.runInNewContext(source, {
    browser: { runtime: { async sendMessage(message) {
      calls.push(message.type);
      if (missing) return { error: "The collection export request expired. Reopen Download." };
      if (message.type === "GET_COLLECTION_EXPORT_REQUEST") return { origins: [] };
      return { started: true };
    } } },
    location: { hash: "#test-token" }, document: { querySelectorAll: () => buttons },
    parent: { postMessage(message, origin) { reports.push({ message, origin }); } }, Promise, Error
  });
  await new Promise(setImmediate);
  return { buttons, reports, calls, loseSession() { missing = true; } };
}

test("expired click reports directly to the owner rather than through the missing session", async () => {
  const { buttons, reports, calls, loseSession } = await chooserHarness();
  assert.ok(buttons.every(button => !button.disabled));
  loseSession();
  buttons[0].click();
  await new Promise(setImmediate);
  assert.deepEqual(calls, ["GET_COLLECTION_EXPORT_REQUEST", "DELIVER_COLLECTION_EXPORT"]);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].message.source, "patreon-reader-collection-error");
  assert.equal(reports[0].message.token, "test-token");
  assert.match(reports[0].message.error, /expired/);
  assert.equal(reports[0].origin, "https://www.patreon.com");
  assert.ok(buttons.every(button => !button.disabled));
});

test("missing session on chooser load reports an error instead of silently disabling buttons", async () => {
  const { buttons, reports } = await chooserHarness({ missingAtLoad: true });
  assert.ok(buttons.every(button => button.disabled));
  assert.match(reports[0].message.error, /expired/);
});
