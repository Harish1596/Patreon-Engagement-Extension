/* Bounded retries for idempotent export reads, never for save/package mutations. */
(() => {
  const statuses = new Set([408, 429, 500, 502, 503, 504]);
  function httpError(response, label) {
    const error = new Error(`${label} (${response.status}).`);
    error.retryable = statuses.has(response.status);
    error.accessDenied = response.status === 401 || response.status === 403;
    const header = response.headers?.get("retry-after");
    if (header) {
      const delay = /^\d+$/.test(header.trim()) ? Number(header) * 1000 : Date.parse(header) - Date.now();
      if (!Number.isNaN(delay)) error.retryAfterMs = Math.max(0, delay);
    }
    return error;
  }
  function networkError(error) {
    if (error?.name === "TypeError") error.retryable = true;
    return error;
  }
  function wait(milliseconds, signal) {
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(signal.reason); };
      const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, milliseconds);
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
  async function run(operation, { signal, onRetry, attempts = 3, timeoutMs = 30_000,
    sleep = wait, random = Math.random } = {}) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      signal?.throwIfAborted();
      const controller = new AbortController();
      const abort = () => controller.abort(signal.reason);
      signal?.addEventListener("abort", abort, { once: true });
      let timedOut = false, failure;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error("The network request timed out."));
      }, timeoutMs);
      try {
        const value = await operation({ signal: controller.signal, attempt });
        signal?.throwIfAborted(); controller.signal.throwIfAborted();
        return value;
      } catch (error) {
        signal?.throwIfAborted();
        failure = timedOut ? Object.assign(new Error("The network request timed out."), { retryable: true }) : error;
      } finally {
        clearTimeout(timer); signal?.removeEventListener("abort", abort);
        controller.abort();
      }
      const delayMs = Math.max(1000 * 2 ** (attempt - 1) + Math.floor(random() * 250), failure?.retryAfterMs || 0);
      // Never retry earlier than the server asks; long waits remain a manual retry.
      if (!failure?.retryable) throw failure;
      if (delayMs > 60_000) {
        failure.message += " The server requests a longer wait; retry manually later.";
        throw failure;
      }
      if (attempt === attempts) {
        failure.message += ` Automatic retries exhausted after ${attempts} attempts.`;
        throw failure;
      }
      await onRetry?.({ attempt: attempt + 1, attempts, delayMs });
      signal?.throwIfAborted();
      await sleep(delayMs, signal);
    }
  }
  globalThis.PatreonRetry = Object.freeze({ run, httpError, networkError, wait });
})();
