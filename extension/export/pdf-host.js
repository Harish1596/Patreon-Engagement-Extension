/* Disposable PDF workers keep pagination and encoding off the document thread. */
(() => {
  const active = new Set();
  function render(chapters, book, signal, workerUrl = 'pdf-worker.js') {
    signal?.throwIfAborted();
    PatreonPdf.size({ chapters, book });
    if (active.size >= 2) return Promise.reject(new Error('Two PDF exports are already rendering. Retry when one finishes.'));
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerUrl);
      active.add(worker);
      let settled = false;
      function finish(error, bytes) {
        if (settled) return; settled = true;
        clearTimeout(timer); signal?.removeEventListener('abort', abort);
        worker.terminate(); active.delete(worker);
        if (error) reject(error); else resolve(bytes);
      }
      const abort = () => finish(new DOMException('PDF export cancelled.', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('PDF generation exceeded two minutes. Export fewer posts or use individual files.')), 120_000);
      signal?.addEventListener('abort', abort, { once: true });
      worker.onerror = () => finish(new Error('The packaged PDF renderer could not start.'));
      worker.onmessage = event => {
        if (event.data?.error) finish(new Error(event.data.error));
        else if (!(event.data?.bytes instanceof Uint8Array) || event.data.bytes.length > PatreonPdf.MAX_OUTPUT) finish(new Error('The PDF renderer returned an invalid file.'));
        else finish(null, event.data.bytes);
      };
      worker.postMessage({ chapters, book });
    });
  }
  globalThis.PatreonPdfHost = Object.freeze({ render });
})();
