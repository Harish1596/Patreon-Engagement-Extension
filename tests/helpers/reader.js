const fs = require("node:fs");
const path = require("node:path");
const extensionRoot = path.resolve(__dirname, "../../extension");
const fixture = fs.readFileSync(path.join(__dirname, "../fixtures/text-image-post.html"), "utf8").trimEnd();
const contentScripts = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8")).content_scripts[0];

async function setup(page, { stored = {}, namespace = "chrome", content = fixture,
  url = "https://www.patreon.com/example/posts/test-123" } = {}) {
  await page.route("https://www.patreon.com/**", (route) => route.fulfill({ contentType: "text/html", body: content }));
  await page.route("https://fixture-extension.invalid/export/chooser.html**", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html><body><main aria-label="Post export formats">
      <button data-format="pdf">PDF</button><button data-format="epub">EPUB</button><button data-format="markdown">Markdown</button>
      </main><script>
      const token = location.hash.slice(1);
      for (const button of document.querySelectorAll("button")) button.onclick = () => parent.postMessage({
        source: "patreon-reader-export", token,
        ...(sessionStorage.getItem("deny-export") === "1" ? { error: "Media access was not granted, so an offline export cannot be created." }
          : { format: button.dataset.format, granted: true })
      }, "https://www.patreon.com");
      </script></body></html>`
  }));
  await page.route("https://fixture-extension.invalid/export/collection-chooser.html**", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html><body><main aria-label="Collection export formats">
      <button data-format="epub">EPUB</button><button data-format="markdown">Markdown</button>
      </main><script>
      const token = location.hash.slice(1);
      for (const button of document.querySelectorAll("button")) button.onclick = () => parent.postMessage({
        source: "patreon-reader-collection-export", token, format: button.dataset.format
      }, "https://www.patreon.com");
      </script></body></html>`
  }));
  await page.goto(url);
  await page.evaluate(({ stored, namespace }) => {
    delete globalThis.browser;
    delete globalThis.chrome;
    localStorage.setItem("test-storage", JSON.stringify(stored));
    const listeners = [];
    const messages = [];
    const collectionSessions = new Map();
    const session = {};
    globalThis.collectionPrepareCount = 0;
    globalThis.forgetCollectionSessions = () => collectionSessions.clear();
    const deliver = async (message) => {
      for (const listener of messages) {
        const result = await new Promise((resolve) => {
          let responded = false;
          const respond = (value) => { responded = true; resolve(value); };
          const returned = listener(message, { id: "fixture-extension", tab: { id: 1, url: location.href } }, respond);
          if (returned !== true && !responded) resolve(returned);
        });
        if (result !== undefined) return result;
      }
      return undefined;
    };
    const changes = (old, next) => {
      const result = {};
      for (const key of Object.keys(next)) if (JSON.stringify(old[key]) !== JSON.stringify(next[key])) result[key] = { oldValue: old[key], newValue: next[key] };
      for (const listener of listeners) listener(result, "local");
    };
    globalThis.deliverExtensionMessage = deliver;
    const api = {
      runtime: {
        id: "fixture-extension",
        getURL: (name) => `https://fixture-extension.invalid/${name.replace(/^\//, "")}`,
        onMessage: { addListener: (fn) => messages.push(fn) },
        sendMessage: async (message) => {
          if (globalThis.collectionMessageHolds?.includes(message.type)) {
            globalThis.collectionHeldType = message.type;
            globalThis.collectionHeldMessage = message;
            await new Promise(resolve => { globalThis.releaseCollectionMessage = resolve; });
            globalThis.collectionLateReplyReleased = true;
          }
          if (message.type.startsWith("COLLECTION_ARCHIVE_")) {
            if (message.type === "COLLECTION_ARCHIVE_CHUNK") {
              globalThis.archiveChunkSizes ||= [];
              globalThis.archiveChunkSizes.push(message.data.length);
            }
            if (message.type === "COLLECTION_ARCHIVE_PACKAGE" && globalThis.failArchivePackaging) return { error: "Synthetic packaging failure." };
            return deliver(message);
          }
          if (message.type === "REGISTER_POST_EXPORT") {
            globalThis.requestedExportOrigins = message.origins;
            return { registered: true };
          }
          if (message.type === "DELIVER_POST_EXPORT") {
            return deliver({
              type: "POST_EXPORT_CHOICE",
              token: message.token,
              ...(message.error ? { error: message.error } : { format: message.format })
            });
          }
          if (message.type === "PREPARE_COLLECTION_EXPORT") {
            globalThis.requestedCollectionUrls = message.urls;
            globalThis.collectionPrepareCount++;
            const titles = message.urls.map((url, index) => globalThis.collectionBuildResult?.files[index]?.title || ["First post", "Second post", "Third post"][index]);
            const result = { registered: true, count: message.urls.length, postUrls: message.urls, postTitles: titles, skipped: 0, origins: [] };
            collectionSessions.set(message.token, result);
            return result;
          }
          if (message.type === "GET_COLLECTION_EXPORT_REQUEST") {
            return collectionSessions.get(message.token) || { error: "Synthetic session expired." };
          }
          if (message.type === "DELIVER_COLLECTION_EXPORT") {
            return deliver({
              type: "COLLECTION_EXPORT_CHOICE", token: message.token,
              ...(message.error ? { error: message.error } : { format: message.format })
            });
          }
          if (message.type === "BUILD_COLLECTION_EXPORT") {
            globalThis.collectionBuildIndices ||= [];
            globalThis.collectionBuildIndices.push(message.index);
            if (globalThis.collectionFailedIndices?.includes(message.index)) return { error: "Synthetic chapter failure." };
            const result = globalThis.collectionBuildResult || {
              files: [
                { title: "First post", extension: "md", encoding: "text", data: `# First post\n${"x".repeat(70_000)}` },
                { title: "Second post", extension: "md", encoding: "text", data: "# Second post" },
                { title: "Third post", extension: "md", encoding: "text", data: "# Third post" }
              ],
              skipped: 0
            };
            if (result.error) return result;
            const files = result.files.map((file, index) => {
              if (message.format !== "snapshot") return file;
              let text = file.data;
              if (file.extension === "epub") {
                const binary = Uint8Array.from(atob(file.data), char => char.charCodeAt(0));
                const view = new DataView(binary.buffer);
                for (let offset = 0; view.getUint32(offset, true) === 0x04034b50;) {
                  const size = view.getUint32(offset + 18, true);
                  const nameLength = view.getUint16(offset + 26, true);
                  const start = offset + 30 + nameLength + view.getUint16(offset + 28, true);
                  const name = new TextDecoder().decode(binary.subarray(offset + 30, offset + 30 + nameLength));
                  if (name === "EPUB/post.xhtml") {
                    text = new DOMParser().parseFromString(new TextDecoder().decode(binary.subarray(start, start + size)), "text/html").body.textContent;
                    break;
                  }
                  offset = start + size;
                }
              }
              const url = collectionSessions.get(message.token).postUrls[index] || `https://www.patreon.com/posts/${101 + index}`;
              return { title: file.title, extension: "snapshot", encoding: "text", data: JSON.stringify({
                version: 1, postId: new URL(url).pathname.split("/").pop(), title: file.title,
                author: "Fixture Creator", sourceUrl: url, language: "en", assets: [],
                body: { tag: "p", children: [text] }
              }) };
            });
            globalThis.collectionTransferFiles = files;
            globalThis.collectionChunkSizes = [];
            return {
              files: (message.index === undefined ? files : [files[message.index]])
                .map(({ data, ...file }) => ({ ...file, length: data.length, cached: globalThis.collectionCachedIndices?.includes(message.index) || false })),
              skipped: result.skipped
            };
          }
          if (message.type === "GET_COLLECTION_EXPORT_CHUNK") {
            if (globalThis.collectionFailedChunkIndices?.includes(message.index)) return { error: "Synthetic transfer failure." };
            const file = globalThis.collectionTransferFiles?.[message.index];
            if (!file) return { error: "Missing synthetic collection file." };
            const data = file.data.slice(message.offset, message.offset + 1024 * 1024);
            globalThis.collectionChunkSizes.push(data.length);
            return { data, done: message.offset + data.length === file.data.length };
          }
          if (message.type === "FINISH_COLLECTION_EXPORT") {
            globalThis.collectionTransferFiles = null;
            return { finished: true };
          }
          if (message.type === "CANCEL_COLLECTION_EXPORT") {
            collectionSessions.delete(message.token);
            globalThis.collectionExportCancelled = true;
            return { cancelled: true };
          }
          if (message.type !== "FETCH_POST_EXPORT_IMAGE") return null;
          if (globalThis.exportImageError) return { error: globalThis.exportImageError };
          const response = await fetch(message.url);
          const bytes = new Uint8Array(await response.arrayBuffer());
          let binary = "";
          for (const byte of bytes) binary += String.fromCharCode(byte);
          const type = response.headers.get("content-type")?.split(";")[0] || "image/png";
          return { dataUrl: `data:${type};base64,${btoa(binary)}`, type };
        }
      },
      storage: {
        session: {
          get: async () => structuredClone(session),
          set: async values => Object.assign(session, structuredClone(values)),
          remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete session[key]; }
        },
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
        sendMessage: async (tabId, message) => {
          if (message?.type?.startsWith("COLLECTION_ARCHIVE_")) return deliver(message);
          if (globalThis.failMessage) throw new Error("Receiving end does not exist");
          return globalThis.pageReply ?? { isPostPage: true };
        }
      }
    };
    globalThis.setStored = api.storage.local.set;
    globalThis.readStored = api.storage.local.get;
    addEventListener("message", (event) => {
      if (event.origin === "https://fixture-extension.invalid"
        && ["patreon-reader-export", "patreon-reader-collection-export"].includes(event.data?.source)) {
        deliver({
          type: event.data.source === "patreon-reader-export" ? "POST_EXPORT_CHOICE" : "COLLECTION_EXPORT_CHOICE",
          token: event.data.token,
          ...(event.data.error ? { error: event.data.error } : { format: event.data.format })
        });
      }
    });
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
      wrap(api.storage.session, "get"); wrap(api.storage.session, "set"); wrap(api.storage.session, "remove");
      wrap(api.tabs, "query"); wrap(api.tabs, "sendMessage");
      wrap(api.runtime, "sendMessage");
      globalThis.chrome = api;
    }
  }, { stored, namespace });
  for (const name of contentScripts.css) await page.addStyleTag({ path: path.join(extensionRoot, name) });
  for (const name of contentScripts.js) await page.addScriptTag({ path: path.join(extensionRoot, name) });
  await page.addScriptTag({ path: path.join(extensionRoot, "background/disk-crypto.js") });
  await page.evaluate(() => { globalThis.PatreonDiskCrypto = PatreonExportCrypto.create(); });
  await page.addScriptTag({ path: path.join(extensionRoot, "background/archives.js") });
  await page.evaluate(() => {
    globalThis.archiveTestBackend = PatreonArchives.install({ download: async (job, file) => {
      PatreonExporter.saveBlob(file, job.filename);
      return { started: true };
    } });
  });
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
