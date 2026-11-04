(() => {
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const token = location.hash.slice(1);
  let origins = [];
  let busy = true;
  let loaded = false;
  let sized = false;
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
    sized = true;
    if (loaded && !exporting) enabled(true);
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

  function reportError(error) {
    // The worker may no longer recognize this token, so report directly to the
    // owning panel rather than sending another request through that session.
    parent.postMessage({ source: "patreon-reader-collection-error", token,
      error: error.message || "Unable to start the collection export. Close and reopen Download Collection."
    }, "https://www.patreon.com");
  }

  for (const button of document.querySelectorAll("[data-format]")) {
    button.addEventListener("click", () => {
      if (busy) return;
      exporting = true;
      enabled(false);
      const request = origins.length ? call(api.permissions, "request", { origins }) : Promise.resolve(true);
      request.then(granted => {
        if (!granted) throw new Error("Media access was not granted, so the collection export cannot be created.");
        return call(api.runtime, "sendMessage", {
          type: "DELIVER_COLLECTION_EXPORT", token, format: button.dataset.format
        });
      }).then(result => {
        if (!result?.started) throw new Error(result?.error || "The collection exporter did not start.");
      }).catch(error => {
        reportError(error);
        exporting = false;
        enabled(loaded && sized);
      });
    });
  }

  call(api.runtime, "sendMessage", { type: "GET_COLLECTION_EXPORT_REQUEST", token }).then(result => {
    if (!result?.origins) throw new Error(result?.error || "The collection export request expired.");
    origins = result.origins;
    loaded = true;
    if (sized) enabled(true);
  }).catch(error => { reportError(error); enabled(false); });
})();
