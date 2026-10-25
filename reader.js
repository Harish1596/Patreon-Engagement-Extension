(() => {
  const { fonts, defaults, normalize } = globalThis.PatreonExtension;
  const TITLE = '[data-tag="post-title"]';
  const BODY = '[class*="PostBodies-module__"][class*="__postContent"] [class*="RichText-module__"][class*="additionalStylesPostContentWrapper"]';
  const CARD = '[data-tag="post-card"]';
  const EXCLUDE = '[data-tag="floating-engagement-sheet"], [data-tag="comment"], [data-tag="comments"], [data-tag="comment-row"], [data-tag="comment-actions"], [data-tag="content-card-comment-thread-container"]';
  const PROPERTIES = ["font", "text-size", "title-size", "text-color", "background-color", "paragraph-spacing", "line-spacing"];
  let enabled = false;
  let preferences = { ...defaults };
  let savePreference;
  let trigger;
  let anchor;
  let host;
  let shadow;
  let panel;
  let open = false;
  let targets = [];
  let route = "";
  let revision = 0;
  let saveQueue = Promise.resolve();
  let pendingWrites = 0;

  function element(tag, attributes = {}, text) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clearTargets() {
    for (const target of targets) {
      target.removeAttribute("data-patreon-reader-title");
      target.removeAttribute("data-patreon-reader-body");
    }
    targets = [];
    for (const property of PROPERTIES) {
      document.documentElement.removeAttribute(`data-patreon-reader-${property}`);
      document.documentElement.style.removeProperty(`--patreon-reader-${property}`);
    }
  }

  function applyStyles() {
    const px = (value) => value === null ? null : `${value}px`;
    const values = {
      font: fonts[preferences.font].value,
      "text-size": px(preferences.textSize),
      "title-size": preferences.textSize === null ? null : px(preferences.textSize * 1.5),
      "text-color": preferences.textColor,
      "background-color": preferences.backgroundColor,
      "paragraph-spacing": px(preferences.paragraphSpacing),
      "line-spacing": preferences.lineSpacing === null ? null : String(preferences.lineSpacing)
    };
    // Packaged CSS uses only these validated values. Site defaults have no rule
    // enabled, so reset never guesses at the creator's original formatting.
    for (const [property, value] of Object.entries(values)) {
      const attribute = `data-patreon-reader-${property}`;
      const variable = `--patreon-reader-${property}`;
      document.documentElement.toggleAttribute(attribute, value !== null);
      if (value === null) document.documentElement.style.removeProperty(variable);
      else document.documentElement.style.setProperty(variable, value);
    }
  }

  function position() {
    if (!open || !trigger?.isConnected) return;
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const offsetX = viewport?.offsetLeft ?? 0;
    const offsetY = viewport?.offsetTop ?? 0;
    panel.style.maxHeight = `${Math.max(80, height - 24)}px`;
    if (width <= 480) {
      panel.style.width = `${Math.max(0, width - 24)}px`;
      panel.style.left = `${offsetX + 12}px`;
      panel.style.top = `${offsetY + Math.max(12, height - panel.offsetHeight - 12)}px`;
    } else {
      panel.style.width = "332px";
      panel.style.left = `${offsetX + Math.max(12, Math.min(rect.left - offsetX, width - 344))}px`;
      const below = rect.bottom + 8;
      panel.style.top = `${Math.max(offsetY + 12, Math.min(below, offsetY + height - panel.offsetHeight - 12))}px`;
    }
  }

  function closePanel(restoreFocus = false) {
    if (!open) return;
    open = false;
    panel.hidden = true;
    trigger?.setAttribute("aria-expanded", "false");
    if (restoreFocus && trigger?.isConnected) trigger.focus();
  }

  function outside(event) {
    if (open && !event.composedPath().includes(host) && !event.composedPath().includes(trigger)) closePanel();
  }

  function keyboard(event) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePanel(true);
    }
    if (event.key === "Tab") {
      const nodes = [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
      const first = nodes[0];
      const last = nodes.at(-1);
      const focused = shadow.activeElement;
      if (event.shiftKey && (focused === first || !focused)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (focused === last || !focused)) {
        event.preventDefault(); first?.focus();
      }
    }
  }

  function report(message) {
    if (shadow) shadow.querySelector("#save-status").textContent = message;
  }

  function update(key, value) {
    preferences = normalize({ ...preferences, [key]: value });
    applyStyles();
    renderControls();
    persist();
  }

  function persist() {
    const snapshot = { ...preferences };
    const currentRevision = ++revision;
    pendingWrites++;
    report("Saving…");
    // Serialize writes so rapid slider changes cannot finish out of order.
    saveQueue = saveQueue.catch(() => {}).then(() => savePreference(snapshot)).then(() => {
      if (revision === currentRevision) report("Saved on this device");
    }).catch(() => {
      if (revision === currentRevision) report("Could not save. Changes are previewed; adjust a control to retry.");
    }).finally(() => { pendingWrites--; });
  }

  function renderControls() {
    if (!shadow) return;
    for (const key of ["textSize", "paragraphSpacing", "lineSpacing"]) {
      const input = shadow.querySelector(`#${key}`);
      const value = preferences[key];
      input.value = value ?? ({ textSize: 18, paragraphSpacing: 16, lineSpacing: 1.6 })[key];
      const display = value === null ? "Site default" : key === "lineSpacing" ? `${value.toFixed(1)}×` : `${value}px`;
      shadow.querySelector(`#${key}-value`).textContent = display;
      input.setAttribute("aria-valuetext", display);
    }
    for (const key of ["textColor", "backgroundColor"]) {
      shadow.querySelector(`#${key}`).value = preferences[key] ?? (key === "textColor" ? "#222222" : "#ffffff");
      shadow.querySelector(`#${key}-value`).textContent = preferences[key] ?? "Site default";
    }
    shadow.querySelector("#font").value = preferences.font;
    for (const reset of shadow.querySelectorAll("[data-reset]")) reset.disabled = preferences[reset.dataset.reset] === null;
    position();
  }

  function makePanel() {
    host = element("div", { "data-patreon-reader-panel": "" });
    shadow = host.attachShadow({ mode: "open" });
    const css = element("style");
    css.textContent = `
      :host { all: initial; color-scheme: light dark; }
      * { box-sizing: border-box; }
      [hidden] { display: none !important; }
      section { position: fixed; z-index: 2147483647; width: 332px; overflow: auto;
        padding: 20px; border: 1px solid #dedee3; border-radius: 18px; color: #202026;
        background: #fff; box-shadow: 0 12px 48px #0003;
        font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      header { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
      h2 { margin: 0; font-size: 18px; letter-spacing: -.3px; }
      p { margin: 4px 0 12px; color: #686872; font-size: 12px; }
      button, select, input { font: inherit; }
      button, select { cursor: pointer; color: inherit; background: #f4f4f6; border: 1px solid #dedee3; border-radius: 8px; }
      button { padding: 6px 10px; }
      button:hover { background: #e9e9ee; }
      button:disabled { opacity: .45; cursor: default; }
      :focus-visible { outline: 2px solid #b82d47; outline-offset: 3px; }
      .row { margin-block: 17px; }
      .caption { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 7px; }
      label { font-weight: 600; }
      output { color: #686872; font-size: 12px; margin-left: auto; }
      input[type=range] { display: block; width: 100%; margin: 10px 0; accent-color: #bd324a; }
      select { width: 100%; padding: 8px; }
      .colors { display: flex; align-items: center; gap: 10px; }
      input[type=color] { width: 45px; height: 32px; padding: 2px; border: 1px solid #aaa; border-radius: 6px; background: transparent; cursor: pointer; }
      .default { margin-left: auto; font-size: 11px; padding: 4px 7px; }
      .caption .default { margin-left: 0; }
      footer { padding-top: 14px; border-top: 1px solid #dedee3; }
      footer button { width: 100%; }
      #save-status { min-height: 18px; margin-bottom: 0; }
      @media(prefers-color-scheme: dark) {
        section { color: #f2f2f5; background: #232326; border-color: #48484e; }
        p, output { color: #b4b4be; }
        button, select { background: #323237; border-color: #505058; }
        button:hover { background: #414148; }
        footer { border-color: #48484e; }
      }
    `;
    panel = element("section", { role: "dialog", "aria-modal": "true", "aria-labelledby": "reader-heading", hidden: "" });
    const header = element("header");
    header.append(element("h2", { id: "reader-heading" }, "Reading appearance"));
    const close = element("button", { type: "button", "aria-label": "Close reading appearance" }, "×");
    close.addEventListener("click", () => closePanel(true));
    header.append(close);
    panel.append(header, element("p", {}, "Applied to all posts. Saved on this device."));
    const fontRow = element("div", { class: "row" });
    const caption = element("div", { class: "caption" });
    caption.append(element("label", { for: "font" }, "Font family"));
    const select = element("select", { id: "font" });
    for (const [id, font] of Object.entries(fonts)) select.append(element("option", { value: id }, font.label));
    select.addEventListener("change", () => update("font", select.value));
    fontRow.append(caption, select);
    panel.append(fontRow);
    for (const [key, label, type, min, max, step] of [
      ["textSize", "Text size", "range", 12, 32, 1],
      ["textColor", "Text color", "color"],
      ["backgroundColor", "Background color", "color"],
      ["paragraphSpacing", "Paragraph spacing", "range", 0, 48, 1],
      ["lineSpacing", "Line spacing", "range", 1, 2.5, 0.1]
    ]) {
      const row = element("div", { class: "row" });
      const heading = element("div", { class: "caption" });
      heading.append(element("label", { for: key }, label));
      const output = element("output", { id: `${key}-value`, for: key });
      heading.append(output);
      const input = element("input", { id: key, type });
      if (type === "range") {
        input.min = min; input.max = max; input.step = step;
      }
      input.addEventListener("input", () => update(key, type === "range" ? Number(input.value) : input.value));
      const reset = element("button", { type: "button", class: "default", "data-reset": key, "aria-label": `Reset ${label.toLowerCase()} to site default` }, "Reset");
      reset.addEventListener("click", () => update(key, null));
      const controls = element("div", { class: type === "color" ? "colors" : "" });
      controls.append(input);
      if (type === "range") heading.append(reset);
      else controls.append(reset);
      row.append(heading, controls);
      panel.append(row);
    }
    const footer = element("footer");
    const reset = element("button", { type: "button" }, "Reset to Patreon defaults");
    reset.addEventListener("click", () => {
      preferences = { ...defaults }; applyStyles(); renderControls(); persist();
    });
    footer.append(reset, element("p", { id: "save-status", role: "status", "aria-live": "polite" }, "Saved on this device"));
    panel.append(footer);
    shadow.append(css, panel);
    document.documentElement.append(host);
    renderControls();
  }

  function mount(like) {
    anchor = like;
    trigger = element("button", {
      type: "button", "data-patreon-reader-button": "", title: "Customize reading appearance",
      "aria-label": "Customize reading appearance", "aria-haspopup": "dialog", "aria-expanded": "false"
    });
    // Reuse only presentation classes, never Patreon IDs, attributes, or handlers.
    trigger.className = like.className;
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "20"); icon.setAttribute("height", "20");
    icon.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M2 19 7 5h2l5 14h-2.3l-1.1-3.5H5.4L4.3 19Zm4.1-5.5h3.8L8 7.7ZM22 19h-2v-1c-.7.8-1.5 1.2-2.7 1.2-1.8 0-3.1-1.1-3.1-2.9 0-2 1.5-3.2 4-3.2H20v-.4c0-1.1-.6-1.7-1.8-1.7-1 0-1.8.4-2.6 1l-1.1-1.5c1-.9 2.3-1.4 3.9-1.4 2.4 0 3.6 1.3 3.6 3.6Zm-2-4.2h-1.5c-1.5 0-2.3.5-2.3 1.4 0 .8.6 1.2 1.5 1.2 1.2 0 2.3-.8 2.3-1.9Z");
    path.setAttribute("fill", "currentColor");
    icon.append(path); trigger.append(icon);
    trigger.addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation();
      if (open) return closePanel(true);
      if (!host?.isConnected) makePanel();
      open = true; panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      renderControls(); position(); panel.querySelector("button").focus();
    });
    like.before(trigger);
  }

  function removeUI() {
    closePanel(true);
    trigger?.remove(); host?.remove();
    trigger = anchor = host = shadow = panel = undefined;
  }

  function visible(node) {
    return node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden";
  }

  function findPost() {
    const titles = [...document.querySelectorAll(TITLE)].filter((node) => !node.closest(EXCLUDE));
    // Patreon uses post-card for the actual post as well as previews. Prefer
    // the page's h1, then keep all searches inside that title's own card.
    const headings = titles.filter((node) => node.matches("h1") || node.querySelector("h1"));
    const candidates = headings.length ? headings : titles.filter((node) => !node.closest(CARD));
    for (const title of candidates.filter(visible)) {
      const card = title.closest(CARD);
      const belongs = (node) => !node.closest(EXCLUDE) && node.closest(CARD) === card;
      const boundary = card ?? title.closest("main");
      for (let parent = title.parentElement; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
        const likes = [...parent.querySelectorAll('[data-tag="like-button"]')].filter((node) => belongs(node) && visible(node));
        const like = likes.find((node) => node.closest('[data-tag="top-engagement"]')) ?? likes[0];
        if (like) {
          let scope = parent;
          // Responsive title copies may share the body at a higher ancestor.
          // Their count must not prevent reaching that body.
          while (scope !== boundary && ![...scope.querySelectorAll(BODY)].some(belongs)
            && scope.parentElement && scope.parentElement !== document.body) scope = scope.parentElement;
          return { scope, like, belongs };
        }
        if (parent === boundary) break;
      }
    }
    return null;
  }

  function reconcile(isPostPage) {
    if (route !== location.pathname) {
      route = location.pathname; removeUI(); clearTargets();
    }
    if (!enabled || !isPostPage) {
      removeUI(); clearTargets(); return;
    }
    const post = findPost();
    if (!post) { removeUI(); clearTargets(); return; }
    const { scope, like, belongs } = post;
    const next = [...scope.querySelectorAll(TITLE), ...scope.querySelectorAll(BODY)].filter(belongs);
    for (const target of targets) if (!next.includes(target)) {
      target.removeAttribute("data-patreon-reader-title"); target.removeAttribute("data-patreon-reader-body");
    }
    targets = next;
    for (const target of targets) {
      const attribute = target.matches(TITLE) ? "data-patreon-reader-title" : "data-patreon-reader-body";
      if (!target.hasAttribute(attribute)) target.setAttribute(attribute, "");
    }
    applyStyles();
    if (anchor !== like || !trigger?.isConnected || trigger.nextElementSibling !== like) {
      removeUI(); mount(like);
    }
    position();
  }

  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", keyboard, true);
  document.addEventListener("focusin", (event) => {
    if (open && !event.composedPath().includes(host) && !event.composedPath().includes(trigger)) closePanel();
  });
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, { passive: true, capture: true });
  window.visualViewport?.addEventListener("resize", position);
  window.visualViewport?.addEventListener("scroll", position);

  globalThis.PatreonReader = {
    configure(nextEnabled, nextPreferences, save) {
      enabled = nextEnabled === true;
      if (!pendingWrites) preferences = normalize(nextPreferences);
      savePreference = save;
      renderControls();
    },
    reconcile
  };
})();
