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
    if (typeof state?.isPostPage !== "boolean") throw new Error("No page response");
    if (!state.isPostPage) {
      status.textContent = "Available on Patreon post pages";
      status.dataset.tone = "inactive";
    } else if (state.readerEnabled && state.readerMounted === false) {
      status.textContent = "Reader controls not found on this post";
      status.dataset.tone = "inactive";
    } else {
      status.textContent = "Preferences apply to all posts";
      status.dataset.tone = "success";
    }
  } catch (_) {
    status.textContent = "Open or refresh a Patreon post to connect";
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


const forgetMedia = document.querySelector("#forget-media");
const mediaStatus = document.querySelector("#media-status");
let mediaBusy = false;
async function mediaOrigins() {
  const permissions = await call(api.permissions, "getAll");
  // Keep the required Patreon integration grant; only revoke optional media hosts.
  return (permissions.origins || []).filter(origin => origin.startsWith("https://") && origin !== "https://www.patreon.com/*");
}
async function showMediaAccess() {
  try {
    const origins = await mediaOrigins();
    forgetMedia.disabled = mediaBusy || !origins.length;
    mediaStatus.textContent = origins.length
      ? `${origins.length} saved media ${origins.length === 1 ? "origin" : "origins"}. Forget access to require permission again.`
      : "No saved media access.";
  } catch {
    forgetMedia.disabled = true;
    mediaStatus.textContent = "Unable to check saved media access. Reopen to retry.";
  }
}
forgetMedia.addEventListener("click", async () => {
  if (mediaBusy) return;
  mediaBusy = true; forgetMedia.disabled = true;
  try {
    const origins = await mediaOrigins();
    if (origins.length && !await call(api.permissions, "remove", { origins })) throw new Error("Access was not removed");
    mediaBusy = false;
    await showMediaAccess();
  } catch {
    mediaStatus.textContent = "Unable to remove media access. Try again.";
    forgetMedia.disabled = false;
  } finally { mediaBusy = false; }
});
showMediaAccess();
