const toggle = document.querySelector("#hidden-toggle");
const status = document.querySelector("#status");

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return typeof tab?.id === "number" ? tab.id : null;
}

async function send(message) {
  const tabId = await activeTabId();
  if (tabId === null) throw new Error("No active browser tab.");

  let response;
  try {
    response = await chrome.tabs.sendMessage(tabId, message);
  } catch (_) {
    throw new Error("Open or refresh a Patreon page first.");
  }

  if (response?.error) throw new Error(response.error);
  return response;
}

function render(state) {
  toggle.checked = state.isHidden;
  if (!state.isPostPage) {
    status.textContent = "Only active on Patreon post pages";
  } else {
    status.textContent = state.isHidden
      ? "Engagement bar hidden"
      : "Engagement bar visible";
  }
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
