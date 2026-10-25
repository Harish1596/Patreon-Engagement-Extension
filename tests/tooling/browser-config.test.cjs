const { test } = require("node:test");
const assert = require("node:assert/strict");
const { browserExecutable } = require("../../scripts/browser-config");

test("browser-specific override wins; invalid overrides fail clearly", () => {
  assert.equal(browserExecutable("brave", { env: { BRAVE_EXECUTABLE: "/custom/brave", BROWSER_EXECUTABLE: "/other" }, exists: () => true }), "/custom/brave");
  assert.equal(browserExecutable("chrome", { env: { BROWSER_EXECUTABLE: "/custom/chrome" }, exists: () => true }), "/custom/chrome");
  assert.throws(() => browserExecutable("chrome", { env: { CHROME_EXECUTABLE: "/missing" }, exists: () => false }), /does not exist/);
});
test("discovers macOS, Linux, and Windows candidates without fixed host assumptions", () => {
  assert.equal(browserExecutable("brave", { platform: "darwin", env: {}, exists: () => true }), "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser");
  assert.equal(browserExecutable("chrome", { platform: "linux", env: {}, exists: file => file === "/usr/bin/chromium" }), "/usr/bin/chromium");
  assert.equal(browserExecutable("chrome", { platform: "win32", env: { LOCALAPPDATA: "C:\\Users\\Example\\AppData\\Local" }, exists: () => true }), "C:\\Users\\Example\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe");
});
test("missing or unknown browsers produce actionable errors", () => {
  assert.throws(() => browserExecutable("brave", { env: {}, exists: () => false }), /BRAVE_EXECUTABLE/);
  assert.throws(() => browserExecutable("unknown"), /Unsupported test browser/);
});
