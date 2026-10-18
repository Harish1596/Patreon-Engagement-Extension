# Patreon Floating Engagement Toggle

A small Chrome/Edge/Brave extension that hides Patreon's floating engagement
bar by default. The toolbar switch can show or hide it at any time.

## Install it

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open or refresh a Patreon page.

## Use it

The floating like, comment, repost, and share bar is hidden automatically. Click
the extension icon and turn off the switch to show it again.

The extension targets only:

```css
div[data-tag="floating-engagement-sheet"]
```

## Notes

- The hide/show setting is shared across Patreon tabs through browser sync
  storage.
- The extension only runs on `https://www.patreon.com/*`.
- No browsing data is collected or sent anywhere.
