# Patreon Engagement Toggle

A small browser extension that hides Patreon's floating engagement bar by
default and optionally customizes post reading appearance. Both features are
controlled from the extension's toolbar popup.

## Browser support

The extension has been manually tested and confirmed to work in:

- Google Chrome
- Mozilla Firefox
- Brave
- Safari for macOS

Other browsers may be compatible, but have not been verified.

The list above describes manual testing of the original engagement-bar feature.
Reader customization needs release validation in each browser; automated fixture
tests do not establish compatibility with the current live Patreon site. See
[TESTING.md](TESTING.md) for the release checklist and browser packaging notes.

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

### Reader customization

1. Open the extension's toolbar popup and turn on **Enable Reader Customization**.
2. On a supported post page, select the **Aa** button at the start of the action
   row: Reader → Like → Comment → Repost → Share → More.
3. Adjust font family, text size (12–32px), Post Color,
   paragraph spacing (0–48px), and line spacing (1–2.5×). Changes preview immediately.

The title uses 1.5× the chosen body text size. Font, size, and spacing
customize the title/body reading text. Post Color covers the full post
column and its outer wrapper/padding, including the title, creator information,
action-row area, and comments.
Metadata and comments receive a matching readable foreground when a background
is selected. Reader, Like, Comment, Repost, Share, and More action icons, counts,
and borders use the same matched palette as the reading text.
Hover, keyboard focus, selected/liked, and disabled states remain distinguishable.
Navigation outside the column, other native controls, images, and embeds keep
their own styling. Links remain underlined when overriding post text color.

Post Color pairs the background with readable text instead of separate color controls:

- Default: restore Patreon's original colors.
- White: white background and charcoal text.
- Sepia: warm cream background and brown text.
- Light Green: pale green background and charcoal text.
- Black: dark background and soft white text.

Every preset updates background, text, metadata, and action colors together.
Previously saved backgrounds map to the nearest preset; old independent text
overrides are dropped. Text-only legacy preferences become Default. The next
settings change saves the migrated `postColor` value without legacy color fields.

Each setting starts at **Site default**. Individual default buttons remove an
override; **Reset to Patreon defaults** removes all appearance overrides without
disabling Reader. Font choices are Patreon default, System Sans, Arial, Verdana,
Trebuchet, Georgia, Times, and Monospace. These reference installed system fonts
with fallbacks; no fonts are downloaded, bundled, or enumerated.

Reader is off by default. Disabling it removes the Aa button and panel and
restores the site's appearance, retaining preferences for next time. Settings
apply across supported posts and open tabs within the same browser profile.
They do not sync between browsers or edit the creator's actual post.

The Reader panel supports keyboard controls, Escape, outside-click dismissal,
and a bottom-sheet layout in narrow windows. If Patreon changes its post markup,
the button may be unavailable until the selectors are updated.

Post pages are recognized locally using this pathname structure:

```text
/<creator>/posts/<post-slug>-<numeric-post-id>
```

The engagement-bar toggle targets:

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
  It stores the hide/show preference, Reader enablement, and appearance
  preferences locally in the browser.

## Development

Runtime code has no third-party dependencies or build step. `extension.js` shares
validated preferences and a small browser API adapter between the popup and
content scripts. `reader.js` owns post detection, scoped styles, and an isolated
Shadow DOM panel. `content.js` coordinates storage and page navigation.

See the [text-and-image post baseline](docs/patreon-text-image-post-baseline.md)
for the observed page hierarchy, screenshot map, selector boundaries, responsive
variants, and how the extension integrates with each region. Start there when
planning changes to the common text-post layout.

For development checks, run `npm ci`, `npm run check`, and `npm test`. Playwright
is a development-only dependency; see [TESTING.md](TESTING.md) for browser setup.
Package only `manifest.json`, `extension.js`, `reader.js`, `content.js`,
`content.css`, `popup.html`, `popup.js`, `popup.css`, `icons/`, `LICENSE`, and
`PRIVACY.md`, with the manifest at the ZIP root. Do not include `node_modules`,
tests, reports, or `.git`.

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
