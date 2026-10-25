(() => {
  const { api, call, normalize } = globalThis.PatreonExtension;
  const ROOT_ATTRIBUTE = "data-hide-patreon-floating-engagement";
  const POST_PATH = /^\/([^/]+)\/posts\/(?:[^/]+-)?\d+\/?$/;
  const RESERVED_ROOT_PATHS = new Set([
    "about",
    "apps",
    "create-on-patreon",
    "explore",
    "home",
    "join",
    "login",
    "logout",
    "messages",
    "notifications",
    "policy",
    "posts",
    "search",
    "settings"
  ]);

  let isHidden = true;
  let readerEnabled = false;
  let readerPreferences = normalize(null);
  let scheduled = false;

  const saveReader = (value) => call(api.storage.local, "set", { readerPreferences: value });
  function refreshReader() {
    globalThis.PatreonReader.configure(readerEnabled, readerPreferences, saveReader);
    globalThis.PatreonReader.reconcile(isPostPage());
  }

  function isPostPage() {
    const match = POST_PATH.exec(window.location.pathname);
    return Boolean(match && !RESERVED_ROOT_PATHS.has(match[1].toLowerCase()));
  }

  function applyVisibility() {
    const root = document.documentElement;
    const shouldHide = isHidden && isPostPage();
    // Avoid redundant attribute writes and observer feedback loops.
    if (root.hasAttribute(ROOT_ATTRIBUTE) !== shouldHide) {
      root.toggleAttribute(ROOT_ATTRIBUTE, shouldHide);
    }
  }

  function state() {
    return {
      isHidden,
      readerEnabled,
      readerMounted: Boolean(document.querySelector("[data-patreon-reader-button]")),
      isPostPage: isPostPage()
    };
  }

  function checkForRouteChange() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      // Same-URL hydration/rerenders can remove extension-owned page state.
      applyVisibility();
      globalThis.PatreonReader.reconcile(isPostPage());
    });
  }

  // Apply the secure default before waiting for the saved preference.
  applyVisibility();

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== api.runtime.id || !message || typeof message !== "object") {
      return;
    }

    if (message.type === "GET_STATE") {
      respond(state());
      return;
    }

    if (message.type === "SET_HIDDEN" && typeof message.value === "boolean") {
      const requestedValue = message.value;
      call(api.storage.local, "set", { isHidden: requestedValue })
        .then(() => {
          isHidden = requestedValue;
          applyVisibility();
          respond(state());
        })
        .catch(() => respond({ error: "Unable to save the preference." }));
      return true;
    }
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.isHidden) {
      isHidden = changes.isHidden.newValue !== false;
      applyVisibility();
    }
    if (changes.readerEnabled || changes.readerPreferences) {
      if (changes.readerEnabled) readerEnabled = changes.readerEnabled.newValue === true;
      if (changes.readerPreferences) readerPreferences = normalize(changes.readerPreferences.newValue);
      refreshReader();
    }
  });

  call(api.storage.local, "get", ["isHidden", "readerEnabled", "readerPreferences"]).then((stored) => {
    isHidden = stored.isHidden !== false;
    readerEnabled = stored.readerEnabled === true;
    readerPreferences = normalize(stored.readerPreferences);
    applyVisibility();
    refreshReader();
  }).catch(() => {
    // Keep the existing safe visibility default and leave Reader disabled.
    applyVisibility();
  });

  window.addEventListener("popstate", checkForRouteChange);
  window.addEventListener("resize", checkForRouteChange);
  globalThis.navigation?.addEventListener("navigatesuccess", checkForRouteChange);

  // Batch DOM changes to restore Reader after Patreon rerenders. No post text
  // is read, stored, or transmitted. Shadow DOM control changes are isolated.
  const routeObserver = new MutationObserver(checkForRouteChange);
  routeObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Restore only our visibility flag if the page strips it during loading.
  // This also runs in background tabs without waiting for an animation frame.
  const visibilityObserver = new MutationObserver(applyVisibility);
  visibilityObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [ROOT_ATTRIBUTE]
  });
})();
