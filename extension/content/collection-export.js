/* Collection export: packages one EPUB or Markdown file per accessible post. */
(() => {
  const { api, call } = globalThis.PatreonExtension;
  const { makeZip, saveBlob, fileStem } = globalThis.PatreonExporter;
  const POST_PATH = /^(?:\/posts\/\d+|\/[^/]+\/posts\/(?:[^/]+-)?\d+)\/?$/;
  let host;
  let shadow;
  let trigger;
  let dialog;
  let chooser;
  let requestToken = "";
  let open = false;
  let busy = false;
  let route = "";

  function element(tag, attributes = {}, text) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function collectionTitle() {
    const heading = [...document.querySelectorAll("main h1, [role=main] h1, h1")]
      .find(node => node.getClientRects().length && node.textContent.trim());
    return heading?.textContent.trim() || document.title.split("|")[0].trim() || "Patreon collection";
  }

  function collectionScope() {
    return document.querySelector('main[role="main"], main, [role="main"]') || document;
  }

  function postUrls() {
    const scope = collectionScope();
    const result = [];
    const seen = new Set();
    const cards = scope.querySelectorAll('a[class*="_gridCard"][href]');
    const anchors = cards.length ? cards : scope.querySelectorAll("a[href]");
    for (const anchor of anchors) {
      let url;
      try { url = new URL(anchor.href, location.href); }
      catch { continue; }
      if (url.origin !== location.origin || !POST_PATH.test(url.pathname)) continue;
      url.search = "";
      url.hash = "";
      if (!seen.has(url.href)) { seen.add(url.href); result.push(url.href); }
    }
    return result;
  }

  const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  function loadMoreButton() {
    return collectionScope().querySelector('[class*="_loadMoreContainer"] button');
  }

  function isDisabled(button) {
    return button.disabled || button.getAttribute("aria-disabled") === "true";
  }

  async function waitForLoadMoreReady() {
    let missingChecks = 0;
    for (let attempt = 0; attempt < 150; attempt++) {
      const button = loadMoreButton();
      if (button) {
        missingChecks = 0;
        if (!isDisabled(button)) return button;
      } else if (++missingChecks >= 10) {
        return null;
      }
      await delay(100);
    }
    throw new Error("Patreon did not finish enabling Load more.");
  }

  async function waitForNextBatch(before) {
    for (let attempt = 0; attempt < 150; attempt++) {
      await delay(100);
      if (postUrls().length > before) return true;
    }
    throw new Error("Patreon did not load the next group of collection posts.");
  }

  async function loadAllPostLinks() {
    for (let page = 0; page < 100; page++) {
      const button = await waitForLoadMoreReady();
      if (!button) return;
      const before = postUrls().length;
      report(`Loading all posts from this collection… ${before} found.`);
      button.click();
      await waitForNextBatch(before);
    }
    throw new Error("This collection has too many pages to prepare safely.");
  }

  function report(message, tone = "") {
    const status = shadow?.querySelector("#collection-export-status");
    if (status) { status.textContent = message; status.dataset.tone = tone; }
  }

  function setBusy(value) {
    busy = value;
    const close = shadow?.querySelector(".close");
    if (close) close.disabled = value;
  }

  function loadChooser() {
    chooser.src = `${api.runtime.getURL("export/collection-chooser.html")}?instance=${crypto.randomUUID()}#${requestToken}`;
  }

  async function prepareSession(prefix = "") {
    setBusy(true);
    chooser.src = "about:blank";
    report(prefix || "Finding accessible posts in this collection…");
    await loadAllPostLinks();
    const urls = postUrls();
    if (!urls.length) throw new Error("No post links were found in this collection.");
    requestToken = crypto.randomUUID();
    const result = await call(api.runtime, "sendMessage", {
      type: "PREPARE_COLLECTION_EXPORT", token: requestToken, urls
    });
    if (!result?.registered) throw new Error(result?.error || "The collection could not be prepared.");
    loadChooser();
    const skipped = result.skipped ? ` ${result.skipped} unavailable or unsupported ${result.skipped === 1 ? "post was" : "posts were"} skipped.` : "";
    report(`${prefix ? `${prefix} ` : ""}${result.count} ${result.count === 1 ? "post is" : "posts are"} ready.${skipped}`, prefix ? "success" : "");
    setBusy(false);
  }

  function decodeFile(file, index, total) {
    let data;
    if (file.encoding === "base64") {
      const binary = atob(file.data);
      data = Uint8Array.from(binary, character => character.charCodeAt(0));
    } else {
      data = file.data;
    }
    const number = String(index + 1).padStart(Math.max(3, String(total).length), "0");
    return { name: `${number} - ${fileStem(file.title)}.${file.extension}`, data };
  }

  async function run(format) {
    if (busy) return;
    setBusy(true);
    report(`Building ${format === "epub" ? "EPUB" : "Markdown"} files…`);
    try {
      const result = await call(api.runtime, "sendMessage", {
        type: "BUILD_COLLECTION_EXPORT", token: requestToken, format
      });
      if (!result?.files?.length) throw new Error(result?.error || "The collection did not produce any files.");
      const entries = result.files.map((file, index) => decodeFile(file, index, result.files.length));
      saveBlob(makeZip(entries), `${fileStem(collectionTitle())}.zip`);
      requestToken = "";
      await prepareSession(`${format === "epub" ? "EPUB" : "Markdown"} ZIP download started.`);
    } catch (error) {
      requestToken = "";
      chooser.src = "about:blank";
      report(error.message || "The collection could not be exported.", "error");
      setBusy(false);
    }
  }

  function close(restoreFocus = false) {
    if (!open || busy) return;
    open = false;
    dialog.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    chooser.src = "about:blank";
    if (requestToken) call(api.runtime, "sendMessage", {
      type: "CANCEL_COLLECTION_EXPORT", token: requestToken
    }).catch(() => {});
    requestToken = "";
    if (restoreFocus) trigger.focus();
  }

  function makeUi() {
    host = element("div", { "data-patreon-collection-download": "" });
    shadow = host.attachShadow({ mode: "open" });
    const style = element("style");
    style.textContent = `:host{all:initial}*{box-sizing:border-box}.trigger{position:fixed;right:20px;bottom:20px;z-index:2147483646;border:1px solid #dedee3;border-radius:999px;padding:10px 16px;color:#202026;background:#fff;box-shadow:0 8px 30px #0003;font:650 14px/1.4 system-ui,sans-serif;cursor:pointer}.trigger:hover{background:#f4f4f6}section{position:fixed;right:20px;bottom:74px;z-index:2147483647;width:340px;max-width:calc(100vw - 24px);padding:18px;border:1px solid #dedee3;border-radius:16px;color:#202026;background:#fff;box-shadow:0 12px 48px #0003;font:14px/1.45 system-ui,sans-serif}[hidden]{display:none!important}header{display:flex;align-items:start;justify-content:space-between;gap:12px}h2{margin:0;font-size:18px}p{margin:6px 0 14px;color:#686872;font-size:12px}.close{padding:5px 9px;border:1px solid #dedee3;border-radius:8px;color:inherit;background:#f4f4f6;font:inherit;cursor:pointer}.close:disabled{opacity:.5;cursor:default}iframe{display:block;width:100%;height:42px;border:0}#collection-export-status{min-height:38px;margin:13px 0 0}[data-tone=error]{color:#a32037}[data-tone=success]{color:#216e39}:focus-visible{outline:2px solid #b82d47;outline-offset:2px}@media(prefers-color-scheme:dark){.trigger,section{color:#f2f2f5;background:#232326;border-color:#48484e}.trigger:hover,.close{background:#323237}.close{border-color:#505058}p{color:#b4b4be}[data-tone=error]{color:#ff9bac}[data-tone=success]{color:#82d99b}}`;
    trigger = element("button", {
      type: "button", class: "trigger", "aria-haspopup": "dialog", "aria-expanded": "false"
    }, "Download collection");
    dialog = element("section", {
      role: "dialog", "aria-modal": "true", "aria-labelledby": "collection-export-heading", hidden: ""
    });
    const header = element("header");
    header.append(element("h2", { id: "collection-export-heading" }, "Download collection"));
    const dismiss = element("button", { type: "button", class: "close", "aria-label": "Close collection download" }, "×");
    dismiss.addEventListener("click", () => close(true));
    header.append(dismiss);
    chooser = element("iframe", { title: "Collection export formats", src: "about:blank" });
    dialog.append(header,
      element("p", {}, "Creates a ZIP with one file per accessible text post, in collection order."),
      chooser,
      element("p", { id: "collection-export-status", role: "status", "aria-live": "polite" }, "Nothing leaves this browser."));
    trigger.addEventListener("click", () => {
      if (open) return close(true);
      open = true;
      dialog.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      prepareSession().catch(error => {
        report(error.message || "The collection could not be prepared.", "error");
        setBusy(false);
      });
    });
    shadow.append(style, trigger, dialog);
    document.documentElement.append(host);
  }

  function remove() {
    if (requestToken) call(api.runtime, "sendMessage", {
      type: "CANCEL_COLLECTION_EXPORT", token: requestToken
    }).catch(() => {});
    host?.remove();
    host = shadow = trigger = dialog = chooser = undefined;
    requestToken = "";
    open = busy = false;
  }

  function reconcile(isCollectionPage) {
    if (route !== location.pathname) { route = location.pathname; remove(); }
    if (!isCollectionPage) { remove(); return; }
    if (!host?.isConnected) makeUi();
  }

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== api.runtime.id || message?.type !== "COLLECTION_EXPORT_CHOICE") return;
    if (!open || message.token !== requestToken) {
      respond({ error: "The collection export panel is no longer active." });
      return;
    }
    if (typeof message.error === "string") {
      report(message.error, "error");
      respond({ reported: true });
      return;
    }
    if (!["epub", "markdown"].includes(message.format)) {
      respond({ error: "The collection export format is invalid." });
      return;
    }
    run(message.format);
    respond({ started: true });
  });

  document.addEventListener("keydown", event => {
    if (open && event.key === "Escape") { event.preventDefault(); close(true); }
  }, true);

  globalThis.PatreonCollectionExporter = Object.freeze({ reconcile });
})();
