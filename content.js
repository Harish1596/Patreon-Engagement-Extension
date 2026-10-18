(() => {
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
  let lastPathname = window.location.pathname;

  function isPostPage() {
    const match = POST_PATH.exec(window.location.pathname);
    return Boolean(match && !RESERVED_ROOT_PATHS.has(match[1].toLowerCase()));
  }

  function applyVisibility() {
    document.documentElement.toggleAttribute(
      ROOT_ATTRIBUTE,
      isHidden && isPostPage()
    );
  }

  function state() {
    return {
      isHidden,
      isPostPage: isPostPage()
    };
  }

  function checkForRouteChange() {
    if (window.location.pathname === lastPathname) return;
    lastPathname = window.location.pathname;
    applyVisibility();
  }

  // Apply the secure default before waiting for the saved preference.
  applyVisibility();

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !message || typeof message !== "object") {
      return;
    }

    if (message.type === "GET_STATE") {
      respond(state());
      return;
    }

    if (message.type === "SET_HIDDEN" && typeof message.value === "boolean") {
      isHidden = message.value;
      chrome.storage.local
        .set({ isHidden })
        .then(() => {
          applyVisibility();
          respond(state());
        })
        .catch(() => respond({ error: "Unable to save the preference." }));
      return true;
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.isHidden) return;
    isHidden = changes.isHidden.newValue !== false;
    applyVisibility();
  });

  chrome.storage.local.get("isHidden").then((stored) => {
    isHidden = stored.isHidden !== false;
    applyVisibility();
  });

  window.addEventListener("popstate", checkForRouteChange);
  globalThis.navigation?.addEventListener("navigatesuccess", checkForRouteChange);

  // Patreon can update its URL without a page load. This observer only compares
  // the pathname; it does not inspect, store, or transmit page content.
  const routeObserver = new MutationObserver(checkForRouteChange);
  routeObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
