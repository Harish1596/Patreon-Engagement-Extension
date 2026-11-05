for (const name of ["discord", "github"]) {
  const link = document.querySelector(`#${name}-link`);
  const value = globalThis.PatreonLinks?.[name];
  if (value) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password) {
        link.href = url.href;
        link.removeAttribute("aria-disabled");
      }
    } catch (_) { /* Leave unconfigured links disabled. */ }
  }
}

const { api, call } = globalThis.PatreonExtension;
const version = api.runtime.getManifest?.().version;
if (version) {
  const badge = document.querySelector("#version");
  badge.textContent = `v${version}`;
  badge.hidden = false;
}
const toggle = document.querySelector("#hidden-toggle");
const readerToggle = document.querySelector("#reader-toggle");
const status = document.querySelector("#status");
let saving = false;
let preferences = { isHidden: true, readerEnabled: false };

function render() {
  toggle.checked = preferences.isHidden;
  readerToggle.checked = preferences.readerEnabled;
  toggle.disabled = readerToggle.disabled = saving;
}

async function showPageStatus() {
  let tab;
  try {
    [tab] = await call(api.tabs, "query", { active: true, currentWindow: true });
    const state = tab?.id === undefined ? null
      : await call(api.tabs, "sendMessage", tab.id, { type: "GET_STATE" });
    if (typeof state?.isPostPage !== "boolean") throw new Error("No page response");
    if (state.collectionDownloadMounted) {
      status.textContent = "Collection downloads are available on this page";
      status.dataset.tone = "success";
    } else if (!state.isPostPage) {
      status.textContent = "Open a Patreon post or collection to get started.";
      status.dataset.tone = "inactive";
    } else if (state.readerEnabled && state.readerMounted === false) {
      status.textContent = "Reader controls not found on this post";
      status.dataset.tone = "inactive";
    } else {
      status.textContent = "Preferences apply to all posts";
      status.dataset.tone = "success";
    }
  } catch (_) {
    let onPatreon = false;
    try {
      const url = new URL(tab?.url);
      onPatreon = url.protocol === "https:" && (url.hostname === "patreon.com" || url.hostname.endsWith(".patreon.com"));
    } catch (_) { /* The browser may not expose the active tab URL. */ }
    status.textContent = onPatreon ? "Refresh this page to enable Patreon Reader."
      : "Open a Patreon post or collection to get started.";
    status.dataset.tone = "inactive";
  }
}

async function save(key, value) {
  saving = true;
  render();
  try {
    await call(api.storage.local, "set", { [key]: value });
    preferences[key] = value;
    await showPageStatus();
  } catch (_) {
    status.textContent = "Unable to save. Please try again.";
    status.dataset.tone = "error";
  } finally {
    saving = false;
    render();
  }
}

toggle.addEventListener("change", () => save("isHidden", toggle.checked));
readerToggle.addEventListener("change", () => save("readerEnabled", readerToggle.checked));
api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.isHidden) preferences.isHidden = changes.isHidden.newValue !== false;
  if (changes.readerEnabled) preferences.readerEnabled = changes.readerEnabled.newValue === true;
  render();
});

toggle.disabled = readerToggle.disabled = true;
call(api.storage.local, "get", ["isHidden", "readerEnabled"]).then((stored) => {
  preferences = { isHidden: stored.isHidden !== false, readerEnabled: stored.readerEnabled === true };
  render();
  return showPageStatus();
}).catch(() => {
  status.textContent = "Unable to load preferences. Reopen to retry.";
  status.dataset.tone = "error";
});
