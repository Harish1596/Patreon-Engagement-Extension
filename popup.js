const toggle = document.querySelector("#hidden-toggle");
const status = document.querySelector("#status");
const pickButton = document.querySelector("#pick");
const forgetButton = document.querySelector("#forget");

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
  toggle.disabled = !state.hasTarget;
  forgetButton.hidden = !state.hasTarget;

  if (!state.hasTarget) {
    status.textContent = "No element selected yet";
  } else if (!state.targetFound) {
    status.textContent = "Saved; waiting for it to appear";
  } else {
    status.textContent = state.isHidden ? "Hidden on Patreon" : "Visible on Patreon";
  }
}

async function refresh() {
  try {
    render(await send({ type: "GET_STATE" }));
  } catch (error) {
    toggle.disabled = true;
    pickButton.disabled = true;
    forgetButton.hidden = true;
    status.textContent = error.message;
  }
}

toggle.addEventListener("change", async () => {
  try {
    render(await send({ type: "SET_HIDDEN", value: toggle.checked }));
  } catch (error) {
    status.textContent = error.message;
  }
});

pickButton.addEventListener("click", async () => {
  try {
    await send({ type: "START_PICKING" });
    window.close();
  } catch (error) {
    status.textContent = error.message;
  }
});

forgetButton.addEventListener("click", async () => {
  try {
    render(await send({ type: "FORGET_TARGET" }));
  } catch (error) {
    status.textContent = error.message;
  }
});

refresh();
