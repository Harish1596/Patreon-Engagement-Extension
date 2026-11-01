/* Collection export: packages one EPUB or Markdown file per accessible post. */
(() => {
  const { api, call } = globalThis.PatreonExtension;
  const { makeCollectionZip, saveBlob, fileStem } = globalThis.PatreonExporter;
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
  let discoveryCache = null;
  const COLLECTION_CACHE_MS = 2 * 60 * 60_000;
  const observedApiRequests = [];
  const MAX_TRANSFER_CHARS = 1024 * 1024;

  function rememberApiRequest(value) {
    try {
      const url = new URL(value, location.href);
      if (url.origin !== location.origin || url.pathname !== "/api/posts") return;
      observedApiRequests.push(url.href);
      if (observedApiRequests.length > 20) observedApiRequests.shift();
    } catch { /* Ignore unrelated or malformed resource names. */ }
  }

  try {
    const resourceObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) rememberApiRequest(entry.name);
    });
    resourceObserver.observe({ type: "resource", buffered: true });
  } catch { /* The current performance entries remain available as a fallback. */ }

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

  function routeCollectionId() {
    const match = /^\/collection\/([^/]+)\/?$/.exec(location.pathname);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function validCollectionApiUrl(value, collectionId, campaignId = "") {
    try {
      const url = new URL(value, location.href);
      if (url.origin !== location.origin || url.pathname !== "/api/posts"
        || url.searchParams.get("filter[collection_id]") !== collectionId
        || (campaignId && url.searchParams.get("filter[campaign_id]") !== campaignId)) return null;
      return url;
    } catch { return null; }
  }

  function collectionApiTemplate() {
    const collectionId = routeCollectionId();
    if (!collectionId) return null;
    const current = performance.getEntriesByType("resource").map(entry => entry.name);
    const candidates = [...observedApiRequests, ...current];
    for (let index = candidates.length - 1; index >= 0; index--) {
      const url = validCollectionApiUrl(candidates[index], collectionId);
      if (!url) continue;
      url.searchParams.delete("page[cursor]");
      return url;
    }
    return null;
  }

  function nextCollectionApiUrl(payload, template, collectionId, campaignId) {
    const linked = payload?.links?.next;
    if (typeof linked === "string" && linked) {
      const url = validCollectionApiUrl(linked, collectionId, campaignId);
      if (!url) throw new Error("Patreon returned an invalid collection page link.");
      return url;
    }
    const cursor = payload?.meta?.pagination?.cursors?.next;
    if (typeof cursor !== "string" || !cursor) return null;
    const url = new URL(template.href);
    url.searchParams.set("page[cursor]", cursor);
    return url;
  }

  async function apiPostUrls() {
    const template = collectionApiTemplate();
    if (!template) return null;
    const collectionId = routeCollectionId();
    const campaignId = template.searchParams.get("filter[campaign_id]") || "";
    const seen = new Set();
    const locked = new Set();
    let expectedTotal = null;
    let pageUrl = template;
    for (let page = 0; page < 100; page++) {
      report(`Reading collection pages… ${seen.size} found.`);
      const fields = new Set((pageUrl.searchParams.get("fields[post]") || "").split(",").filter(Boolean));
      fields.add("current_user_can_view");
      pageUrl.searchParams.set("fields[post]", [...fields].join(","));
      const response = await fetch(pageUrl.href, {
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`Patreon collection request failed (${response.status}).`);
      const payload = await response.json();
      if (!Array.isArray(payload?.data)) throw new Error("Patreon returned an invalid collection page.");
      const total = Number(payload?.meta?.pagination?.total);
      if (Number.isSafeInteger(total) && total >= 0) {
        if (expectedTotal !== null && expectedTotal !== total) {
          throw new Error("Patreon changed the collection total during preparation.");
        }
        expectedTotal = total;
      }
      for (const item of payload.data) {
        if (item?.type !== "post" || !/^\d+$/.test(item.id)) continue;
        const url = `${location.origin}/posts/${item.id}`;
        seen.add(url);
        if (item.attributes?.current_user_can_view === false) locked.add(url);
      }
      setProgress("Finding collection posts", seen.size, expectedTotal);
      if (seen.size > 100) throw new Error("This collection contains more than 100 posts.");
      pageUrl = nextCollectionApiUrl(payload, template, collectionId, campaignId);
      if (!pageUrl) {
        if (expectedTotal !== null && seen.size !== expectedTotal) {
          throw new Error(`Patreon returned ${seen.size} of ${expectedTotal} collection posts.`);
        }
        if (!seen.size) throw new Error("Patreon returned no collection posts.");
        return { urls: [...seen].filter(url => !locked.has(url)), locked: locked.size };
      }
    }
    throw new Error("This collection has too many API pages to prepare safely.");
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

  function setProgress(label = "", current, total) {
    const progress = shadow?.querySelector("#collection-export-progress");
    if (!progress) return;
    if (!label) {
      progress.hidden = true;
      progress.removeAttribute("value");
      progress.removeAttribute("aria-valuetext");
      return;
    }
    progress.hidden = false;
    if (Number.isSafeInteger(current) && Number.isSafeInteger(total) && total > 0) {
      progress.max = total;
      progress.value = Math.min(total, Math.max(0, current));
      progress.setAttribute("aria-valuetext", `${label}: ${progress.value} of ${total}`);
    } else {
      progress.removeAttribute("value");
      progress.setAttribute("aria-valuetext", label);
    }
  }

  function setBusy(value) {
    busy = value;
    const close = shadow?.querySelector(".close");
    if (close) close.disabled = value;
    const refresh = shadow?.querySelector(".refresh");
    if (refresh) refresh.disabled = value;
  }

  function loadChooser() {
    chooser.src = `${api.runtime.getURL("export/collection-chooser.html")}?instance=${crypto.randomUUID()}#${requestToken}`;
  }

  async function discardPreparation() {
    const token = requestToken;
    requestToken = "";
    if (token) await call(api.runtime, "sendMessage", {
      type: "CANCEL_COLLECTION_EXPORT", token
    }).catch(() => {});
  }

  async function prepareSession(prefix = "", refresh = false) {
    const preparationRoute = route;
    setBusy(true);
    setProgress("Finding collection posts");
    report(prefix || "Finding accessible posts in this collection…");
    if (refresh || (discoveryCache && discoveryCache.expires <= Date.now())) {
      discoveryCache = null;
      await discardPreparation();
    }
    let discovered = discoveryCache?.discovered;
    if (!discovered) {
      chooser.src = "about:blank";
      try { discovered = await apiPostUrls(); }
      catch { discovered = null; }
      if (!discovered) {
        await loadAllPostLinks();
        discovered = { urls: postUrls(), locked: 0 };
      }
      if (route !== preparationRoute || !host?.isConnected) return;
      discoveryCache = { discovered, expires: Date.now() + COLLECTION_CACHE_MS };
    }
    const { urls, locked } = discovered;
    if (!urls.length && locked) {
      throw new Error(`${locked === 1 ? "The only post is" : `All ${locked} posts are`} locked for your current membership. Nothing was downloaded.`);
    }
    if (!urls.length) throw new Error("No post links were found in this collection.");
    let result;
    if (requestToken) {
      try {
        const existing = await call(api.runtime, "sendMessage", {
          type: "GET_COLLECTION_EXPORT_REQUEST", token: requestToken
        });
        if (Array.isArray(existing?.origins)) result = existing;
      } catch { /* The service worker may have restarted or expired the session. */ }
      if (!result) await discardPreparation();
    }
    if (route !== preparationRoute || !host?.isConnected) return;
    if (!result) {
      chooser.src = "about:blank";
      requestToken = crypto.randomUUID();
      setProgress("Preparing posts", 0, urls.length);
      result = await call(api.runtime, "sendMessage", {
        type: "PREPARE_COLLECTION_EXPORT", token: requestToken, urls
      });
      if (!result?.registered) throw new Error(result?.error || "The collection could not be prepared.");
    }
    if (route !== preparationRoute || !host?.isConnected) return;
    loadChooser();
    const skipped = result.skipped ? ` ${result.skipped} unavailable or unsupported ${result.skipped === 1 ? "post was" : "posts were"} skipped.` : "";
    const lockedMessage = locked ? ` ${locked} locked ${locked === 1 ? "post was" : "posts were"} skipped.` : "";
    report(`${prefix ? `${prefix} ` : ""}${result.count} ${result.count === 1 ? "post is" : "posts are"} ready.${lockedMessage}${skipped}`, prefix ? "success" : "");
    setProgress();
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

  async function receiveFile(token, metadata, index) {
    if (!metadata || typeof metadata.title !== "string"
      || !["md", "epub"].includes(metadata.extension)
      || !["text", "base64"].includes(metadata.encoding)
      || !Number.isSafeInteger(metadata.length) || metadata.length < 0) {
      throw new Error("The collection returned invalid file metadata.");
    }
    const chunks = [];
    let offset = 0;
    while (offset < metadata.length) {
      const result = await call(api.runtime, "sendMessage", {
        type: "GET_COLLECTION_EXPORT_CHUNK", token, index, offset
      });
      if (typeof result?.data !== "string" || !result.data.length
        || result.data.length > MAX_TRANSFER_CHARS) {
        throw new Error(result?.error || "The collection returned an invalid file chunk.");
      }
      chunks.push(result.data);
      offset += result.data.length;
      if (Boolean(result.done) !== (offset === metadata.length)) {
        throw new Error("A collection file ended at an unexpected position.");
      }
    }
    return { ...metadata, data: chunks.join("") };
  }

  async function run(format) {
    if (busy) return;
    setBusy(true);
    setProgress(`Building ${format === "epub" ? "EPUB" : "Markdown"} files`);
    report(`Building ${format === "epub" ? "EPUB" : "Markdown"} files…`);
    try {
      const result = await call(api.runtime, "sendMessage", {
        type: "BUILD_COLLECTION_EXPORT", token: requestToken, format
      });
      if (!result?.files?.length) throw new Error(result?.error || "The collection did not produce any files.");
      const entries = [];
      for (let index = 0; index < result.files.length; index++) {
        report(`Receiving ${format === "epub" ? "EPUB" : "Markdown"} files… ${index + 1} of ${result.files.length}.`);
        setProgress(`Receiving ${format === "epub" ? "EPUB" : "Markdown"} files`, index, result.files.length);
        const file = await receiveFile(requestToken, result.files[index], index);
        entries.push(decodeFile(file, index, result.files.length));
        setProgress(`Receiving ${format === "epub" ? "EPUB" : "Markdown"} files`, index + 1, result.files.length);
      }
      report("Packaging collection ZIP…");
      setProgress("Packaging collection ZIP");
      saveBlob(await makeCollectionZip(entries), `${fileStem(collectionTitle())}.zip`);
      const finished = await call(api.runtime, "sendMessage", {
        type: "FINISH_COLLECTION_EXPORT", token: requestToken
      });
      if (!finished?.finished) throw new Error(finished?.error || "The collection transfer could not be completed.");
      await prepareSession(`${format === "epub" ? "EPUB" : "Markdown"} ZIP download started.`);
    } catch (error) {
      if (requestToken) call(api.runtime, "sendMessage", {
        type: "CANCEL_COLLECTION_EXPORT", token: requestToken
      }).catch(() => {});
      requestToken = "";
      chooser.src = "about:blank";
      report(error.message || "The collection could not be exported.", "error");
      setProgress();
      setBusy(false);
    }
  }

  function close(restoreFocus = false) {
    if (!open || busy) return;
    open = false;
    dialog.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    chooser.src = "about:blank";
    if (restoreFocus) trigger.focus();
  }

  function makeUi() {
    host = element("div", { "data-patreon-collection-download": "" });
    shadow = host.attachShadow({ mode: "open" });
    const style = element("style");
    style.textContent = `:host{all:initial}*{box-sizing:border-box}.trigger{position:fixed;right:20px;bottom:20px;z-index:2147483646;border:1px solid #dedee3;border-radius:999px;padding:10px 16px;color:#202026;background:#fff;box-shadow:0 8px 30px #0003;font:650 14px/1.4 system-ui,sans-serif;cursor:pointer}.trigger:hover{background:#f4f4f6}section{position:fixed;right:20px;bottom:74px;z-index:2147483647;width:340px;max-width:calc(100vw - 24px);padding:18px;border:1px solid #dedee3;border-radius:16px;color:#202026;background:#fff;box-shadow:0 12px 48px #0003;font:14px/1.45 system-ui,sans-serif}[hidden]{display:none!important}header{display:flex;align-items:start;justify-content:space-between;gap:12px}h2{margin:0;font-size:18px}p{margin:6px 0 14px;color:#686872;font-size:12px}.close{padding:5px 9px;border:1px solid #dedee3;border-radius:8px;color:inherit;background:#f4f4f6;font:inherit;cursor:pointer}.close:disabled{opacity:.5;cursor:default}iframe{display:block;width:100%;height:42px;border:0}progress{display:block;width:100%;height:8px;margin:12px 0 0;accent-color:#b82d47}#collection-export-status{min-height:38px;margin:10px 0 0}[data-tone=error]{color:#a32037}[data-tone=success]{color:#216e39}:focus-visible{outline:2px solid #b82d47;outline-offset:2px}@media(prefers-color-scheme:dark){.trigger,section{color:#f2f2f5;background:#232326;border-color:#48484e}.trigger:hover,.close{background:#323237}.close{border-color:#505058}p{color:#b4b4be}[data-tone=error]{color:#ff9bac}[data-tone=success]{color:#82d99b}}`;
    trigger = element("button", {
      type: "button", class: "trigger", "aria-haspopup": "dialog", "aria-expanded": "false"
    }, "Download Collection");
    dialog = element("section", {
      role: "dialog", "aria-modal": "true", "aria-labelledby": "collection-export-heading", hidden: ""
    });
    const header = element("header");
    header.append(element("h2", { id: "collection-export-heading" }, "Download Collection"));
    const dismiss = element("button", { type: "button", class: "close", "aria-label": "Close collection download" }, "×");
    dismiss.addEventListener("click", () => close(true));
    header.append(dismiss);
    chooser = element("iframe", { title: "Collection export formats", src: "about:blank" });
    dialog.append(header,
      element("p", {}, "Creates a ZIP with one file per accessible text post, in collection order."),
      chooser,
      element("progress", { id: "collection-export-progress", "aria-label": "Collection download progress", hidden: "" }),
      element("p", { id: "collection-export-status", role: "status", "aria-live": "polite" }, "Nothing leaves this browser."));
    const refresh = element("button", { type: "button", class: "close refresh" }, "Refresh collection");
    refresh.addEventListener("click", () => {
      if (busy) return;
      prepareSession("", true).catch(error => {
        report(error.message || "The collection could not be refreshed.", "error");
        setProgress();
        setBusy(false);
      });
    });
    dialog.append(refresh);
    trigger.addEventListener("click", () => {
      if (open) return close(true);
      open = true;
      dialog.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      prepareSession().catch(error => {
        report(error.message || "The collection could not be prepared.", "error");
        setProgress();
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
    discoveryCache = null;
    open = busy = false;
  }

  function reconcile(isCollectionPage) {
    if (route !== location.pathname) { route = location.pathname; remove(); }
    if (!isCollectionPage) { remove(); return; }
    if (!host?.isConnected) makeUi();
  }

  window.addEventListener("message", event => {
    if (!open || event.origin !== api.runtime.getURL("").replace(/\/$/, "")
      || event.source !== chooser?.contentWindow || event.data?.source !== "patreon-reader-collection-error"
      || event.data.token !== requestToken || typeof event.data.error !== "string") return;
    report(event.data.error, "error");
    setProgress();
    setBusy(false);
  });

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== api.runtime.id || !message || typeof message !== "object") return;
    if (message.type === "COLLECTION_EXPORT_PROGRESS") {
      if (!open || message.token !== requestToken) return;
      if (!Number.isSafeInteger(message.current) || !Number.isSafeInteger(message.total)
        || message.current < 0 || message.total < 1 || message.current > message.total) return;
      const label = message.phase === "prepare"
        ? "Preparing posts"
        : `Building ${message.format === "epub" ? "EPUB" : "Markdown"} files`;
      report(`${label}… ${message.current} of ${message.total}.`);
      setProgress(label, message.current, message.total);
      respond({ reported: true });
      return;
    }
    if (message.type !== "COLLECTION_EXPORT_CHOICE") return;
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
