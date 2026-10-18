(() => {
  const HIDDEN_ATTRIBUTE = "data-patreon-floater-hidden-by-extension";
  const STYLE_ID = "patreon-floater-toggle-style";
  const STORAGE_KEYS = ["target", "isHidden"];

  let target = null;
  let isHidden = true;
  let picking = false;
  let highlighted = null;
  let oldOutline = "";
  let applyQueued = false;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `[${HIDDEN_ATTRIBUTE}] { display: none !important; }`;
    (document.head || document.documentElement).appendChild(style);
  }

  function escapeCss(value) {
    return CSS.escape(String(value));
  }

  function isStable(value) {
    if (!value || value.length > 100) return false;
    return !/\b(css|sc|jsx|emotion)-?[a-z0-9]{5,}\b/i.test(value) &&
      !/[a-f0-9]{12,}/i.test(value);
  }

  function attributeSelector(element) {
    const candidates = ["data-testid", "data-tag", "aria-label", "id"];
    for (const name of candidates) {
      const value = element.getAttribute(name);
      if (!isStable(value)) continue;
      const selector = name === "id"
        ? `#${escapeCss(value)}`
        : `${element.localName}[${name}="${escapeCss(value)}"]`;
      try {
        if (document.querySelectorAll(selector).length === 1) return selector;
      } catch (_) {
        // Try the next attribute.
      }
    }
    return null;
  }

  function selectorFor(element) {
    const direct = attributeSelector(element);
    if (direct) return direct;

    const parts = [];
    let node = element;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body) {
      const anchored = attributeSelector(node);
      if (anchored) {
        parts.unshift(anchored);
        break;
      }

      let part = node.localName;
      const siblings = node.parentElement
        ? [...node.parentElement.children].filter((child) => child.localName === node.localName)
        : [];
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function floatingContainerFrom(element) {
    let node = element;
    let fallback = element;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const nearBottom = rect.bottom >= window.innerHeight - 120;
      if ((style.position === "fixed" || style.position === "sticky") && nearBottom) {
        fallback = node;
      }
      node = node.parentElement;
    }
    return fallback;
  }

  function resolveTarget() {
    if (!target?.selector) return [];
    try {
      return [...document.querySelectorAll(target.selector)];
    } catch (_) {
      return [];
    }
  }

  function applyVisibility() {
    applyQueued = false;
    if (picking) return;
    installStyle();

    document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`).forEach((element) => {
      element.removeAttribute(HIDDEN_ATTRIBUTE);
    });

    const matches = resolveTarget();
    if (isHidden) {
      matches.forEach((element) => element.setAttribute(HIDDEN_ATTRIBUTE, ""));
    }
    return matches.length;
  }

  function scheduleApply() {
    if (applyQueued) return;
    applyQueued = true;
    requestAnimationFrame(applyVisibility);
  }

  function clearHighlight() {
    if (!highlighted) return;
    highlighted.style.outline = oldOutline;
    highlighted = null;
    oldOutline = "";
  }

  function stopPicking(restoreVisibility = true) {
    picking = false;
    clearHighlight();
    document.removeEventListener("mousemove", onPointerMove, true);
    document.removeEventListener("click", onPick, true);
    document.removeEventListener("keydown", onPickerKey, true);
    document.documentElement.style.cursor = "";
    document.getElementById("patreon-floater-picker-tip")?.remove();
    if (restoreVisibility) applyVisibility();
  }

  function onPointerMove(event) {
    const candidate = floatingContainerFrom(event.target);
    if (candidate === highlighted) return;
    clearHighlight();
    highlighted = candidate;
    oldOutline = candidate.style.outline;
    candidate.style.outline = "3px solid #f96854";
  }

  async function onPick(event) {
    if (!highlighted) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const selected = highlighted;
    const newTarget = { selector: selectorFor(selected) };
    stopPicking(false);
    target = newTarget;
    isHidden = true;
    await chrome.storage.sync.set({ target, isHidden });
    applyVisibility();
  }

  function onPickerKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      stopPicking();
    }
  }

  function startPicking() {
    stopPicking(false);
    picking = true;
    document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`).forEach((element) => {
      element.removeAttribute(HIDDEN_ATTRIBUTE);
    });

    const tip = document.createElement("div");
    tip.id = "patreon-floater-picker-tip";
    tip.textContent = "Click the floating element to hide it · Esc to cancel";
    Object.assign(tip.style, {
      position: "fixed",
      zIndex: "2147483647",
      top: "12px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "9px 14px",
      borderRadius: "8px",
      color: "white",
      background: "#111",
      font: "600 13px system-ui, sans-serif",
      boxShadow: "0 3px 12px rgb(0 0 0 / 30%)",
      pointerEvents: "none"
    });
    document.documentElement.appendChild(tip);
    document.documentElement.style.cursor = "crosshair";
    document.addEventListener("mousemove", onPointerMove, true);
    document.addEventListener("click", onPick, true);
    document.addEventListener("keydown", onPickerKey, true);
  }

  function state() {
    return {
      hasTarget: Boolean(target?.selector),
      isHidden,
      targetFound: resolveTarget().length > 0
    };
  }

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

    if (message.type === "START_PICKING") {
      startPicking();
      respond({ ok: true });
      return;
    }

    if (message.type === "FORGET_TARGET") {
      target = null;
      chrome.storage.sync.remove("target").then(() => {
        applyVisibility();
        respond(state());
      });
      return true;
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.target) target = changes.target.newValue || null;
    if (changes.isHidden) isHidden = changes.isHidden.newValue !== false;
    scheduleApply();
  });

  chrome.storage.sync.get(STORAGE_KEYS).then((stored) => {
    target = stored.target || null;
    isHidden = stored.isHidden !== false;
    installStyle();
    applyVisibility();

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
})();
