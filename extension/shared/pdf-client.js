/* Content-side transport; rendering lives entirely in the extension. */
(() => {
  async function render(chapters, book, signal) {
    const { api, call } = PatreonExtension;
    signal?.throwIfAborted();
    PatreonPdf.size({ chapters, book });
    const id = crypto.randomUUID();
    let abort;
    try {
      const pending = call(api.runtime, 'sendMessage', { type: 'PDF_RENDER', id, chapters, book });
      const stopped = new Promise((resolve, reject) => {
        abort = () => {
          call(api.runtime, 'sendMessage', { type: 'PDF_CANCEL', id }).catch(() => {});
          reject(new DOMException('PDF export cancelled.', 'AbortError'));
        };
        signal?.addEventListener('abort', abort, { once: true });
      });
      const result = await Promise.race([pending, stopped]);
      signal?.throwIfAborted();
      if (result?.error || typeof result?.data !== 'string') throw new Error(result?.error || 'The PDF renderer did not respond.');
      if (result.data.length > Math.ceil(PatreonPdf.MAX_OUTPUT / 3) * 4) throw new Error('The generated PDF exceeds its size limit.');
      return Uint8Array.from(atob(result.data), c => c.charCodeAt(0));
    } finally { signal?.removeEventListener('abort', abort); }
  }
  globalThis.PatreonPdfClient = Object.freeze({ render });
})();
