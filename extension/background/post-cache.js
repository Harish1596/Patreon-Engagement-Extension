/* Extension-origin disk cache. Keys are synthetic; no network requests occur. */
(() => {
  function create({ storage = globalThis.caches, now = () => Date.now(),
    maxBytes = 512 * 1024 * 1024, ttlMs = 2 * 60 * 60_000, onChange = () => {}, cipher = globalThis.PatreonDiskCrypto } = {}) {
    const name = "patreon-export-sources-v1";
    let queue = Promise.resolve();
    let deadlines = new Map();
    const key = (token, postId) => `https://patreon-export-cache.invalid/${encodeURIComponent(token)}/${postId}`;
    // Serialize mutations, including cleanup, so concurrent collections share one
    // disk budget and cancelled writes cannot repopulate a cleared collection.
    function run(action, fallback) {
      const result = queue.then(async () => action(await storage.open(name))).catch(() => fallback);
      queue = result.then(() => {});
      return result;
    }
    async function entries(cache, owners) {
      const kept = [];
      const observed = new Map();
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        const size = Number(response?.headers.get("x-bytes"));
        const expires = Number(response?.headers.get("x-expires"));
        let token;
        try { token = decodeURIComponent(new URL(request.url).pathname.split("/")[1]); }
        catch { await cache.delete(request); continue; }
        if (response?.headers.get("x-encrypted") !== "1" || !Number.isSafeInteger(size) || size < 0 || !Number.isFinite(expires)
          || expires <= now() || (owners && !owners.has(token))) {
          await cache.delete(request);
        } else { kept.push({ request, size }); observed.set(request.url, expires); }
      }
      deadlines = observed;
      onChange();
      return kept;
    }
    return Object.freeze({
      get(token, postId) {
        return run(async cache => {
          const url = key(token, postId);
          const response = await cache.match(url);
          if (!response) return null;
          const expires = Number(response.headers.get("x-expires"));
          if (response.headers.get("x-encrypted") !== "1" || !Number.isFinite(expires) || expires <= now()) {
            await cache.delete(url);
            deadlines.delete(url);
            onChange();
            return null;
          }
          let file;
          try {
            file = JSON.parse(new TextDecoder().decode(await cipher.open(new Uint8Array(await response.arrayBuffer()), url)));
            const snapshot = JSON.parse(file.data);
            if (snapshot.version !== 1 || snapshot.postId !== postId || !Array.isArray(snapshot.assets)) throw new Error("Invalid cache entry");
          } catch { await cache.delete(url); deadlines.delete(url); onChange(); return null; }
          return { title: file.title, extension: "snapshot", encoding: "text", data: file.data };
        }, null);
      },
      put(token, postId, file, signal) {
        return run(async cache => {
          if (signal?.aborted || file.extension !== "snapshot") return false;
          if (new Blob([file.data]).size > maxBytes) return false;
          const blob = new Blob([await cipher.seal(new TextEncoder().encode(JSON.stringify({ title: file.title, data: file.data })), key(token, postId))]);
          if (blob.size > maxBytes) return false;
          const url = key(token, postId);
          await cache.delete(url);
          const existing = await entries(cache);
          let bytes = existing.reduce((total, item) => total + item.size, 0);
          // Keep this collection's warm prefix when its sources exceed the
          // budget. Evicting its next chapter on every miss would turn a repeat
          // sequential export into an entirely cold pass through the cache.
          const evictable = existing.filter(item => decodeURIComponent(new URL(item.request.url).pathname.split("/")[1]) !== token);
          if (bytes + blob.size - evictable.reduce((total, item) => total + item.size, 0) > maxBytes) return false;
          for (const item of evictable) {
            if (bytes + blob.size <= maxBytes) break;
            await cache.delete(item.request);
            deadlines.delete(item.request.url);
            bytes -= item.size;
          }
          if (signal?.aborted) return false;
          const expires = now() + ttlMs;
          await cache.put(url, new Response(blob, { headers: {
            "content-type": "application/octet-stream", "x-bytes": String(blob.size),
            "x-expires": String(expires), "x-encrypted": "1"
          } }));
          if (signal?.aborted) { await cache.delete(url); return false; }
          deadlines.set(url, expires);
          onChange();
          return true;
        }, false);
      },
      clear(token) {
        return run(async cache => {
          const prefix = `/${encodeURIComponent(token)}/`;
          for (const request of await cache.keys()) {
            if (new URL(request.url).pathname.startsWith(prefix)) { await cache.delete(request); deadlines.delete(request.url); }
          }
          onChange();
        });
      },
      prune(owners) { return run(cache => entries(cache, owners)); },
      deadline: () => Math.min(...deadlines.values())
    });
  }
  globalThis.PatreonPostCache = Object.freeze({ create });
})();
