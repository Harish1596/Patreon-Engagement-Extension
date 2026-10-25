# Reader validation

The [maintained post-page reference](docs/patreon-text-image-post-baseline.md)
records the supplied HTML, screenshots, current integration contract, hook
inventory, and UI-drift investigation procedure as architectural evidence.
Its observations are distinct from the synthetic and installed-extension tests
below; documenting the captures does not establish live behavioral coverage.

## Live Patreon verification

**Completed — user-confirmed October 25, 2026, for the entire recorded testing
history.** This manual confirmation supersedes earlier live-Patreon-pending
notes in [testing history](docs/testing-history.md). Those notes are retained
as historical records of the status at the time.

This is user-reported verification, separate from the automated results below.
Individual testing dates, browser/OS versions, and scenario coverage were not
itemized in this confirmation; it does not establish an exhaustive browser or
accessibility matrix or guarantee compatibility with future Patreon UI changes.

## Automated checks

Run these commands from the repository root with Node.js 22 or later:

```sh
npm ci
npm run check
npm run test:tooling
npm test
npm run test:brave
npm run package
```

- `check` recursively syntax-checks runtime, development scripts, and tests.
- `test:tooling` runs Node tests for packaging and browser discovery, without launching a browser.
- `test` runs the Chrome browser suites; `test:brave` runs the same suites plus the unpacked-extension case in Brave.
- `package` requires `zip` and `unzip` on PATH. Existing releases require explicit `--force` replacement. See [release packaging](docs/release-packaging.md).

Latest structural-work verification: **28 Chrome cases, 29 Brave cases, and 13
Node tooling cases passed**, plus syntax and whitespace checks. Chrome skips
the Brave-only installed test intentionally. Detailed dated results, earlier
failures/retries, and original browser/OS versions are retained in
[testing history](docs/testing-history.md); historical counts are not current totals.
The source feature version remains 1.3.9.

The subsequent swatch-order change also passed 28 Chrome and 29 Brave cases,
including exact visual-order semantics via DOM order, keyboard navigation, and
legacy color migration assertions. The 1.3.9 ZIP was rebuilt and validated.
This change has not received a separate user live-Patreon confirmation.

Latest popup-layout verification: **29 Chrome cases and 30 Brave cases passed**,
including a new 320px popup layout check in light/dark modes with long status
messages and usable switches. Syntax and ZIP packaging validation also passed.
No new live Patreon verification is claimed for this popup-only change.

## Browser configuration

Shared discovery in `scripts/browser-config.js` checks common macOS, Linux, and
Windows locations. Set `CHROME_EXECUTABLE` or `BRAVE_EXECUTABLE` for a custom
installation; `BROWSER_EXECUTABLE` is the fallback override for the active browser.
Invalid overrides fail rather than silently selecting another browser. The same
resolver is used by Playwright and the installed-extension test. Node launchers
avoid shell-specific environment assignment and wildcard expansion.

For example, on macOS/Linux:

```sh
CHROME_EXECUTABLE="/custom/path/to/chrome" npm test
BRAVE_EXECUTABLE="/custom/path/to/brave" npm run test:brave
```

In PowerShell, set `$env:CHROME_EXECUTABLE` or `$env:BRAVE_EXECUTABLE` before
running the same npm command. No Playwright browser download is required for
these local-installation commands. Automated browser verification here ran on macOS;
Windows/Linux path discovery has unit coverage, not native browser-run coverage.

## Test organization and limits

Browser specs are grouped into appearance, comments, detection, lifecycle, popup,
settings, and installed-extension suites. Base HTML lives in `tests/fixtures/`;
shared setup, API mocks, and UI controls are in `tests/helpers/reader.js`. The helper
loads runtime scripts/styles in the order declared by `extension/manifest.json`,
including the DOM adapter. Playwright discovers only `*.spec.js`; Node tooling
cases live under `tests/tooling/*.test.cjs`.

Fixture tests intercept Patreon requests with synthetic HTML and mock local
storage/messaging. The promise-based `browser` mock is not Firefox-engine testing.
Brave's installed test uses a temporary profile, loads `extension/`, opens
`popup/popup.html`, and exercises real extension storage/content injection across
two synthetic post tabs. It saves panel/popup screenshots in ignored
`test-results/`. It does not log into Patreon or test a store-distributed package.

Packaging tests use temporary copied sources and deliberately malformed archives.
They check exact allowlisted contents, version consistency, required resources,
CRC/integrity, duplicate/missing entries, changed payloads, source/output symlinks,
and output preservation. Symlink tests are skipped on Windows because creating
symlinks may require extra OS privileges. No credentials or real account data
are used. Staging and test directories are cleaned by the tooling.

No automated check establishes full current-live-Patreon compatibility,
assistive-technology behavior, authenticated submission, Firefox/Safari rendering,
or approval by a browser store. Preserve native handlers, ARIA state, access
permissions, and draft content when changing appearance.

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
  unbroken links, each Post Color preset, and matching text and action colors.
- Upgrade from separate color settings. Check background migration, removal of
  the old text override, persistence after a settings change, and Default reset.
- Check Reader, Like, Comment, Repost, Share, and More against every background
  in both Patreon themes. Verify nested icons/counts, liked/selected states,
  disabled states, hover, focus, and original colors after reset or disable.
- Check comment Like, Reply, and More on parent comments and expanded replies
  against every preset, including counts, liked/menu states, hover, and focus.
- Confirm background covers the complete post column and metadata/comments are
  readable in both Patreon themes. Native controls, navigation outside the
  column, images, attachments, and embeds should retain their styling. Font
  size, family, and spacing must remain scoped to the post title/body.
- Check immediate preview, individual resets, reset all, disable/re-enable, and
  synchronization between two open post tabs. Disabling removes the panel,
  button, and appearance styles while retaining saved choices.
- Navigate between posts without reload, then away to a creator page. Test
  browser back/forward, lazy content, and delayed rerenders. There must be no
  duplicate controls or lingering styles on unsupported pages.
- Navigate with Tab, Shift+Tab, Enter, arrows, and Escape. Verify labels with a
  screen reader, focus return after dismissal, and outside-click dismissal.
- Test light/dark themes, narrow windows, 200% browser zoom, OS text scaling,
  and keyboard selection of color swatches. Ensure the panel stays within the viewport and
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
