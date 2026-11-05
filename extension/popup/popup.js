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
const errorMessage = document.querySelector("#preferences-error");
let saving = false;
let preferences = { isHidden: true, readerEnabled: false };

function render() {
  toggle.checked = preferences.isHidden;
  readerToggle.checked = preferences.readerEnabled;
  toggle.disabled = readerToggle.disabled = saving;
}

function showError(message = "") {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

async function save(key, value) {
  saving = true;
  showError();
  render();
  try {
    await call(api.storage.local, "set", { [key]: value });
    preferences[key] = value;
  } catch (_) {
    showError("Unable to save. Please try again.");
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
}).catch(() => {
  showError("Unable to load preferences. Reopen to retry.");
});
