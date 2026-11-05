/* Shared leases prevent a finished archive from closing an active PDF renderer. */
(() => {
  function create(api = globalThis.browser?.runtime ? browser : chrome) {
    const leases = new Set(); let queue = Promise.resolve();
    function call(target, method, ...args) {
      if (globalThis.browser?.runtime) return target[method](...args);
      return new Promise((resolve, reject) => target[method](...args, result => {
        const error = api.runtime.lastError; error ? reject(new Error(error.message)) : resolve(result);
      }));
    }
    function serialize(action) { const task = queue.then(action); queue = task.catch(() => {}); return task; }
    async function acquire(id) {
      return serialize(async () => {
        leases.add(id);
        try {
          if (!await api.offscreen.hasDocument()) await api.offscreen.createDocument({ url: 'export/archive-download.html',
            reasons: ['BLOBS', 'WORKERS'], justification: 'Generate local PDF files and save disk-backed exports.' });
        } catch (error) { leases.delete(id); throw error; }
      });
    }
    async function release(id) {
      return serialize(async () => {
        leases.delete(id);
        if (!leases.size && await api.offscreen.hasDocument()) await api.offscreen.closeDocument();
      });
    }
    return Object.freeze({ acquire, release, call });
  }
  globalThis.PatreonOffscreen = Object.freeze({ create });
})();
