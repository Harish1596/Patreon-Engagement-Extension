const toggle = document.querySelector("#hidden-toggle");
const status = document.querySelector("#status");

async function activePatreonTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://www.patreon.com/")) {
    return null;
  }
  return tab;
}

async function send(message) {
  const tab = await activePatreonTab();
  if (!tab) throw new Error("Open a Patreon page first.");
  return chrome.tabs.sendMessage(tab.id, message);
}

function render(state) {
  toggle.checked = state.isHidden;
  status.textContent = state.isHidden
    ? "Engagement bar hidden"
    : "Engagement bar visible";
}

async function refresh() {
  try {
    render(await send({ type: "GET_STATE" }));
  } catch (error) {
    toggle.disabled = true;
    status.textContent = error.message;
  }
}

toggle.addEventListener("change", async () => {
  try {
    render(await send({ type: "SET_HIDDEN", value: toggle.checked }));
  } catch (error) {
    toggle.checked = !toggle.checked;
    status.textContent = error.message;
  }
});

refresh();
