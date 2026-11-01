/* Fetches post media only after the user grants the exact image origin. */
(() => {
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  const pending = new Map();
  const collections = new Map();
  const knownPosts = new Map();
  const cancelledCollections = new Set();
  const MAX_TRANSFER_CHARS = 1024 * 1024;
  const COLLECTION_CACHE_MS = 2 * 60 * 60_000;
  const COLLECTION_SESSION_PREFIX = "collection-export:";
  const mediaRequests = new Map();
  const cancelledMediaTransfers = new Set();

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
    const { ownerTabId, ownerWindowId, posts, skipped, expires } = session;
    await call(api.storage.session, "set", {
      [COLLECTION_SESSION_PREFIX + token]: { version: 1, ownerTabId, ownerWindowId, posts, skipped, expires }
    });
    if (session.controller?.signal.aborted) await call(api.storage.session, "remove", COLLECTION_SESSION_PREFIX + token);
    checkCancelled(session);
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
        || !Array.isArray(value.posts) || !value.posts.length || value.posts.length > 100
        || !value.posts.every(post => validPostUrl(post?.url) && typeof post.title === "string"
          && (post.tabId === null || Number.isSafeInteger(post.tabId))
          && Array.isArray(post.origins) && post.origins.every(origin => typeof origin === "string"))) {
        expired.push(key);
        continue;
      }
      collections.set(token, { ...value, workerTabId: null });
    }
    if (expired.length) await call(api.storage.session, "remove", expired);
  }

  const collectionsReady = restoreCollections();
  collectionsReady.catch(() => {}); // Request handlers surface restoration failures.

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
      } catch (error) { lastError = error; }
      if (signal?.aborted) throw new Error("The collection export was cancelled.");
      await cancellable(delay(250), signal);
    }
    throw lastError || new Error("The post did not become ready for export.");
  }

  async function reportCollectionProgress(session, token, phase, current, total, format = "") {
    checkCancelled(session);
    try {
      await call(api.tabs, "sendMessage", session.ownerTabId, {
        type: "COLLECTION_EXPORT_PROGRESS", token, phase, current, total, format
      });
    } catch { /* The owner tab may have closed or navigated. */ }
  }

  function validFileMetadata(file) {
    return file && typeof file.title === "string"
      && ["md", "epub"].includes(file.extension)
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

  async function buildCollection(token, session, format, selectedIndex) {
    const files = [];
    await reportCollectionProgress(session, token, "build", 0, session.posts.length, format);
    for (let index = 0; index < session.posts.length; index++) {
      if (selectedIndex !== undefined && index !== selectedIndex) continue;
      const post = session.posts[index];
      if (cancelledCollections.has(token)) throw new Error("The collection export was cancelled.");
      let result;
      let usedTabId;
      const transferId = crypto.randomUUID();
      const expectedPostId = /(?:\/|-)(\d+)\/?$/.exec(new URL(post.url).pathname)[1];
      const request = { type: "BUILD_POST_EXPORT", format, transferId, expectedPostId };
      if (post.tabId) {
        try {
          session.activePost = { tabId: post.tabId, transferId };
          result = await askPost(post.tabId, request, 60, session.controller.signal);
          usedTabId = post.tabId;
        } catch {
          checkCancelled(session);
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
      files.push(await pullPostFile(usedTabId, transferId, result.file, session.controller.signal));
      session.activePost = null;
      await reportCollectionProgress(session, token, "build", index + 1, session.posts.length, format);
    }
    return files;
  }

  async function prepareCollection(message, sender) {
    const urls = Array.isArray(message.urls) ? [...new Set(message.urls)] : [];
    if (typeof message.token !== "string" || !/^[0-9a-f-]{36}$/i.test(message.token)
      || !urls.length || urls.length > 100 || urls.some(url => !validPostUrl(url))) {
      throw new Error("The collection supplied an invalid post list.");
    }
    if (collections.has(message.token)) throw new Error("This collection is already prepared or being prepared.");
    cancelledCollections.delete(message.token);
    const session = {
      ownerTabId: sender.tab.id,
      ownerWindowId: sender.tab.windowId,
      workerTabId: null,
      posts: [],
      skipped: 0,
      preparing: true,
      controller: new AbortController(),
      expires: Date.now() + COLLECTION_CACHE_MS
    };
    collections.set(message.token, session);
    try {
      await reportCollectionProgress(session, message.token, "prepare", 0, urls.length);
      for (let index = 0; index < urls.length; index++) {
        const url = urls[index];
        const expectedPostId = /(?:\/|-)(\d+)\/?$/.exec(new URL(url).pathname)[1];
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
            origins: result.post.origins
          });
        } catch (error) {
          if (session.controller.signal.aborted || cancelledCollections.has(message.token)) throw error;
          session.skipped++;
        }
        await reportCollectionProgress(session, message.token, "prepare", index + 1, urls.length);
      }
      if (!session.posts.length) throw new Error("No accessible text posts in this collection could be prepared.");
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
        count: session.posts.length,
        postUrls: session.posts.map(post => post.url),
        skipped: session.skipped,
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
        .catch((error) => respond({ error: error.message || "The collection could not be prepared." }));
      return true;
    }

    if (message.type === "GET_COLLECTION_EXPORT_REQUEST") {
      const session = collectionFor(message, sender);
      respond(session ? {
        origins: [...new Set(session.posts.flatMap(post => post.origins))],
        count: session.posts.length,
        postUrls: session.posts.map(post => post.url),
        skipped: session.skipped
      } : { error: "The collection export request expired. Reopen Download." });
      return;
    }

    if (message.type === "DELIVER_COLLECTION_EXPORT") {
      const session = collectionFor(message, sender);
      const validFormat = ["epub", "markdown"].includes(message.format);
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
      if (!session || !["epub", "markdown"].includes(message.format)) {
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
      buildCollection(message.token, session, message.format, message.index).then(async files => {
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
            length: file.data.length
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
    call(api.permissions, "contains", { origins: [origin] }).then((allowed) => {
      if (!allowed) throw new Error("Media access was not granted for this image origin.");
      return fetch(parsed.href, { credentials: "omit", redirect: "follow", signal: controller.signal });
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Image request failed (${response.status}).`);
      const finalOrigin = `${new URL(response.url).origin}/*`;
      if (!await call(api.permissions, "contains", { origins: [finalOrigin] })) {
        throw new Error("The image redirected to an origin without media permission.");
      }
      const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (!type?.startsWith("image/")) throw new Error("The media response was not an image.");
      const declaredSize = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES) throw new Error("An inline image is too large to export safely.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error("An inline image is too large to export safely.");
      respond({ dataUrl: `data:${type};base64,${base64(bytes)}`, type });
    }).catch((error) => respond({ error: error.message || "Unable to fetch post media." })).finally(() => {
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
      collectionsReady.then(() => handleMessage(message, sender, respond))
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
