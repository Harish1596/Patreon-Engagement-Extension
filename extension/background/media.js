/* Fetches post media only after the user grants the exact image origin. */
importScripts("../shared/pdf.js", "offscreen.js", "pdf-renderer.js", "../shared/zip.js", "../shared/retry.js", "retention.js", "disk-crypto.js", "post-cache.js", "epub-book.js", "pdf-book.js", "archives.js");
globalThis.PatreonDiskCrypto = globalThis.PatreonExportCrypto.create();
globalThis.PatreonRetention = globalThis.PatreonExportRetention.create();
globalThis.PatreonOffscreenService = globalThis.PatreonOffscreen.create();
globalThis.PatreonPdfRenderService = globalThis.PatreonPdfRenderer.install();
globalThis.PatreonArchives.install();
(() => {
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const retention = globalThis.PatreonRetention;
  const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  const pending = new Map();
  let activeMedia = 0;
  const mediaWaiters = [];
  async function mediaSlot(signal) {
    signal.throwIfAborted();
    if (activeMedia >= 2) await new Promise((resolve, reject) => {
      const start = () => { signal.removeEventListener("abort", abort); resolve(); };
      const abort = () => {
        const index = mediaWaiters.indexOf(start);
        if (index >= 0) mediaWaiters.splice(index, 1);
        reject(signal.reason);
      };
      mediaWaiters.push(start);
      signal.addEventListener("abort", abort, { once: true });
    });
    else activeMedia++;
    // A released slot is reserved for its next waiter, even before it resumes.
    return () => {
      const next = mediaWaiters.shift();
      if (next) next();
      else activeMedia--;
    };
  }
  const collections = new Map();
  const knownPosts = new Map();
  const cancelledCollections = new Set();
  const MAX_TRANSFER_CHARS = 1024 * 1024;
  const COLLECTION_CACHE_MS = 2 * 60 * 60_000;
  const COLLECTION_SESSION_PREFIX = "collection-export:";
  const mediaRequests = new Map();
  const cancelledMediaTransfers = new Set();
  const sourceCache = globalThis.PatreonPostCache.create({ onChange: () => retention.changed() });

  function checkCancelled(session) {
    if (session?.controller?.signal.aborted) throw new Error("The collection export was cancelled.");
  }

  function cancellable(promise, signal) {
    if (!signal) return promise;
    return new Promise((resolve, reject) => {
      const abort = () => reject(new Error("The collection export was cancelled."));
      if (signal.aborted) { Promise.resolve(promise).catch(() => {}); abort(); return; }
      signal.addEventListener("abort", abort, { once: true });
      Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  }

  function call(target, method, ...args) {
    if (globalThis.browser?.runtime) return target[method](...args);
    return new Promise((resolve, reject) => {
      target[method](...args, (result) => {
        const error = api.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(result);
      });
    });
  }

  function base64(bytes) {
    let result = "";
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      result += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
    }
    return btoa(result);
  }

  const delay = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

  function validPostUrl(value) {
    try {
      const url = new URL(value);
      return url.origin === "https://www.patreon.com"
        && /^(?:\/posts\/\d+|\/[^/]+\/posts\/(?:[^/]+-)?\d+)\/?$/.test(url.pathname);
    } catch { return false; }
  }

  async function persistCollection(token, session) {
    checkCancelled(session);
    // Session storage survives worker suspension, but is cleared with the browser
    // session. Never put post bodies, file transfers, or media URLs here.
    const { ownerTabId, ownerWindowId, posts, skipped, skippedPosts = [], expires } = session;
    await call(api.storage.session, "set", {
      [COLLECTION_SESSION_PREFIX + token]: { version: 1, ownerTabId, ownerWindowId, posts, skipped, skippedPosts, expires }
    });
    if (session.controller?.signal.aborted) await call(api.storage.session, "remove", COLLECTION_SESSION_PREFIX + token);
    checkCancelled(session);
    retention.changed();
  }

  async function restoreCollections() {
    const stored = await call(api.storage.session, "get", null);
    const expired = [];
    for (const [key, value] of Object.entries(stored)) {
      if (!key.startsWith(COLLECTION_SESSION_PREFIX)) continue;
      const token = key.slice(COLLECTION_SESSION_PREFIX.length);
      if (!/^[0-9a-f-]{36}$/i.test(token) || value?.version !== 1
        || !Number.isSafeInteger(value.ownerTabId) || !Number.isSafeInteger(value.ownerWindowId)
        || !Number.isFinite(value.expires) || value.expires <= Date.now()
        || !Number.isSafeInteger(value.skipped) || value.skipped < 0
        || !Array.isArray(value.posts) || !value.posts.length || value.posts.length > 1000
        || !value.posts.every(post => validPostUrl(post?.url) && typeof post.title === "string"
          && (post.tabId === null || Number.isSafeInteger(post.tabId))
          && Array.isArray(post.origins) && post.origins.every(origin => typeof origin === "string"))) {
        expired.push(key);
        continue;
      }
      const skippedPosts = Array.isArray(value.skippedPosts) ? value.skippedPosts.filter(post => validPostUrl(post?.url)
        && typeof post.title === "string" && typeof post.reason === "string").slice(0, 1000) : [];
      collections.set(token, { ...value, skippedPosts, workerTabId: null });
    }
    if (expired.length) await call(api.storage.session, "remove", expired);
    await sourceCache.prune(new Set(collections.keys()));
  }

  const collectionsReady = restoreCollections();
  collectionsReady.catch(() => {}); // Request handlers surface restoration failures.
  retention.register({
    ready: collectionsReady,
    deadline: () => Math.min(sourceCache.deadline(), ...[...collections.values()].map(session => session.expires)),
    async sweep() {
      for (const [token, session] of collections) {
        if (session.expires <= Date.now() && !session.preparing && !session.building) {
          await discardCollection(token);
          await call(api.tabs, "sendMessage", session.ownerTabId, { type: "COLLECTION_EXPORT_CACHE_EXPIRED", token }).catch(() => {});
        }
      }
      await sourceCache.prune(new Set(collections.keys()));
    },
    async clear() {
      for (const token of [...collections.keys()]) await discardCollection(token);
      pending.clear();
      await sourceCache.prune(new Set());
    }
  });

  async function closeTabs(tabIds) {
    if (!tabIds.length) return;
    try { await call(api.tabs, "remove", tabIds); }
    catch { /* Tabs may already have been closed by the user. */ }
  }

  async function discardCollection(token) {
    const session = collections.get(token);
    collections.delete(token);
    if (session) {
      session.controller?.abort();
      cancelActivePost(session);
      delete session.files;
      await closeWorker(session);
    }
    await call(api.storage.session, "remove", COLLECTION_SESSION_PREFIX + token);
    await sourceCache.clear(token);
    retention.changed();
  }

  function cancelActivePost(session) {
    const active = session.activePost;
    if (!active) return;
    const key = `${active.tabId}:${active.transferId}`;
    cancelledMediaTransfers.add(key);
    for (const controller of mediaRequests.get(key) || []) controller.abort();
    call(api.tabs, "sendMessage", active.tabId,
      { type: "CANCEL_POST_EXPORT", transferId: active.transferId }).catch(() => {});
    session.activePost = null;
  }

  async function closeWorker(session) {
    const tabId = session.workerTabId;
    session.workerTabId = null;
    if (tabId) await closeTabs([tabId]);
  }

  async function navigateWorker(session, url) {
    checkCancelled(session);
    if (session.workerTabId) {
      try {
        await call(api.tabs, "update", session.workerTabId, { url, active: false });
        checkCancelled(session);
        return session.workerTabId;
      } catch {
        checkCancelled(session);
        session.workerTabId = null;
      }
    }
    const tab = await call(api.tabs, "create", { url, active: false, windowId: session.ownerWindowId });
    session.workerTabId = tab.id;
    if (session.controller?.signal.aborted) {
      await closeWorker(session);
      checkCancelled(session);
    }
    return tab.id;
  }

  async function askWorkerPost(session, url, message) {
    const tabId = await navigateWorker(session, url);
    if (message.transferId) session.activePost = { tabId, transferId: message.transferId };
    return askPost(tabId, message, 60, session.controller?.signal);
  }

  async function askPost(tabId, message, attempts = 60, signal) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        if (signal?.aborted) throw new Error("The collection export was cancelled.");
        const result = await cancellable(call(api.tabs, "sendMessage", tabId, message), signal);
        const identityMatches = !message.expectedPostId
          || (result?.post || result?.file)?.postId === message.expectedPostId;
        if (result && !result.error && identityMatches) return result;
        lastError = new Error(result?.error || "The post is not ready for export.");
        // Readiness polling must not restart a completed, failed export (which
        // may already have exhausted its own bounded network retries).
        if (message.type === "BUILD_POST_EXPORT" && result?.error && !/not finished loading|not ready for export/i.test(result.error)) {
          lastError.postFailure = true; throw lastError;
        }
      } catch (error) { if (error.postFailure) throw error; lastError = error; }
      if (signal?.aborted) throw new Error("The collection export was cancelled.");
      await cancellable(delay(250), signal);
    }
    throw lastError || new Error("The post did not become ready for export.");
  }

  async function reportCollectionProgress(session, token, phase, current, total, format = "", detail = {}) {
    checkCancelled(session);
    try {
      await call(api.tabs, "sendMessage", session.ownerTabId, {
        type: "COLLECTION_EXPORT_PROGRESS", token, phase, current, total, format, ...detail
      });
    } catch { /* The owner tab may have closed or navigated. */ }
  }

  function validFileMetadata(file) {
    return file && typeof file.title === "string"
      && ["md", "epub", "snapshot"].includes(file.extension)
      && ["text", "base64"].includes(file.encoding)
      && Number.isSafeInteger(file.length) && file.length >= 0;
  }

  async function pullPostFile(tabId, transferId, metadata, signal) {
    if (!validFileMetadata(metadata)) throw new Error("The post returned invalid export metadata.");
    const chunks = [];
    let offset = 0;
    try {
      while (offset < metadata.length) {
        const result = await askPost(tabId, {
          type: "GET_POST_EXPORT_CHUNK", transferId, offset
        }, 60, signal);
        if (typeof result.data !== "string" || !result.data.length
          || result.data.length > MAX_TRANSFER_CHARS) {
          throw new Error("The post returned an invalid export chunk.");
        }
        chunks.push(result.data);
        offset += result.data.length;
        if (Boolean(result.done) !== (offset === metadata.length)) {
          throw new Error("The post export ended at an unexpected position.");
        }
      }
      if (offset !== metadata.length) throw new Error("The post export is incomplete.");
      return { ...metadata, data: chunks.join("") };
    } finally {
      call(api.tabs, "sendMessage", tabId, { type: "RELEASE_POST_EXPORT", transferId }).catch(() => {});
    }
  }

  async function buildCollection(token, session, format, selectedIndex, operationId) {
    const files = [];
    await reportCollectionProgress(session, token, "build", 0, session.posts.length, format,
      { operationId, index: selectedIndex ?? 0, title: session.posts[selectedIndex ?? 0].title });
    for (let index = 0; index < session.posts.length; index++) {
      if (selectedIndex !== undefined && index !== selectedIndex) continue;
      const post = session.posts[index];
      session.buildIndex = index;
      session.operationId = operationId;
      if (cancelledCollections.has(token)) throw new Error("The collection export was cancelled.");
      let result;
      let usedTabId;
      const transferId = crypto.randomUUID();
      const expectedPostId = /(?:\/|-)(\d+)\/?$/.exec(new URL(post.url).pathname)[1];
      if (format === "snapshot") {
        const cached = await sourceCache.get(token, expectedPostId);
        checkCancelled(session);
        if (cached) {
          files.push({ ...cached, cached: true });
          await reportCollectionProgress(session, token, "build", index + 1, session.posts.length, format, { operationId, index, title: post.title, cached: true });
          continue;
        }
      }
      const request = { type: "BUILD_POST_EXPORT", format, transferId, expectedPostId };
      if (post.tabId) {
        try {
          session.activePost = { tabId: post.tabId, transferId };
          result = await askPost(post.tabId, request, 60, session.controller.signal);
          usedTabId = post.tabId;
        } catch (error) {
          checkCancelled(session);
          if (error.postFailure) throw error;
          result = await askWorkerPost(session, post.url, request);
          usedTabId = session.workerTabId;
        }
      } else {
        result = await askWorkerPost(session, post.url, request);
        usedTabId = session.workerTabId;
      }
      if (cancelledCollections.has(token)) {
        call(api.tabs, "sendMessage", usedTabId, { type: "RELEASE_POST_EXPORT", transferId }).catch(() => {});
        throw new Error("The collection export was cancelled.");
      }
      const file = await pullPostFile(usedTabId, transferId, result.file, session.controller.signal);
      checkCancelled(session);
      if (format === "snapshot") await sourceCache.put(token, expectedPostId, file, session.controller.signal);
      checkCancelled(session);
      files.push(file);
      session.activePost = null;
      await reportCollectionProgress(session, token, "build", index + 1, session.posts.length, format, { operationId, index, title: post.title, cached: false });
    }
    return files;
  }

  async function prepareCollection(message, sender) {
    const urls = Array.isArray(message.urls) ? [...new Set(message.urls)] : [];
    if (typeof message.token !== "string" || !/^[0-9a-f-]{36}$/i.test(message.token)
      || !urls.length || urls.length > 1000 || urls.some(url => !validPostUrl(url))) {
      throw new Error("The collection supplied an invalid post list.");
    }
    const existingSession = collections.get(message.token);
    if (existingSession && (!message.refresh || existingSession.ownerTabId !== sender.tab.id
      || existingSession.preparing || existingSession.building)) {
      throw new Error("This collection is already prepared, busy, or belongs to another tab.");
    }
    const previous = existingSession?.expires > Date.now() ? existingSession : null;
    const revisions = new Map();
    if (Array.isArray(message.revisions) && message.revisions.length <= 1000) {
      for (const item of message.revisions) {
        if (urls.includes(item?.url) && /^[a-f0-9]{64}$/.test(item?.revision || "")) revisions.set(item.url, item.revision);
      }
    }
    const reusable = new Map();
    for (const post of previous?.posts || []) {
      if (post.revision && revisions.get(post.url) === post.revision) reusable.set(post.url, post);
    }
    cancelledCollections.delete(message.token);
    const session = {
      ownerTabId: sender.tab.id,
      ownerWindowId: sender.tab.windowId,
      workerTabId: null,
      posts: [],
      skipped: 0,
      skippedPosts: [],
      reused: 0,
      preparing: true,
      controller: new AbortController(),
      expires: Date.now() + COLLECTION_CACHE_MS
    };
    collections.set(message.token, session);
    try {
      // Keep the same owner namespace and original expiry for unchanged sources.
      // Remove changed, removed, locked or unverifiable sources before revalidation.
      await sourceCache.retain(message.token, new Set([...reusable.keys()].map(url => /(?:\/|-)(\d+)\/?$/.exec(new URL(url).pathname)[1])), session.controller.signal);
      checkCancelled(session);
      await reportCollectionProgress(session, message.token, "prepare", 0, urls.length, "", { operationId: message.operationId });
      for (let index = 0; index < urls.length; index++) {
        const url = urls[index];
        await reportCollectionProgress(session, message.token, "prepare-post", index, urls.length, "", { operationId: message.operationId, index });
        const expectedPostId = /(?:\/|-)(\d+)\/?$/.exec(new URL(url).pathname)[1];
        const prior = reusable.get(url);
        if (prior && await sourceCache.has(message.token, expectedPostId)) {
          checkCancelled(session);
          session.posts.push({ ...prior }); session.reused++;
          await reportCollectionProgress(session, message.token, "prepare", index + 1, urls.length, "",
            { operationId: message.operationId, index, title: prior.title, cached: true });
          continue;
        }
        checkCancelled(session);
        const request = { type: "DESCRIBE_POST_EXPORT", expectedPostId };
        const existing = [...knownPosts].find(([, postUrl]) => postUrl === url);
        try {
          let result;
          let tabId = null;
          if (existing) {
            try { result = await askPost(existing[0], request, 60, session.controller.signal); tabId = existing[0]; }
            catch { /* A previously registered tab may have navigated elsewhere. */ }
          }
          checkCancelled(session);
          if (!result) result = await askWorkerPost(session, url, request);
          if (cancelledCollections.has(message.token)) throw new Error("The collection export was cancelled.");
          session.posts.push({
            tabId,
            url,
            title: result.post.title,
            ...(revisions.has(url) ? { revision: revisions.get(url) } : {}),
            origins: result.post.origins
          });
        } catch (error) {
          if (session.controller.signal.aborted || cancelledCollections.has(message.token)) throw error;
          session.skipped++;
          const errorText = String(error.message || "");
          const reason = /supported text body|could not be found|not ready|finished loading/i.test(errorText)
            ? "No supported text body was available. The post may be locked, unsupported, or not fully loaded."
            : /timed out|not respond|receiving end|connection/i.test(errorText)
              ? "The post could not be loaded or did not respond during preparation."
              : "The post could not be prepared. Access or page loading may have failed.";
          session.skippedPosts.push({ url, title: "", reason });
        }
        await reportCollectionProgress(session, message.token, "prepare", index + 1, urls.length, "",
          { operationId: message.operationId, index, title: session.posts.at(-1)?.url === url ? session.posts.at(-1).title : "" });
      }
      if (!session.posts.length) throw Object.assign(new Error("No accessible text posts in this collection could be prepared."), { skippedPosts: session.skippedPosts });
      if (cancelledCollections.has(message.token)) throw new Error("The collection export was cancelled.");
      await closeWorker(session);
      checkCancelled(session);
      session.expires = Date.now() + COLLECTION_CACHE_MS;
      await persistCollection(message.token, session);
      checkCancelled(session);
      session.preparing = false;
      cancelledCollections.delete(message.token);
      return {
        registered: true,
        reused: session.reused,
        count: session.posts.length,
        postUrls: session.posts.map(post => post.url),
        postTitles: session.posts.map(post => post.title),
        skipped: session.skipped,
        skippedPosts: session.skippedPosts,
        origins: [...new Set(session.posts.flatMap(post => post.origins))]
      };
    } catch (error) {
      if (collections.get(message.token) === session) await discardCollection(message.token);
      cancelledCollections.delete(message.token);
      throw error;
    }
  }

  function collectionFor(message, sender) {
    const session = collections.get(message.token);
    if (!session || session.ownerTabId !== sender.tab.id || session.preparing) return null;
    if (session.expires <= Date.now()) {
      discardCollection(message.token).catch(() => {});
      return null;
    }
    return session;
  }

  function handleMessage(message, sender, respond) {
    if (sender.id !== api.runtime.id || !message || typeof message !== "object") return;
    let senderHost = "";
    try { senderHost = sender.tab?.url ? new URL(sender.tab.url).hostname : ""; }
    catch { /* Reject malformed sender URLs below. */ }
    if (senderHost !== "www.patreon.com") {
      if (["REGISTER_POST_EXPORT", "GET_POST_EXPORT_REQUEST", "DELIVER_POST_EXPORT", "FETCH_POST_EXPORT_IMAGE",
        "REGISTER_EXPORTABLE_POST_TAB", "UNREGISTER_EXPORTABLE_POST_TAB",
        "PREPARE_COLLECTION_EXPORT", "GET_COLLECTION_EXPORT_REQUEST", "DELIVER_COLLECTION_EXPORT",
        "BUILD_COLLECTION_EXPORT", "GET_COLLECTION_EXPORT_CHUNK", "FINISH_COLLECTION_EXPORT",
        "CANCEL_COLLECTION_EXPORT"].includes(message.type)) {
        respond({ error: "Post export requests must come from Patreon." });
      }
      return;
    }

    if (message.type === "REGISTER_EXPORTABLE_POST_TAB") {
      if (validPostUrl(sender.tab.url)) {
        const url = new URL(sender.tab.url);
        url.search = "";
        url.hash = "";
        knownPosts.set(sender.tab.id, url.href);
      }
      respond({ registered: true });
      return;
    }

    if (message.type === "UNREGISTER_EXPORTABLE_POST_TAB") {
      knownPosts.delete(sender.tab.id);
      respond({ unregistered: true });
      return;
    }

    if (message.type === "REGISTER_POST_EXPORT") {
      const origins = Array.isArray(message.origins) ? [...new Set(message.origins)] : [];
      if (typeof message.token !== "string" || !/^[0-9a-f-]{36}$/i.test(message.token)
        || origins.length > 20 || origins.some(origin => {
        try {
          const url = new URL(origin.replace(/\*$/, "placeholder"));
          return url.protocol !== "https:" || !origin.endsWith("/*") || url.pathname !== "/placeholder";
        } catch { return true; }
      })) {
        respond({ error: "The post supplied an invalid media origin." });
        return;
      }
      pending.set(message.token, { origins, tabId: sender.tab.id, expires: Date.now() + 5 * 60_000 });
      respond({ registered: true });
      return;
    }

    if (message.type === "GET_POST_EXPORT_REQUEST") {
      const request = pending.get(message.token);
      if (!request || request.expires < Date.now() || request.tabId !== sender.tab.id) {
        pending.delete(message.token);
        respond({ error: "The export request expired. Reopen Download." });
        return;
      }
      respond({ origins: request.origins });
      return;
    }

    if (message.type === "DELIVER_POST_EXPORT") {
      const request = pending.get(message.token);
      const validFormat = ["pdf", "epub", "markdown"].includes(message.format);
      if (!request || request.expires < Date.now() || request.tabId !== sender.tab.id
        || (!validFormat && typeof message.error !== "string")) {
        pending.delete(message.token);
        respond({ error: "The export request expired or is invalid. Reopen Download." });
        return;
      }
      call(api.tabs, "sendMessage", request.tabId, {
        type: "POST_EXPORT_CHOICE",
        token: message.token,
        ...(validFormat ? { format: message.format } : { error: message.error })
      }).then((result) => respond(result || { error: "The post exporter did not respond." }))
        .catch((error) => respond({ error: error.message || "Unable to start the post export." }));
      return true;
    }

    if (message.type === "PREPARE_COLLECTION_EXPORT") {
      prepareCollection(message, sender).then(respond)
        .catch((error) => respond({ error: error.message || "The collection could not be prepared.", skippedPosts: error.skippedPosts || [] }));
      return true;
    }

    if (message.type === "GET_COLLECTION_EXPORT_REQUEST") {
      const session = collectionFor(message, sender);
      respond(session ? {
        origins: [...new Set(session.posts.flatMap(post => post.origins))],
        count: session.posts.length,
        postUrls: session.posts.map(post => post.url),
        postTitles: session.posts.map(post => post.title),
        skipped: session.skipped,
        skippedPosts: session.skippedPosts || []
      } : { error: "The collection export request expired. Reopen Download." });
      return;
    }

    if (message.type === "DELIVER_COLLECTION_EXPORT") {
      const session = collectionFor(message, sender);
      const validFormat = ["epub", "markdown", "epub-book", "pdf", "pdf-book"].includes(message.format);
      if (!session || (!validFormat && typeof message.error !== "string")) {
        respond({ error: "The collection export request expired or is invalid. Reopen Download." });
        return;
      }
      call(api.tabs, "sendMessage", session.ownerTabId, {
        type: "COLLECTION_EXPORT_CHOICE", token: message.token,
        ...(validFormat ? { format: message.format } : { error: message.error })
      }).then((result) => respond(result || { error: "The collection exporter did not respond." }))
        .catch((error) => respond({ error: error.message || "Unable to start the collection export." }));
      return true;
    }

    if (message.type === "BUILD_COLLECTION_EXPORT") {
      const session = collectionFor(message, sender);
      if (!session || !["epub", "markdown", "snapshot"].includes(message.format)) {
        respond({ error: "The collection export request expired or is invalid. Reopen Download." });
        return;
      }
      if (session.building) { respond({ error: "A collection export is already running." }); return; }
      if (message.index !== undefined && (!Number.isSafeInteger(message.index)
        || message.index < 0 || message.index >= session.posts.length)) {
        respond({ error: "The collection post index is invalid." }); return;
      }
      session.building = true;
      session.controller = new AbortController();
      buildCollection(message.token, session, message.format, message.index, message.operationId).then(async files => {
        checkCancelled(session);
        await closeWorker(session);
        session.files = message.index === undefined ? files : Object.assign([], { [message.index]: files[0] });
        session.expires = Date.now() + COLLECTION_CACHE_MS;
        await persistCollection(message.token, session);
        checkCancelled(session);
        session.building = false;
        cancelledCollections.delete(message.token);
        respond({
          files: files.map(file => ({
            title: file.title,
            extension: file.extension,
            encoding: file.encoding,
            length: file.data.length,
            cached: file.cached === true
          })),
          skipped: session.skipped
        });
      }).catch(async error => {
        if (message.index === undefined || session.controller.signal.aborted) {
          if (collections.get(message.token) === session) await discardCollection(message.token);
        } else {
          // Keep prepared metadata so a failed chapter can be requested again.
          cancelActivePost(session);
          delete session.files;
          await closeWorker(session);
          session.building = false;
        }
        cancelledCollections.delete(message.token);
        respond({ error: error.message || "One of the collection posts could not be exported." });
      });
      return true;
    }

    if (message.type === "GET_COLLECTION_EXPORT_CHUNK") {
      const session = collectionFor(message, sender);
      const index = message.index;
      const file = Number.isSafeInteger(index) && index >= 0 ? session?.files?.[index] : null;
      const offset = message.offset;
      if (!file || typeof file.data !== "string" || !Number.isSafeInteger(offset)
        || offset < 0 || offset > file.data.length) {
        respond({ error: "The collection file transfer expired or is invalid." });
        return;
      }
      let end = Math.min(file.data.length, offset + MAX_TRANSFER_CHARS);
      if (end < file.data.length && /[\uD800-\uDBFF]/.test(file.data[end - 1])) end--;
      const data = file.data.slice(offset, end);
      const done = end === file.data.length;
      if (done) file.data = null;
      respond({ data, done });
      return;
    }

    if (message.type === "FINISH_COLLECTION_EXPORT") {
      const session = collectionFor(message, sender);
      if (!session) {
        respond({ error: "The collection export request expired. Reopen Download." });
        return;
      }
      delete session.files;
      closeWorker(session).then(() => {
        cancelledCollections.delete(message.token);
        respond({ finished: true });
      });
      return true;
    }

    if (message.type === "CANCEL_COLLECTION_EXPORT") {
      const session = collections.get(message.token);
      if (session && session.ownerTabId !== sender.tab.id) { respond({ error: "This collection belongs to another tab." }); return; }
      cancelledCollections.add(message.token);
      discardCollection(message.token).then(() => respond({ cancelled: true }));
      return true;
    }

    if (message.type !== "FETCH_POST_EXPORT_IMAGE") return;
    let parsed;
    try { parsed = new URL(message.url); }
    catch { respond({ error: "The post contains an invalid image URL." }); return; }
    if (parsed.protocol !== "https:") {
      respond({ error: "The image source is not permitted for post export." });
      return;
    }
    const origin = `${parsed.origin}/*`;
    const mediaKey = typeof message.transferId === "string" ? `${sender.tab.id}:${message.transferId}` : "";
    if (mediaKey && cancelledMediaTransfers.has(mediaKey)) { respond({ error: "The collection export was cancelled." }); return; }
    const controller = new AbortController();
    if (mediaKey) {
      if (!mediaRequests.has(mediaKey)) mediaRequests.set(mediaKey, new Set());
      mediaRequests.get(mediaKey).add(controller);
    }
    const limit = Number.isSafeInteger(message.maxBytes) && message.maxBytes > 0
      ? Math.min(message.maxBytes, MAX_IMAGE_BYTES) : MAX_IMAGE_BYTES;
    globalThis.PatreonRetry.run(async ({ signal }) => {
      const release = await mediaSlot(signal);
      try {
        signal.throwIfAborted();
        if (!await call(api.permissions, "contains", { origins: [origin] })) {
          throw new Error("Media access was not granted for this image origin.");
        }
        let response;
        try { response = await fetch(parsed.href, { credentials: "omit", redirect: "error", signal }); }
        catch (error) { throw globalThis.PatreonRetry.networkError(error); }
        if (!response.ok) {
          const error = globalThis.PatreonRetry.httpError(response, "Image request failed");
          await response.body?.cancel().catch(() => {});
          throw error;
        }
        const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
        if (!type?.startsWith("image/")) throw new Error("The media response was not an image.");
        const declaredSize = Number(response.headers.get("content-length"));
        if (Number.isFinite(declaredSize) && declaredSize > limit) throw new Error("An inline image is too large to export safely.");
        if (!response.body) throw new Error("The image response has no readable body.");
        const reader = response.body.getReader();
        const chunks = [];
        let tail = new Uint8Array(Math.min(limit, 64 * 1024));
        let used = 0;
        let size = 0;
        try {
          while (true) {
            signal.throwIfAborted();
            let next;
            try { next = await reader.read(); } catch (error) { throw globalThis.PatreonRetry.networkError(error); }
            const { value, done } = next;
            if (done) break;
            size += value.byteLength;
            if (size > limit) throw new Error("An inline image is too large to export safely.");
            // Coalesce tiny network chunks so bookkeeping is bounded too.
            let offset = 0;
            while (offset < value.length) {
              const count = Math.min(tail.length - used, value.length - offset);
              tail.set(value.subarray(offset, offset + count), used);
              used += count; offset += count;
              if (used === tail.length) { chunks.push(tail); tail = new Uint8Array(Math.min(limit, 64 * 1024)); used = 0; }
            }
          }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        if (used) chunks.push(tail.subarray(0, used));
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        return { dataUrl: `data:${type};base64,${base64(bytes)}`, type };
      } finally { release(); }
    }, { signal: controller.signal, onRetry: async retry => {
      const active = [...collections].find(([, session]) => session.activePost?.tabId === sender.tab.id
        && session.activePost?.transferId === message.transferId);
      if (active) {
        const [token, session] = active;
        const index = session.buildIndex;
        await reportCollectionProgress(session, token, "retry", 0, session.posts.length, "", {
          operationId: session.operationId, index: Math.max(0, index), ...retry
        });
      }
      await call(api.tabs, "sendMessage", sender.tab.id, { type: "POST_EXPORT_RETRY", transferId: message.transferId, ...retry }).catch(() => {});
    } }).then(respond).catch((error) => respond({ error: controller.signal.aborted ? "The post media request was cancelled." : error.message || "Unable to fetch post media." })).finally(() => {
      controller.abort();
      if (mediaKey) {
        mediaRequests.get(mediaKey)?.delete(controller);
        if (!mediaRequests.get(mediaKey)?.size) mediaRequests.delete(mediaKey);
      }
    });
    return true;
  }

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (["PREPARE_COLLECTION_EXPORT", "GET_COLLECTION_EXPORT_REQUEST", "DELIVER_COLLECTION_EXPORT",
      "BUILD_COLLECTION_EXPORT", "GET_COLLECTION_EXPORT_CHUNK", "FINISH_COLLECTION_EXPORT",
      "CANCEL_COLLECTION_EXPORT"].includes(message?.type)) {
      collectionsReady.then(() => retention.wait()).then(() => {
        if (retention.isClosed()) { respond({ error: "Export caches were cleared when the last browser window closed." }); return; }
        return handleMessage(message, sender, respond);
      })
        .catch(() => respond({ error: "Unable to restore the collection session. Close and reopen Download Collection." }));
      return true;
    }
    return handleMessage(message, sender, respond);
  });

  api.tabs.onRemoved.addListener(tabId => {
    knownPosts.delete(tabId);
    collectionsReady.then(async () => {
      for (const [token, session] of collections) {
        if (session.ownerTabId === tabId) await discardCollection(token);
        else if (session.workerTabId === tabId) session.workerTabId = null;
      }
    }).catch(() => {});
  });
})();
