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
  let layoutRevision = 0;
  const resize = () => {
    if (!exporting) {
      busy = true;
      for (const control of document.querySelectorAll("#formats input, #download-collection")) control.setAttribute("aria-disabled", "true");
    }
    parent.postMessage({ source: "patreon-reader-collection-size", token,
      height: Math.ceil(main.getBoundingClientRect().height) + 4, revision: ++layoutRevision
    }, "https://www.patreon.com");
  };
  window.addEventListener("message", event => {
    if (event.source !== parent || event.origin !== "https://www.patreon.com"
      || event.data?.source !== "patreon-reader-collection-sized" || event.data.token !== token
      || event.data.height !== Math.ceil(main.getBoundingClientRect().height) + 4
      || event.data.revision !== layoutRevision) return;
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
    for (const control of document.querySelectorAll("#formats input, #download-collection")) {
      control.disabled = !value;
      control.setAttribute("aria-disabled", String(!value));
    }
  }

  const download = document.querySelector("#download-collection");
  const description = document.querySelector("#selection-description");
  const descriptions = {
    epub: { single: "All chapters in one ebook.", zip: "One ebook per chapter, in a ZIP." },
    pdf: { single: "All chapters in one PDF.", zip: "One PDF per chapter, in a ZIP." },
    markdown: { single: "All chapters in one editable file.", zip: "One editable file per chapter, in a ZIP." }
  };
  const selection = () => ({
    format: document.querySelector('input[name="format"]:checked').value,
    packaging: document.querySelector('input[name="packaging"]:checked').value
  });
  document.querySelector("#formats").addEventListener("change", () => {
    // Selection copy can change the anchored panel height. Wait for the parent
    // layout acknowledgement before accepting a click at its new position.
    const { format, packaging } = selection();
    const label = format === "markdown" ? "Markdown" : format.toUpperCase();
    download.textContent = `Download ${label}${packaging === "zip" ? " ZIP" : ""}`;
    description.textContent = descriptions[format][packaging];
    resize();
  });
  download.addEventListener("click", () => {
    if (busy) return;
    const { format, packaging } = selection();
    exporting = true;
    enabled(false);
    parent.postMessage({ source: "patreon-reader-collection-export", token,
      format: format + (packaging === "single" ? "-book" : "") }, "https://www.patreon.com");
  });

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
