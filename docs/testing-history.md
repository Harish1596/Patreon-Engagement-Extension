# Testing history

Dated verification records for the Patreon extension. These are historical
results, not claims that every browser or live-site variant is currently verified.
Use [TESTING.md](../TESTING.md) for current commands and the release checklist.

## Release 1.1.0 testing complete — confirmed October 25, 2026

The user confirmed that **all completed testing in this history applies to
Patreon Reader 1.1.0**, including live Patreon testing and the latest changes.
Release testing is complete. This supersedes earlier live-testing-pending or
unrecorded-confirmation notes in the checkpoint records below.

Earlier 1.1.x, 1.2.x, and 1.3.x labels identify intermediate development builds
and temporary release numbers within the work delivered as **1.1.0**; they are
not separate published releases. Those labels, commands, archive names,
automated results, failures, and retries are retained as contemporaneous evidence,
not rewritten as though every automated run used final 1.1.0 metadata.

This is a user-reported manual confirmation, not a new assistant-run browser
session. Individual execution dates, browser/OS versions, and scenarios were
not itemized. The completion confirmation does not add an unreported browser,
OS, or accessibility matrix, change the scope of synthetic tests, or claim store
approval. Chrome Web Store 1.0.0 remains the user-reported published baseline;
no upload or publication is recorded here.

That completion statement applies to the 1.1.0 work available at confirmation,
not the later 1.1.1 hotfix below. The user subsequently reported uploading
1.1.0 to the Chrome dashboard; publication/approval was not confirmed.

## Historical release and checkpoint records

### Hide-bar recovery hotfix — 1.1.1

The user reports the same recognized post URL works in one tab but shows the
floating engagement bar in a newly opened tab. The popup remains enabled,
toggling off/on restores hiding, and Reader settings persist across tabs,
reloads, and restarts. Normal synthetic fresh-tab startup preserved storage;
simulating removal of the root hide flag reproduced the visible bar even with
the saved preference still true. No live DOM capture proves what removed it.

`applyVisibility()` now writes only when flag presence differs from the desired
state. Every batched page update reconciles visibility even on the same URL.
A second observer watches only the root hide attribute and repairs it immediately,
without depending on animation frames or watching all page attributes. Saved
show preference and non-post routes still remove the flag. No new permissions,
storage keys, or selectors were introduced. Version fields advance to 1.1.1
because the user already uploaded 1.1.0; the earlier archive is retained.

- Before the fix, both new Chrome lost-flag tests failed (Reader on and off).
- After the fix: 33 Chrome cases passed; the installed-extension case skipped.
- Brave: all 34 cases passed, including actual extension storage and popup.
- Installed test now strips the flag during synthetic page loading and verifies
  fresh same-post tabs, attribute-only recovery, reloads, and both toggle states.
- Fixture tests also cover same-URL rerenders, zero redundant flag mutations,
  preserved Reader colors, unsupported routes, and saved preferences.
- All 15 tooling tests, syntax (23 JavaScript files), whitespace, and 1.1.1 ZIP
  packaging validation passed.
- Live user confirmation remains required; no upload or publication was performed.

### Reader icons and store artwork — 1.1.0, October 25, 2026

After the user's release-testing confirmation, replaced the eye-slash mark with
an original blue open-book/gold-bookmark icon. Added `icons/reader.svg`, updated
the popup/packaging reference, and regenerated runtime icons at 16/32/48/128px.
The 128px packaged/store icons use 96px artwork and 16px transparent padding.
Updated the 440×280 promo tile and added a 1400×560 marquee with current branding
and existing-feature copy only. Store PNGs are opaque RGB; no product screenshots
were fabricated. Added an offline SVG-to-PNG regeneration command and artwork guide.

- Initial generation caught a browser viewport-resize rendering artifact in the
  128px icon; the transparent-padding check stopped generation. Tooling then
  reported the expected missing store PNG. Fresh fixed-size pages and paint
  synchronization resolved the issue, and all seven PNGs generated successfully.
- All 15 tooling tests passed, including new dimensions/format/branding checks.
- All 4 targeted Brave popup/installed-extension tests passed, including the
  popup icon source and image-loading assertions.
- Syntax (23 JavaScript files), whitespace, and rebuilt 1.1.0 ZIP validation passed.
- Visually reviewed all final icons, both promo tiles, and the installed popup.
- Full browser suites and new live Patreon tests were not rerun for this
  branding-only change. No store upload or publication was performed.

### Release version corrected to 1.1.0 — October 25, 2026

The user confirmed the Chrome Web Store extension version is 1.0.0 and selected
1.1.0 for the next backward-compatible feature release. Updated all four release
version fields from the temporary local 1.2.0 value to 1.1.0. No runtime behavior,
permissions, or saved preferences changed. Earlier checkpoints retain their
original version labels; the temporary 1.2.0 package is superseded.

- Syntax, all 13 tooling tests, whitespace, and packaging validation passed.
- Generated `dist/patreon-reader-1.1.0.zip`; older local archives were retained.
- Browser suites were not rerun for this metadata-only change.
- The store version is user-reported, not independently checked in the dashboard.
  No upload or publication was performed.

### Release renumbering to 1.2.0 — October 25, 2026

At the user's request, changed the current manifest, package, and both root
lockfile version fields from 1.3.9 to 1.2.0. This is release renumbering, not
a rollback of features, settings, or compatibility. Earlier 1.2.0/1.3.x entries
retain their original development-checkpoint numbers and should not be treated
as a monotonic published-release sequence.

- Syntax checks, all 13 tooling tests, whitespace, and packaging validation passed.
- Generated `dist/patreon-reader-1.2.0.zip`; older local archives were retained.
- Browser suites were not rerun for this version-metadata-only change.
- Store upload eligibility remains unverified: the latest uploaded store version
  must be lower than 1.2.0. No store upload or publication was performed.

### Rename to Patreon Reader — October 25, 2026

Renamed the manifest display name, action tooltip, popup document title, README,
and privacy-policy identity to Patreon Reader. Local package metadata now uses
`patreon-reader`; release output is `dist/patreon-reader-1.3.9.zip`. Version,
permissions, storage keys, and repository URLs are unchanged. Earlier records
retain their historical names. No store listing was edited or published.

- All 13 tooling tests passed, including archive filename and manifest-name assertions.
- All 4 targeted Brave popup/installed-extension tests passed, including discovery
  by the new name and the popup title assertion.
- Syntax, whitespace, and new ZIP packaging validation passed.
- Full browser suites and new live Patreon verification were not performed for this rename.

### Creator byline avatar separation — October 25, 2026

The 17:54:09 screenshot shows a creator avatar blending into a White post
surface. Inspection of the original saved HTML established the CreatorByLine
avatar wrapper and inner Avatar container; the new screenshot's DOM was not
supplied. A non-default-color-only outline/drop shadow targets that container
under the marked reading surface, preserving native shape and dimensions.

- Chrome: 30 passed; the Brave-only installed test was skipped.
- Brave: all 31 passed, including the installed-extension test.
- Regression coverage includes every preset, square/round containers,
  Default/disable/re-enable restoration, and unchanged navigation/comment
  avatars, article images, and follow-button shadows.
- Initial Chrome run: the new test failed because computed color-mix shadows
  serialize as `color(srgb …)`, not `rgba(…)`. The assertion now compares against
  an independently computed expected shadow. Both full suites then passed.
- Syntax, whitespace, and rebuilt 1.3.9 ZIP validation passed.
- Live confirmation on the newly supplied creator's page remains unrecorded.

### Remove popup footer — October 25, 2026

Removed the "Runs locally on Patreon post pages" footer, its lock icon, and
unused styles. Popup width remains 320px; runtime preferences are unchanged.

- Targeted Chrome popup tests: 3 passed.
- Targeted Brave popup/installed-extension tests: 4 passed.
- Added footer-absence assertions; retained light/dark overflow checks.
- Syntax, whitespace, and rebuilt 1.3.9 ZIP validation passed.
- Full browser suites were not rerun; no new live Patreon evidence is claimed.

### Compact extension popup — October 25, 2026

Reduced the toolbar popup width from 360px to 320px without changing text sizes,
switch sizes, preferences, or the on-page Reader panel. Version remains 1.3.9.

- Chrome: 29 cases passed; the Brave-only installed test was skipped.
- Brave: all 30 cases passed, including the installed-extension case.
- New regression coverage checks light/dark modes, long status messages,
  overflow, text/switch separation, and Reader toggle operation at 320px.
- Syntax, whitespace, and rebuilt ZIP packaging validation passed.
- This is automated popup verification, not new live Patreon evidence.

### Swatch display order — October 25, 2026 (after live-testing confirmation)

Reversed only the non-default swatches: Default, Charcoal, Light Green, Sepia,
White. Shared palette definitions and legacy nearest-color migration retain
their original order. Saved values are unchanged; version remains 1.3.9.

- Chrome: 28 cases passed; the Brave-only installed test was skipped.
- Brave: all 29 cases passed, including the installed-extension case.
- Regression assertions cover exact swatch DOM order, arrow/Home/End navigation,
  persistence, and legacy color migration.
- Syntax and whitespace checks passed; the local 1.3.9 ZIP was rebuilt and
  passed packaging validation.
- Initial sandboxed attempts failed at browser launch before assertions;
  rerunning with browser-launch permission produced the passing results above.
- No new live Patreon verification is claimed for this subsequent change.

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


## Repository and tooling checkpoints

The following notes preserve the sequence of the layout, documentation, packaging,
and test-organization work. Earlier counts and deferred tasks are historical.

DOM adapter extraction: `extension/content/patreon-dom.js` now owns the existing
selectors/discovery and surface/action-row fallbacks, without changing their
logic. The manifest loads it before Reader; fixture loading reads script order
from the manifest instead of keeping another hard-coded list. Packaging explicitly
allowlists the new file. A direct adapter test supplements the existing detection,
appearance, and lifecycle coverage.
After extraction, 28 Chrome cases and all 29 Brave cases passed, including the
actual unpacked extension. All 11 Node tooling cases and syntax checks passed;
visibility and discovery functions were compared verbatim before/after extraction.

Local packaging tooling: `npm run test:tooling` runs Node tests independently of
Playwright. Eight packaging tests passed for exact contents, version mismatches,
missing/unsafe resources, corrupted/modified ZIPs, overwrite protection, and forced
rebuilds. See [release packaging](release-packaging.md). Playwright discovers
only `*.spec.js`; Node tooling tests use `*.test.cjs` under `tests/tooling/`.

Repository-layout update: unpacked extensions now load from `extension/`, and
the installed test opens `popup/popup.html`. Synthetic HTML is in `tests/fixtures/`;
shared setup/API mocks and control helpers are in `tests/helpers/reader.js`.
Runtime script order and test behavior are unchanged. Packaging automation and
browser-path portability changes are deliberately deferred to the next task.
That sentence records the earlier layout-only checkpoint; those tooling changes
are now implemented by the commands and configuration described below.
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


### Final structural-tooling verification

The DOM-adapter extraction passed 28 Chrome cases and all 29 Brave cases.
Thirteen Node tooling cases passed after extending archive checks to cover
CRC corruption, missing/duplicate entries, invalid numeric versions, and symlinks.
Syntax and whitespace checks passed. Browser tests ran on macOS; Windows/Linux
browser discovery paths were tested with injected candidates, not native OS runs.
Feature behavior/version stays 1.3.9. These checks do not establish new live-site
coverage.

The actual `npm run package -- --force` command rebuilt the ignored local 1.3.9
ZIP with the new directory layout and DOM adapter: exactly 16 allowlisted files,
manifest at ZIP root, archive integrity and snapshot-byte checks passed. A second
non-forced CLI invocation refused the existing archive and its SHA-256 remained
unchanged. The rebuilt ZIP replaces the earlier generated 1.3.9 artifact only;
no store release was published. Documentation checks passed for 46 local links
and anchors before the final guide/history links were added.

### Unreleased post export — October 29, 2026

Added an independent main-action Download control and local PDF, EPUB 3, and
Markdown generation for the currently rendered text/image post. Inline images
are embedded. Remote image bytes use an optional exact-origin permission request
and a packaged worker that accepts only HTTPS image requests from Patreon tabs,
omits credentials, rechecks redirect permission, rejects non-image responses,
and enforces per-image and combined size limits. Extraction excludes comments,
recommendations, membership UI, and page chrome; copied markup drops executable,
form, embed, event, class, ID, and inline-style data.

Five synthetic export cases passed for all three formats, embedded and remote
media, permission denial, scope, rerendering, and route cleanup. The complete
run passed 39 Chrome cases (one Brave-only installed case skipped), all 40 Brave
cases including the unpacked extension, 15 Node tooling cases, and syntax checks
for 27 JavaScript files. Packaging allowlists and validates the worker, exporter,
and packaged chooser resources. No package was built or published. Current-live Patreon media
hosts and permission prompts, manual PDF saving, EPUB-reader interoperability,
and non-text post types remain unverified.

The user's first live export attempt then exposed generated Patreon classes
`JRIMpq_postContent`, `_5kju5G_additionalStylesPostContentWrapper`, and
`JRIMpq_singleColumnPost`; Download mounted but the body lookup failed because it
still required readable CSS-module prefixes. Discovery and related surface CSS
now use the retained semantic suffixes under the existing same-card boundary.
A supplied-structure regression passes export, Reader typography, and outer
surface selection. The complete 40/41 Chrome/Brave results above include this
case. Post-fix confirmation on the affected live page remains pending.

The next user retest reached media permission handling and failed with
`Cannot read properties of undefined (reading 'request')`. Chrome does not expose
the permissions API in the content-script context used by the exporter. The
content script then sent the validated exact-origin set to the packaged background
worker, but the following live retest correctly exposed Chrome's additional rule:
`permissions.request` must execute in the direct user-gesture context, and a
message does not transfer that activation to the worker.

The format controls now live in a web-accessible but packaged extension-origin
frame. The trusted content script registers a random-token/exact-origin request
with the worker; the frame retrieves it before enabling controls and calls
`permissions.request` directly from the user's PDF/EPUB/Markdown click. The page
cannot supply arbitrary origins to the frame. The worker still rechecks granted
permission before media fetch. PDF now prints from a temporary same-tab iframe so
it does not need a popup after the cross-frame message. Fixture APIs deliberately
omit `permissions` from the content-script mock. Targeted chooser, grant/denial,
format, and live-structure checks pass; affected-page confirmation is pending.

The user's first successful PDF supplied October 29, 2026 confirmed that Chrome
added its native date/title header and source/page-count footer. A supplied dark
mode screenshot also showed the extension-origin chooser iframe as a black
rectangle inside the charcoal panel. The PDF print page now uses zero `@page`
margins with an inner 18 mm content wrapper and adds ordered creator, download-time,
and source metadata. A subsequent refinement moves that block above the title and
labels its fields “Creator,” “Download time,” and “Source.” The chooser document now paints white/charcoal backgrounds
matching the parent panel. Synthetic PDF checks verify metadata order, clean
source URL, and the zero-margin print rule; live re-export confirmation is pending.

The visible Creator, Download time, and Source block was subsequently applied to
EPUB XHTML and Markdown above their titles. EPUB OPF metadata also records creator
and source. Synthetic EPUB and Markdown checks verify the fields, ordering, clean
source URL, and exclusion of surrounding Patreon UI.

A later installed-browser report showed format buttons reacting without starting
an export after Reader customization. The packaged chooser had used DOM
`postMessage`, which reaches the page's main world but not the extension's isolated
content-script world; main-world fixture injection had masked that boundary. The
chooser now sends its validated token and format to the worker with extension
runtime messaging, and the worker delivers it to the originating tab with
`tabs.sendMessage`. Reopening Download also clears the old chooser immediately so
a fast click cannot reuse its expired token. The targeted five Chrome export
cases passed, and a real unpacked-Brave regression passed after changing Reader
font and color and downloading Markdown. This is installed-extension evidence
against synthetic Patreon HTML, not confirmation on the user's live post. Final
verification after the bridge change passed 39 Chrome cases with the Brave-only
case skipped, all 40 Brave cases, all 15 tooling tests, and syntax checks for 27
JavaScript files.

The next live retest showed that a successful download left all three format
buttons disabled until the panel was closed. The exporter tried to reset the
chooser by assigning its existing URL, which Chrome did not treat as a new
navigation, so the chooser's local busy state survived. Each completion now loads
a uniquely addressed chooser instance with the same validated request token. An
unpacked-Brave regression confirms Markdown followed by EPUB can be downloaded
from one continuously open panel.

Export filenames were then standardized on the displayed post title. EPUB and
Markdown already used a filesystem-safe title stem; PDF now applies that same
stem to the print document and temporarily to the Patreon tab while invoking
Chrome's print UI, then restores the original tab title. The PDF fixture verifies
illegal filename characters are removed, the title is present at print time, and
the existing tab title is restored.

### Separate-file collection export — October 31, 2026

Added the first collection-export mode for `/collection/{identifier}` pages.
EPUB and Markdown produce a collection-named ZIP containing one numbered file per
accessible text post in rendered link order. Same-origin post URLs are deduplicated;
the worker reuses registered post tabs without requesting broad tab-history access,
or creates and later closes temporary Patreon tabs. Exact media-origin permission
is collected during preflight and requested from the packaged chooser's direct
format-button gesture. PDF and combined-document collection output remain deferred.

Verification passed 41 Chrome cases with the Brave-only installed test skipped,
all 42 Brave cases, all 15 tooling tests, and syntax checks for 30 JavaScript files.
The installed test uses two already-open intercepted synthetic post pages because
Playwright does not intercept extension-created tab navigation. No live collection
page or current pagination/lazy-loading behavior was verified; only links rendered
inside the collection page's main region are established by this checkpoint.

The user's first live collection attempt then reported “No post links were found
in this collection.” An October 31 screenshot and sanitized structural captures
showed why: live collection cards use direct `/posts/<numeric-id>` links rather
than creator-prefixed post routes. The page displayed 74 posts but initially
rendered 20 `a[class*="_gridCard"]` elements followed by a
`[class*="_loadMoreContainer"]` button. Discovery now scopes itself to those grid
cards, accepts direct numeric post routes throughout routing and worker validation,
and exhausts Load more before preflight. A sanitized regression adds cards through
that control and excludes a non-card post link. A separate detection case covers
Reader and Download on direct numeric post URLs. Post-fix live confirmation is
pending.

The initial worker lifecycle created a new temporary tab for every unopened post
during preflight and again during packaging. After the user reported that the
resulting tab churn was disruptive, the worker was changed to keep one inactive,
session-owned tab and navigate it sequentially through every unopened post. The
same worker survives from preflight through the selected build and is closed on
completion, cancellation, failure, expiry detection, or collection-tab closure.
Already-open matching user tabs remain reusable and are never navigated. A Node
background-worker regression verifies three unopened posts use one created tab,
navigate it for both phases, and close it once after the build.

Live testing then showed preparation advancing by exactly one 20-card batch each
time the collection dialog opened. Discovery had treated Patreon's transiently
disabled Load more control as the end of pagination immediately after detecting
new cards. It now waits for the control to be re-enabled and continues clicking
until the control remains absent; a timeout is an explicit error rather than a
partial export. The collection fixture reproduces a delayed re-enable across two
batches and verifies that all three synthetic post links are prepared in one run.

The user then supplied the same-origin request and a response generated by Load
more. It establishes `/api/posts` filtered by campaign and collection, collection
ordering, 20 post resources in the page, a reported total of 74, and a next cursor.
Collection discovery now retains matching request URLs in memory from document
start, validates the origin, path, collection and campaign filters, removes the
starting cursor, and follows validated next pages. It requires a stable total and
an exact unique-post count before preflight. An unavailable or changed private
response falls back to the tested Load more path. A new synthetic two-page API
case verifies three ordered IDs are prepared without clicking the page control;
the raw supplied response and its content-specific IDs/cursor are not committed.

The collection trigger and dialog heading were subsequently changed from
“Download collection” to “Download Collection.” Three focused Chrome collection
cases, the installed-extension Brave case, and syntax checks for 31 JavaScript
files passed; this wording-only change adds no new Patreon markup claim.

The first live 74-entry EPUB collection ZIP was rejected by macOS Archive Utility.
Metadata-only inspection found a complete 2.4 MB ZIP whose 74 entries passed
Info-ZIP verification and macOS `ditto` extraction, ruling out truncation and ZIP32
overflow. The shared writer had nevertheless labeled the outer collection archive
as `application/epub+zip` and emitted invalid all-zero DOS dates. Collection ZIPs
now use `application/zip`, while shared entries receive one valid timestamp and
EPUB payloads retain their required MIME type. The focused browser regression now
checks the MIME selection, nonzero date, Info-ZIP validation, and macOS `ditto`
extraction without committing or reading the supplied post contents.

The user then requested that no completed collection worker remain open. Although
the build worker already closed, the automatic post-download session refresh had
prepared and retained a replacement worker for another format choice. Preparation
now closes its single reusable worker before registering the session; a later build
creates one fresh worker and closes it during the existing terminal cleanup. The
tooling regression verifies three unopened posts use one created/navigated/closed
tab during preflight and one during generation, with no worker retained between
phases or after completion.

### Chunked collection transfer — November 1, 2026

Live EPUB and Markdown attempts then failed with Chrome/Brave's “Message exceeded
maximum allowed size of 64MiB” error. Each post returned its complete encoded file
in one tab message, and the background later returned every completed file in one
collection message. EPUB Base64 and Markdown inline-image data amplified those
aggregate JSON payloads before ZIP assembly.

Both boundaries now exchange metadata first and pull file data in at most 1 MiB
character chunks. Post transfers are released after the background reconstructs
them; collection-file data is released after its final chunk; successful completion
or any cancellation discards the session. The collection page constructs the ZIP
only after reconstructing each declared file length. A tooling regression uses a
synthetic file larger than two chunks and checks chunk bounds, metadata-only build
responses, exact reconstruction, finalization, and worker cleanup. The full final
matrix passed 43 Chrome cases plus one expected skip, all 44 Brave cases, all 16
tooling tests, and syntax checks for 31 JavaScript files. Live post-fix confirmation
remains pending.

### Outer ZIP deflate compatibility — November 1, 2026

A second live EPUB collection download still produced an unsupported-format report.
Metadata-only inspection found a complete 76 MB archive with 74 entries, valid
timestamps, correct central-directory offsets, and successful Info-ZIP and macOS
`ditto` extraction. All 74 nested EPUB containers also passed ZIP validation. The
remaining distinction from a canonical repack was the outer method-0 storage
framing: macOS classified the live download as generic data, while a method-8
deflate repack was recognized as ZIP data.

The shared writer now optionally wraps outer collection entries in standards-
compliant raw-DEFLATE stored blocks and records method 8 with separate compressed
and uncompressed sizes. This adds framing only; it does not recompress or alter
the nested EPUB bytes, and individual EPUB construction continues using stored
entries so its first `mimetype` entry remains specification-compliant. The focused
test uses a synthetic entry spanning multiple stored DEFLATE blocks, asserts method
8, and passes Info-ZIP plus macOS `ditto`; the full final matrix
passed 43 Chrome cases plus one expected skip, all 44 Brave cases, all 16 tooling
tests, and syntax checks for 31 JavaScript files. Live post-fix Archive Utility
confirmation remains pending.

### Download progress feedback — November 1, 2026

Post preparation and multi-stage collection export previously relied only on
changing status text, leaving long media fetches and large collections without a
persistent visual activity indicator. The post dialog now exposes an accessible
indeterminate progress bar while registering download options and preparing text
and images. The collection dialog covers discovery, preparation, generation,
page-side chunk receipt, and ZIP packaging; preparation, generation, and receipt
use completed-post counts, while stages without a reliable total remain
indeterminate. Completion and errors hide the bar and preserve the status result.

The background worker sends owner-tab-only progress messages before and after
each prepared or generated post. Tests verify the three-post `0, 1, 2, 3`
sequences, visible post progress during a delayed remote image request, and the
collection bar's discovery-to-ready lifecycle. A yield originally placed before
the synthetic ZIP download was removed because it could discard Chromium's
transient user activation and block the download. The final matrix passed 43
Chrome cases plus one expected skip, all 44 Brave cases, all 16 tooling tests,
and syntax checks for 31 JavaScript files. No new live Patreon markup observation
is claimed by this change.

### Archive Utility root-cause investigation — November 1, 2026

The user reports that the newest outer ZIP still fails in Archive Utility. The
newest local download has 74 entries and 76,144,838 bytes. Outer directory offsets,
declared lengths, decompression, and CRCs pass, as do the nested EPUB ZIP entries;
macOS nevertheless classifies it as generic data. Earlier Info-ZIP/ditto success
was insufficient to establish Archive Utility compatibility, and the previous
method-8 fix did not resolve the actual trigger.

Large synthetic EPUBs created with the current writer reproduce generic-data
classification for both method 0 and method 8 with stored DEFLATE blocks. The
local macOS generic ZIP magic rule excludes an early `application/epub+zip`
marker, which appears at offset 118 in the newest outer archive. Stored blocks
preserve that nested marker verbatim. Actual raw-DEFLATE compression, a longer
first filename moving the marker beyond the scan window, and a same-size marker
substitution each restore ZIP classification. Markdown controls lack this marker
and are recognized. The actual-compression synthetic control also extracts through
Archive Utility. A stored-block control produced no output; direct GUI error-text
inspection was unavailable because assistive access was not granted.

Separate aggregate inspection establishes that all three local collection ZIPs
contain 74 copies of one post title/source/body, with distinct metadata making
the complete EPUB hashes differ. Code inspection identifies the unchecked worker
transition: `tabs.update` is followed immediately by messaging, and any successful
old-document response is accepted without comparing the requested post identity.
The background unit fixture switches URLs immediately and the installed-browser
case reuses already-open posts, leaving this navigation race untested.

This checkpoint records diagnosis only. No runtime fix was applied. Tests and
fixtures remained outside the repository; no account payload, post text, private
URLs, or original archive was committed. Current commands/results and evidence
limits are recorded in TESTING.md.

### Collection compression and post identity fixes — November 1, 2026

The outer collection ZIP now uses real browser DEFLATE compression instead of
uncompressed stored blocks. The shared ZIP writer records compressed and original
lengths; individual EPUB containers remain stored ZIPs with their required first
`mimetype` entry. Compression runs asynchronously during the packaging progress
stage. A browser regression downloads a compressed ZIP containing a synthetic
1.2 MB EPUB, independently inflates its bytes, verifies its nested structure and
contents, and passes Info-ZIP, macOS format detection, and `ditto` extraction.
Archive Utility also extracted this browser-generated ZIP, and `cmp` confirmed
the extracted EPUB exactly matches the independent extraction.

Preflight and build requests now carry the requested numeric post ID. Content
scripts require that ID to match both the immutable initial document identity
and current URL and require a completed document. They verify identity again
after asynchronous media preparation, before publishing a file transfer. The
background independently checks returned IDs and retries successful responses
from the old page. A stale registered tab falls back to the navigation worker.

The delayed-navigation worker regression supplies two old-document responses at
each transition during preparation and generation, verifies eight rejected stale
replies, distinct output titles and matching transferred bodies, and checks worker
cleanup. A browser test rejects incorrect IDs and a new SPA URL still showing the
previous document. The final matrix passed 45 Chrome tests plus one expected skip,
all 46 Brave tests, all 17 tooling tests, and syntax checks for 32 JavaScript files.
The Brave installed-extension case includes distinct post contents in a real
compressed collection download. Current authenticated Patreon collection export
remains pending user confirmation; the older repeated-post archives must be
downloaded again after reloading the extension and page.

### Explicit locked collection skipping — November 1, 2026

The user's collection increased to 75 posts and preparation reported 74 ready
with one generic unavailable/unsupported skip. Read-only inspection in the user's
signed-in Brave tab confirmed four API pages, 74 accessible posts, and one post
with `attributes.current_user_can_view === false`.

Discovery now requests that flag on every page and filters explicit false values
before sending URLs to the worker. The unique total still includes locked posts
for pagination validation and the existing safety bound. Locked counts are
deduplicated and reported separately; absent or nonboolean flags preserve normal
preparation. An all-locked result shows a membership message without preparing
worker tabs or enabling export. The DOM fallback retains its existing generic
preparation checks because no new locked-page selector was established.

All six Chrome collection tests and all seven targeted Brave collection/installed
tests passed, along with syntax checks for 32 JavaScript files. Fixtures cover
locked posts across cursor pages, duplicate locked entries, unknown flags, full
totals, exclusion from worker requests, and entirely locked single/multiple-post
collections. The updated discovery function was also executed read-only in the
live Brave tab and returned 74 accessible URLs and one locked skip. This confirms
live discovery only; full installed export after reloading remains pending. No
private page payload, post content, or account identifiers were committed.

### Reuse collection discovery and preparation — November 1, 2026

Opening the panel always repeated discovery/preflight, and every successful
download discarded its session and immediately repeated both phases. Discovery
results now remain in page memory for 15 minutes. Prepared post metadata is kept
in the background for 15 minutes after preparation/generation. Panel close no
longer cancels an idle prepared session. Successful finalization releases file
transfers while preserving preparation, so another format can be selected without
rediscovery or preflight. Generation still reads each post and its images, and
all active worker tabs close at the existing phase boundaries.

Refresh collection explicitly invalidates both caches to pick up new chapters
and changed access. Expiry refreshes on opening; lost worker state reruns only
preflight using the cached links. Collection navigation/reload clears page cache
state. A repeat-download test exposed a race caused by navigating the chooser
through `about:blank` immediately before reloading it with cached data; reuse now
refreshes the chooser directly.

All seven targeted Chrome collection cases, eight targeted Brave collection/
installed cases, 17 tooling tests, and syntax checks for 32 JavaScript files
passed. The new browser lifecycle case verifies one discovery/preflight across
panel reopen and two format download actions, then checks refresh, lost sessions,
expiry, and route invalidation. The worker regression verifies transfer release,
repeat build without preflight, cancellation, and worker closure. This checkpoint
uses synthetic pages; authenticated live cache reuse remains pending after reload.
The installed Brave case additionally verifies real consecutive Markdown and EPUB
downloads with correct distinct chapter content using the same prepared session.

### Two-hour collection cache — November 1, 2026

Increased both page discovery and background prepared-session lifetimes from
15 minutes to two hours at the user's request. Existing refresh, navigation,
reload, transfer release, and worker-restart behavior is retained. The focused
Chrome and Brave cache lifecycle tests passed with simulated reuse at 119 minutes
and expiry beyond two hours. Background tests independently check preparation
survives 119 minutes and expires after 121 minutes. All 17 tooling tests and
syntax checks for 32 JavaScript files passed. No live two-hour waiting test or
full browser-suite rerun was performed for this duration adjustment.

### Keep collection operations in the background — November 1, 2026

The user reported being repeatedly returned to the collection after selecting
another browser tab during preparation and downloads. The worker's short readiness
fallback explicitly activated the worker and then the owner collection tab after
eight failed replies, regardless of which tab the user had selected.

Removed that activation fallback. Newly created/navigated workers remain inactive,
and requests use the existing 60-attempt, 250 ms readiness/identity retry loop.
Existing preflight skip and generation failure handling applies at timeout, with
no focus change. Tests reproduce navigation remaining stale beyond the previous
threshold and a complete timeout, covering preparation, generation, and cleanup.
Both new regressions failed before the fix and pass afterward. All 19 tooling
tests, syntax checks for 32 JavaScript files, and the installed Brave regression
with collection Markdown followed by EPUB passed. Current live Patreon loading
while another tab remains selected still needs user confirmation.

### Restore collection sessions after worker suspension — November 1, 2026

The user reported format buttons appearing to do nothing after the prepared
panel sat idle. The two-hour expiration did not preserve the background Map when
the extension service worker stopped. A click woke a new worker without that
session, and the chooser attempted to report the error through the same missing
session, so no status reached the owner panel.

Prepared metadata now uses browser `storage.session`, with a versioned record
per token. Startup restores valid records before handling collection messages and
prunes expired/invalid entries. Preparation and generation await saving metadata;
file bytes, post bodies, and signed image URLs remain transient. Cancellation and
owner-tab closure remove saved records, including closure during restoration.
Restored sessions enforce the owner-tab binding without letting another tab
invalidate the owner's record.

The chooser reports errors directly to its parent, which authenticates the
extension origin, current frame, and active token. This removes reliance on a
missing session for error reporting while preserving gesture-bound permission
requests. Missing or expired sessions now show the existing reopen instruction.

All eight targeted Chrome collection cases, nine targeted Brave collection/
installed cases, 24 tooling tests, and syntax checks for 33 JavaScript files
passed. The installed Brave case explicitly closes the worker target before
Markdown and again before EPUB, then verifies correct distinct chapter contents.
It also cancels a session while the chooser stays open and verifies a visible
expired-session error. VM tests cover restoration without new preflight, metadata
boundaries, ownership, expiry, cancellation, and tab-close cleanup. The initial
Chrome Markdown download timed out once; the isolated and full targeted reruns
passed. Tests use synthetic Patreon responses, so a natural idle timeout on the
authenticated live collection remains pending user confirmation.
