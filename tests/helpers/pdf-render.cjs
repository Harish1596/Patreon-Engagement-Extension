/* Execute the packaged renderer in a disposable Node Web Worker transport. */
const path = require('node:path');
const { Worker } = require('node:worker_threads');
async function render(chapters, book, signal) {
  signal?.throwIfAborted();
  const worker = new Worker(path.resolve(__dirname, 'pdf-node-worker.cjs'));
  let abort, timeout;
  try {
    return await new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Renderer timed out')), 20_000);
      abort = () => reject(new DOMException('PDF cancelled', 'AbortError'));
      signal?.addEventListener('abort', abort, { once: true });
      worker.on('error', reject);
      worker.on('message', result => result.error ? reject(Object.assign(new Error(result.error), { pdfFailures: result.pdfFailures })) : resolve(result.bytes));
      worker.postMessage({ chapters, book });
    });
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); await worker.terminate(); }
}
module.exports = { render };
