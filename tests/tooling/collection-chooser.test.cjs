const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.resolve(__dirname, "../../extension/export/collection-chooser.js"), "utf8");

async function chooserHarness({ grant = true } = {}) {
  const reports = [], calls = [], listeners = [];
  const parent = { postMessage(message, origin) { reports.push({ message, origin }); } };
  const buttons = ["epub", "markdown"].map(format => ({ dataset: { format }, disabled: true,
    addEventListener(event, listener) { this.click = listener; } }));
  const allow = { disabled: true, addEventListener(event, listener) { this.click = listener; } };
  const nodes = { "#allow-images": allow, "#formats": {}, "#image-permission": {}, "#image-hosts": {} };
  const context = { ResizeObserver: class { observe() {} }, window: { addEventListener(type, listener) { if (type === "message") listeners.push(listener); } },
    browser: { permissions: { request(options) { calls.push({ type: "permission", ...options }); return Promise.resolve(grant); } },
      runtime: { async sendMessage(message) { calls.push(message); return { origins: ["https://media.example/*"] }; } } },
    location: { hash: "#test-token" }, document: { addEventListener() {}, querySelector: selector => nodes[selector] || { getBoundingClientRect: () => ({ height: 252 }) }, querySelectorAll: () => buttons },
    parent, Promise, Error, URL
  };
  vm.runInNewContext(source, context);
  const message = (data, origin = "https://www.patreon.com", sender = parent) => {
    for (const fn of listeners) fn({ source: sender, origin, data: { token: "test-token", ...data } });
  };
  message({ source: "patreon-reader-collection-sized", height: 256 });
  await new Promise(setImmediate);
  return { buttons, allow, reports, calls, nodes, message };
}

test("format chooser needs no collection discovery or worker session before selection", async () => {
  const { buttons, reports, calls } = await chooserHarness();
  assert.deepEqual(calls, []);
  assert.ok(buttons.every(button => !button.disabled));
  buttons[0].click();
  await new Promise(setImmediate);
  assert.equal(reports[0].message.source, "patreon-reader-collection-export");
  assert.equal(reports[0].message.format, "epub");
  assert.deepEqual(calls, []);
  assert.ok(buttons.every(button => button.disabled));
});

for (const grant of [true, false]) test(`image permission is requested only by an explicit click; granted=${grant}`, async () => {
  const { allow, calls, message, reports, nodes } = await chooserHarness({ grant });
  const request = { source: "patreon-reader-collection-permission", requestId: "request-one" };
  message(request, "https://evil.example"); message(request, undefined, {});
  await new Promise(setImmediate);
  assert.equal(calls.length, 0);
  message(request);
  await new Promise(setImmediate);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, "GET_COLLECTION_EXPORT_REQUEST");
  assert.equal(nodes["#formats"].hidden, true);
  assert.equal(allow.disabled, false);
  allow.click();
  // request() happens synchronously in the gesture, before any promise wait.
  assert.equal(calls[1].type, "permission");
  assert.deepEqual(Array.from(calls[1].origins), ["https://media.example/*"]);
  await new Promise(setImmediate);
  const result = reports.find(item => item.message.source === "patreon-reader-collection-permission-result").message;
  assert.equal(result.granted, grant);
  assert.equal(result.requestId, "request-one");
});
