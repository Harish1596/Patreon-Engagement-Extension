# Patreon Floating Element Toggle

A small Chrome/Edge/Brave extension that remembers a floating Patreon element
and hides it by default. It also watches for Patreon recreating the element as
you scroll or move between posts.

## Install it

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open or refresh a Patreon page.

## Select the element once

1. Scroll down until the unwanted floating element is visible.
2. Click the extension icon, then **Select element on page**.
3. Move the pointer over the unwanted bar. The extension outlines the floating
   container rather than only the button or text under the pointer.
4. Click it. It is saved and immediately hidden.

Use the extension's switch to show or hide it. **Forget selected element** lets
you select it again if Patreon changes its page structure.

## Notes

- The setting is shared across Patreon tabs through browser sync storage.
- The extension only runs on `https://www.patreon.com/*`.
- No browsing data is collected or sent anywhere.
