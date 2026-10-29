/* Fetches post media only after the user grants the exact image origin. */
(() => {
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  const pending = new Map();

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

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== api.runtime.id || !message || typeof message !== "object") return;
    let senderHost = "";
    try { senderHost = sender.tab?.url ? new URL(sender.tab.url).hostname : ""; }
    catch { /* Reject malformed sender URLs below. */ }
    if (senderHost !== "www.patreon.com") {
      if (["REGISTER_POST_EXPORT", "GET_POST_EXPORT_REQUEST", "DELIVER_POST_EXPORT", "FETCH_POST_EXPORT_IMAGE"].includes(message.type)) {
        respond({ error: "Post export requests must come from Patreon." });
      }
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
})();
