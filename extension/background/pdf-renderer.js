/* Validated content requests -> extension-owned offscreen PDF workers. */
(() => {
  function install({ api = globalThis.browser?.runtime ? browser : chrome, offscreen = globalThis.PatreonOffscreenService } = {}) {
    const { call } = offscreen;
    const active = new Map(); const cancelled = new Map();
    const uuid = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
    async function render(chapters, book, signal, id = crypto.randomUUID()) {
      await globalThis.PatreonArchiveService?.ready;
      signal?.throwIfAborted();
      PatreonPdf.size({ chapters, book });
      if (!Array.isArray(chapters) || !chapters.length || chapters.length > 100) throw new Error('The PDF chapter count is invalid.');
      const validated = chapters.map(PatreonPdf.chapter);
      const lease = `pdf:${id}`;
      let abort;
      try {
        await offscreen.acquire(lease);
        signal?.throwIfAborted();
        const pending = call(api.runtime, 'sendMessage', { type: 'PDF_HOST_RENDER', id, chapters: validated, book });
        const stopped = new Promise((resolve, reject) => {
          abort = () => {
            call(api.runtime, 'sendMessage', { type: 'PDF_HOST_CANCEL', id }).catch(() => {});
            reject(new DOMException('PDF export cancelled.', 'AbortError'));
          };
          signal?.addEventListener('abort', abort, { once: true });
          if (signal?.aborted) abort();
        });
        const result = await Promise.race([pending, stopped]);
        signal?.throwIfAborted();
        if (result?.error) throw Object.assign(new Error(result.error), { pdfFailures: PatreonPdf.failureDetails(result.pdfFailures, validated.length) });
        if (typeof result?.data !== 'string' || result.data.length > Math.ceil(PatreonPdf.MAX_OUTPUT / 3) * 4) throw new Error('The PDF renderer returned an invalid file.');
        const bytes = Uint8Array.from(atob(result.data), c => c.charCodeAt(0));
        if (bytes.length > PatreonPdf.MAX_OUTPUT || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('The PDF renderer returned an invalid file.');
        return bytes;
      } finally {
        signal?.removeEventListener('abort', abort);
        await offscreen.release(lease);
      }
    }
    api.runtime.onMessage.addListener((message, sender, respond) => {
      if (!['PDF_RENDER', 'PDF_CANCEL'].includes(message?.type)) return;
      if (sender.id !== api.runtime.id || !Number.isSafeInteger(sender.tab?.id)
        || !/^https:\/\/www\.patreon\.com\//.test(sender.tab?.url || '') || !uuid(message.id)) {
        respond({ error: 'PDF requests must come from a Patreon tab with a valid request ID.' }); return;
      }
      const owner = sender.tab.id;
      if (message.type === 'PDF_CANCEL') {
        const job = active.get(message.id);
        if (job && job.owner !== owner) { respond({ error: 'This PDF belongs to another tab.' }); return; }
        job?.controller.abort();
        for (const [key, item] of cancelled) if (item.expires <= Date.now()) cancelled.delete(key);
        if (cancelled.size < 1000) cancelled.set(message.id, { owner, expires: Date.now() + 120_000 });
        respond({ cancelled: true }); return;
      }
      if (active.has(message.id) || active.size >= 2 || cancelled.has(message.id)) { respond({ error: 'The PDF request is busy, stale or cancelled. Retry the export.' }); return; }
      const job = { owner, controller: new AbortController() }; active.set(message.id, job);
      const timer = setTimeout(() => job.controller.abort(), 125_000);
      render(message.chapters, message.book, job.controller.signal, message.id).then(bytes => {
        job.controller.signal.throwIfAborted();
        let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        respond({ data: btoa(binary) });
      }).catch(error => {
        const pdfFailures = PatreonPdf.failureDetails(error.pdfFailures, message.chapters?.length);
        respond({ error: error.message || 'The PDF could not be generated.', ...(pdfFailures.length ? { pdfFailures } : {}) });
      })
        .finally(() => { clearTimeout(timer); active.delete(message.id); });
      return true;
    });
    api.tabs.onRemoved?.addListener(owner => { for (const job of active.values()) if (job.owner === owner) job.controller.abort(); });
    return Object.freeze({ render });
  }
  globalThis.PatreonPdfRenderer = Object.freeze({ install });
})();
