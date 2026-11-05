(() => {
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const token = location.hash.slice(1);
  let origins = [];
  let busy = true;

  function call(target, method, ...args) {
    if (globalThis.browser?.runtime) return target[method](...args);
    return new Promise((resolve, reject) => {
      target[method](...args, (result) => {
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
      enabled(false);
      const request = origins.length ? call(api.permissions, "request", { origins }) : Promise.resolve(true);
      request.then((granted) => {
        if (!granted) throw new Error("Media access was not granted, so an offline export cannot be created.");
        return call(api.runtime, "sendMessage", {
          type: "DELIVER_POST_EXPORT", token, format: button.dataset.format
        }).then((result) => {
          if (!result?.started) throw new Error(result?.error || "The post exporter did not start.");
        });
      }).catch((error) => {
        const message = error.message || "Unable to request media access.";
        call(api.runtime, "sendMessage", { type: "DELIVER_POST_EXPORT", token, error: message }).catch(() => {});
        enabled(true);
      });
    });
  }

  call(api.runtime, "sendMessage", { type: "GET_POST_EXPORT_REQUEST", token }).then((result) => {
    if (!result?.origins) throw new Error(result?.error || "The export request expired. Reopen Download.");
    origins = result.origins;
    enabled(true);
  }).catch((error) => {
    const message = error.message || "Unable to prepare media access.";
    call(api.runtime, "sendMessage", { type: "DELIVER_POST_EXPORT", token, error: message }).catch(() => {});
  });
})();
