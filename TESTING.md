# Reader validation

## Automated checks

Install Node.js 22 or later and a local Chrome installation, then run:

```sh
npm ci
npm run check
npm test
npm run test:brave
```

The Playwright configuration uses Chrome and Brave at their standard macOS
application paths. Adjust `executablePath` in `playwright.config.js` on other
systems. No Playwright browser download is required for these two commands.

Tests render a synthetic Patreon-shaped fixture with changing CSS-module hashes
and mock extension storage/messaging. They exercise both Chrome's callback API
and the promise-based browser API. This checks DOM behavior, computed styles,
settings, cleanup, navigation, keyboard interaction, storage errors, and the
popup. The Brave command also loads the actual unpacked extension in a temporary
profile and checks real extension storage, popup controls, content-script
injection, and synchronization between two tabs. It saves panel and popup
screenshots in `test-results/`. The installed-extension test is skipped by the
Chrome command because it uses Brave's unpacked-extension support.

These checks do not cover store packaging, current Patreon markup, screen-reader
output, or Safari/Firefox engines.

### Implementation verification — October 25, 2026

On macOS 15.7.3 (Apple Silicon):

- Chrome 156.0.8078.48: 12 fixture tests passed; the Brave-only installation test
  was skipped as intended.
- Brave 153.1.95.101: all 13 tests passed, including the actual unpacked-extension
  test with real local extension storage and two post tabs.
- JavaScript syntax checks and `git diff --check` passed.
- The generated popup and Reader-panel screenshots were visually inspected.

Live Patreon, Firefox, Safari, and assistive-technology verification remain
pending before release.

## Manual release checklist

Record browser and OS versions and results for Chrome, Brave, Firefox, and Safari
for macOS. Test an actual installed build in each browser. Original manual
support claims are not evidence that the Reader feature passes this checklist.

- Upgrade from 1.0.0 with both possible engagement preferences. Reader starts
  disabled; the engagement choice survives. Restart the browser and verify
  preferences are restored.
- Enable Reader in the extension popup. Exactly one Aa button appears before
  Like on the main post; no button appears in the floating bar or related cards.
- Verify each control on public and legitimately accessible member posts,
  locked previews, and posts containing headings, lists, quotes, links, images,
  and embeds. Do not use the extension to obtain inaccessible content.
- Check default fonts, unavailable-font fallbacks, bold/italic text, long
  unbroken links, and custom foreground/background contrast. Color choices are
  user-controlled; choose a readable combination.
- Confirm comments, creator information, navigation, images, attachments, and
  embeds retain their normal appearance.
- Check immediate preview, individual resets, reset all, disable/re-enable, and
  synchronization between two open post tabs. Disabling removes the panel,
  button, and appearance styles while retaining saved choices.
- Navigate between posts without reload, then away to a creator page. Test
  browser back/forward, lazy content, and delayed rerenders. There must be no
  duplicate controls or lingering styles on unsupported pages.
- Navigate with Tab, Shift+Tab, Enter, arrows, and Escape. Verify labels with a
  screen reader, focus return after dismissal, and outside-click dismissal.
- Test light/dark themes, narrow windows, 200% browser zoom, OS text scaling,
  and the native color picker. Ensure the panel stays within the viewport and
  all controls remain reachable by scrolling.
- Scroll through a long post and repeatedly navigate. Check for console errors,
  observer loops, noticeable delays, and unexpected network requests.
- Verify both engagement toggle positions and both Reader toggle positions,
  including popup use on a non-Patreon tab.

## Browser delivery

- Chrome/Brave: use the same Manifest V3 source package. Test Brave with default
  Shields settings and with Patreon site access granted.
- Firefox: load the source as a temporary add-on for local validation; validate
  and sign an appropriate Firefox package before distributing via Mozilla.
  Review any current Firefox-specific manifest requirements at release time.
- Safari for macOS: package the source with Apple's Safari Web Extension tooling
  and test the generated extension with Patreon site access allowed. A Chrome
  Web Store update does not update Safari installations.

Responsive narrow-window behavior does not establish mobile extension support.
No new extension permissions, remote fonts, or runtime dependencies are added.
