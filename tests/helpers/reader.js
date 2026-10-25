const fs = require("node:fs");
const path = require("node:path");
const extensionRoot = path.resolve(__dirname, "../../extension");
const fixture = fs.readFileSync(path.join(__dirname, "../fixtures/text-image-post.html"), "utf8").trimEnd();

async function setup(page, { stored = {}, namespace = "chrome", content = fixture } = {}) {
  await page.route("https://www.patreon.com/**", (route) => route.fulfill({ contentType: "text/html", body: content }));
  await page.goto("https://www.patreon.com/example/posts/test-123");
  await page.evaluate(({ stored, namespace }) => {
    localStorage.setItem("test-storage", JSON.stringify(stored));
    const listeners = [];
    const messages = [];
    const changes = (old, next) => {
      const result = {};
      for (const key of Object.keys(next)) if (JSON.stringify(old[key]) !== JSON.stringify(next[key])) result[key] = { oldValue: old[key], newValue: next[key] };
      for (const listener of listeners) listener(result, "local");
    };
    const api = {
      runtime: { id: "fixture-extension", onMessage: { addListener: (fn) => messages.push(fn) } },
      storage: {
        local: {
          get: async () => JSON.parse(localStorage.getItem("test-storage")),
          set: async (next) => {
            if (globalThis.failStorage) throw new Error("Storage unavailable");
            const old = JSON.parse(localStorage.getItem("test-storage"));
            localStorage.setItem("test-storage", JSON.stringify({ ...old, ...next }));
            changes(old, next);
          }
        },
        onChanged: { addListener: (fn) => listeners.push(fn) }
      },
      tabs: {
        query: async () => [{ id: 1 }],
        sendMessage: async () => {
          if (globalThis.failMessage) throw new Error("Receiving end does not exist");
          return globalThis.pageReply ?? { isPostPage: true };
        }
      }
    };
    globalThis.setStored = api.storage.local.set;
    globalThis.readStored = api.storage.local.get;
    window.addEventListener("storage", (event) => {
      if (event.key === "test-storage") changes(JSON.parse(event.oldValue || "{}"), JSON.parse(event.newValue || "{}"));
    });
    if (namespace === "browser") globalThis.browser = api;
    else {
      const wrap = (target, name) => {
        const original = target[name];
        target[name] = (...args) => {
          const callback = args.pop();
          original(...args).then(callback, (error) => {
            api.runtime.lastError = { message: error.message };
            callback();
            delete api.runtime.lastError;
          });
        };
      };
      wrap(api.storage.local, "get"); wrap(api.storage.local, "set");
      wrap(api.tabs, "query"); wrap(api.tabs, "sendMessage");
      globalThis.chrome = api;
    }
  }, { stored, namespace });
  await page.addStyleTag({ path: path.join(extensionRoot, "content/content.css") });
  for (const name of ["shared/extension.js", "content/reader.js", "content/content.js"]) await page.addScriptTag({ path: path.join(extensionRoot, name) });
}

const button = (page) => page.getByRole("button", { name: "Customize reading appearance", exact: true });
const dialog = (page) => page.getByRole("dialog", { name: "Reading appearance" });
async function enable(page, value = true) {
  await page.evaluate((readerEnabled) => setStored({ readerEnabled }), value);
}
async function change(page, id, value) {
  await page.locator(`[data-patreon-reader-panel]`).evaluate((host, { id, value }) => {
    const input = host.shadowRoot.getElementById(id);
    if (input.getAttribute("role") === "radiogroup") {
      input.querySelector(`[data-color="${value}"]`).click();
      return;
    }
    input.value = value;
    input.dispatchEvent(new Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  }, { id, value });
}

module.exports = { fixture, extensionRoot, setup, button, dialog, enable, change };
