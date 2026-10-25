const { api, call } = globalThis.PatreonExtension;
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
  try {
    const [tab] = await call(api.tabs, "query", { active: true, currentWindow: true });
    const state = tab?.id === undefined ? null
      : await call(api.tabs, "sendMessage", tab.id, { type: "GET_STATE" });
    status.textContent = state?.isPostPage
      ? "Preferences apply to all posts" : "Available on Patreon post pages";
    status.dataset.tone = state?.isPostPage ? "success" : "inactive";
  } catch (_) {
    status.textContent = "Available on Patreon post pages";
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
