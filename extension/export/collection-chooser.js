(() => {
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const token = location.hash.slice(1);
  let origins = [];
  let busy = true;
  let permissionRequest = null;
  let exporting = false;
  // The content panel and this permission-owning extension frame have separate
  // layouts. Measure actual content so font scaling cannot clip the choices.
  const main = document.querySelector("main");
  const resize = () => parent.postMessage({ source: "patreon-reader-collection-size", token,
    height: Math.ceil(main.getBoundingClientRect().height) + 4
  }, "https://www.patreon.com");
  window.addEventListener("message", event => {
    if (event.source !== parent || event.origin !== "https://www.patreon.com"
      || event.data?.source !== "patreon-reader-collection-sized" || event.data.token !== token
      || event.data.height !== Math.ceil(main.getBoundingClientRect().height) + 4) return;
    if (!exporting) enabled(true);
  });
  new ResizeObserver(resize).observe(main);
  window.addEventListener("load", resize);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      parent.postMessage({ source: "patreon-reader-collection-close", token }, "https://www.patreon.com");
    }
  });

  function call(target, method, ...args) {
    if (globalThis.browser?.runtime) return target[method](...args);
    return new Promise((resolve, reject) => {
      target[method](...args, result => {
        const error = api.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(result);
      });
    });
  }

  function enabled(value) {
    busy = !value;
    for (const button of document.querySelectorAll("[data-format]")) button.disabled = !value;
  }

  for (const button of document.querySelectorAll("[data-format]")) {
    button.addEventListener("click", () => {
      if (busy) return;
      exporting = true;
      enabled(false);
      parent.postMessage({ source: "patreon-reader-collection-export", token,
        format: button.dataset.format }, "https://www.patreon.com");
    });
  }

  // Fetch image hosts only after the running download encounters them. Never
  // query the collection session simply to display format choices.
  window.addEventListener("message", event => {
    if (event.source !== parent || event.origin !== "https://www.patreon.com" || event.data?.token !== token
      || event.data.source !== "patreon-reader-collection-permission" || typeof event.data.requestId !== "string") return;
    if (permissionRequest === event.data.requestId) return;
    permissionRequest = event.data.requestId;
    const requestId = permissionRequest;
    call(api.runtime, "sendMessage", { type: "GET_COLLECTION_EXPORT_REQUEST", token }).then(result => {
      if (permissionRequest !== requestId) return;
      if (!Array.isArray(result?.origins)) throw new Error("Image permission request expired. Retry the download.");
      origins = result.origins;
      document.querySelector("#formats").hidden = true;
      document.querySelector("#image-permission").hidden = false;
      document.querySelector("#image-hosts").textContent = origins.map(origin => new URL(origin).host).join(", ");
      document.querySelector("#allow-images").disabled = false;
      resize();
    }).catch(() => {
      parent.postMessage({ source: "patreon-reader-collection-permission-result", token, requestId,
        granted: false }, "https://www.patreon.com");
    });
  });
  document.querySelector("#allow-images").addEventListener("click", () => {
    if (!permissionRequest) return;
    const requestId = permissionRequest;
    document.querySelector("#allow-images").disabled = true;
    // Must be called directly from this extension-frame user gesture.
    call(api.permissions, "request", { origins }).then(granted => {
      parent.postMessage({ source: "patreon-reader-collection-permission-result", token, requestId,
        granted: granted === true }, "https://www.patreon.com");
    }).catch(() => {
      parent.postMessage({ source: "patreon-reader-collection-permission-result", token, requestId,
        granted: false }, "https://www.patreon.com");
    }).finally(() => { if (permissionRequest === requestId) permissionRequest = null; });
  });
})();
