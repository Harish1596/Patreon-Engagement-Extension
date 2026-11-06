/* Collection export: combined documents or individual chapter files in ZIPs. */
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
  let permissionWait = null;
  let downloadReport = null;
  let reportTimer;
  const cleanReportText = value => String(value || "").replace(/https?:\/\/[^\s<>"']+/gi, "[URL omitted]")
    .replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 1200);
  function reportUrl(value) {
    try { const url = new URL(value); return url.origin === "https://www.patreon.com" && POST_PATH.test(url.pathname)
      ? `${url.origin}${url.pathname}` : ""; } catch { return ""; }
  }
  function resetDownloadReport() {
    clearTimeout(reportTimer);
    downloadReport = null;
    renderDownloadReport();
  }
  const handedOff = post => ["download-started", "completed", "interrupted", "unconfirmed"].includes(post.status);
  function partResults() {
    return [...(downloadReport?.parts?.values() || [])].filter(part => part.started).map(part =>
      `${part.filename}: ${part.state === "complete" ? "Completed" : part.state === "interrupted" ? `Interrupted · ${part.reason}` : part.state === "unavailable" ? "Status unavailable · Completion could not be confirmed." : "In progress · The browser is saving the file."}`).join("\n");
  }
  function applyPartResult(part) {
    if (!downloadReport) return;
    const status = part.state === "complete" ? "completed" : part.state === "interrupted" ? "interrupted" : part.state === "unavailable" ? "unconfirmed" : "download-started";
    for (const post of downloadReport.posts) if (part.urls.includes(post.url)) {
      post.status = status;
      post.reason = status === "completed" ? "The browser confirmed the file finished downloading."
        : ["interrupted", "unconfirmed"].includes(status) ? part.reason : "Included in the collection file handed to the browser.";
    }
  }
  function renderDownloadReport() {
    const view = shadow?.querySelector(".download-report");
    if (!view) return;
    view.hidden = busy || !downloadReport;
    if (view.hidden) return;
    const totals = Object.fromEntries(["ready", "prepared", "download-started", "completed", "interrupted", "unconfirmed", "skipped", "failed", "cancelled"].map(status =>
      [status, downloadReport.posts.filter(post => post.status === status).length]));
    const labels = { ready: "Ready", prepared: "Prepared", "download-started": "Saving", completed: "Completed", interrupted: "Interrupted", unconfirmed: "Status unavailable", skipped: "Skipped", failed: "Failed", cancelled: "Cancelled" };
    const totalsList = view.querySelector(".report-totals"); totalsList.replaceChildren();
    const included = totals["download-started"] + totals.completed + totals.interrupted + totals.unconfirmed;
    totalsList.append(element("li", {}, `${included} included`));
    for (const [status, label] of Object.entries(labels)) if (totals[status]) {
      totalsList.append(element("li", { "data-result": status }, `${totals[status]} ${label.toLowerCase()}`));
    }
    const state = view.querySelector(".report-state");
    state.textContent = downloadReport.state;
    state.hidden = included > 0 && !totals.failed && !totals.cancelled && !totals.ready && !totals.prepared;
    const parts = view.querySelector(".download-parts"); parts.replaceChildren();
    for (const part of downloadReport.parts.values()) if (part.started) {
      const row = element("li");
      const outcome = part.state === "complete" ? "Completed" : part.state === "interrupted" ? "Interrupted"
        : part.state === "unavailable" ? "Status unavailable" : "In progress";
      row.append(element("strong", {}, part.filename), element("span", {}, outcome));
      if (["interrupted", "unavailable"].includes(part.state)) row.append(element("p", {}, part.reason));
      else if (part.state !== "complete") row.append(element("p", {}, "The browser is saving the file."));
      parts.append(row);
    }
    parts.hidden = !parts.childElementCount;
    const list = view.querySelector("ol"); list.replaceChildren();
    // Successful chapters share their file outcome; only individual issues need rows.
    for (const post of downloadReport.posts.filter(post => ["failed", "skipped"].includes(post.status))) {
      const row = element("li");
      row.append(element("strong", {}, post.title || post.url || "Post"), element("p", {}, `${labels[post.status]}${post.reason ? ` · ${post.reason}` : ""}`));
      if (post.url) row.append(element("a", { href: post.url, target: "_blank", rel: "noopener noreferrer" }, "Open post"));
      list.append(row);
    }
    list.hidden = !list.childElementCount;
    view.querySelector(".report-issues-heading").hidden = list.hidden;
    view.querySelector("button").disabled = false;
  }
  function prepareDownloadReport(prepared, discovered) {
    if (downloadReport?.format) return; // Preserve the last attempt while its chooser is refreshed.
    if (!downloadReport) {
      downloadReport = { title: cleanReportText(collectionTitle()), source: `${location.origin}${location.pathname}`,
        createdAt: new Date().toISOString(), format: "", state: "Collection discovered. Nothing downloaded yet.", posts: [], parts: new Map() };
      reportTimer = setTimeout(resetDownloadReport, COLLECTION_CACHE_MS);
    }
    const posts = new Map();
    for (const post of [...(discovered?.skippedPosts || []), ...(prepared.skippedPosts || [])]) {
      const url = reportUrl(post.url); if (url) posts.set(url, { url, title: cleanReportText(post.title), status: "skipped", reason: cleanReportText(post.reason) });
    }
    (prepared.postUrls || []).forEach((value, index) => {
      const url = reportUrl(value); if (url && !posts.has(url)) posts.set(url, { url, title: cleanReportText(prepared.postTitles?.[index]), status: "ready", reason: "" });
    });
    downloadReport.posts = [...posts.values()];
    // Older prepared sessions may only know the skipped count; never invent URLs or reasons.
    const unknown = Math.max(0, (prepared.skipped || 0) - (prepared.skippedPosts?.length || 0));
    for (let index = 0; index < unknown; index++) downloadReport.posts.push({ url: "", title: "Unidentified post", status: "skipped", reason: "Unavailable or unsupported. Individual post details were not provided." });
    renderDownloadReport();
  }
  function updateReportPost(url, status, reason = "") {
    const post = downloadReport?.posts.find(post => post.url === reportUrl(url));
    if (post) { post.status = status; post.reason = cleanReportText(reason); }
    renderDownloadReport();
  }
  function reportState(state) {
    if (downloadReport) { downloadReport.state = state; renderDownloadReport(); }
  }
  function saveDownloadReport() {
    if (!downloadReport || busy) return;
    const lines = [downloadReport.title, `Source: ${downloadReport.source}`, `Report time: ${downloadReport.createdAt}`,
      `Format: ${downloadReport.format || "Not selected"}`, `Status: ${downloadReport.state}`, partResults(), "",
      "Download started means the file was handed to the browser, not that it finished saving.", ""];
    for (const post of downloadReport.posts) lines.push(`${post.status.toUpperCase()}: ${post.title || post.url || "Post"}`, post.url, post.reason, "");
    globalThis.PatreonExporter.saveBlob(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }), `${fileStem(downloadReport.title)} - Download Report.txt`);
  }
  const COLLECTION_CACHE_MS = 2 * 60 * 60_000;
  const observedApiRequests = [];
  const MAX_TRANSFER_CHARS = 1024 * 1024;
  const BATCH_POSTS = 100;

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
    if (details) { details.hidden = false; details.open = true; details.querySelector("summary").textContent = "Progress details"; }
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
    if (permissionWait?.operation === operation) { permissionWait.respond({ granted: false }); permissionWait = null; }
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
    detail("counts", `${checkpoint.total > BATCH_POSTS ? `Part ${Math.floor(checkpoint.offset / BATCH_POSTS) + 1} of ${Math.ceil(checkpoint.total / BATCH_POSTS)} · ` : ""}Completed ${checkpoint.entries.filter(Boolean).length} of ${checkpoint.count}`
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
    if (downloadReport) for (const post of downloadReport.posts) if (post.status !== "skipped" && !handedOff(post)) { post.status = "cancelled"; post.reason = "Export cancelled before this post was downloaded."; }
    reportState(downloadReport?.posts.some(post => handedOff(post))
      ? "Cancelled remaining parts. Earlier downloads were already handed to the browser." : "Cancelled. Nothing downloaded.");
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

  function oldestFirst(urls, published = new Map()) {
    const posts = urls.map(url => ({ url, published: published.get(url),
      id: /(?:\/|-)(\d+)\/?$/.exec(new URL(url).pathname)[1].replace(/^0+/, "") || "0" }));
    // Complete publication dates give chronological order, including scheduled
    // posts. Otherwise IDs are a deterministic creation-order approximation.
    // Use one policy for the whole list so mixed dates cannot yield a cyclic sort.
    const dated = posts.every(post => Number.isFinite(post.published));
    return posts.sort((left, right) => (dated ? left.published - right.published : 0)
      || left.id.length - right.id.length
      || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)).map(post => post.url);
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
    return oldestFirst(result);
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
    const titles = new Map();
    const published = new Map();
    const revisions = new Map();
    let expectedTotal = null;
    let pageUrl = template;
    for (let page = 0; page < 100; page++) {
      signal.throwIfAborted();
      report(`Reading collection pages… ${seen.size} found.`);
      const fields = new Set((pageUrl.searchParams.get("fields[post]") || "").split(",").filter(Boolean));
      fields.add("current_user_can_view");
      fields.add("content_json_string");
      fields.add("title");
      fields.add("published_at");
      pageUrl.searchParams.set("fields[post]", [...fields].join(","));
      const payload = await globalThis.PatreonRetry.run(async ({ signal: attemptSignal }) => {
        let response;
        try { response = await fetch(pageUrl.href, { credentials: "include", signal: attemptSignal, headers: { Accept: "application/json" } }); }
        catch (error) { throw globalThis.PatreonRetry.networkError(error); }
        if (!response.ok) {
          const error = globalThis.PatreonRetry.httpError(response, "Patreon collection request failed");
          await response.body?.cancel().catch(() => {});
          throw error;
        }
        try { return await response.json(); }
        catch (error) { throw globalThis.PatreonRetry.networkError(error); }
      }, { signal, onRetry: retry => {
        report(`Collection request failed temporarily. Retry ${retry.attempt} of ${retry.attempts} in ${Math.ceil(retry.delayMs / 1000)}s…`);
        setProgress("Waiting to retry collection request");
      } });
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
        const date = typeof item.attributes?.published_at === "string" ? Date.parse(item.attributes.published_at) : NaN;
        if (Number.isFinite(date)) published.set(url, date);
        if (typeof item.attributes?.title === "string") titles.set(url, cleanReportText(item.attributes.title));
        if (item.attributes?.current_user_can_view === false) locked.add(url);
        // A full structured body plus explicit access is evidence of sameness;
        // timestamps/teasers alone cannot establish whether a chapter was edited.
        const attributes = item.attributes;
        revisions.delete(url);
        if (attributes?.current_user_can_view === true && typeof attributes.content_json_string === "string"
          && attributes.content_json_string.trim()) {
          try {
            const content = JSON.parse(attributes.content_json_string);
            if (content && typeof content === "object" && Object.keys(content).length) {
              const references = [item.relationships?.images?.data, item.relationships?.authors?.data].flat().filter(Boolean);
              const related = (Array.isArray(payload.included) ? payload.included : []).filter(resource => references.some(reference =>
                reference.id === resource.id && reference.type === resource.type))
                .map(resource => [resource.type, resource.id, resource.attributes]).sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`));
              const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([
                content, attributes.title, attributes.post_type, item.relationships?.images?.data,
                item.relationships?.authors?.data, attributes.post_file, attributes.embed, related
              ])));
              signal.throwIfAborted();
              revisions.set(url, [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join(""));
            }
          } catch { signal.throwIfAborted(); /* Missing/invalid full content forces a normal recheck. */ }
        }
      }
      setProgress("Finding collection posts", seen.size, expectedTotal);
      detail("counts", `Found ${seen.size}${expectedTotal === null ? "" : ` of ${expectedTotal}`} posts`);
      if (seen.size > 1000) throw Object.assign(new Error("This collection contains more than 1,000 posts. Choose a smaller collection."), { limitExceeded: true });
      pageUrl = nextCollectionApiUrl(payload, template, collectionId, campaignId);
      if (!pageUrl) {
        if (expectedTotal !== null && seen.size !== expectedTotal) {
          throw new Error(`Patreon returned ${seen.size} of ${expectedTotal} collection posts.`);
        }
        if (!seen.size) throw new Error("Patreon returned no collection posts.");
        const urls = oldestFirst([...seen].filter(url => !locked.has(url)), published);
        return { urls, locked: locked.size,
          revisions: urls.filter(url => revisions.has(url)).map(url => ({ url, revision: revisions.get(url) })),
          skippedPosts: oldestFirst([...locked], published).map(url => ({ url, title: titles.get(url) || "", reason: "Locked for your current membership." })) };
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
    if (chooser) {
      chooser.hidden = !requestToken || chooser.src === "about:blank";
      chooser.style.pointerEvents = value ? "none" : "";
      chooser.style.opacity = value ? ".5" : "1";
    }
    const details = shadow?.querySelector(".progress-details");
    if (details) { details.hidden = !value; if (!value) details.open = false; }
    const close = shadow?.querySelector(".close");
    if (close) close.disabled = false;
    const cancel = shadow?.querySelector(".cancel");
    if (cancel) { cancel.hidden = !value || activeOperation?.handedOff; cancel.disabled = false; }
    shadow?.querySelector(".format-options")?.setAttribute("aria-hidden", String(value));
    if (value && shadow?.activeElement === chooser) (cancel.hidden ? close : cancel)?.focus();
    renderDownloadReport();
  }

  function showOptions(message = "Choose a format and packaging, then download.") {
    if (shadow) shadow.querySelector(".intro").textContent = "Choose how to save this collection.";
    if (!requestToken) requestToken = crypto.randomUUID();
    finishOperation();
    setBusy(false);
    setProgress();
    loadChooser();
    report(message);
    if (checkpoint) showRetry();
    else shadow.querySelector(".retry").hidden = true;
  }

  function showImagePermission() {
    if (!permissionWait || !open) return;
    chooser.hidden = false;
    chooser.style.pointerEvents = "";
    chooser.style.opacity = "1";
    shadow.querySelector(".format-options").setAttribute("aria-hidden", "false");
    shadow.querySelector(".intro").textContent = "Your download is waiting for image access.";
    chooser.contentWindow?.postMessage({ source: "patreon-reader-collection-permission", token: requestToken,
      requestId: permissionWait.id }, api.runtime.getURL("").replace(/\/$/, ""));
  }

  function loadChooser() {
    chooser.hidden = false;
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

  async function discoverSession(operation) {
    checkOperation(operation);
    const signal = operation.controller.signal;
    const preparationRoute = route;
    setBusy(true);
    setProgress("Finding collection posts");
    report("Finding accessible posts in this collection…");
    if (discoveryCache && discoveryCache.expires <= Date.now()) {
      clearDiscovery(); resetDownloadReport();
      await discardPreparation(true);
      checkOperation(operation);
    }
    let discovered = discoveryCache?.discovered;
    if (!discovered) {
      chooser.src = "about:blank";
      try { discovered = await apiPostUrls(signal); }
      catch (error) {
        signal.throwIfAborted();
        if (error.retryable || error.accessDenied || error.limitExceeded) throw error; // Do not bypass exhausted/rate-limited or denied reads through DOM fallback.
        discovered = null;
      }
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
    if (urls.length + (locked || 0) > 1000) throw new Error("This collection contains more than 1,000 posts. Choose a smaller collection.");
    if (!urls.length && locked) {
      prepareDownloadReport({ postUrls: [], skippedPosts: [] }, discovered);
      reportState("No accessible posts. Nothing downloaded.");
      throw new Error(`${locked === 1 ? "The only post is" : `All ${locked} posts are`} locked for your current membership. Nothing was downloaded.`);
    }
    if (!urls.length) {
      throw new Error("No post links were found in this collection.");
    }
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
      setProgress("Starting collection download", 0, urls.length);
      result = await waitFor(call(api.runtime, "sendMessage", {
        type: "PREPARE_COLLECTION_EXPORT", token: requestToken, urls,
        revisions: discovered.revisions || [], deferred: true, operationId: operation.id
      }), signal);
      if (!result?.registered) {
        prepareDownloadReport({ ...result, postUrls: [], skipped: result?.skippedPosts?.length || 0 }, discovered);
        reportState("Preparation failed. Nothing downloaded.");
        throw new Error(result?.error || "The collection could not be prepared.");
      }
    }
    if (route !== preparationRoute || !host?.isConnected) return;
    checkOperation(operation);
    if (checkpoint && ((checkpoint.total || checkpoint.count) !== result.count
      || checkpoint.signature !== JSON.stringify(result.postUrls))) await dropCheckpoint();
    checkOperation(operation);
    prepareDownloadReport(result, discovered);
    loadChooser();
    return result;
  }

  function showRetry() {
    const complete = checkpoint.entries.filter(Boolean).length;
    const remaining = checkpoint.count - complete;
    const part = checkpoint.total > BATCH_POSTS ? `Part ${Math.floor(checkpoint.offset / BATCH_POSTS) + 1} of ${Math.ceil(checkpoint.total / BATCH_POSTS)}. ` : "";
    report(`${part}${complete} of ${checkpoint.count} posts retained. ${remaining ? `${remaining} failed.` : "Packaging failed."} ${checkpoint.error || ""} Retry to resume.`, "error");
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
    return { name: `${number} - ${fileStem(file.title)}.${file.extension}`, data,
      metadata: { title: file.title, creator: file.creator || "Not available", language: file.language || "und" } };
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

  async function run(format, start = checkpoint?.offset || 0, continuation = false) {
    if (busy) return;
    if (checkpoint && checkpoint.format !== format) start = 0;
    const book = format === "epub-book";
    const pdfBook = format === "pdf-book";
    const pdf = pdfBook || format === "pdf";
    const markdownBook = format === "markdown-book";
    const single = book || markdownBook || pdfBook;
    const extension = book ? "epub" : markdownBook ? "md" : pdfBook ? "pdf" : "zip";
    const outputFormat = book ? "epub" : markdownBook ? "markdown" : format;
    const documentLabel = book ? "EPUB book" : pdfBook ? "PDF book" : "Markdown file";
    const label = pdf ? "PDF" : outputFormat === "epub" ? "EPUB" : "Markdown";
    const operation = beginOperation();
    const signal = operation.controller.signal;
    setBusy(true);
    setProgress(single ? `Building ${documentLabel}` : `Building ${label} files`);
    report(single ? `Building ${documentLabel}…` : `Building ${label} files…`);
    let prepared;
    try {
      prepared = await waitFor(call(api.runtime, "sendMessage", {
        type: "GET_COLLECTION_EXPORT_REQUEST", token: requestToken
      }), signal);
      if (!Number.isSafeInteger(prepared?.count)) {
        prepared = await discoverSession(operation);
      }
      if (!Number.isSafeInteger(prepared?.count) || prepared.count < 1) {
        throw new Error(prepared?.error || "The collection session is unavailable. Reopen Download Collection.");
      }
      checkOperation(operation);
      if (!downloadReport || downloadReport.mode !== format || (!checkpoint && !continuation) || (checkpoint && checkpoint.format !== format)) {
        resetDownloadReport();
        prepareDownloadReport(prepared, discoveryCache?.discovered);
      }
      downloadReport.mode = format;
      downloadReport.format = single ? `Single ${label}` : `${label} files (ZIP)`;
      // Retry state comes from committed disk entries, not previous failed attempts.
      for (const post of downloadReport.posts) if (post.status !== "skipped" && !handedOff(post)) { post.status = "ready"; post.reason = ""; }
      reportState(start ? "Building the next part. Earlier parts were handed to the browser." : "Building chapters. No collection file downloaded yet.");
      const signature = JSON.stringify(prepared.postUrls);
      if (!checkpoint || checkpoint.format !== format || (checkpoint.total || checkpoint.count) !== prepared.count || checkpoint.signature !== signature) {
        await dropCheckpoint();
        checkOperation(operation);
        if (start >= prepared.count) start = 0;
        checkpoint = { id: crypto.randomUUID(), format, offset: start, total: prepared.count,
          count: Math.min(BATCH_POSTS, prepared.count - start), signature, entries: [], error: "" };
      }
      const offset = checkpoint.offset || 0;
      const part = Math.floor(offset / BATCH_POSTS) + 1;
      const parts = Math.ceil(prepared.count / BATCH_POSTS);
      const suffix = parts > 1 ? ` - Part ${String(part).padStart(3, "0")} of ${String(parts).padStart(3, "0")}` : "";
      let staged;
      try { staged = await archive.request("GET", { id: checkpoint.id }, signal); }
      catch { checkOperation(operation); }
      if (!staged) {
        // Rebuild disk files only if the browser lost their temporary directory.
        await archive.request("CREATE", { id: checkpoint.id, count: checkpoint.count,
          filename: `${fileStem(collectionTitle())}${suffix}.${extension}`,
          ...(single ? { ...(markdownBook ? { markdown: true } : {}), book: { ...(pdfBook ? { format: "pdf" } : {}), title: `${collectionTitle()}${suffix}`, source: `${location.origin}${location.pathname}`,
            downloadedAt: new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "long" }).format(new Date()) } } : {}) }, signal);
        checkpoint.entries = [];
      } else {
        checkpoint.entries = staged.entries;
      }
      counts(operation);
      for (let index = 0; index < checkpoint.count; index++) {
        const postIndex = offset + index;
        if (checkpoint.entries[index]) {
          if (!checkpoint.entries[index].skipped) updateReportPost(prepared.postUrls[postIndex], "prepared", "Retained chapter reused.");
          continue;
        }
        try {
          currentPost(postIndex, prepared.count, prepared.postTitles?.[postIndex]);
          detail("bytes", "");
          report(`Building post ${postIndex + 1} of ${prepared.count}…`);
          setProgress("Building posts", offset + checkpoint.entries.filter(Boolean).length, prepared.count);
          const result = await waitFor(call(api.runtime, "sendMessage", {
            type: "BUILD_COLLECTION_EXPORT", token: requestToken, format: "snapshot", index: postIndex, operationId: operation.id
          }), signal);
          checkOperation(operation);
          if (result?.skippedPost?.url === prepared.postUrls[postIndex]) {
            const skipped = await archive.request("SKIP", { id: checkpoint.id, index }, signal);
            checkOperation(operation);
            if (!skipped.skipped) throw new Error("The skipped chapter could not be recorded.");
            checkpoint.entries[index] = skipped.entry;
            updateReportPost(prepared.postUrls[postIndex], "skipped", result.skippedPost.reason);
            counts(operation);
            continue;
          }
          if (!result?.files?.length) throw Object.assign(new Error(result?.error || "The post did not produce a file."), { permissionDenied: result?.permissionDenied === true });
          currentPost(postIndex, prepared.count, result.files[0].title);
          (prepared.postTitles ||= [])[postIndex] = result.files[0].title;
          const row = downloadReport?.posts.find(post => post.url === prepared.postUrls[postIndex]);
          if (row) row.title = cleanReportText(result.files[0].title);
          if (result.files[0].cached) operation.cached.add(index);
          counts(operation);
          report(result.files[0].cached ? "Reading cached chapter…" : "Receiving chapter…");
          let file = await receiveFile(requestToken, result.files[0], postIndex, signal, operation);
          if (file.extension !== "snapshot") throw new Error("The collection returned an invalid source snapshot.");
          report(`Formatting ${label} chapter…`);
          setProgress("Formatting chapter");
          file = await fileFromSnapshot(JSON.parse(file.data), outputFormat, prepared.postUrls[postIndex], (book || markdownBook) ? { index, count: checkpoint.count } : undefined, signal);
          checkOperation(operation);
          checkpoint.entries[index] = await archive.store(checkpoint.id, index, decodeFile(file, postIndex, prepared.count), signal, progress => {
            if (activeOperation !== operation || signal.aborted) return;
            byteProgress("Compressing and saving chapter", progress.read, progress.total, progress.done);
            detail("bytes", `${bytes(progress.read)} of ${bytes(progress.total)} · Compressed ${bytes(progress.stored)}`);
          });
          checkOperation(operation);
          updateReportPost(prepared.postUrls[postIndex], "prepared", "Chapter prepared and saved for packaging.");
          counts(operation);
        } catch (error) {
          checkOperation(operation);
          checkpoint.error = `Post ${postIndex + 1}: ${error.message || "Export failed."}`;
          operation.failed.add(index);
          updateReportPost(prepared.postUrls[postIndex], "failed", error.message || "Export failed.");
          counts(operation);
          if (error.permissionDenied) break;
        }
      }
      if (checkpoint.entries.filter(Boolean).length !== checkpoint.count) {
        setProgress();
        setBusy(false);
        finishOperation(operation);
        loadChooser();
        reportState(offset ? "Some chapters failed in this part. Earlier part downloads remain available. Retry failed posts to continue."
          : "Some chapters failed. Nothing downloaded. Retry failed posts to continue.");
        showRetry();
        return;
      }
      if (checkpoint.entries.every(entry => entry.skipped)) {
        const next = offset + checkpoint.count;
        await dropCheckpoint();
        checkOperation(operation);
        await call(api.runtime, "sendMessage", { type: "FINISH_COLLECTION_EXPORT", token: requestToken });
        checkOperation(operation);
        finishOperation(operation); setBusy(false);
        if (next < prepared.count) return run(format, next, true);
        reportState(downloadReport?.parts.size ? "Remaining posts were skipped. Earlier files were handed to the browser."
          : "No supported text posts. Nothing downloaded.");
        showOptions("No supported text posts in this part. Choose another format.");
        return;
      }
      reportState("Chapters prepared. Packaging the collection file.");
      report(single ? `Assembling ${documentLabel}…` : "Packaging collection ZIP…");
      setProgress(single ? `Assembling ${documentLabel}` : "Packaging collection ZIP");
      // Register before PACKAGE: a small native download can finish before its
      // request reply arrives. Keep results attached to this attempt and part.
      const partResult = { urls: prepared.postUrls.slice(offset, offset + checkpoint.count).filter((url, index) => !checkpoint.entries[index].skipped),
        filename: `${fileStem(collectionTitle())}${suffix}.${extension}`, state: "pending", started: false };
      downloadReport?.parts.set(checkpoint.id, partResult);
      const packaged = await archive.request("PACKAGE", { id: checkpoint.id, operationId: operation.id }, signal);
      checkOperation(operation);
      if (!packaged.started) throw new Error("The collection download could not be started.");
      operation.handedOff = true;
      partResult.started = true;
      applyPartResult(partResult);
      reportState("Collection file handed to the browser.");
      setBusy(true);
      // The browser now owns the disk-backed archive until completion/interrupt.
      const next = offset + checkpoint.count;
      checkpoint = null;
      const finished = await call(api.runtime, "sendMessage", {
        type: "FINISH_COLLECTION_EXPORT", token: requestToken
      });
      if (!finished?.finished) throw new Error(finished?.error || "The collection transfer could not be completed.");
      if (next < prepared.count) {
        // Native downloads own earlier files. A fresh operation makes remaining
        // parts cancellable without undoing those already handed to the browser.
        finishOperation(operation); setBusy(false);
        return run(format, next, true);
      }
      showOptions(parts > 1 ? `${parts} ${single ? documentLabel : `${label} ZIP`} part downloads started.`
        : single ? `${documentLabel} download started.` : `${label} ZIP download started.`);

    } catch (error) {
      if (signal.aborted || activeOperation !== operation) return;
      let message = error.message || "The collection could not be exported.";
      const affected = [];
      if (checkpoint && Array.isArray(prepared?.postUrls)) {
        for (const issue of globalThis.PatreonPdf.failureDetails(error.pdfFailures, checkpoint.count)) {
          const entry = checkpoint.entries[issue.index];
          if (!entry || entry.skipped) continue;
          const postIndex = (checkpoint.offset || 0) + issue.index, url = prepared.postUrls[postIndex];
          const post = downloadReport?.posts.find(post => post.url === url);
          const title = cleanReportText(entry.title || post?.title || `Post ${postIndex + 1}`);
          if (post) post.title = title;
          updateReportPost(url, "failed", `${issue.message} Chapter data is retained for retry.`);
          affected.push(`Post ${postIndex + 1} — ${title.slice(0, 160)}`);
        }
      }
      if (affected.length) message += ` Affected posts: ${affected.slice(0, 3).join("; ")}${affected.length > 3 ? `; and ${affected.length - 3} more` : ""}. See Download report for details.`;
      reportState(`Collection download failed: ${cleanReportText(message)} Prepared chapter data is retained for retry.`);
      report(message, "error");
      setProgress();
      setBusy(false);
      finishOperation(operation);
      loadChooser();
      if (checkpoint) { checkpoint.error = message; showRetry(); }
    }
  }

  function close(restoreFocus = false) {
    if (!open) return;
    open = false;
    dialog.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (!busy) chooser.src = "about:blank";
    if (restoreFocus) trigger.focus();
  }

  function makeUi() {
    host = element("div", { "data-patreon-collection-download": "" });
    shadow = host.attachShadow({ mode: "open" });
    const style = element("style");
    style.textContent = `
      :host{all:initial}*{box-sizing:border-box}[hidden]{display:none!important}
      .trigger{position:fixed;right:20px;bottom:20px;z-index:2147483646;border:1px solid #dedee3;border-radius:999px;padding:10px 16px;color:#202026;background:#fff;box-shadow:0 8px 30px #0003;font:650 14px/1.4 system-ui,sans-serif;cursor:pointer}
      .trigger:hover{background:#f4f4f6}
      section{position:fixed;right:20px;bottom:74px;z-index:2147483647;width:400px;max-width:calc(100vw - 24px);padding:22px;border:1px solid #dedee3;border-radius:16px;color:#202026;background:#fff;box-shadow:0 12px 48px #0003;font:14px/1.5 system-ui,sans-serif;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#a0a0aa transparent}
      header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
      h2{margin:0;font-size:20px;font-weight:700;letter-spacing:-.02em}
      p{margin:0;color:#60606c;font-size:13px}
      .intro{margin-bottom:16px}
      .close{min-height:36px;padding:7px 11px;border:1px solid #dedee3;border-radius:8px;color:inherit;background:#f4f4f6;font:inherit;cursor:pointer}
      .dismiss{display:grid;place-items:center;width:44px;min-height:44px;padding:8px;background:transparent}
      .dismiss svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
      .close:hover:enabled{background:#e9e9ee}.close:disabled{opacity:.5;cursor:default}
      iframe{display:block;width:100%;height:252px;border:0;margin:0}
      progress{display:block;width:100%;height:6px;margin:16px 0 0;accent-color:#b82d47}
      #collection-export-status{margin:14px 0 0;color:inherit;font-size:13px;font-weight:550}
      [data-tone=error]{color:#a32037!important}[data-tone=success]{color:#216e39!important}
      :focus-visible{outline:2px solid #b82d47;outline-offset:3px}
      ::selection{color:#fff;background:#35353d}
      @media(max-width:480px){section{right:12px;bottom:72px;padding:18px}.trigger{right:12px}}
      @media(prefers-color-scheme:dark){.trigger,section{color:#f2f2f5;background:#232326;border-color:#48484e;scrollbar-color:#666671 transparent}.trigger:hover,.close{background:#2d2d32}.close{border-color:#4d4d56}.dismiss{background:transparent}.close:hover:enabled{background:#38383f}p{color:#b8b8c3}[data-tone=error]{color:#ff9bac!important}[data-tone=success]{color:#82d99b!important}:focus-visible{outline-color:#ff9bac}}
    `;
    trigger = element("button", {
      type: "button", class: "trigger", "aria-haspopup": "dialog", "aria-expanded": "false"
    }, "Download Collection");
    dialog = element("section", {
      role: "dialog", "aria-modal": "false", "aria-labelledby": "collection-export-heading", tabindex: "-1", hidden: ""
    });
    const header = element("header");
    header.append(element("h2", { id: "collection-export-heading" }, "Download Collection"));
    const dismiss = element("button", { type: "button", class: "close", "aria-label": "Close collection download" }, "×");
    dismiss.addEventListener("click", () => close(true));
    dismiss.classList.add("dismiss");
    const closeIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    closeIcon.setAttribute("viewBox", "0 0 24 24"); closeIcon.setAttribute("aria-hidden", "true");
    const closePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    closePath.setAttribute("d", "m6 6 12 12M6 18 18 6"); closeIcon.append(closePath);
    dismiss.replaceChildren(closeIcon);
    header.append(dismiss);
    chooser = element("iframe", { title: "Collection export formats", src: "about:blank" });
    const body = element("div", { class: "collection-body" });
    const formatOptions = element("div", { class: "format-options" });
    formatOptions.append(element("p", { class: "intro" }, "Choose how to save this collection."), chooser);
    body.append(formatOptions,
      element("progress", { id: "collection-export-progress", "aria-label": "Collection download progress", hidden: "" }),
      element("p", { id: "collection-export-status", role: "status", "aria-live": "polite" }, "Files are generated locally."));
    const details = element("details", { class: "progress-details", hidden: "" });
    details.append(element("summary", {}, "Progress details"));
    for (const name of ["current", "counts", "bytes", "elapsed"]) {
      details.append(element("p", { [`data-progress-${name}`]: "", ...(name === "elapsed" ? {} : { hidden: "" }) }));
    }
    style.textContent += ".progress-details p{margin:4px 0;font-size:12px;overflow-wrap:anywhere}.progress-details [data-progress-current]{color:inherit;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.progress-details{margin-top:12px}.progress-details summary{color:#60606c;font-size:12px;cursor:pointer}.progress-details[open] summary{margin-bottom:8px}section{max-height:calc(100vh - 98px);max-height:calc(100dvh - 98px);overflow:auto}";
    body.append(details);
    const controls = element("div", { class: "controls" });
    style.textContent += ".controls{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:12px}.controls:not(:has(>button:not([hidden]))){display:none}";
    const cancel = element("button", { type: "button", class: "close cancel", hidden: "" }, "Cancel");
    cancel.addEventListener("click", cancelOperation);
    const restart = element("button", { type: "button", class: "close restart", hidden: "" }, "Start again");
    restart.addEventListener("click", () => showOptions());
    const retry = element("button", { type: "button", class: "close retry", hidden: "" }, "Retry failed posts");
    retry.addEventListener("click", () => { if (checkpoint) run(checkpoint.format); });
    const reportView = element("div", { class: "download-report", role: "region", "aria-label": "Download report", hidden: "" });
    reportView.append(element("h3", {}, "Download report"), element("ul", { class: "report-totals", "aria-label": "Post totals" }), element("p", { class: "report-state" }), element("ul", { class: "download-parts", "aria-label": "Downloaded files" }),
      element("h4", { class: "report-issues-heading" }, "Posts needing attention"), element("ol", { class: "report-issues", "aria-label": "Posts needing attention" }));
    const saveReport = element("button", { type: "button", class: "close" }, "Save report");
    saveReport.addEventListener("click", saveDownloadReport); reportView.append(saveReport);
    style.textContent += `.download-report{margin-bottom:16px;border-bottom:1px solid #dedee3;padding-bottom:16px;overflow-wrap:anywhere}.download-report h3{margin:0 0 8px;font-size:15px;font-weight:650}.download-report h4{margin:16px 0 8px;font-size:13px;font-weight:650}.download-report ul{list-style:none;padding:0;margin:8px 0 12px}.report-totals{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px;font-variant-numeric:tabular-nums}.download-parts li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;margin:10px 0;font-size:13px}.download-parts p{grid-column:1/-1}.download-report .report-issues{padding-left:20px;margin:8px 0 16px;font-size:13px}.report-issues li{margin:12px 0}.download-report p{margin:4px 0 8px}.download-report a{color:inherit;text-decoration:underline;text-underline-offset:3px}.download-report strong{font-size:13px}.report-totals [data-result=failed],.report-totals [data-result=interrupted]{color:#a32037}.download-report [hidden]{display:none!important}#collection-export-status{overflow-wrap:anywhere}@media(prefers-color-scheme:dark){.download-report{border-color:#48484e}.report-totals [data-result=failed],.report-totals [data-result=interrupted]{color:#ff9bac}}`;

    body.prepend(reportView);
    controls.append(cancel, restart, retry);
    dialog.append(header, body, controls);
    style.textContent += `@media(prefers-color-scheme:dark){.progress-details summary{color:#b8b8c3}}section{display:flex;flex-direction:column;overflow:hidden}header,.controls{flex:none}.collection-body{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}.controls{border-top:1px solid #dedee3;padding-top:12px}.format-options[aria-hidden=true]{height:0;overflow:hidden;visibility:hidden}.retry{font-weight:650}@media(prefers-color-scheme:dark){.controls{border-color:#48484e}}`;
    trigger.addEventListener("click", () => {
      if (open) return close(true);
      open = true;
      dialog.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      dialog.focus();
      if (busy) { showImagePermission(); return; }
      showOptions();
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
    resetDownloadReport();
    dropCheckpoint();
    open = busy = false;
  }

  function reconcile(isCollectionPage) {
    if (route !== location.pathname) { route = location.pathname; remove(); }
    if (!isCollectionPage) { remove(); return; }
    if (!host?.isConnected) makeUi();
  }

  window.addEventListener("message", event => {
    if (!open || event.origin !== api.runtime.getURL("").replace(/\/$/, "")
      || event.source !== chooser?.contentWindow || event.data?.token !== requestToken) return;
    if (event.data.source === "patreon-reader-collection-export") {
      if (!busy && ["epub", "pdf", "markdown", "epub-book", "pdf-book", "markdown-book"].includes(event.data.format)) run(event.data.format);
      return;
    }
    if (event.data.source === "patreon-reader-collection-permission-result") {
      const waiting = permissionWait;
      if (!waiting || waiting.id !== event.data.requestId || activeOperation !== waiting.operation
        || waiting.operation.controller.signal.aborted) return;
      permissionWait = null;
      setBusy(true);
      waiting.respond({ granted: event.data.granted === true });
      return;
    }
    if (event.data.source === "patreon-reader-collection-close") { close(true); return; }
    if (event.data.source === "patreon-reader-collection-size") {
      // Enlarged chooser text can exceed the initial frame height. The outer
      // scroll body bounds the panel while this finite limit keeps the frame usable.
      if (Number.isSafeInteger(event.data.height) && event.data.height >= 100 && event.data.height <= 2048) {
        chooser.style.height = `${event.data.height}px`;
        const height = event.data.height;
        // Enable choices only after the outer panel has settled around the new
        // frame height. Otherwise fast clicks can land at its previous position.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (open && event.source === chooser?.contentWindow && event.data.token === requestToken
            && chooser.style.height === `${height}px`) {
            event.source.postMessage({ source: "patreon-reader-collection-sized", token: requestToken, height, revision: event.data.revision }, event.origin);
            showImagePermission();
          }
        }));
      }
      return;
    }
    if (busy || event.data.source !== "patreon-reader-collection-error" || typeof event.data.error !== "string") return;
    report(event.data.error, "error");
    setProgress(); finishOperation(); setBusy(false);
  });

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== api.runtime.id || !message || typeof message !== "object") return;
    if (message.type === "COLLECTION_MEDIA_PERMISSION") {
      if (sender.tab || !busy || !activeOperation || message.token !== requestToken
        || message.operationId !== activeOperation.id || activeOperation.controller.signal.aborted || permissionWait) {
        respond({ granted: false }); return;
      }
      permissionWait = { id: crypto.randomUUID(), operation: activeOperation, respond };
      report("Allow image access to continue the download.");
      setProgress();
      showImagePermission();
      return true;
    }
    if (message.type === "COLLECTION_ARCHIVE_RESULT") {
      const part = downloadReport?.parts?.get(message.id);
      if (sender.tab || !part || !["complete", "interrupted", "unavailable"].includes(message.state)) return;
      // Terminal results are immutable; ignore duplicate or out-of-order replies.
      if (["complete", "interrupted", "unavailable"].includes(part.state)) return;
      part.state = message.state; part.started = true;
      part.reason = cleanReportText(message.reason || "The browser interrupted the download.");
      applyPartResult(part); renderDownloadReport();
      respond({ reported: true }); return;
    }
    if (message.type === "COLLECTION_EXPORT_CACHE_EXPIRED" && requestToken && message.token === requestToken && !busy) {
      requestToken = "";
      clearDiscovery();
      chooser.src = "about:blank";
      report("Cached collection data expired. Choose a format to download again.");
      showOptions("Cached collection data expired. Choose a format to download again.");
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
        report(checkpoint.format === "epub-book" ? "Starting EPUB download…" : checkpoint.format === "pdf-book" ? "Starting PDF download…" : checkpoint.format === "markdown-book" ? "Starting Markdown download…" : "Starting ZIP download…");
        setProgress(checkpoint.format === "epub-book" ? "Starting EPUB download" : checkpoint.format === "pdf-book" ? "Starting PDF download" : checkpoint.format === "markdown-book" ? "Starting Markdown download" : "Starting ZIP download");
        respond({ handedOff: true });
      } else {
        if (!Number.isSafeInteger(message.current) || !Number.isSafeInteger(message.total)
          || message.total !== checkpoint.count || message.current < 0 || message.current > message.total
          || !Number.isSafeInteger(message.bytesCopied) || !Number.isSafeInteger(message.bytesTotal)
          || message.bytesCopied < 0 || message.bytesTotal <= 0 || message.bytesCopied > message.bytesTotal) {
          respond({ error: "Invalid archive progress." }); return;
        }
        currentPost(message.index + (checkpoint.offset || 0), checkpoint.total || message.total, message.name, "File");
        if (message.stage === "finalize") {
          report(checkpoint.format === "epub-book" ? "Finalizing EPUB…" : checkpoint.format === "pdf-book" ? "Finalizing PDF…" : checkpoint.format === "markdown-book" ? "Finalizing Markdown…" : "Finalizing ZIP…");
          setProgress(checkpoint.format === "epub-book" ? "Finalizing EPUB" : checkpoint.format === "pdf-book" ? "Finalizing PDF" : checkpoint.format === "markdown-book" ? "Finalizing Markdown" : "Finalizing ZIP");
        } else if (message.stage === "render") { report("Generating PDF pages…"); setProgress("Generating PDF pages"); }
        else byteProgress(checkpoint.format === "pdf-book" ? "Assembling PDF book" : checkpoint.format === "epub-book" ? "Assembling EPUB book" : checkpoint.format === "markdown-book" ? "Assembling Markdown file" : "Packaging collection ZIP", message.bytesCopied, message.bytesTotal);
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
      if (!["prepare", "prepare-post", "build", "retry"].includes(message.phase)) return;
      if (message.phase === "retry") {
        if (!Number.isSafeInteger(message.attempt) || message.attempt < 2 || message.attempt > 3
          || !Number.isFinite(message.delayMs) || message.delayMs < 0 || message.delayMs > 60_000) return;
        report(`Image request failed temporarily. Retry ${message.attempt} of 3 in ${Math.ceil(message.delayMs / 1000)}s…`);
        setProgress("Waiting to retry image request");
        respond({ reported: true }); return;
      }
      currentPost(message.index, message.total, message.title);
      const preparing = message.phase !== "build";
      const label = preparing ? "Preparing posts" : "Fetching chapter";
      const current = !preparing && checkpoint ? (checkpoint.offset || 0) + checkpoint.entries.filter(Boolean).length : message.current;
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
    if (!["epub", "markdown", "epub-book", "markdown-book", "pdf", "pdf-book"].includes(message.format)) {
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
