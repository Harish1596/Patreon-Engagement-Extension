/* Export data has a separate lifecycle from durable Reader preferences. */
(() => {
  function create({ api = globalThis.browser?.runtime ? browser : chrome, now = () => Date.now() } = {}) {
    const services = [];
    const alarm = "patreon-export-expiry";
    let queue = Promise.resolve();
    let scheduled = false;
    let dirty = false;
    let closed = false;
    function call(target, method, ...args) {
      if (globalThis.browser?.runtime) return target[method](...args);
      return new Promise((resolve, reject) => target[method](...args, value => {
        if (api.runtime.lastError) reject(new Error(api.runtime.lastError.message)); else resolve(value);
      }));
    }
    async function schedule() {
      const deadline = Math.min(...services.map(service => service.deadline()));
      const existing = await api.alarms.get(alarm);
      if (!Number.isFinite(deadline)) {
        if (existing) await api.alarms.clear(alarm);
        return;
      }
      // Delayed alarms and temporarily busy jobs must not cause a tight wake loop.
      const when = Math.max(now() + 30_000, deadline);
      if (!existing || Math.abs(existing.scheduledTime - when) > 1000) await api.alarms.create(alarm, { when });
    }
    function enqueue(action) {
      const pending = queue.then(async () => {
        await Promise.all(services.map(service => service.ready));
        await action();
      });
      queue = pending.catch(() => {}).finally(changed);
      return pending;
    }
    function changed() {
      dirty = true;
      if (scheduled) return;
      scheduled = true;
      (async () => {
        try {
          do { dirty = false; await queue; await schedule(); } while (dirty);
        } finally { scheduled = false; }
      })().catch(() => {});
    }
    const sweep = () => enqueue(() => Promise.all(services.map(service => service.sweep())));
    api.alarms.onAlarm.addListener(event => { if (event.name === alarm) sweep().catch(() => {}); });
    api.runtime.onStartup.addListener(() => {
      enqueue(() => Promise.all(services.map(service => service.clear()))).catch(() => {});
    });
    api.windows.onRemoved.addListener(() => {
      enqueue(async () => {
        const windows = await call(api.windows, "getAll", { windowTypes: ["normal", "popup"] });
        if (windows.length) return;
        closed = true;
        await Promise.all(services.map(service => service.clear()));
      }).catch(() => {});
    });
    api.windows.onCreated.addListener(() => { enqueue(async () => { closed = false; }).catch(() => {}); });
    return Object.freeze({
      register(service) { services.push(service); Promise.resolve(service.ready).then(changed).catch(() => {}); changed(); },
      changed,
      wait: () => queue,
      isClosed: () => closed
    });
  }
  globalThis.PatreonExportRetention = Object.freeze({ create });
})();
