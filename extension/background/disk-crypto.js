/* Disk payloads use a browser-session key; no key is written to local storage. */
(() => {
  function create({ api = globalThis.browser?.runtime ? browser : chrome, crypto = globalThis.crypto } = {}) {
    const name = "export-disk-key-v1";
    let pending;
    function call(method, ...args) {
      if (globalThis.browser?.runtime) return api.storage.session[method](...args);
      return new Promise((resolve, reject) => api.storage.session[method](...args, result => {
        if (api.runtime.lastError) reject(new Error(api.runtime.lastError.message)); else resolve(result);
      }));
    }
    function key() {
      if (!pending) pending = (async () => {
        const stored = (await call("get", name))[name];
        let raw;
        if (Array.isArray(stored) && stored.length === 32 && stored.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) raw = new Uint8Array(stored);
        else {
          raw = crypto.getRandomValues(new Uint8Array(32));
          await call("set", { [name]: [...raw] });
        }
        return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
      })().catch(error => { pending = null; throw error; });
      return pending;
    }
    const aad = context => new TextEncoder().encode(context);
    return Object.freeze({
      async seal(bytes, context) {
        const secret = await key();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(context) }, secret, bytes));
        const result = new Uint8Array(12 + ciphertext.length);
        result.set(iv); result.set(ciphertext, 12);
        return result;
      },
      async open(bytes, context) {
        if (bytes.length < 28) throw new Error("The encrypted export data is incomplete.");
        return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12), additionalData: aad(context) }, await key(), bytes.subarray(12)));
      }
    });
  }
  globalThis.PatreonExportCrypto = Object.freeze({ create });
})();
