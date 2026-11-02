/* Collection export: packages one EPUB or Markdown file per accessible post. */
(() => {
  const { api, call } = globalThis.PatreonExtension;
  const { fileStem, fileFromSnapshot } = globalThis.PatreonExporter;
  const archive = globalThis.PatreonArchiveStream;
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
  let discoveryTimer;
  let activeOperation = null;
  let checkpoint = null;
  const COLLECTION_CACHE_MS = 2 * 60 * 60_000;
  const observedApiRequests = [];
  const MAX_TRANSFER_CHARS = 1024 * 1024;

  function clearDiscovery() {
    clearTimeout(discoveryTimer);
    discoveryCache = null;
  }

  function dropCheckpoint() {
    const id = checkpoint?.id;
    checkpoint = null;
    return id ? archive.request("DROP", { id }).catch(() => ({ dropped: false })) : Promise.resolve({ dropped: true });
  }

  function beginOperation() {
    finishOperation();
    const operation = { id: crypto.randomUUID(), controller: new AbortController(), handedOff: false,
      startedAt: performance.now(), cached: new Set(), failed: new Set() };
    activeOperation = operation;
    for (const name of ["current", "counts", "bytes"]) {
      const node = shadow?.querySelector(`[data-progress-${name}]`);
      if (node) { node.textContent = ""; node.hidden = true; }
    }
    const details = shadow?.querySelector(".progress-details");
    if (details) details.hidden = false;
    renderElapsed(operation);
    operation.timer = setInterval(() => {
      if (activeOperation === operation) renderElapsed(operation);
    }, 1000);
    const restart = shadow?.querySelector(".restart");
    if (restart) restart.hidden = true;
    const retry = shadow?.querySelector(".retry");
    if (retry) retry.hidden = true;
    return operation;
  }

  function renderElapsed(operation) {
    const seconds = Math.floor(Math.max(0, (operation.finishedAt ?? performance.now()) - operation.startedAt) / 1000);
    const clock = seconds >= 3600
      ? `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    const node = shadow?.querySelector("[data-progress-elapsed]");
    if (node) node.textContent = `Elapsed: ${clock}`;
  }

  function finishOperation(operation = activeOperation) {
    if (!operation) return;
    clearInterval(operation.timer);
    operation.finishedAt ??= performance.now();
    renderElapsed(operation);
    if (activeOperation === operation) activeOperation = null;
  }

  function detail(name, text) {
    const node = shadow?.querySelector(`[data-progress-${name}]`);
    if (node) { node.textContent = text; node.hidden = !text; }
    if (activeOperation) renderElapsed(activeOperation);
  }

  function currentPost(index, total, title = "", kind = "Post") {
    if (!Number.isSafeInteger(index) || index < 0 || index >= total) return;
    const name = typeof title === "string" ? title.replace(/\s+/g, " ").trim().slice(0, 240) : "";
    detail("current", `${kind} ${index + 1} of ${total}${name ? `: ${name}` : ""}`);
  }

  function counts(operation) {
    if (!checkpoint) return;
    detail("counts", `Completed ${checkpoint.entries.filter(Boolean).length} of ${checkpoint.count}`
      + (operation.cached.size ? ` · ${operation.cached.size} cached` : "")
      + (operation.failed.size ? ` · ${operation.failed.size} failed` : ""));
  }

  function bytes(value) {
    if (value < 1024) return `${value} B`;
    const unit = value < 1024 * 1024 ? 1024 : 1024 * 1024;
    return `${(value / unit).toFixed(1)} ${unit === 1024 ? "KiB" : "MiB"}`;
  }

  function byteProgress(label, read, total, done = false) {
    const percent = done ? 100 : Math.min(99, total ? Math.floor(read * 100 / total) : 0);
    report(`${label}… ${percent}%.`);
    setProgress(label, percent, 100);
    shadow?.querySelector("#collection-export-progress")?.setAttribute("aria-valuetext", `${label}: ${percent}%`);
  }

  function checkOperation(operation) {
    operation.controller.signal.throwIfAborted();
    if (activeOperation !== operation) throw new DOMException("The operation was cancelled.", "AbortError");
  }

  function waitFor(promise, signal) {
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException("The operation was cancelled.", "AbortError"));
      if (signal.aborted) { Promise.resolve(promise).catch(() => {}); abort(); return; }
      signal.addEventListener("abort", abort, { once: true });
      Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  }

  async function cancelOperation() {
    const operation = activeOperation;
    if (!busy || !operation || operation.handedOff) return;
    const ownerHost = host;
    operation.controller.abort();
    const dropping = dropCheckpoint();
    finishOperation(operation);
    const token = requestToken;
    requestToken = "";
    chooser.src = "about:blank";
    report("Cancelling…");
    setProgress("Cancelling");
    shadow.querySelector(".cancel").disabled = true;
    let failed = !(await dropping).dropped;
    if (token) {
      try {
        const result = await call(api.runtime, "sendMessage", { type: "CANCEL_COLLECTION_EXPORT", token });
        failed ||= !result?.cancelled;
      } catch { failed = true; }
    }
    if (host !== ownerHost || !host?.isConnected || activeOperation) return;
    report(failed ? "Cancellation could not be confirmed. Close this collection tab to stop its worker."
      : "Cancelled. You can start again.", failed ? "error" : "");
    setProgress();
    setBusy(false);
    shadow.querySelector(".restart").hidden = failed;
  }

  function showPreparationError(error) {
    if (error.name === "AbortError") return;
    report(error.message || "The collection could not be prepared.", "error");
    setProgress();
    finishOperation();
    setBusy(false);
  }

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

  async function apiPostUrls(signal) {
    const template = collectionApiTemplate();
    if (!template) return null;
    const collectionId = routeCollectionId();
    const campaignId = template.searchParams.get("filter[campaign_id]") || "";
    const seen = new Set();
    const locked = new Set();
    let expectedTotal = null;
    let pageUrl = template;
    for (let page = 0; page < 100; page++) {
      signal.throwIfAborted();
      report(`Reading collection pages… ${seen.size} found.`);
      const fields = new Set((pageUrl.searchParams.get("fields[post]") || "").split(",").filter(Boolean));
      fields.add("current_user_can_view");
      pageUrl.searchParams.set("fields[post]", [...fields].join(","));
      const response = await fetch(pageUrl.href, {
        credentials: "include",
        signal,
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`Patreon collection request failed (${response.status}).`);
      const payload = await response.json();
      signal.throwIfAborted();
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
      detail("counts", `Found ${seen.size}${expectedTotal === null ? "" : ` of ${expectedTotal}`} posts`);
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

  async function waitForLoadMoreReady(signal) {
    let missingChecks = 0;
    for (let attempt = 0; attempt < 150; attempt++) {
      signal.throwIfAborted();
      const button = loadMoreButton();
      if (button) {
        missingChecks = 0;
        if (!isDisabled(button)) return button;
      } else if (++missingChecks >= 10) {
        return null;
      }
      await waitFor(delay(100), signal);
    }
    throw new Error("Patreon did not finish enabling Load more.");
  }

  async function waitForNextBatch(before, signal) {
    for (let attempt = 0; attempt < 150; attempt++) {
      await waitFor(delay(100), signal);
      if (postUrls().length > before) return true;
    }
    throw new Error("Patreon did not load the next group of collection posts.");
  }

  async function loadAllPostLinks(signal) {
    for (let page = 0; page < 100; page++) {
      const button = await waitForLoadMoreReady(signal);
      if (!button) return;
      const before = postUrls().length;
      report(`Loading all posts from this collection… ${before} found.`);
      detail("counts", `Found ${before} posts`);
      button.click();
      await waitForNextBatch(before, signal);
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
    const cancel = shadow?.querySelector(".cancel");
    if (cancel) { cancel.hidden = !value || activeOperation?.handedOff; cancel.disabled = false; }
  }

  function loadChooser() {
    chooser.src = `${api.runtime.getURL("export/collection-chooser.html")}?instance=${crypto.randomUUID()}#${requestToken}`;
  }

  async function discardPreparation(clearCheckpoint = true) {
    if (clearCheckpoint) await dropCheckpoint();
    const token = requestToken;
    requestToken = "";
    if (token) await call(api.runtime, "sendMessage", {
      type: "CANCEL_COLLECTION_EXPORT", token
    }).catch(() => {});
  }

  async function prepareSession(prefix = "", refresh = false, operation = beginOperation(), continueOperation = false) {
    checkOperation(operation);
    const signal = operation.controller.signal;
    const preparationRoute = route;
    setBusy(true);
    setProgress("Finding collection posts");
    report(prefix || "Finding accessible posts in this collection…");
    if (refresh || (discoveryCache && discoveryCache.expires <= Date.now())) {
      clearDiscovery();
      await discardPreparation(refresh);
      checkOperation(operation);
    }
    let discovered = discoveryCache?.discovered;
    if (!discovered) {
      chooser.src = "about:blank";
      try { discovered = await apiPostUrls(signal); }
      catch { signal.throwIfAborted(); discovered = null; }
      if (!discovered) {
        await loadAllPostLinks(signal);
        discovered = { urls: postUrls(), locked: 0 };
      }
      if (route !== preparationRoute || !host?.isConnected) return;
      checkOperation(operation);
      discoveryCache = { discovered, expires: Date.now() + COLLECTION_CACHE_MS };
      clearTimeout(discoveryTimer);
      discoveryTimer = setTimeout(clearDiscovery, COLLECTION_CACHE_MS);
    }
    const { urls, locked } = discovered;
    if (!urls.length && locked) {
      throw new Error(`${locked === 1 ? "The only post is" : `All ${locked} posts are`} locked for your current membership. Nothing was downloaded.`);
    }
    if (!urls.length) throw new Error("No post links were found in this collection.");
    let result;
    if (requestToken) {
      try {
        const existing = await waitFor(call(api.runtime, "sendMessage", {
          type: "GET_COLLECTION_EXPORT_REQUEST", token: requestToken
        }), signal);
        if (Array.isArray(existing?.origins)) result = existing;
      } catch { /* The service worker may have restarted or expired the session. */ }
      checkOperation(operation);
      if (!result) await discardPreparation(false);
    }
    if (route !== preparationRoute || !host?.isConnected) return;
    checkOperation(operation);
    if (!result) {
      chooser.src = "about:blank";
      requestToken = crypto.randomUUID();
      setProgress("Preparing posts", 0, urls.length);
      result = await waitFor(call(api.runtime, "sendMessage", {
        type: "PREPARE_COLLECTION_EXPORT", token: requestToken, urls, operationId: operation.id
      }), signal);
      if (!result?.registered) throw new Error(result?.error || "The collection could not be prepared.");
    }
    if (route !== preparationRoute || !host?.isConnected) return;
    checkOperation(operation);
    if (checkpoint && (checkpoint.count !== result.count
      || checkpoint.signature !== JSON.stringify(result.postUrls))) await dropCheckpoint();
    checkOperation(operation);
    if (continueOperation) return result;
    loadChooser();
    const skipped = result.skipped ? ` ${result.skipped} unavailable or unsupported ${result.skipped === 1 ? "post was" : "posts were"} skipped.` : "";
    const lockedMessage = locked ? ` ${locked} locked ${locked === 1 ? "post was" : "posts were"} skipped.` : "";
    report(`${prefix ? `${prefix} ` : ""}${result.count} ${result.count === 1 ? "post is" : "posts are"} ready.${lockedMessage}${skipped}`, prefix ? "success" : "");
    setProgress();
    setBusy(false);
    finishOperation(operation);
    if (checkpoint) showRetry();
  }

  function showRetry() {
    const complete = checkpoint.entries.filter(Boolean).length;
    const remaining = checkpoint.count - complete;
    report(`${complete} of ${checkpoint.count} posts retained. ${remaining ? `${remaining} failed.` : "Packaging failed."} ${checkpoint.error || ""} Retry to resume.`, "error");
    const retry = shadow.querySelector(".retry");
    retry.textContent = remaining ? "Retry failed posts" : "Retry packaging";
    retry.hidden = false;
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

  async function receiveFile(token, metadata, index, signal, operation) {
    if (!metadata || typeof metadata.title !== "string"
      || !["md", "epub", "snapshot"].includes(metadata.extension)
      || !["text", "base64"].includes(metadata.encoding)
      || !Number.isSafeInteger(metadata.length) || metadata.length < 0) {
      throw new Error("The collection returned invalid file metadata.");
    }
    const chunks = [];
    let offset = 0;
    let updatedAt = -Infinity;
    while (offset < metadata.length) {
      signal.throwIfAborted();
      const result = await waitFor(call(api.runtime, "sendMessage", {
        type: "GET_COLLECTION_EXPORT_CHUNK", token, index, offset
      }), signal);
      if (typeof result?.data !== "string" || !result.data.length
        || result.data.length > MAX_TRANSFER_CHARS) {
        throw new Error(result?.error || "The collection returned an invalid file chunk.");
      }
      chunks.push(result.data);
      offset += result.data.length;
      if (operation && activeOperation === operation && (performance.now() - updatedAt >= 250 || offset === metadata.length)) {
        updatedAt = performance.now();
        byteProgress(metadata.cached ? "Reading cached chapter" : "Receiving chapter", offset, metadata.length, offset === metadata.length);
      }
      if (Boolean(result.done) !== (offset === metadata.length)) {
        throw new Error("A collection file ended at an unexpected position.");
      }
    }
    return { ...metadata, data: chunks.join("") };
  }

  async function run(format) {
    if (busy) return;
    const operation = beginOperation();
    const signal = operation.controller.signal;
    setBusy(true);
    setProgress(`Building ${format === "epub" ? "EPUB" : "Markdown"} files`);
    report(`Building ${format === "epub" ? "EPUB" : "Markdown"} files…`);
    try {
      let prepared = await waitFor(call(api.runtime, "sendMessage", {
        type: "GET_COLLECTION_EXPORT_REQUEST", token: requestToken
      }), signal);
      if (!Number.isSafeInteger(prepared?.count)) {
        prepared = await prepareSession("", false, operation, true);
      }
      if (!Number.isSafeInteger(prepared?.count) || prepared.count < 1) {
        throw new Error(prepared?.error || "The collection session is unavailable. Reopen Download Collection.");
      }
      checkOperation(operation);
      const signature = JSON.stringify(prepared.postUrls);
      if (!checkpoint || checkpoint.format !== format || checkpoint.count !== prepared.count || checkpoint.signature !== signature) {
        await dropCheckpoint();
        checkOperation(operation);
        checkpoint = { id: crypto.randomUUID(), format, count: prepared.count, signature, entries: [], error: "" };
      }
      let staged;
      try { staged = await archive.request("GET", { id: checkpoint.id }, signal); }
      catch { checkOperation(operation); }
      if (!staged) {
        // Rebuild disk files only if the browser lost their temporary directory.
        await archive.request("CREATE", { id: checkpoint.id, count: checkpoint.count,
          filename: `${fileStem(collectionTitle())}.zip` }, signal);
        checkpoint.entries = [];
      } else {
        checkpoint.entries = staged.entries;
      }
      counts(operation);
      for (let index = 0; index < checkpoint.count; index++) {
        if (checkpoint.entries[index]) continue;
        try {
          currentPost(index, checkpoint.count, prepared.postTitles?.[index]);
          detail("bytes", "");
          report(`Building post ${index + 1} of ${checkpoint.count}…`);
          setProgress("Building posts", checkpoint.entries.filter(Boolean).length, checkpoint.count);
          const result = await waitFor(call(api.runtime, "sendMessage", {
            type: "BUILD_COLLECTION_EXPORT", token: requestToken, format: "snapshot", index, operationId: operation.id
          }), signal);
          checkOperation(operation);
          if (!result?.files?.length) throw new Error(result?.error || "The post did not produce a file.");
          currentPost(index, checkpoint.count, result.files[0].title);
          if (result.files[0].cached) operation.cached.add(index);
          counts(operation);
          report(result.files[0].cached ? "Reading cached chapter…" : "Receiving chapter…");
          let file = await receiveFile(requestToken, result.files[0], index, signal, operation);
          if (file.extension !== "snapshot") throw new Error("The collection returned an invalid source snapshot.");
          report(`Formatting ${format === "epub" ? "EPUB" : "Markdown"} chapter…`);
          setProgress("Formatting chapter");
          file = await fileFromSnapshot(JSON.parse(file.data), format, prepared.postUrls[index]);
          checkOperation(operation);
          checkpoint.entries[index] = await archive.store(checkpoint.id, index, decodeFile(file, index, checkpoint.count), signal, progress => {
            if (activeOperation !== operation || signal.aborted) return;
            byteProgress("Compressing and saving chapter", progress.read, progress.total, progress.done);
            detail("bytes", `${bytes(progress.read)} of ${bytes(progress.total)} · Compressed ${bytes(progress.stored)}`);
          });
          checkOperation(operation);
          counts(operation);
        } catch (error) {
          checkOperation(operation);
          checkpoint.error = `Post ${index + 1}: ${error.message || "Export failed."}`;
          operation.failed.add(index);
          counts(operation);
        }
      }
      if (checkpoint.entries.filter(Boolean).length !== checkpoint.count) {
        setProgress();
        setBusy(false);
        finishOperation(operation);
        loadChooser();
        showRetry();
        return;
      }
      report("Packaging collection ZIP…");
      setProgress("Packaging collection ZIP");
      const packaged = await archive.request("PACKAGE", { id: checkpoint.id, operationId: operation.id }, signal);
      checkOperation(operation);
      if (!packaged.started) throw new Error("The collection download could not be started.");
      operation.handedOff = true;
      setBusy(true);
      // The browser now owns the disk-backed archive until completion/interrupt.
      checkpoint = null;
      const finished = await call(api.runtime, "sendMessage", {
        type: "FINISH_COLLECTION_EXPORT", token: requestToken
      });
      if (!finished?.finished) throw new Error(finished?.error || "The collection transfer could not be completed.");
      await prepareSession(`${format === "epub" ? "EPUB" : "Markdown"} ZIP download started.`, false, operation);
    } catch (error) {
      if (signal.aborted || activeOperation !== operation) return;
      report(error.message || "The collection could not be exported.", "error");
      setProgress();
      setBusy(false);
      finishOperation(operation);
      loadChooser();
      if (checkpoint) { checkpoint.error = error.message; showRetry(); }
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
    const details = element("div", { class: "progress-details", hidden: "" });
    for (const name of ["current", "counts", "bytes", "elapsed"]) {
      details.append(element("p", { [`data-progress-${name}`]: "", ...(name === "elapsed" ? {} : { hidden: "" }) }));
    }
    style.textContent += ".progress-details p{margin:4px 0;font-size:12px;overflow-wrap:anywhere}.progress-details [data-progress-current]{color:inherit;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}section{max-height:calc(100vh - 98px);overflow:auto}";
    dialog.append(details);
    const refresh = element("button", { type: "button", class: "close refresh" }, "Refresh collection");
    refresh.addEventListener("click", () => {
      if (busy) return;
      prepareSession("", true).catch(showPreparationError);
    });
    const controls = element("div", { class: "controls" });
    style.textContent += ".controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}";
    const cancel = element("button", { type: "button", class: "close cancel", hidden: "" }, "Cancel");
    cancel.addEventListener("click", cancelOperation);
    const restart = element("button", { type: "button", class: "close restart", hidden: "" }, "Start again");
    restart.addEventListener("click", () => prepareSession().catch(showPreparationError));
    const retry = element("button", { type: "button", class: "close retry", hidden: "" }, "Retry failed posts");
    retry.addEventListener("click", () => { if (checkpoint) run(checkpoint.format); });
    controls.append(refresh, cancel, restart, retry);
    dialog.append(controls);
    trigger.addEventListener("click", () => {
      if (open) return close(true);
      open = true;
      dialog.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      prepareSession().catch(showPreparationError);
    });
    shadow.append(style, trigger, dialog);
    document.documentElement.append(host);
  }

  function remove() {
    activeOperation?.controller.abort();
    finishOperation();
    if (requestToken) call(api.runtime, "sendMessage", {
      type: "CANCEL_COLLECTION_EXPORT", token: requestToken
    }).catch(() => {});
    host?.remove();
    host = shadow = trigger = dialog = chooser = undefined;
    requestToken = "";
    clearDiscovery();
    dropCheckpoint();
    open = busy = false;
  }

  function reconcile(isCollectionPage) {
    if (route !== location.pathname) { route = location.pathname; remove(); }
    if (!isCollectionPage) { remove(); return; }
    if (!host?.isConnected) makeUi();
  }

  window.addEventListener("message", event => {
    if (!open || busy || event.origin !== api.runtime.getURL("").replace(/\/$/, "")
      || event.source !== chooser?.contentWindow || event.data?.source !== "patreon-reader-collection-error"
      || event.data.token !== requestToken || typeof event.data.error !== "string") return;
    report(event.data.error, "error");
    setProgress();
    finishOperation();
    setBusy(false);
  });

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== api.runtime.id || !message || typeof message !== "object") return;
    if (message.type === "COLLECTION_EXPORT_CACHE_EXPIRED" && requestToken && message.token === requestToken && !busy) {
      requestToken = "";
      clearDiscovery();
      chooser.src = "about:blank";
      report("Cached collection data expired. Start again to prepare the collection.");
      shadow.querySelector(".restart").hidden = false;
      shadow.querySelector(".progress-details").hidden = true;
      respond({ expired: true });
      return;
    }
    if (message.type === "COLLECTION_ARCHIVE_EXPIRED" && checkpoint && message.id === checkpoint.id && !busy) {
      checkpoint = null;
      shadow.querySelector(".retry").hidden = true;
      report("Temporary export files expired. Select a format or start again.");
      shadow.querySelector(".progress-details").hidden = true;
      respond({ expired: true });
      return;
    }
    if (["COLLECTION_ARCHIVE_PROGRESS", "COLLECTION_ARCHIVE_HANDOFF"].includes(message.type)) {
      if (message.id !== checkpoint?.id || !activeOperation || activeOperation.controller.signal.aborted
        || message.operationId !== activeOperation.id) {
        respond({ error: "The collection download is no longer active." }); return;
      }
      if (message.type === "COLLECTION_ARCHIVE_HANDOFF") {
        activeOperation.handedOff = true;
        setBusy(true);
        report("Starting ZIP download…");
        setProgress("Starting ZIP download");
        respond({ handedOff: true });
      } else {
        if (!Number.isSafeInteger(message.current) || !Number.isSafeInteger(message.total)
          || message.total !== checkpoint.count || message.current < 0 || message.current > message.total
          || !Number.isSafeInteger(message.bytesCopied) || !Number.isSafeInteger(message.bytesTotal)
          || message.bytesCopied < 0 || message.bytesTotal <= 0 || message.bytesCopied > message.bytesTotal) {
          respond({ error: "Invalid archive progress." }); return;
        }
        currentPost(message.index, message.total, message.name, "File");
        if (message.stage === "finalize") {
          report("Finalizing ZIP…");
          setProgress("Finalizing ZIP");
        } else byteProgress("Packaging collection ZIP", message.bytesCopied, message.bytesTotal);
        detail("bytes", `${bytes(message.bytesCopied)} of ${bytes(message.bytesTotal)} packaged`);
        respond({ reported: true });
      }
      return;
    }
    if (message.type === "COLLECTION_EXPORT_PROGRESS") {
      if (!open || !busy || !activeOperation || message.token !== requestToken
        || message.operationId !== activeOperation.id || activeOperation.controller.signal.aborted) return;
      if (!Number.isSafeInteger(message.current) || !Number.isSafeInteger(message.total)
        || message.current < 0 || message.total < 1 || message.current > message.total) return;
      if (!["prepare", "prepare-post", "build"].includes(message.phase)) return;
      currentPost(message.index, message.total, message.title);
      const preparing = message.phase !== "build";
      const label = preparing ? "Preparing posts" : "Fetching chapter";
      const current = !preparing && checkpoint ? checkpoint.entries.filter(Boolean).length : message.current;
      report(`${label}… ${current} of ${message.total}.`);
      setProgress(label, current, message.total);
      if (preparing) detail("counts", `Checked ${message.current} of ${message.total} posts`);
      else counts(activeOperation);
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
  document.addEventListener("visibilitychange", () => { if (activeOperation) renderElapsed(activeOperation); });

  globalThis.PatreonCollectionExporter = Object.freeze({ reconcile });
})();
