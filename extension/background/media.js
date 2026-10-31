/* Fetches post media only after the user grants the exact image origin. */
(() => {
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  const pending = new Map();
  const collections = new Map();
  const knownPosts = new Map();
  const cancelledCollections = new Set();

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

  async function closeTabs(tabIds) {
    if (!tabIds.length) return;
    try { await call(api.tabs, "remove", tabIds); }
    catch { /* Tabs may already have been closed by the user. */ }
  }

  async function discardCollection(token) {
    const session = collections.get(token);
    collections.delete(token);
    if (session) await closeTabs(session.posts.filter(post => post.owned).map(post => post.tabId));
  }

  async function createPostTab(url, session) {
    const tab = await call(api.tabs, "create", {
      url, active: false, windowId: session.ownerWindowId
    });
    return tab.id;
  }

  async function askOwnedPost(tabId, ownerTabId, message) {
    try {
      return await askPost(tabId, message, 8);
    } catch {
      await call(api.tabs, "update", tabId, { active: true });
      await call(api.tabs, "update", ownerTabId, { active: true });
      return askPost(tabId, message);
    }
  }

  async function askPost(tabId, message, attempts = 60) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const result = await call(api.tabs, "sendMessage", tabId, message);
        if (result && !result.error) return result;
        lastError = new Error(result?.error || "The post is not ready for export.");
      } catch (error) { lastError = error; }
      await delay(250);
    }
    throw lastError || new Error("The post did not become ready for export.");
  }

  async function buildCollection(token, session, format) {
    const files = [];
    for (const post of session.posts) {
      if (cancelledCollections.has(token)) throw new Error("The collection export was cancelled.");
      let tabId = post.tabId;
      let owned = false;
      try {
        if (!tabId) {
          tabId = await createPostTab(post.url, session);
          owned = true;
        }
        let result;
        try {
          result = owned
            ? await askOwnedPost(tabId, session.ownerTabId, { type: "BUILD_POST_EXPORT", format })
            : await askPost(tabId, { type: "BUILD_POST_EXPORT", format });
        } catch (error) {
          if (owned) throw error;
          tabId = await createPostTab(post.url, session);
          owned = true;
          result = await askOwnedPost(tabId, session.ownerTabId, { type: "BUILD_POST_EXPORT", format });
        }
        if (cancelledCollections.has(token)) throw new Error("The collection export was cancelled.");
        files.push(result.file);
      } finally {
        if (owned && tabId) await closeTabs([tabId]);
      }
    }
    return files;
  }

  async function prepareCollection(message, sender) {
    const urls = Array.isArray(message.urls) ? [...new Set(message.urls)] : [];
    if (typeof message.token !== "string" || !/^[0-9a-f-]{36}$/i.test(message.token)
      || !urls.length || urls.length > 100 || urls.some(url => !validPostUrl(url))) {
      throw new Error("The collection supplied an invalid post list.");
    }
    cancelledCollections.delete(message.token);
    await discardCollection(message.token);
    const posts = [];
    let skipped = 0;
    try {
      for (const url of urls) {
        const existing = [...knownPosts].find(([, postUrl]) => postUrl === url);
        const owned = !existing;
        const tab = existing ? { id: existing[0] }
          : { id: await createPostTab(url, { ownerWindowId: sender.tab.windowId }) };
        try {
          const result = owned
            ? await askOwnedPost(tab.id, sender.tab.id, { type: "DESCRIBE_POST_EXPORT" })
            : await askPost(tab.id, { type: "DESCRIBE_POST_EXPORT" });
          if (cancelledCollections.has(message.token)) throw new Error("The collection export was cancelled.");
          posts.push({
            tabId: owned ? null : tab.id,
            owned: false,
            url,
            title: result.post.title,
            origins: result.post.origins
          });
          if (owned) await closeTabs([tab.id]);
        } catch (error) {
          if (cancelledCollections.has(message.token)) {
            if (owned) await closeTabs([tab.id]);
            throw error;
          }
          skipped++;
          if (owned) await closeTabs([tab.id]);
        }
      }
      if (!posts.length) throw new Error("No accessible text posts in this collection could be prepared.");
      if (cancelledCollections.has(message.token)) throw new Error("The collection export was cancelled.");
      const session = {
        ownerTabId: sender.tab.id,
        ownerWindowId: sender.tab.windowId,
        posts,
        skipped,
        expires: Date.now() + 5 * 60_000
      };
      collections.set(message.token, session);
      cancelledCollections.delete(message.token);
      return {
        registered: true,
        count: posts.length,
        skipped,
        origins: [...new Set(posts.flatMap(post => post.origins))]
      };
    } catch (error) {
      await closeTabs(posts.filter(post => post.owned).map(post => post.tabId));
      cancelledCollections.delete(message.token);
      throw error;
    }
  }

  function collectionFor(message, sender) {
    const session = collections.get(message.token);
    if (!session || session.expires < Date.now() || session.ownerTabId !== sender.tab.id) {
      discardCollection(message.token);
      return null;
    }
    return session;
  }

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== api.runtime.id || !message || typeof message !== "object") return;
    let senderHost = "";
    try { senderHost = sender.tab?.url ? new URL(sender.tab.url).hostname : ""; }
    catch { /* Reject malformed sender URLs below. */ }
    if (senderHost !== "www.patreon.com") {
      if (["REGISTER_POST_EXPORT", "GET_POST_EXPORT_REQUEST", "DELIVER_POST_EXPORT", "FETCH_POST_EXPORT_IMAGE",
        "REGISTER_EXPORTABLE_POST_TAB", "UNREGISTER_EXPORTABLE_POST_TAB",
        "PREPARE_COLLECTION_EXPORT", "GET_COLLECTION_EXPORT_REQUEST", "DELIVER_COLLECTION_EXPORT",
        "BUILD_COLLECTION_EXPORT", "CANCEL_COLLECTION_EXPORT"].includes(message.type)) {
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
      buildCollection(message.token, session, message.format).then(async files => {
        const skipped = session.skipped;
        await discardCollection(message.token);
        cancelledCollections.delete(message.token);
        respond({ files, skipped });
      }).catch(async error => {
        await discardCollection(message.token);
        cancelledCollections.delete(message.token);
        respond({ error: error.message || "One of the collection posts could not be exported." });
      });
      return true;
    }

    if (message.type === "CANCEL_COLLECTION_EXPORT") {
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
    call(api.permissions, "contains", { origins: [origin] }).then((allowed) => {
      if (!allowed) throw new Error("Media access was not granted for this image origin.");
      return fetch(parsed.href, { credentials: "omit", redirect: "follow" });
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
    }).catch((error) => respond({ error: error.message || "Unable to fetch post media." }));
    return true;
  });

  api.tabs.onRemoved.addListener(tabId => knownPosts.delete(tabId));
})();
