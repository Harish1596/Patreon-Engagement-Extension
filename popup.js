const toggle = document.querySelector("#hidden-toggle");
const status = document.querySelector("#status");
const PAGE_UNAVAILABLE_MESSAGE = "Available on Patreon post pages";

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
    throw new Error(PAGE_UNAVAILABLE_MESSAGE);
  }

  if (response?.error) throw new Error(response.error);
  return response;
}

function render(state) {
  toggle.checked = state.isHidden;
  toggle.disabled = false;

  if (!state.isPostPage) {
    setStatus(PAGE_UNAVAILABLE_MESSAGE, "inactive");
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
    setStatus(
      error.message,
      error.message === PAGE_UNAVAILABLE_MESSAGE ? "inactive" : "error"
    );
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
    setStatus(
      error.message,
      error.message === PAGE_UNAVAILABLE_MESSAGE ? "inactive" : "error"
    );
  }
});

refresh();
