# Patreon Engagement Toggle

A small browser extension that hides Patreon's floating engagement bar by
default. The toolbar switch can show or hide it at any time.

## Browser support

The extension has been manually tested and confirmed to work in:

- Google Chrome
- Mozilla Firefox
- Brave
- Safari for macOS

Other browsers may be compatible, but have not been verified.

## Why I Built This

Patreon's floating engagement toolbar was covering part of the text whenever I
scrolled through a post, which made reading less comfortable. I built this
extension to keep the toolbar hidden by default. I am sharing this in case anyone else wishes for the same.

## Install it

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open or refresh a Patreon page.

## Use it

On Patreon post pages, the floating like, comment, repost, and share bar is
hidden automatically. Click the extension icon and turn off the switch to show
it again.

Post pages are recognized locally using this pathname structure:

```text
/<creator>/posts/<post-slug>-<numeric-post-id>
```

The extension targets only:

```css
div[data-tag="floating-engagement-sheet"]
```

## Notes

- The hide/show setting is stored only on the local device.
- The extension only runs on `https://www.patreon.com/*`.
- Although the content script remains loaded across Patreon to support its
  client-side navigation, it modifies the page only when the URL matches a post.
- All styles and scripts are packaged locally. The extension makes no network
  requests and accepts no remotely supplied selectors or code.
- The extension does not collect or transmit personal or sensitive user data.
  Its only retained value is the hide/show preference stored locally in the
  browser.

## Reporting Issues

If the extension is not working as expected, first refresh the Patreon page and
confirm that the extension is enabled and allowed to access `patreon.com`.

You can report an issue in either of these ways:

1. **Chrome Web Store Support:** Open the extension's Chrome Web Store listing,
   scroll to the **Support** section, and submit a support request.
2. **GitHub Issues:** Check the
   [existing issues](https://github.com/Harish1596/Patreon-Engagement-Extension/issues)
   and select **New issue** if the problem has not already been reported.

Please include:

- A brief description of what happened and what you expected to happen.
- Your browser, browser version, and extension version.
- Whether the problem occurs on every Patreon post or only certain posts.
- A screenshot, if it helps explain the problem.

Before sharing a screenshot or link, remove or obscure private content. Never
include passwords, cookies, payment information, private messages, or other
sensitive account information in a report.

## Privacy

See the [Privacy Policy](PRIVACY.md) for details about the extension's local
data processing, permissions, and storage.

## License

Copyright (C) 2026 Harish Babu.

This project is licensed under the [GNU General Public License version 3](LICENSE)
only (`GPL-3.0-only`).
