(() => {
  const TARGET_SELECTOR = 'div[data-tag="floating-engagement-sheet"]';
  const ROOT_ATTRIBUTE = "data-hide-patreon-floating-engagement";
  const STYLE_ID = "patreon-floating-engagement-toggle-style";

  let isHidden = true;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html[${ROOT_ATTRIBUTE}] ${TARGET_SELECTOR} {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function applyVisibility() {
    installStyle();
    document.documentElement.toggleAttribute(ROOT_ATTRIBUTE, isHidden);
  }

  function state() {
    return {
      isHidden,
      targetFound: Boolean(document.querySelector(TARGET_SELECTOR))
    };
  }

  // Hide by default before waiting for storage, avoiding a flash of the sheet.
  applyVisibility();

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === "GET_STATE") {
      respond(state());
      return;
    }

    if (message.type === "SET_HIDDEN") {
      isHidden = Boolean(message.value);
      chrome.storage.sync.set({ isHidden }).then(() => {
        applyVisibility();
        respond(state());
      });
      return true;
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.isHidden) return;
    isHidden = changes.isHidden.newValue !== false;
    applyVisibility();
  });

  chrome.storage.sync.get("isHidden").then((stored) => {
    isHidden = stored.isHidden !== false;
    applyVisibility();
  });
})();
