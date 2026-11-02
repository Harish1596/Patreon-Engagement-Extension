/* Disk-backed retry files and streaming ZIP assembly. No archive bytes enter session storage. */
(() => {
  function install({ api = globalThis.browser?.runtime ? browser : chrome,
    root = () => navigator.storage.getDirectory(), download, retention = globalThis.PatreonRetention } = {}) {
    const { zipHeader, dosTimestamp } = globalThis.PatreonZip;
    const jobs = new Map();
    const cancelled = new Set();
    const prefix = "collection-archive:";
    const ttl = 2 * 60 * 60_000;
    const uuid = value => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
    const uint32 = value => Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff;
    const validEntry = entry => !entry || (typeof entry.name === "string" && !/[/\\\x00]/.test(entry.name)
      && uint32(entry.crc) && uint32(entry.size) && uint32(entry.compressedSize));
    let offscreen;
    function call(target, method, ...args) {
      if (globalThis.browser?.runtime) return target[method](...args);
      return new Promise((resolve, reject) => target[method](...args, result => {
        const error = api.runtime.lastError;
        if (error) reject(new Error(error.message)); else resolve(result);
      }));
    }
    const directory = async () => (await root()).getDirectoryHandle("patreon-archives-v1", { create: true });
    const folder = async job => (await directory()).getDirectoryHandle(job.id, { create: true });
    const check = job => {
      job.controller.signal.throwIfAborted();
      if (jobs.get(job.id) !== job) throw new Error("The archive was cancelled.");
    };
    async function persist(job) {
      const { id, owner, count, filename, entries, expires, downloadId } = job;
      await call(api.storage.session, "set", { [prefix + id]: { version: 1, id, owner, count, filename, entries, expires, ...(downloadId === undefined ? {} : { downloadId }) } });
      if (jobs.get(id) !== job) await call(api.storage.session, "remove", prefix + id);
      retention?.changed();
    }
    function enqueue(job, action) {
      job.busy = (job.busy || 0) + 1;
      const task = job.queue.then(() => { check(job); return action(); }).finally(() => { job.busy--; });
      job.queue = task.catch(() => {});
      return task;
    }
    async function cleanup(job, completed = false) {
      if (job.downloading && !completed) return false;
      if (jobs.get(job.id) === job) jobs.delete(job.id);
      job.controller.abort();
      await job.queue;
      await job.writer?.stream.abort().catch(() => {});
      await call(api.storage.session, "remove", prefix + job.id);
      try { await (await directory()).removeEntry(job.id, { recursive: true }); } catch { /* Already removed or unavailable. */ }
      if (api.offscreen && await api.offscreen.hasDocument()) {
        await call(api.runtime, "sendMessage", { type: "ARCHIVE_BLOB_CLOSE", id: job.id }).catch(() => {});
        if (![...jobs.values()].some(item => item.downloading || item.blobOpen)) await api.offscreen.closeDocument();
      }
      retention?.changed();
      return true;
    }
    const ready = (async () => {
      const stored = await call(api.storage.session, "get", null);
      for (const [key, value] of Object.entries(stored)) {
        if (!key.startsWith(prefix)) continue;
        if (!uuid(value?.id) || key !== prefix + value.id || value.version !== 1
          || !Number.isSafeInteger(value.owner) || !Number.isSafeInteger(value.count) || value.count < 1 || value.count > 100
          || !Array.isArray(value.entries) || value.entries.length > value.count || !value.entries.every(validEntry) || typeof value.filename !== "string"
          || (value.downloadId !== undefined && !uint32(value.downloadId))
          || /[/\\\x00]/.test(value.filename) || !Number.isFinite(value.expires) || (value.expires <= Date.now() && value.downloadId === undefined)) {
          await call(api.storage.session, "remove", key); continue;
        }
        jobs.set(value.id, { ...value, controller: new AbortController(), queue: Promise.resolve(), downloading: value.downloadId !== undefined });
      }
      try {
        const disk = await directory();
        for await (const [name] of disk.entries()) if (!jobs.has(name)) await disk.removeEntry(name, { recursive: true });
      } catch { /* A storage error is reported when the user starts an archive. */ }
      if (!download) for (const job of [...jobs.values()]) {
        if (job.downloadId === undefined) continue;
        const [state] = await call(api.downloads, "search", { id: job.downloadId });
        if (!state || ["complete", "interrupted"].includes(state.state)) await cleanup(job, true);
      }
    })();
    ready.catch(() => {});
    const sweep = async () => {
      await ready;
      for (const job of [...jobs.values()]) {
        if (!job.downloading && !job.busy && job.expires <= Date.now()) {
          await cleanup(job);
          await call(api.tabs, "sendMessage", job.owner, { type: "COLLECTION_ARCHIVE_EXPIRED", id: job.id }).catch(() => {});
        }
      }
    };
    const clear = async () => { await ready; await Promise.all([...jobs.values()].map(job => cleanup(job))); };
    retention?.register({ ready, deadline: () => Math.min(...[...jobs.values()].filter(job => !job.downloading).map(job => job.expires)), sweep, clear });
    async function deliver(job, operationId) {
      if (download) return download(job, await (await (await folder(job)).getFileHandle("archive.zip")).getFile());
      job.blobOpen = true;
      try {
        if (!offscreen) offscreen = (async () => {
          if (!await api.offscreen.hasDocument()) await api.offscreen.createDocument({
            url: "export/archive-download.html", reasons: ["BLOBS"], justification: "Save a disk-backed collection ZIP and release it when its download finishes."
          });
        })().finally(() => { offscreen = null; });
        await offscreen;
        check(job);
        const blob = await call(api.runtime, "sendMessage", { type: "ARCHIVE_BLOB_OPEN", id: job.id });
        if (!blob?.url?.startsWith(`blob:${api.runtime.getURL("")}`)) throw new Error(blob?.error || "The archive download could not be opened.");
        check(job);
        const handoff = await call(api.tabs, "sendMessage", job.owner, { type: "COLLECTION_ARCHIVE_HANDOFF", id: job.id, operationId });
        check(job);
        if (!handoff?.handedOff) throw new Error("The collection page is no longer ready to download.");
        job.downloading = true;
        try {
          job.downloadId = await call(api.downloads, "download", { url: blob.url, filename: job.filename, saveAs: false });
          await persist(job);
          const [state] = await call(api.downloads, "search", { id: job.downloadId });
          if (state?.state === "complete" || state?.state === "interrupted") {
            setTimeout(() => cleanup(job, true).catch(() => {}), 0);
          }
        } catch (error) { job.downloading = false; throw error; }
        return { started: true, downloadId: job.downloadId };
      } catch (error) {
        job.blobOpen = false;
        if (await api.offscreen.hasDocument()) {
          await call(api.runtime, "sendMessage", { type: "ARCHIVE_BLOB_CLOSE", id: job.id }).catch(() => {});
          if (![...jobs.values()].some(item => item.downloading || item.blobOpen)) await api.offscreen.closeDocument();
        }
        throw error;
      }
    }
    async function packageZip(job, operationId) {
      if (job.entries.filter(Boolean).length !== job.count) throw new Error("Some archive chapters are missing.");
      const disk = await folder(job);
      const output = await (await disk.getFileHandle("archive.zip", { create: true })).createWritable();
      const central = [];
      const timestamp = dosTimestamp();
      let offset = 0;
      let bytesCopied = 0;
      let lastUpdate = -Infinity;
      const bytesTotal = job.entries.reduce((sum, entry) => sum + entry.compressedSize, 0);
      async function progress(index, current, force = false, stage = "copy") {
        check(job);
        const now = Date.now();
        if (!force && now - lastUpdate < 250) return;
        lastUpdate = now;
        await call(api.tabs, "sendMessage", job.owner, { type: "COLLECTION_ARCHIVE_PROGRESS", id: job.id, operationId,
          current, total: job.count, index, name: job.entries[index].name, bytesCopied, bytesTotal, stage }).catch(() => {});
      }
      try {
        for (let index = 0; index < job.count; index++) {
          check(job);
          const entry = job.entries[index];
          await progress(index, index, true);
          const name = new TextEncoder().encode(entry.name);
          const file = await (await disk.getFileHandle(`${index}.deflate`)).getFile();
          if (file.size !== entry.compressedSize || !uint32(offset + 30 + name.length + file.size)) throw new Error("The archive is incomplete or exceeds the 4 GiB ZIP limit.");
          await output.write(zipHeader(file.size, entry.size, entry.crc, name.length, offset, timestamp, 8));
          await output.write(name);
          const reader = file.stream().getReader();
          const abortRead = () => { reader.cancel().catch(() => {}); };
          job.controller.signal.addEventListener("abort", abortRead, { once: true });
          try {
            for (;;) {
              check(job);
              const { value, done } = await reader.read();
              if (done) break;
              await output.write(value);
              bytesCopied += value.length;
              await progress(index, index);
            }
          } finally {
            job.controller.signal.removeEventListener("abort", abortRead);
            await reader.cancel().catch(() => {}); reader.releaseLock();
          }
          central.push(zipHeader(file.size, entry.size, entry.crc, name.length, offset, timestamp, 8, true), name);
          offset += 30 + name.length + file.size;
          await progress(index, index + 1, true);
        }
        const centralSize = central.reduce((sum, bytes) => sum + bytes.length, 0);
        if (!uint32(offset + centralSize + 22)) throw new Error("The archive exceeds the 4 GiB ZIP limit.");
        for (const bytes of central) { check(job); await output.write(bytes); }
        const end = new Uint8Array(22);
        const view = new DataView(end.buffer);
        view.setUint32(0, 0x06054b50, true);
        view.setUint16(8, job.count, true); view.setUint16(10, job.count, true);
        view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
        await output.write(end);
        await progress(job.count - 1, job.count, true, "finalize");
        check(job);
        await output.close();
      } catch (error) { await output.abort().catch(() => {}); throw error; }
      check(job);
      return deliver(job, operationId);
    }
    async function handle(message, sender) {
      await ready;
      await retention?.wait();
      if (retention?.isClosed()) throw new Error("Export caches were cleared when the last browser window closed.");
      if (!uuid(message.id)) throw new Error("The archive ID is invalid.");
      let job = jobs.get(message.id);
      if (message.type === "COLLECTION_ARCHIVE_DROP" && !job) {
        cancelled.add(message.id);
        return { dropped: true };
      }
      if (message.type === "COLLECTION_ARCHIVE_CREATE") {
        if (cancelled.has(message.id)) throw new Error("The archive was cancelled.");
        if (job) throw new Error("This archive already exists.");
        if (!Number.isSafeInteger(message.count) || message.count < 1 || message.count > 100
          || typeof message.filename !== "string" || !message.filename.endsWith(".zip") || /[/\\\x00]/.test(message.filename)) throw new Error("The archive metadata is invalid.");
        job = { id: message.id, owner: sender.tab.id, count: message.count, filename: message.filename,
          entries: [], expires: Date.now() + ttl, controller: new AbortController(), queue: Promise.resolve() };
        jobs.set(job.id, job);
        try { await folder(job); check(job); await persist(job); check(job); return { created: true }; }
        catch (error) { await cleanup(job); throw error; }
      }
      if (!job || job.owner !== sender.tab.id) throw new Error("The temporary archive expired or belongs to another tab.");
      if (message.type === "COLLECTION_ARCHIVE_DROP") {
        cancelled.add(message.id);
        return { dropped: await cleanup(job) };
      }
      if (job.expires <= Date.now() && !job.downloading && !job.busy) { await cleanup(job); throw new Error("The temporary archive expired."); }
      // Access can renew a live job, but cannot revive already-expired data.
      if (message.type === "COLLECTION_ARCHIVE_GET") {
        job.expires = Date.now() + ttl;
        await persist(job);
        return { entries: job.entries };
      }
      return enqueue(job, async () => {
        if (job.downloading) throw new Error("This archive has already been handed to the browser.");
        if (message.type === "COLLECTION_ARCHIVE_PACKAGE") return packageZip(job, message.operationId);
        const index = message.index;
        if (!Number.isSafeInteger(index) || index < 0 || index >= job.count) throw new Error("The archive chapter index is invalid.");
        if (message.type === "COLLECTION_ARCHIVE_BEGIN") {
          if (!uuid(message.transferId) || typeof message.name !== "string" || /[/\\\x00]/.test(message.name) || new TextEncoder().encode(message.name).length > 65535) throw new Error("The archive chapter name is invalid.");
          await job.writer?.stream.abort().catch(() => {});
          job.entries[index] = null;
          const stream = await (await (await folder(job)).getFileHandle(`${index}.deflate`, { create: true })).createWritable();
          try { check(job); } catch (error) { await stream.abort().catch(() => {}); throw error; }
          job.writer = { index, stream, bytes: 0, name: message.name, transferId: message.transferId };
          return { begun: true };
        }
        const writer = job.writer;
        if (message.type === "COLLECTION_ARCHIVE_ABORT") {
          if (writer?.index === index && writer.transferId === message.transferId) {
            await writer.stream.abort().catch(() => {});
            job.writer = null;
          }
          return { aborted: true };
        }
        if (!writer || writer.index !== index) throw new Error("The archive chapter transfer was interrupted. Retry this chapter.");
        if (writer.transferId !== message.transferId) throw new Error("The archive chapter transfer is stale.");
        if (message.type === "COLLECTION_ARCHIVE_CHUNK") {
          if (typeof message.data !== "string" || !message.data.length || message.data.length > 1024 * 1024) throw new Error("The archive chunk is invalid.");
          const bytes = Uint8Array.from(atob(message.data), char => char.charCodeAt(0));
          if (message.offset !== writer.bytes || !uint32(writer.bytes + bytes.length)) throw new Error("The archive chunk is out of order or too large.");
          const stored = job.entries.reduce((sum, entry) => sum + (entry?.compressedSize || 0), 0);
          if (!uint32(stored + writer.bytes + bytes.length)) throw new Error("The archive exceeds the 4 GiB ZIP limit.");
          await writer.stream.write(bytes);
          writer.bytes += bytes.length;
          return { written: true };
        }
        if (message.type === "COLLECTION_ARCHIVE_END") {
          if (!uint32(message.crc) || !uint32(message.size) || message.compressedSize !== writer.bytes) throw new Error("The archive chapter ended at an unexpected position.");
          await writer.stream.close();
          check(job);
          job.entries[index] = { name: writer.name, crc: message.crc, size: message.size, compressedSize: writer.bytes };
          job.writer = null;
          job.expires = Date.now() + ttl;
          await persist(job);
          check(job);
          return { stored: true, entry: job.entries[index] };
        }
        throw new Error("Unknown archive operation.");
      });
    }
    api.runtime.onMessage.addListener((message, sender, respond) => {
      if (!message?.type?.startsWith("COLLECTION_ARCHIVE_") || ["COLLECTION_ARCHIVE_PROGRESS", "COLLECTION_ARCHIVE_HANDOFF"].includes(message.type)) return;
      if (sender.id !== api.runtime.id || !sender.tab || !/^https:\/\/www\.patreon\.com\//.test(sender.tab.url || "")) { respond({ error: "Archive requests must come from Patreon." }); return; }
      handle(message, sender).then(respond, error => respond({ error: error.message || "Temporary archive storage is unavailable." }));
      return true;
    });
    api.tabs.onRemoved?.addListener(tabId => {
      ready.then(() => Promise.all([...jobs.values()].filter(job => job.owner === tabId).map(job => cleanup(job)))).catch(() => {});
    });
    api.downloads?.onChanged.addListener(delta => {
      if (!["complete", "interrupted"].includes(delta.state?.current)) return;
      ready.then(() => Promise.all([...jobs.values()].filter(job => job.downloadId === delta.id).map(job => cleanup(job, true)))).catch(() => {});
    });
    return Object.freeze({ ready, sweep, clear });
  }
  globalThis.PatreonArchives = Object.freeze({ install });
})();
