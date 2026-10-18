const toggle = document.querySelector("#hidden-toggle");
const status = document.querySelector("#status");

function setStatus(message, tone) {
  status.textContent = message;
  status.dataset.tone = tone;
}

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
  toggle.disabled = false;

  if (!state.isPostPage) {
    setStatus("Available on Patreon post pages", "inactive");
  } else {
    setStatus(
      state.isHidden ? "Hidden on this post" : "Visible on this post",
      state.isHidden ? "success" : "visible"
    );
  }
}

async function refresh() {
  try {
    render(await send({ type: "GET_STATE" }));
  } catch (error) {
    toggle.disabled = true;
    setStatus(error.message, "error");
  }
}

toggle.addEventListener("change", async () => {
  const requestedValue = toggle.checked;
  toggle.disabled = true;
  setStatus("Saving preference…", "loading");

  try {
    render(await send({ type: "SET_HIDDEN", value: requestedValue }));
  } catch (error) {
    toggle.checked = !requestedValue;
    toggle.disabled = false;
    setStatus(error.message, "error");
  }
});

refresh();
