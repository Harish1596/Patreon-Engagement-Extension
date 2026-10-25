# Reader validation

The [maintained post-page reference](docs/patreon-text-image-post-baseline.md)
records the supplied HTML, screenshots, current integration contract, hook
inventory, and UI-drift investigation procedure as architectural evidence.
Its observations are distinct from the synthetic and installed-extension tests
below; documenting the captures does not establish live behavioral coverage.

## Automated checks

Repository-layout update: unpacked extensions now load from `extension/`, and
the installed test opens `popup/popup.html`. Synthetic HTML is in `tests/fixtures/`;
shared setup/API mocks and control helpers are in `tests/helpers/reader.js`.
Runtime script order and test behavior are unchanged. Packaging automation and
browser-path portability changes are deliberately deferred to the next task.
The runtime version remains 1.3.9 and existing release ZIPs are not rebuilt here.
Validation passed: 27 Chrome fixture tests and all 28 Brave tests, including
loading the unpacked extension from `extension/` and opening its relocated popup.
Runtime JavaScript/CSS and icon contents were compared byte-for-byte with their
previous paths; base fixture contents match their former inline strings. All
manifest/popup assets resolve, script order is preserved, and 26 local doc file
links, code fences, syntax, and whitespace checks passed. These checks do not
establish new live Patreon behavior.

Documentation maintenance, October 25, 2026: the maintained reference was reviewed
against runtime 1.3.9 (`d59a994`) and the supplied full HTML. Checks passed for 35
local Markdown links/anchors, code-fence balance, all 70 captured data-tag/testid
values and counts, original source SHA-256, current color presets, override names,
version, and whitespace. Added AGENTS.md for future-session discovery/maintenance.
This was a documentation-only task: no runtime changes, version bump, package
rebuild, or new browser-test run. Runtime results below remain their dated evidence.

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

### Main-post detection regression — 1.1.1

User-supplied structural diagnostics showed that Patreon wraps the main post
inside `data-tag="post-card"`, has two title elements, and uses `like-button`
for comment actions too. The initial implementation incorrectly excluded the
whole main card. New tests reproduced the missing button before the fix.

Reader now allows the main post card, scopes searches to the selected title's
own card, prefers the visible top-engagement row, excludes comment rows and
threads, and reevaluates the selected row on resize. Duplicate responsive titles
no longer prevent finding the shared post body. Popup status distinguishes a
missing page connection from unsupported pages and missing Reader controls.

Verification on the same Chrome/Brave versions listed above:

- Chrome: all 15 fixture tests passed; the Brave-only installation test skipped.
- Brave: all 16 tests passed, including an installed extension with the main
  post-card wrapper, duplicate titles, real storage, and popup-to-page messaging.
- Syntax and whitespace checks passed. Retesting on the live post is pending.

### Full-column reading colors — 1.2.0

The supplied markup identifies `PostBodies-module__…__singleColumnContent`
around the complete column and `data-testid="single-column-post-wrapper"`
around its inner content. Background overrides target these surfaces as well
as the post text, with the selected card/scope as a fallback. Removing Reader
or resetting background removes the override and restores original styles.

Four independently chosen background swatches (White, Sepia, Light Green,
Black) and four text swatches (Charcoal, Slate, Brown, Soft White) replace the
free color pickers. Auto text chooses a matching foreground. Low-contrast text
options are disabled for an explicit background; changing backgrounds switches
incompatible text to Auto. Older valid hexadecimal colors map to the nearest
preset. No new settings keys or permissions are introduced.

Regression coverage includes the outer and inner surfaces, metadata/comment
contrast, preserved native-control and navigation styling, reset and disable
cleanup, color migration, keyboard radio-group selection, and actual extension
storage propagation to another post tab. On the browser versions listed above,
all 17 Chrome fixture tests and all 18 Brave tests passed. The Brave suite
includes the actual unpacked-extension test. Live-site confirmation and Firefox/
Safari validation remain pending.

### Outer-wrapper background — 1.2.1

The latest supplied markup adds `PostBodies-module__…__singleColumnContentWrapper`
outside the inner content column. Reader explicitly prefers that outer wrapper
and colors the inner column too, so its padding and surrounding space share the
selected background. A regression fixture uses distinct original backgrounds
and outer padding, verifies both surfaces change, and checks reset/disable
restores both originals. The actual unpacked-extension fixture now includes
the same outer/inner nesting.

All 18 Chrome fixture tests and all 19 Brave tests passed, along with syntax and
whitespace checks. Live Patreon confirmation remains pending.

### Action contrast — 1.2.2

When an explicit reading background is selected, the main post's action row
receives foreground, border, hover, and selected-state colors matched to the
background. Descendant icon wrappers and counts inherit that foreground; SVGs
use currentColor. Native handlers and aria state attributes are preserved.
Keyboard-focus outlines and disabled opacity/cursors are styled explicitly.
Resetting background or disabling Reader restores the native appearance.

The rules apply only to Reader and the known main-post action controls. Comment
actions, join/login buttons, media, and navigation outside that row retain their
styles. The action palette is independent of the selected reading-text color.

Regression coverage simulates both white-on-dark and black-on-light native
icons across every reading background, including nested count/icon colors,
selected/disabled states, hover/focus, reset, and cleanup. The installed-extension
test checks nested white labels become dark on Light Green in two post tabs.

All 20 Chrome fixture tests and all 21 Brave tests passed, with syntax and
whitespace checks passing too. Live Patreon confirmation remains pending.

### Paired Post Color — 1.3.0

One Post Color radio group replaces independent text/background controls. Default,
White, Sepia, Light Green, and Black apply matched text, surface, and action colors.
Swatches preview both text and background. Legacy backgrounds migrate to the
nearest preset; independent text overrides are discarded. New `postColor` values,
including an explicit default, take precedence over legacy fields. Saved settings
use only the new color field after the next change.

Coverage includes paired foregrounds, contrast, invalid values, legacy migration,
keyboard selection, reset/disable cleanup, and cross-tab installed-extension use.
All 21 Chrome fixture tests passed (the Brave-only installed test is skipped).
All 22 Brave tests passed, including the actual unpacked extension. Syntax and
whitespace checks passed; the rendered panel screenshot was inspected.
Live Patreon confirmation remains pending.

### Comment foreground and plain swatches — 1.3.1

The supplied HTML identifies parent `comment-row` containers as `role="button"`,
unlike their replies. The generic button-descendant exclusion incorrectly kept
all parent text in the site's original foreground. Comment rows are now exempt
from that exclusion; actual nested controls remain excluded. Author-name buttons
and their text receive surface ink explicitly. Default and disable remove these
overrides. Color swatches now show plain colors without Aa, retaining labels and
accessible radio names; Default retains its reset symbol.

Regression coverage models the clickable parent, non-clickable reply, author-name
buttons, explicit white descendants, unrelated controls, all presets, and cleanup.
All 22 Chrome fixture tests and all 23 Brave tests passed, including the unpacked
extension test in Brave. Syntax and whitespace checks passed. The updated panel
screenshot was inspected to confirm plain color swatches.
Live Patreon confirmation remains pending.

### Comment action contrast — 1.3.2

Like, Reply, and More buttons within `comment-actions` now use the surface ink,
including nested icon wrappers and counts. SVGs use currentColor. Hover, keyboard
focus, liked/expanded, and disabled states receive matching palette styles.
Comment rows keep their native layout; join/login controls, comment-entry forms,
and buttons outside the reading surface remain untouched. Default and disable
restore original styling. Native handlers and ARIA attributes are not replaced.

Regression tests cover white and black native icons, parent and reply actions,
every preset, nested SVG/count colors, focus/hover, selected/disabled states,
unrelated form controls, reset, and disable. All 24 Chrome fixture tests and all
25 Brave tests passed, including the installed-extension test in Brave. Syntax
and whitespace checks passed. Live Patreon confirmation is pending.

### Reply/More SVG-fill override — 1.3.3

Patreon's TextLink rule forces `fill: var(--TextLinkStyle-color) !important`
on SVGs in buttons without `hasIconColor`. Like has that class; Reply and More
do not. The 1.3.2 non-important fill override therefore lost to the native rule.
The fix adds `!important` only to comment-action SVG fill inside the active reading
surface. Text, layout, handlers, and other icons are unchanged by this fix.

The regression fixture now includes the actual TextLink class distinction and
competing important rule, with paths inheriting SVG fill as in the supplied HTML.
Both native-theme cases failed at Reply before the fix. Tests also check More's
expanded fill, reset/disable cleanup, and icons outside the reading surface.
After the fix, all 24 Chrome fixture tests and all 25 Brave tests passed; syntax
and whitespace checks passed. An isolated Chrome check using the supplied full
HTML and its linked public styles (with website scripts removed and browser
network requests blocked) confirmed all six rendered comment action icons have
the same computed fill as their button foreground. This is an offline snapshot
check, not validation of current live interactions.
Live Patreon confirmation remains pending.

### Dark preset label — 1.3.4

Renamed the Post Color option from Black to Dark. Its background (`#202124`),
foreground (`#f5f5f0`), interaction palette, and stored value are unchanged.
Existing saved selections therefore remain valid without migration. Reader and
installed-extension tests select the updated accessible radio name.
All 24 Chrome fixture tests and the focused unpacked-extension test in Brave
passed. The first Brave run selected Dark successfully but failed later while
re-enabling the Reader toggle; an unchanged rerun passed. That intermittent
toggle failure was not diagnosed or fixed as part of this label-only change.
Syntax and whitespace checks passed.

### Charcoal preset label — 1.3.5

Renamed Dark to Charcoal without changing the background (`#202124`), foreground
(`#f5f5f0`), interaction colors, or stored preferences. Updated the current README
and browser-test radio names; historical release notes retain their original labels.
All 24 Chrome fixture tests and the focused unpacked-extension test in Brave
passed. Syntax and whitespace checks passed.

### Membership banner background — 1.3.6

The nested `CTABanner` root inside `cta-banner-wrapper` now follows Post Color
when inside the active reading surface. Previously its paragraphs received the
new foreground while its card kept the native dark background. The background
rule targets the inner card, not its images, Join buttons, or layout properties.
The selector uses module/role prefixes instead of the captured generated hash.

A new test reproduced the unchanged dark background before the fix. It covers
every preset, desktop/mobile text, Join buttons, image dimensions, card layout,
unrelated banners, and Default/disable restoration. All 25 Chrome fixture tests
and all 26 Brave tests passed, including the unpacked-extension test in Brave.
Syntax and whitespace checks passed. Live Patreon confirmation remains pending.

### Membership banner separation — 1.3.7

Non-default Post Colors give the membership card a one-pixel shadow outline
using surface ink at 28% opacity and a soft black drop shadow. The outline is
light on Charcoal and dark on light presets. Using box-shadow avoids layout
changes. Default and disabling Reader restore the original shadow. Images,
Join buttons, and banners outside the reading surface remain untouched.

Coverage verifies the computed outline/shadow for all presets, unchanged card
dimensions and Join-button shadows, out-of-scope banners, and reset/disable.
All 25 Chrome fixture tests and all 26 Brave tests passed. A focused Chrome rerun
also passed after adding an existing native shadow to the fixture to verify its
restoration. Syntax and whitespace checks passed.
Live Patreon confirmation remains pending.

### Comment-entry colors — 1.3.8

The comment composer uses separate `comment-field-box`, `comment-field-with-affixes`,
and `comment-field` elements. Its wrappers kept the native background, while the
disabled textarea used native `-webkit-text-fill-color` and placeholder colors.
The supplied logged-out HTML nests this disabled field inside a login link.

Scoped rules now match the selected Post Color for wrapper backgrounds, textarea
text/fill/caret, placeholder, border, and focus outline. Disabled opacity and
attributes, login navigation, editor sizing, draft content, and error-border
styling remain native. An invalid field (`aria-invalid="true"`) is excluded from
the custom border/focus rules. Default/disable restores native colors.

Tests reproduce the background failure before the fix, then check all presets
with enabled/disabled fields, placeholder/fill, focus, opacity, login click handler,
draft retention, invalid borders, unrelated forms, and reset/disable cleanup.
All 27 Chrome fixture tests and all 28 Brave tests passed, including the unpacked
extension test in Brave. Syntax and whitespace checks passed. An isolated Chrome
check using the supplied full HTML and linked public styles confirmed Sepia
background, text fill, and placeholder colors while preserving the disabled
attribute, native 0.6 opacity, and enclosing login link. Website scripts were
removed and browser network requests blocked for that snapshot check.
Live Patreon confirmation remains pending.

### Inset comment-entry surface — 1.3.9

For non-default Post Colors, the two comment-field wrappers now blend the selected
page background with 8% black in sRGB. This creates a slightly darker input surface
on White, Sepia, Light Green, and Charcoal without changing text, borders, focus,
native disabled opacity, permissions, or editing behavior. Default and disabling
Reader restore the native background.

Enabled and disabled field tests sample the computed background through canvas,
verify its darker channels and matching wrappers for every preset, and check the
text/field pair retains at least 4.5:1 contrast before native disabled dimming.
Existing focus, login, draft, error-border, scope, and cleanup assertions remain.
All 27 Chrome fixture tests and all 28 Brave tests passed. The initial Brave
color assertions differed by one channel level during canvas readback; assertions
now allow that tolerance while still requiring darker channels and 4.5:1 contrast.
A focused Chrome rerun also passed after this adjustment. Syntax and whitespace
checks passed.
Live Patreon confirmation remains pending.

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
