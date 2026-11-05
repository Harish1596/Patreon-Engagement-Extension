# Testing history

Dated verification records for the Patreon extension. These are historical
results, not claims that every browser or live-site variant is currently verified.
Use [TESTING.md](../TESTING.md) for current commands and the release checklist.

## November 5, 2026 — Popup product identity and page status

The toolbar popup now leads with Patreon Reader, a version badge read from the
runtime manifest, and “Reading comfort. Offline access.” Reading preferences,
Page status and Community have separate labelled sections. Existing toggles and
branded community links remain; a short hint directs downloads to Patreon pages.
The popup consumes the existing collection-download mounted flag rather than
changing page integration. A disconnected tab with an exposed Patreon HTTPS URL
gets a refresh instruction; other tabs, including those whose URL the browser
withholds, get the open-post-or-collection instruction. No permissions were added.

Validation:

- Two new callback/promise API regressions failed on the old heading before the
  implementation, then passed with manifest-derived version and contextual status.
- `npm test -- tests/popup.spec.js tests/ui-readability.spec.js --workers=2 --output=/tmp/popup-header-final-results`:
  **13 passed**, including persistent independent toggles, save failures, keyboard
  community links, 320px bounds and dynamic badge layout in light/dark themes.
- `npm run test:brave -- tests/popup.spec.js tests/ui-readability.spec.js --output=/tmp/popup-header-brave-results`:
  **13 passed**. This run preceded the final additional badge geometry assertion;
  the same runtime implementation was used in both runs.
- `npm run check`: **90 JavaScript files**; `git diff --check` is clean.
- Browser plugin not available; a separate Playwright Chrome capture loaded only
  popup CSS/JS and mocked extension APIs, avoiding Patreon fixture styles. Both
  themes fit 320 × 508px, with the real icon loaded, no horizontal overflow,
  working Reader toggle and no page errors. 200% zoom also has no horizontal
  overflow. Screenshots are outside the repository under `/tmp/popup-header-*`.

The supplied Return YouTube Dislike screenshot informed identity/version hierarchy;
its account, premium and donation features were not added. This refines the existing
popup rather than introducing a new surface. No new live Patreon or signed-in
browser data was inspected; native browser-popup placement remains user-verifiable.

## November 5, 2026 — Support button colors

Discord now uses blurple (#5865f2) and GitHub uses charcoal (#24292f), with
white labels/logos, darker hover fills and a visible GitHub border in both themes.
Empty/invalid destinations retain the existing neutral disabled appearance.

`npm run check` passes for **90 JavaScript files**;
`node --test tests/tooling/package.test.cjs` passes **11 tests**;
`git diff --check` passes. Browser plugin not available; regular Playwright used.
`npm test -- tests/popup.spec.js --grep 'community links' --max-failures=1`
again aborts at Chrome launch (SIGABRT/kill EPERM) before the case runs. Rendered
brand colors, hover/focus and light/dark appearance remain unverified.

## November 5, 2026 — Compact Support buttons

Added a Support heading beneath Reader Customization. Renamed the two links to
Discord and GitHub with local inline brand marks (Simple Icons, CC0), hidden from
accessible names. Button dimensions change from approximately 137 × 40 px to
103 × 30 px, retaining readable text, theme colors and keyboard focus styling.
Configured destinations and new-tab behavior are unchanged.

`npm run check` passes for **90 JavaScript files**;
`node --test tests/tooling/package.test.cjs` passes **11 tests**;
`npm run package -- --force` validates the ZIP; `git diff --check` passes.
A temporary jsdom smoke check confirms the Support heading, navigation label,
link labels and decorative SVG markup. The UI detector reported only the existing
Inter font warning. Browser plugin not available; regular Playwright was used.
`npm test -- tests/popup.spec.js --grep 'community links' --max-failures=1`
failed at Chrome launch (SIGABRT/kill EPERM) before the single case ran. Updated
light/dark size, logo, focus and new-tab assertions remain unexecuted; no rendered
screenshot or live destination verification is claimed.

## November 5, 2026 — Cuneiform PDF fallback

The reported U+1202D (𒀭, CUNEIFORM SIGN AN) is outside the primary Noto Sans
coverage. A real-renderer regression reproduced the failure before the fix. PDFs
now select a bundled Noto Sans Cuneiform face for supported text runs while keeping
Latin and extended Latin in the primary family. Text is preserved, including
metadata, contents entries, headings and internal/external links. The fallback has
one regular face, used for all four style aliases; surrounding Latin keeps its
bold/italic styling. Font input hashes and the upstream OFL notice are committed
under `scripts/pdf-fonts/noto-sans-cuneiform/`; rendering makes no font requests.

Final checks:

- `npm test -- --workers=2 --output=/tmp/pdf-cuneiform-chrome-results`:
  **154 passed, 2 Brave-only cases skipped**.
- `npm run test:brave -- tests/pdf.spec.js tests/collection-pdf.spec.js tests/installed-pdf.spec.js --output=/tmp/pdf-cuneiform-brave-results`:
  **12 passed**, including real installed post, combined collection and PDF ZIP
  downloads plus the larger 75-chapter runtime bridge with mixed-script text.
- `npm run test:tooling`: **139 passed**; `npm run check`: **89 JavaScript files**.
- `npm run package -- --force` validates the extension archive. Offline vendor
  regeneration reproduces all five renderer/font/coverage/license/README artifacts
  exactly; `git diff --check` is clean.

Independent PDF.js extraction checks mixed Latin, Ḫ and 𒀭, metadata and links;
a rasterized sample was visually inspected for actual glyph rendering. A separate
regression bounds fallback expansion to 100,000 font runs per PDF before layout.
Unsupported Unicode still fails explicitly. SVG text retains primary-font coverage
validation because its contents are not rewritten with document-text fallback.
This adds tested Cuneiform coverage, not universal Unicode support. Existing PDF
byte/image/time budgets and cache/access rules are retained. No private collection
or new live Patreon DOM was inspected; the user's collection needs live confirmation.

## November 5, 2026 — Checked-in popup link configuration

Replaced environment-based generation with tracked `extension/popup/links.js`.
Both URL fields are intentionally empty for the maintainer to fill in. Edit the
public HTTPS URLs and reload the extension; packaging includes this file directly.
The generation script, npm command and generation-specific tests were removed.
Local `.env` files are untouched and are no longer read for community links.

Checks: `node --test tests/tooling/package.test.cjs` passes **11 tests**, including
an edited-config snapshot with an ignored dotenv value. `npm run check` passes
for **90 JavaScript files**; `npm run package -- --force` validates the ZIP;
`git diff --check` passes. Popup behavior and layout code did not change in this
follow-up. Browser tests were not rerun; the preceding Chrome launch blocker and
unverified rendered/new-tab behavior still apply.

## November 5, 2026 — Popup community links

Added Join Discord and View on GitHub below Reader Customization. Public HTTPS
URLs are generated from DISCORD_INVITE_LINK and GITHUB_REPO_LINK; only those two
values enter the ignored popup configuration and allowlisted ZIP. Unconfigured
links stay disabled. No extension permissions or Patreon page integration changed.

Checks on the current feat/download base:

- `node --test tests/tooling/popup-links.test.cjs tests/tooling/package.test.cjs`:
  **12 passed**, including environment precedence, exclusion of unrelated values,
  unsafe URL rejection, and archive validation.
- `npm run check`: **92 JavaScript files**; `git diff --check`: passed.
- `npm run package -- --force`: validated ZIP, including generated public URLs.
- Temporary jsdom smoke check: generated URLs initialize both anchors with new-tab
  targets and noopener/noreferrer; missing configuration leaves both disabled.
- Browser plugin not available. `npm test -- tests/popup.spec.js --max-failures=1`
  collected five cases, then Chrome aborted at launch with SIGABRT/kill EPERM
  before any test body ran; four cases did not run. Light/dark rendering, keyboard
  navigation and actual new-tab behavior remain unverified. No live Discord,
  GitHub or authenticated Patreon requests were made.

For source installs, run `npm run configure-links` after changing `.env` and reload
`extension/`. See README for `--env-file` and packaging configuration behavior.

## November 5, 2026 — Extended Latin PDF font coverage

A reported Single PDF failed at U+1E2A (Ḫ). Inspection with fontkit confirmed that
all four bundled Roboto faces lack U+1E2A, its lowercase form, combining U+032E
and related extended Latin glyphs. A real-renderer regression reproduced that
exact error before the change. PDFs now use locally bundled Noto Sans as their
primary family; original Roboto assets remain for compatibility. No characters
are stripped or transliterated. Glyph validation remains enabled against coverage
shared by all four primary faces, and unsupported emoji still fails explicitly.

Final checks:

- `npm test -- --workers=2 --output=/tmp/pdf-font-chrome-results`:
  **153 passed, 2 Brave-only cases skipped**.
- `npm run test:brave -- tests/pdf.spec.js tests/collection-pdf.spec.js tests/installed-pdf.spec.js --output=/tmp/pdf-font-brave-final-results`:
  **11 passed**, including exact diacritics in real post PDFs, combined collections
  and every PDF ZIP entry, plus the larger 75-chapter runtime bridge.
- `npm run test:tooling`: **136 passed**; `npm run check`: **89 JavaScript files**;
  `npm run package -- --force` validates the archive including the font license;
  `git diff --check` is clean.
- Re-running `node scripts/vendor-pdf.js` reproduces the same renderer, VFS,
  coverage, license and generated README hashes without network access.

PDF.js extraction verifies U+1E2A/U+1E2B, related accented Latin, metadata and
regular/bold/italic/bold-italic output. A decomposed H + U+032E is compared after
NFC normalization in the test only; runtime text is unchanged. The installed HTML
fixture now explicitly declares UTF-8: its initial new Unicode text was decoded
as mojibake without that header, independently of font rendering.

Four unmodified static TTFs, the upstream OFL license and provenance hashes are
committed under `scripts/pdf-fonts/noto-sans/`, pinned to the official repository
commit recorded in `source.json`. Rebuilds verify those input hashes. Only the VFS
and license are shipped in the extension, avoiding duplicate raw font files in
its package. This broadens tested Latin/Greek/Cyrillic coverage, not all Unicode.
The user's private collection still needs live confirmation. PDF limits (48/40 MiB),
image budgets, cache lifetime, permissions and local/offline processing are retained.

## November 5, 2026 — Increased PDF input/output limits

PDF input now allows **48 MiB** of serialized data and output allows **40 MiB**.
The previous limits were 24/32 MiB. Reported limits come from the shared constants
across source validation, collection assembly and rendering. The 512 MiB source
cache remains a disk budget; it is not the renderer's RAM/input allowance. The
runtime still sends JSON input and base64 output, so the new caps leave transport
headroom. Image/pixel guards, concurrency, timeouts and cleanup remain unchanged.

Final checks:

- `npm test -- --workers=2 --output=/tmp/pdf-limit-chrome-results`:
  **152 passed, 2 Brave-only cases skipped**.
- `npm run test:brave -- tests/installed-pdf.spec.js tests/collection-pdf.spec.js tests/pdf.spec.js --output=/tmp/pdf-limit-brave-results`:
  **10 passed**, including the actual installed extension runtime bridge with
  >24 MiB input, native PDF saves, combined/ZIP output, retry and cancellation.
- `npm run test:tooling`: **135 passed**; `npm run check`: **89 JavaScript files**;
  `npm run package -- --force` validates the extension; `git diff --check` is clean.

Four new regressions failed under the old caps: accepting >24 MiB input, rendering
75 image chapters, forwarding larger input and accepting a 33 MiB output response.
After the increase all pass. Boundary tests retain rejection of 49 MiB ASCII,
UTF-8 data exceeding 48 MiB and output above 40 MiB. The synthetic output response
checks transport size validation; it is not treated as a valid rendered PDF.

The deterministic 75-chapter fixture has **33,635,356 input bytes**, producing
**21,851,024 output bytes and 78 pages**. Independent PDF.js checks confirm all
75 chapter bodies in order; the contents spans multiple pages. Installed Brave
runs the same >24 MiB fixture through background/offscreen messaging and checks
its returned PDF bytes and offscreen disposal. Fixture code is shared, generated
locally and contains no private collection data. This is functional validation,
not a peak-memory measurement or a guarantee that every 75-post collection fits.
The user's offered collection still requires testing; no live private posts were
fetched. Earlier dated 24/32 MiB statements remain historical evidence.

## November 5, 2026 — Oldest-first collection reading order

The user chose oldest-to-newest downloads. Previously API and DOM encounter order
was preserved, so a newest-first collection became a newest-first file/book. The
controller now orders the complete accessible list before caching/preparation and
batching. Complete publication timestamps determine chronology; missing/invalid
dates use numeric post IDs for the whole list as a deterministic approximation.
Timestamp ties also use numeric IDs without floating-point conversion. Publication
metadata is requested through the existing collection API, not extra post visits.

Final checks:

- `npm test -- --workers=2 --output=/tmp/collection-order-chrome-results`:
  **152 passed, 2 Brave-only cases skipped**.
- `npm run test:brave -- tests/collection-order.spec.js tests/collection-cache.spec.js tests/installed.spec.js tests/installed-pdf.spec.js --output=/tmp/collection-order-brave-results`:
  **14 passed**.
- `npm run test:tooling`: **131 passed**; `npm run check`: **88 JavaScript files**;
  `npm run package -- --force` validates the extension; `git diff --check` is clean.

Two API regressions failed before the fix because the requested post URLs stayed
newest-first. All ten new ordering cases pass. They parse actual EPUB/Markdown/PDF
outputs across single and ZIP modes; multi-page fixtures include duplicates and a
locked post, and deliberately publish IDs out of numeric order. Body data is keyed
by post URL, so output assertions cannot pass merely from fixed fixture indexes.
Cases also cover cached format changes without another discovery, missing/invalid
dates, timezone-equivalent timestamp ties, IDs beyond Number's safe integer range,
DOM fallback and a reversed 101-post collection split into two numbered parts.

Worker storage tests retain caller-order validation: chronological policy belongs
to discovery, while workers preserve the supplied sequence. The two-hour cache
policy, retry behavior, memberships/origins, storage budgets and writers are retained.
Native Brave verifies saving and worker-restart cache reuse through the installed
extension fixture. This task used sanitized fixtures, not a new live collection
inspection. Exact publication chronology cannot be guaranteed when dates are absent;
the numeric-ID fallback is explicitly approximate. The old page/display-order policy
in earlier dated checkpoints is superseded by this user-directed reading order.

## November 5, 2026 — Remove manual collection refresh

Refresh Collection is removed from the page panel. Download is the sole trigger
for discovery/post retrieval, reusing valid metadata and shared cached sources.
The existing fixed two-hour expiry and cleanup policy are retained. Missing or
expired data is fetched by the next selected download; expiry alone performs no
eager requests. An empty recovery footer now collapses, while Cancel, Retry and
Start again remain available in their existing states. Obsolete refresh override
branches, button styles and user-facing refresh instructions were removed.

Final checks:

- `npm test -- --workers=2 --output=/tmp/collection-no-refresh-chrome-results`:
  **142 passed, 2 Brave-only cases skipped**.
- `npm run test:brave -- tests/collection-menu.spec.js tests/collection-controls.spec.js tests/collection-cache.spec.js tests/installed.spec.js tests/installed-pdf.spec.js --output=/tmp/collection-no-refresh-brave-results`:
  **17 passed**, including native EPUB/Markdown/PDF output, cache reuse after worker
  restarts, completion and cleanup.
- `npm run test:tooling`: **131 passed**. `npm run check`: **87 JavaScript files**.
  `npm run package -- --force` validates the extension; `git diff --check` is clean.
- A pre-fix UI test failed because Refresh was present. Post-fix cases verify its
  absence and no blank footer before/after downloads, with Cancel/Retry geometry
  retained. Light/dark desktop and narrow screenshots were inspected together.
  One scoped Impeccable scan returned no findings.

`tests/collection-cache.spec.js` replaces the former manual-refresh browser cases.
Clock-driven tests verify reuse just before two hours, fresh discovery after expiry,
no renewal by repeated downloads and current lock/uncertain-access handling. The
synthetic session helper now models metadata expiry; real worker cache/storage TTL
checks remain in tooling. Format-switch and new-report replacement coverage is
retained. Earlier dated commands naming `tests/collection-refresh.spec.js` describe
historical checkpoints; use the current commands above for this tree.

This changes the extension UI and its page-side manual override, not cache lifetime,
source storage budgets, backend revision support, membership/origin policy or the
local download engines. Collection changes become visible when discovery is fetched
after expiry. No live Patreon account inspection or new permission was involved.

## November 5, 2026 — Stable collection selector layout

A supplied screenshot showed Markdown breaking mid-word and Markdown ZIP adding
an extra description line. Equal-width format columns and the longest description
were reproduced independently: two desktop widths split the label at 16px text,
and a 360px fixture gained 19.5px when selections changed. All three regressions
failed before the fix. Content-sized wrapping controls now keep names whole;
concise descriptions keep all six tested combinations at the same frame height.

Checks for this follow-up:

- `npm test -- --workers=2 --output=/tmp/collection-selector-layout-chrome-results`:
  **141 passed, 2 Brave-only cases skipped**.
- `npm run test:brave -- tests/collection-menu.spec.js tests/collection-controls.spec.js tests/ui-readability.spec.js --output=/tmp/collection-selector-layout-brave-results`:
  **18 passed**.
- `node --test tests/tooling/collection-chooser.test.cjs`: **9 passed**;
  `npm run check`: **87 JavaScript files**; `git diff --check`: clean.
- One scoped Impeccable detector scan returned no findings. Rendered desktop and
  narrow screenshots were inspected together; tests include doubled text, keyboard
  download, pointer actions, readable themes, resize guards and recovery controls.

New cases cover 1280×740, 800×600 and 360×740, iterate all six format/packaging
pairs, and assert unbroken format names, no selection-dependent height growth and
no horizontal overflow. Short windows and larger text may still require outer
scrolling; this removes the extra Markdown ZIP growth rather than promising every
control fits every viewport. No live Patreon inspection, download-engine changes,
new permissions, dependencies or source-cache changes were made.

## November 5, 2026 — Collection format and packaging selectors

The chooser uses Format (EPUB/PDF/Markdown), Packaging (Single file/Separate files
(ZIP)) and one output-specific Download button. Choices alone make no collection
requests. Default selection is EPUB / Single file. The existing six backend modes,
source reuse, numbered parts, permission gesture and recovery controls are retained.
A missing PDF parent-message allowlist and stale Retry control after Refresh were
reproduced and fixed. Revision-tagged sizing acknowledgements prevent older layout
messages from unlocking a newer selection; layout waits retain keyboard tab order.

Final checks:

- `npm test -- --workers=2 --output=/tmp/collection-selectors-release-chrome-results`:
  **138 passed, 2 skipped**. The skips are Brave-only installed-extension tests.
- `npm run test:brave -- tests/collection-menu.spec.js tests/collection-controls.spec.js tests/collection-demand.spec.js tests/installed.spec.js tests/installed-pdf.spec.js --output=/tmp/collection-selectors-release-brave-results`:
  **19 passed**, including actual native saving, PDF/ZIP byte parsing, EPUB/Markdown
  cache reuse after worker restarts, reports and cleanup.
- `npm run test:tooling`: **131 passed**. Real chooser DOM/script tests exercise all
  six mappings, selection without discovery, duplicate clicks, guarded explicit
  permission grant/denial and stale same-height sizing acknowledgements.
- `npm run check`: **87 JavaScript files**. `npm run package -- --force` validates
  the extension ZIP. `git diff --check` is clean.

Rendered fixtures cover light/dark 1280×900, dark 360×740 and initial doubled text;
all choices fit the measured frame with no inner scrolling. The outer body remains
scrollable at enlarged text so the recovery footer stays visible. Native radio
arrow/Tab/Space behavior, Enter download, Escape/focus return and pointer actions
are checked. Screenshots were inspected in bounded batches; subsequent changes addressed
behavioral regressions rather than introducing a new visual world. The mechanical
scan identified missing body text inheritance; explicit theme text color was added.
A separate reviewer found no remaining material production issues after fixes.

Earlier failed runs exposed stale pre-on-demand fixture assumptions: reports were
opened before being created; error-only builds lacked title fallback; clock tests
paused animation frames before selection; Refresh assertions included initial
registration cleanup; and native tests suspended the worker before deferred source
population. Fixtures now reach and retain the intended behavioral assertions. PDF
fixtures use ordinary chapter text instead of the shared 70,000-character unbroken
Markdown stress word, whose browser PDF layout is slow; the Markdown stress case
remains. Brave CDP download management may rename PDF blobs, so requested title
filenames remain asserted in controller fixtures while native checks parse actual
saved files. Installed collection tests reuse registered post tabs; worker-navigation
fixture routing and real image-host prompts are outside this checkpoint's evidence.

Browser-plugin tooling was unavailable; existing Playwright fixtures were used.
No live signed-in Patreon inspection, new Patreon selectors, permissions, dependency or
cache-policy changes were made. This is synthetic/installed-extension evidence,
not live-page confirmation or a general PDF performance guarantee.

## November 5, 2026 — Combined export integration

**November 5, 2026 — PDF/Markdown/on-demand integration:** The combined tree
preserves immediate format selection, deferred collection discovery, per-chapter
image approval, Single Markdown, and all EPUB/Markdown ZIP behavior while adding
Single PDF and PDF ZIP. Combined PDFs omit the persistent skipped-post slots from
the on-demand pipeline; PDF ZIP filenames retain discovered chapter numbering.

`npm run test:tooling` passes **125 cases**; `npm run check` validates **86 JavaScript
files**; `npm run package -- --force` validates the extension archive. New DOM
integration cases run all six collection modes through the real controller and
storage writers, verify no registration before selection and check skipped posts
in both PDF modes. The 101-post PDF split and retry/cancellation cases remain
covered. A focused independent integration review passed 14 PDF collection,
chooser-permission and PDF-service cases; a minor merged chooser markup omission
was corrected and no remaining findings were reported.

Browser attempts remain blocked: `npm test -- --max-failures=1` stops at one Chrome
launch failure with 138 cases not run; `npm run test:brave -- tests/installed-pdf.spec.js
--max-failures=1` also fails at launch. Both show SIGABRT/cleanup EPERM before any
page assertion. Browser/native/CSP/layout and live Patreon verification are still
pending. Earlier dated successes/failures below remain their own checkpoints.

## November 4, 2026 — Direct PDF development checkpoint

Direct PDF downloads, November 4, 2026 (development branch): **98 Node tooling
cases passed**, including real packaged-worker PDF generation, independent PDF.js
parsing, real post/collection controller execution in jsdom, both collection
outputs, encrypted retry/restart, cancellation, PNG inflation limits, shared
offscreen leases and the 101-post split. Syntax checks cover 83 JavaScript files;
packaging validated `dist/patreon-reader-1.1.1.zip`. A synthetic one-page sample
with metadata, text formatting, lists, a quotation, multilingual text, hyperlinks
and a PNG was rendered using PDF.js and visually inspected outside the repo.

Commands:

```sh
npm run test:tooling
npm run check
npm run package -- --force
npm test
npm run test:brave -- tests/installed-pdf.spec.js tests/pdf.spec.js tests/collection-pdf.spec.js tests/collection-menu.spec.js
git diff --check
```

Browser status: the full Chrome attempt has **125 launch failures and 2 skips**;
the targeted Brave attempt has **14 launch failures**, including the native
installed-PDF test. Every failure occurs at browser launch before page assertions
(`Target page, context or browser has been closed`, process SIGABRT, with cleanup
reporting `kill EPERM`). The pre-change baseline had the same launch failure.
Browser plugin not available; repository Playwright was used. These attempts do
not establish chooser geometry, native messaging/CSP or real installed downloads.
The added browser cases remain pending in a working browser environment. Live
Patreon verification is also pending. DOM tests are deliberately distinguished
from browser tests and do not measure layout or execute the real browser APIs.

PDF limits: 24 MiB serialized input, 32 MiB output, 8,192 pixels per image side,
16 million pixels per image, 32 million raster pixels per PDF and a 120-second
worker deadline. Test coverage includes PNG/SVG embedding and explicit unsupported
glyph errors; GIF/WebP/AVIF browser conversion is implemented but not yet browser
verified. Font coverage is bundled Roboto's four-face intersection, with tested
Latin/Greek/Cyrillic text; arbitrary languages and emoji are not promised. Single
PDF renders a bounded part in memory; only the EPUB path retains its streamed
book-assembly contract. No total RAM ceiling, live Patreon compatibility or
PDF/UA certification is claimed. The renderer/fonts are packaged locally and no
conversion service receives post contents.

Implementation commits: `05ed965` adds local rendering and replaces printing;
`227cc4e` adds combined PDF/PDF ZIP collections and bounded PNG decoding;
`1d7ae2b` fixes inert wrappers and sequences offscreen lifetime after restoration.
An independent whole-branch review found the wrapper issue; its fix passed the
reviewer's 10-case PDF/content rerun. The startup fix passed the reviewer's
4-case service rerun. No additional findings were reported. The
branch is isolated from other primary-checkout work. No release/publication or
merge into the primary checkout is implied by this checkpoint.

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

### Cancel active collection operations — November 1, 2026

Added an explicit Cancel action throughout collection discovery, preparation,
generation, file receipt, and packaging, plus Start again after confirmed cleanup.
Discovery requests, readiness delays, message waits, tagged background media
requests, compression streams, and checksum stages now observe cancellation.
Checksum calculation yields between 1 MiB chunks. Cancellation invalidates the
active UI operation and token so late responses cannot overwrite status, start a
new preparation, or hand off an archive. Completed discovery remains cached.

Preparation sessions are registered before visiting posts, allowing cancellation
to close their worker before preflight finishes. Abortable waits release the
operation without waiting for stalled post replies. Worker creation completing
after cancellation immediately closes that worker. Reused user tabs receive a
transfer cancellation message instead of being closed; late build/media requests
for cancelled transfers are rejected. Prepared metadata and file data are removed,
and persistence checks prevent a cancelled session being saved again.

All 21 targeted Chrome collection/post cases, 22 targeted Brave collection/post/
installed cases, 27 tooling tests, and syntax checks for 33 JavaScript files
passed. Coverage includes API request abort without fallback, cancellation at
preparation/build/chunk/compression stages, cancellation during cached-session
recovery, late replies and late worker creation, media abort, existing-tab
preservation, and restarting after cancellation. The installed Brave test still
verifies worker-restart recovery and both export formats. These use synthetic
pages; authenticated live cancellation remains pending confirmation.

Cancellation ends at the browser download handoff. The Cancel control is hidden
after that point. A native Patreon Load more request already in flight may finish,
but the extension does not click further batches or continue exporting.

### Retry and resume collection exports — November 2, 2026

Collection generation now requests and receives individual chapters, retaining
completed entries in page memory. A failed build or chunk transfer leaves the
prepared session usable and allows later chapters to finish. Retry failed posts
requests only missing chapters; the ZIP is withheld until every prepared chapter
is present. Packaging errors expose Retry packaging without regenerating posts.
Closing/reopening the panel preserves progress; reload/navigation, Cancel,
Refresh, switching formats, or successful handoff clears it. Missing or expired
metadata is prepared again, and the ordered post URLs must match before retained
files are reused. Preflight skips remain outside this recovery scope. No file
bytes, post bodies, or media URLs are added to session storage.

Temporary workers close after each chapter is received by the background, and
failed indexed requests clean up their transfer and media requests without
discarding preparation metadata. Existing whole-collection requests retain their
previous behavior for compatibility. No new permission or DOM selector is added.

Verification: 18 Chrome collection tests, 7 isolated Chrome post tests, 19 Brave
collection/installed tests, and 28 tooling tests passed; syntax checks cover 33
JavaScript files, and whitespace checks passed. New browser coverage verifies
Markdown build recovery, EPUB transfer recovery with distinct nested chapter
bytes, panel reopening, metadata recovery, packaging-only retry, and explicit
refresh invalidation. A background case verifies indexed bounds, cleanup, and
retry after worker restart. Broader export runs intermittently failed existing
PDF-status and remote-media-progress assertions; the unchanged post suite passed
in isolation. The initial sandboxed browser launch failed; subsequent isolated
browser profiles ran with the required access. Authenticated live recovery has
not been verified.
Two focused Chrome recovery cases also passed after extending the EPUB scenario
past discovery-cache expiry; retained files survive unchanged re-preparation.

### Share text and image sources across formats — November 2, 2026

Collection export now transfers an inert, versioned chapter snapshot rather than
a pre-rendered EPUB/Markdown file. It includes one data URL per distinct inline
image and a minimal content tree, with no source image request URLs. The worker
stores it in extension-origin CacheStorage for two hours; the collection page
renders each selected format locally, one chapter at a time. Download time is
generated for each output. The shared disk budget is 512 MiB. Old entries from
other collections can be evicted; a collection that exceeds the budget preserves
its existing cached prefix instead of evicting its next useful chapter on every
miss. Full/unavailable storage, expired records, and corrupt entries fall back to
normal fetching. Cache reads do not extend retention.

Refresh, Cancel, and owner-tab closure remove that collection's source records.
Worker startup prunes expired/orphaned records against restored session metadata;
pending cancelled writes cannot repopulate the cache. Browser-session metadata
remains metadata-only. Disk expiry removal is lazy, including after browser
closure; a new browser session cannot reuse sources without a saved owner.
No host permission was added. Packaging includes the new local worker helper.
The privacy policy documents source retention and deletion.

Individual post exports also retain one source snapshot in page memory, with a
two-hour lifetime and 16 MiB serialized-size allowance. A normalized-content
fingerprint invalidates edits without treating Reader CSS changes as new content.
Repeated images share one EPUB asset and cached bytes are decoded only when EPUB
needs them; Markdown keeps its existing inline data URLs. The 100 MiB image-output
guard still counts repeated occurrences to bound embedded Markdown output.
Archive assembly and generated retry files remain in memory; streaming is deferred.

Verification: 18 Chrome collection cases and 8 isolated Chrome post cases passed;
19 Brave collection/installed cases and 8 isolated Brave post cases passed;
33 tooling cases and 35-file syntax checks passed, with clean whitespace checks.
The installed test closes source tabs and terminates the extension worker between
Markdown and EPUB, then verifies correct chapter contents and no newly opened
tabs. Cache policy tests cover budget/eviction, expiry, corruption, cancellation,
owner cleanup, unavailable disk storage, and worker-restored hits. Earlier broad
runs hit the known PDF-status flake and a synthetic chooser click timeout; the
post-cache case now exercises the runtime message contract, while installed
coverage retains actual chooser clicks. Authenticated live reuse is pending.

### Stream collection ZIPs through private disk storage — November 2, 2026

Replaced in-memory generated retry files and whole-archive assembly with compressed
OPFS chapter files and a streaming disk ZIP writer. Chapter CRCs are computed while
compressing, zlib framing is stripped incrementally, and bounded chunk writes are
awaited before more output is requested. The writer copies compressed file streams
directly into a disk-backed ZIP and keeps only its central directory in memory.
Shared ZIP primitives preserve post EPUB behavior and classic ZIP headers.
Archive owner IDs, names, sizes, checksums, expiry, and download IDs persist in
session storage; no chapter/archive payloads are stored there. Source snapshots
remain in their separate two-hour cache.

Added required downloads/offscreen permissions. A hidden first-party document
creates a Blob URL for the finished disk File, and the browser's downloads API
saves it without a new tab. The active collection acknowledges handoff before
Cancel is hidden and the download begins. Completion/interruption revokes the
Blob URL, removes files/metadata, and closes the hidden document when unused.
Unfinished files are deleted on Cancel, Refresh, format changes, and owner closure;
downloads already handed to the browser retain their file until completion.
Idle retry records expire after two hours and startup prunes expired/orphaned
directories. Live open checkpoints can renew files, while lost jobs rebuild from
available cached sources. Disk/quota errors preserve completed entries and produce
a visible error; there is no whole-archive RAM fallback. ZIP64 remains deferred,
with explicit checks against 32-bit size/offset overflow. Per-chapter rendering
still needs memory proportional to that chapter.

Verification: 20 Chrome collection cases and 10 Chrome post/streaming cases passed;
23 Brave collection/streaming/installed cases, 8 isolated Brave post cases, and
35 tooling cases passed; syntax
checks cover 41 JavaScript files. A 12 MiB random-data fixture forbids whole-file
reads, checks UTF-8 filenames and independent inflation/CRC checks through unzip,
and extracts with macOS ditto. New cancellation cases cover archive chunk writes
and packaging. Node disk tests restore completed files after worker restart,
simulate quota failure and successful retry, reject invalid ownership/offsets,
and clean partial/expired/orphaned files. The installed test verifies actual browser
downloads to an isolated directory and cleanup of files plus the hidden document,
including format reuse after closing source tabs and terminating the worker.
An earlier broad Chrome run hit the existing EPUB synthetic chooser click timeout;
the isolated post suite subsequently passed. The old installed test waited for
a Patreon-page download event; it now checks browser download completion because
the hidden document owns the download. These are synthetic tests, not authenticated
Patreon verification or an empirical peak-memory benchmark.
Six focused Chrome cancellation/recovery cases also passed after guarding late
archive creation and rechecking cancellation after asynchronous checkpoint cleanup.

### Show detailed collection progress — November 2, 2026

Added current post/file titles, elapsed attempt time, completed/cached/failed
counts, and byte-based compression and ZIP copy progress. Receiving/cached reading,
formatting, compression/saving, packaging, finalization, and browser handoff have
distinct labels. The completed-post count is separate from per-stage percentages.
Compression stays below 100% until its disk entry is committed; ZIP copying counts
compressed payload bytes and then enters an explicit finalization stage.
The monotonic elapsed clock refreshes once per second and on stage/visibility
updates, freezes when work ends, and restarts on retry. Timer updates are outside
the live status region. The panel clamps long plain-text titles and scrolls within
the viewport. Attempt IDs bind preparation/build and archive progress/handoff
messages to their active operation, preventing stale updates from replacing a
cancelled, completed, or retried attempt. No new permissions, content visits, or
persistent timing records are introduced.

Verification: 20 existing Chrome collection cases and 3 focused Chrome progress
cases passed; 26 Brave collection/progress/streaming/installed cases and 35 tooling
cases passed. Syntax checks cover 42 JavaScript files; whitespace checks passed.
The focused cases hold source generation, disk commit, and packaging to verify
title/byte/count displays, safe text rendering, invalid/late attempt rejection,
99% before commit, cancellation freeze, and retry timer/failure resets. Background
tests verify cached-source flags/titles and correlated monotonic copy bytes through
finalization. Real unpacked-extension handoff, source reuse, file cleanup, and ZIP
extraction regressions remain covered in Brave. Evidence uses synthetic pages;
authenticated live progress and broad screen-reader/assistive testing remain
unverified. Elapsed time covers extension work through handoff, not the subsequent
browser download, and there is no estimated remaining-time prediction.

### Clean export data on expiry and browser lifecycle events — November 2, 2026

Added an export-only retention coordinator with one alarm for the nearest cache,
metadata, or idle-archive deadline. It rechecks scheduling after concurrent
mutations, wakes the worker for expiry cleanup, and disarms when no data remains.
Last normal/popup window closure clears export state; browser startup purges
leftovers, while ordinary worker restarts retain live session data. New collection
requests wait for maintenance, and late requests after last-window cleanup cannot
repopulate caches until another window opens. Reader preferences in storage.local
are never cleared. The new alarms permission supports these wakeups.

Source entries retain the fixed two-hour insertion lifetime. Metadata and idle
archive jobs are swept without a new user export. Expired retry jobs now reject
GET instead of renewing expired data; missing jobs regenerate from available
sources. Source-page discovery and individual-post memory copies get expiry
timers. Idle panels receive expiry notifications and show Start again rather than
leaving stale format options. Active operations and native-download backing files
are protected until safe cleanup. This supersedes earlier lazy cleanup and the
checkpoint-renewal exception after expiry.

Verification: 23 Chrome collection/progress cases, 8 isolated Chrome post cases,
26 Brave collection/progress/streaming/installed cases, and 41 tooling cases passed;
syntax checks cover 44 JavaScript files and whitespace checks passed. The installed
Brave regression fires a native alarm after advancing the worker clock, verifies
physical cache-record/file removal without another export, and compares saved
customisations before/after. Lifecycle fixtures verify last-window/startup cleanup,
worker-restart preservation, reopening, alarm removal, and concurrent rescheduling.
Worker tests verify expired source/metadata sweeps and OPFS cleanup, including
rejection of expired renewal. The expired retry fixture now expects regeneration
of all expired files while preserving order. An initial post suite hit the existing
synthetic EPUB chooser click timeout; an isolated rerun passed.

Browser alarms can be delayed by scheduling or sleep. Forced quit/crash can stop
shutdown cleanup, leaving disk data for the next startup purge; no extension can
promise deletion after its browser process has already stopped. These synthetic
tests do not establish forced-termination secure erasure or authenticated live
Patreon behavior. User-saved ZIPs and durable customisations are retained.


## November 2, 2026 — Export security audit fixes (unreleased)

Bounded media reads replace whole-response buffering. Each post fetches images
sequentially under the remaining 100 MiB occurrence budget and the 25 MiB image
limit; the worker permits two concurrent requests with 30-second deadlines,
coalesces small chunks, aborts overflow and rejects redirects. Data URLs receive
pre-decode size checks. Raster signatures must match the supported declared MIME.
SVGs are rebuilt using a graphics-only allowlist, including restored sources;
active content, external references, styles and document/entity declarations
cannot pass through. Unsupported SVG effects may be removed. Markdown escapes
literal text and metadata, encodes link delimiters, and uses code fences longer
than original backtick runs.

Verification: 36 Chrome export/security/collection/progress/streaming cases,
11 Brave post/security cases, one installed Brave case and 44 tooling cases
passed. Syntax covers 45 JavaScript files; whitespace checks passed. Existing
Markdown-source assertions initially failed on the new escaping and were updated;
EPUB text assertions were preserved. Tests reproduce the audit's output-injection,
SVG and memory-limit cases using synthetic data, including old cached SVGs and
raster MIME disguises. Installed Brave verifies actual extension downloads,
cross-format source reuse, worker restart and retention cleanup. No authenticated
Patreon or third-party reader verification is claimed. User-saved old files are
not modified; disk caches remain unencrypted and crash-time erasure is still
best effort. These fixes do not establish an extension-wide RAM ceiling.


## November 2, 2026 — Nested Markdown containment follow-up

List continuation indentation now preserves nested fenced-code containment.
Malformed heading/inline containers use inline code for preformatted children.
All 12 Chrome post/security cases passed; the new regression parses actual output
using development-only CommonMark and checks the rendered preview for injected
images, script effects and network attempts. This closes the nested-list bypass
missed by the original string-only Markdown checks. No live Patreon/reader
verification is claimed.


## November 2, 2026 — Encrypt reusable source files

Source snapshots and titles now use authenticated AES-256-GCM disk envelopes,
with an in-memory browser-session key shared across worker restarts. Authentication
binds each record to its owner/post cache URL. Legacy plaintext and corrupt records
are removed rather than reused. All 46 tooling cases and an installed Brave case passed, including stored-byte
inspection and tampering/substitution checks. Browser-session storage follows the
[Chrome storage contract](https://developer.chrome.com/docs/extensions/reference/api/storage#session).
This reduces exposure of leftover disk caches, not compromise of an active browser
or OS memory/swap. Expiry cleanup and user preferences retain their own lifecycles.


## November 2, 2026 — Encrypt retry chapters and bound temporary archives

Retry chapters use authenticated encrypted frames with transfer/offset binding.
The ZIP writer decrypts incrementally without whole-file reads. A shared 1 GiB
archive payload budget includes committed files, pending writes and ZIP staging;
source caching retains its separate 512 MiB budget. Concurrent writes serialize
budget checks; restart reconstructs disk usage, and abort/drop releases accounted
bytes after successful cleanup. Failed packaging/handoff removes plaintext ZIPs.
Legacy plaintext retries are purged. Native downloads temporarily require plaintext
ZIP backing files; forced termination can interrupt cleanup, so this is not secure
erasure or protection against a compromised running browser or OS memory capture.

All 50 tooling cases, 25 Chrome collection/progress/streaming cases and 3 Brave
installed/streaming cases passed; syntax covers 46 JavaScript files. Fixtures
exercise concurrent quota exhaustion/recovery, restart staging limits, tampering,
legacy deletion and failed-handoff cleanup. Installed Brave verifies encrypted
source reuse, worker restart, downloads and expiry while retaining preferences.
No authenticated live Patreon verification is claimed.


## November 2, 2026 — Media permission management and final audit-fix checks

The toolbar popup exposes saved optional media-origin count and Forget media
access. Removing grants preserves the required Patreon host, saved preferences,
cached content and user-saved exports. Failure is reported without changing the
Reader/engagement toggle flow. Future network retrieval requires media access
again; revocation during an active export may cause remaining requests to fail.

Final verification passed: 41 Chrome cases, 42 Brave cases (including the installed
extension), 50 tooling cases, syntax checks for 46 JavaScript files and whitespace
checks. Fixtures span nested CommonMark containment, SVG/raster safeguards, source
and retry encryption/tampering, concurrent archive quotas, failed handoff cleanup,
permission-removal success/failure, native downloads, worker restarts and expiry.
No authenticated live Patreon or crash-time secure-erasure claim is made.


## November 2, 2026 — Normalize Markdown line endings before containment

The follow-up audit reproduced active literal HTML from bare CR in code within
lists and blockquotes. The previous containment fix split only LF, while Markdown
also interprets CR as a line ending. Markdown serialization now normalizes CRLF
and CR to LF before escaping, fencing and container prefixes, including inline
code and conversion of previously cached raw source trees. DOM and cache formats
are preserved. User-saved older exports are not rewritten.

Verification: 14 Chrome post/security cases, 15 Brave post/security/installed cases
and 50 tooling cases passed. Syntax covers 46 JavaScript files; whitespace checks
passed. A CommonMark/preview matrix covers fresh and cached LF/CRLF/CR output in
lists, nested lists, blockquotes, quoted lists, headings and inline code, with
literal HTML, embedded backticks and ordinary text. It asserts no raw active image,
script effect or external request and verifies normalized output. Installed Brave
covers native downloads and encrypted source reuse after worker restart. These
synthetic/installed checks do not establish live Patreon or third-party reader
compatibility.


## November 3, 2026 — Stream a single EPUB from encrypted chapter retries

The packaged writer decrypts/inflates one staged chapter at a time and emits
stored EPUB resources under per-chapter directories, with a collection title
page, TOC, metadata, manifest and ordered spine. It validates resource sizes,
CRCs and allowed paths, and uses the existing native-download/retention flow.
Single EPUB and separate ZIP jobs share the same temporary payload budget.
All 54 tooling cases passed, including restart, bounded reads, quota failure,
invalid paths/metadata, and owner closure during book assembly. These Node
fixtures establish the streaming writer contract; browser/UI integration is
recorded separately. No EPUB-reader certification or live Patreon claim is made.


## November 3, 2026 — Offer a single EPUB book alongside separate-file ZIPs

The collection chooser groups Single EPUB under One book and retains the EPUB/
Markdown buttons under Separate files (ZIP). Single EPUB reuses source snapshots
and sanitization, builds independently retryable chapters, then saves one book
with collection title/creator/source/download-time metadata, ordered TOC/spine,
local images/styles, and previous/next/Contents chapter links. New EPUB labels
cover assembly, finalization and handoff. Switching modes drops generated retry
files but preserves reusable sources. No Patreon selectors or new permissions
were introduced. The hidden downloader uses an explicit EPUB MIME on a disk-backed
Blob slice; the initial installed filename assertion caught the inherited ZIP
MIME, which was fixed before the full successful rerun.

Verification passed: 43 Chrome browser cases, 44 Brave cases including installed
extension downloads, 54 tooling cases, syntax checks for 48 JavaScript files and
whitespace checks. Fixtures verify real ZIP CRCs with `unzip -t`, stored-first
mimetype, XML validity, manifest/spine/TOC order, local resource/navigation targets,
metadata escaping, image sanitization, mode switching, independent chapter retry,
packaging retry with whole-file reads forbidden, cancellation and cleanup.
Installed Brave verifies all three collection modes, correct saved extensions,
source reuse across worker restarts, no new post tabs and expiry cleanup. No
live authenticated Patreon or EPUB-reader interoperability certification is
claimed. Existing post/storage limits and temporary plaintext final-file
limitations apply to books as well as ZIP downloads.


## November 3, 2026 — Collection download reports

A collapsible report in the collection dialog lists individual post outcomes and
safe canonical links, with Save report for an explicit standalone text download.
Membership locks and preparation skips include reasons; errors lacking evidence
use limited wording. Generated chapters remain Prepared until browser handoff,
which is labeled Download started without claiming native completion. Retries
replace failed outcomes and reuse committed chapters; packaging failures never
mark posts downloaded. Cancellation remains reviewable. The latest page-local
report lasts at most two hours, survives dialog reopening and clears on explicit
refresh, navigation/reload or expiry. Per-post preparation skips follow existing
browser-session retention and owner cleanup; raw failure URLs are not retained.
No new permissions, post selectors or generated book/ZIP resources are introduced.

Verification passed: 34 Chrome collection/report/book/progress/streaming cases,
6 Brave report/installed cases, 56 tooling cases, syntax for 49 JavaScript files
and whitespace checks. Fixtures cover report saving, URL redaction/inert content,
locked-only and unsupported-only outcomes, restart, chapter/packaging failures,
retry, cancellation, refresh/reopen, navigation and expiry. Installed Brave checks
the report after real EPUB handoff. Synthetic desktop/light and narrow/dark
screenshots were reviewed and the Impeccable detector returned no findings. The
new skip handler's intermediate shadowing regression and the locked test's missing
performance entry were corrected before the final passing runs. No live Patreon
or native download-completion verification is claimed.


## November 3, 2026 — Incrementally refresh collection sources

Refresh now retains the existing owner/token source namespace while rereading
collection order and access. SHA-256 fingerprints of usable structured body/title
and available media/author context qualify only explicitly accessible posts for
reuse. Live matching source bytes keep their original expiry; new, edited,
uncached, expired or unverifiable posts are prepared again. Removed or newly
locked posts lose their sources. Generated retry files/report reset so order,
book navigation and access changes cannot preserve stale outputs. Cancellation,
owner cleanup and cache/disk bounds still apply. Missing evidence and DOM-only
fallback revalidate fully; API pagination data is still fetched on refresh.

Passing verification: 36 Chrome collection/refresh/report/book/progress/streaming
cases, 12 Brave refresh/report/book/installed cases, 60 tooling cases, syntax for
50 JavaScript files and whitespace checks. Worker fixtures cover reconciliation,
restart, deadline preservation, cross-owner rejection and cancellation. Browser
fixtures cover fingerprints, same-token order changes and locks/unknown access.
Installed Brave verifies persisted revisions and no new tabs during unchanged
refresh after cached downloads/worker restarts. Its first attempt raced the initial
API resource record; the fixture now waits for evidence before preparation. An
expiry fixture prompted pruning expired retained records during reconciliation.
One existing Chrome cancellation/restart fixture timed out waiting for a synthetic
download in the broad run; its isolated rerun passed, alongside the 35 other broad
passes. No authenticated live private-API compatibility or universal revision
availability is claimed. No raw response content or signed URL is stored in
revision metadata.


## November 3, 2026 — Automatically retry temporary export reads

A packaged shared helper retries idempotent collection-API and inline-image reads
up to three total attempts with 1s/2s exponential backoff, small jitter, per-attempt
30s deadlines and abortable waits. Readable Retry-After seconds/dates increase the
wait; requests asking for over 60s stay manual. Permissions, access denials,
unsupported/invalid/oversized content, storage and packaging/native-download
mutations remain manual. Retry progress uses the existing owner/operation guards.
Failed image streams restart from zero, releasing the media slot between attempts,
with the same origin/credential/redirect/size rules. Exhausted transient or denied
collection API reads no longer initiate a hidden DOM fallback. Completed chapter
BUILD failures cannot repeat through readiness polling or an existing-tab fallback;
normal document-readiness polling remains separate.

Verification passed: 56 Chrome export cases, 14 Brave focused cases including
installed extension coverage, 68 tooling cases, syntax for 53 JavaScript files
and whitespace checks. Initial broad and isolated runs hit repeated synthetic
post-chooser pointer/layout failures; a diagnostic click produced no choice
message. Fixture controls stay disabled until handlers/rendering are ready, and
three post-export behavior cases use the existing runtime delivery seam. Real
chooser gestures remain in installed Brave. A focused 14-case run passed before
the final broad runs above.
Unit/worker tests exercise bounded delays/attempts, Retry-After, cancellation,
timeout, stream reset, permanent errors and no repeated finished builds. Browser
fixtures verify UI recovery, wait cancellation, exhaustion without fallback and
manual 401/403/long-wait errors. Installed Brave injects a temporary API failure
and verifies real recovery/downloads. These fixtures do not establish live Patreon
or network-service behavior.


## November 3, 2026 — Download large collections in ordered parts

Discovery/prepared metadata now support up to 1,000 posts, while each generated
ZIP or EPUB book contains at most 100 prepared chapters. The controller downloads
numbered parts automatically in collection order. Chapter filenames in separate
ZIPs use global numbering; each EPUB book has self-contained local navigation.
Later-part retry reuses staged successful chapters without repeating earlier
handoffs. Reports preserve earlier included rows, cancellation affects remaining
work, and selecting a new format starts from the first chapter. Collections up to
100 chapters retain their previous output names. Source and archive disk budgets
remain unchanged; splitting is by chapter count, with manual storage-error retry
still required for unusually large parts or overlapping native downloads.

Verification passed: 62 Chrome export cases, 7 Brave cases including the installed
extension, 69 tooling cases, syntax for 54 JavaScript files and whitespace checks.
Synthetic 101-post cases cover all formats, part contents/order, independent EPUB
TOCs/navigation, later failures/retry/cancellation, format changes and refusal
above the discovery bound. A worker fixture prepares/restores 1,000 metadata
records and builds index 999 after restart. Installed Brave verifies the existing
smaller native-download/cache/expiry flow; large native collection handoffs and
live Patreon collections were not exercised. Tests use sanitized synthetic posts.


## November 4, 2026 — Track native collection download results

Collection reports now list each output file's In progress, Completed, Interrupted
or Status unavailable result and update all posts belonging to that part. Native
state changes are sent only to the owning tab before temporary-file cleanup;
post-handoff search and worker restoration reconcile quick or missed events.
Fixed explanations replace raw browser errors. IDs belong to the current report,
so stale or duplicate results cannot overwrite a new attempt or terminal outcome.
Reports remain page-local with their existing expiry/reset behavior, and saved
reports include file results. Existing cancellation/retry preserves earlier
completed/interrupted parts. No new permission or durable history cache is added.

Verification passed: 67 Chrome export cases, 6 Brave cases including the installed
extension, 74 tooling cases, syntax for 55 JavaScript files and whitespace checks.
The first native-worker tests incorrectly counted the shared encryption-key record
as archive metadata; assertions now check the archive namespace and physical files.
Two initial browser tests reached their assertions before chooser delivery;
the helper now waits for a recorded handoff. Final runs cover early/late results,
independent parts, sender/attempt guards, saved/closed reports, expiry, native API
reconciliation and cleanup. Installed Brave verifies real EPUB completion;
interruption/restart reconciliation uses synthetic API fixtures. Live Patreon and
live browser interruption/resume were not tested. Completed means the browser
confirmed saving, and does not establish archive validity.


## November 4, 2026 — Make collection download choices readable

Replaced the cramped grouped chooser with three full-width descriptive download
actions and explicit ZIP badges. The permission frame resizes to measured content,
validates its owner/token on messages and waits for a layout acknowledgement before
enabling choices. The parent remains responsive, keeps the chooser in place during
generation and collapses finished preparation/progress details. Report totals move
inside the expandable report, Refresh becomes secondary, and Escape from within
the frame restores trigger focus. User-gesture permission requests, export formats,
cache lifecycle and access rules are preserved.

Final verification: 71 Chrome export cases, 5 Brave cases including the installed
extension, 74 tooling cases, syntax for 56 JavaScript files and whitespace checks.
Layout tests use actual packaged chooser assets with a mock API bridge, inspect
light/dark 1280×900 and dark 360×740 layouts, and verify overflow, enlarged text,
keyboard downloads, Escape and resize-message bounds. Two screenshot batches were
inspected outside the repo. The design detector flagged 10px ZIP labels, corrected
to 11px without a second detector pass. Browser plugin was unavailable; isolated
Playwright profiles were used.

Initial unit mocks lacked the new layout primitives. Browser failures exposed a
child-frame animation wait in the mock bridge, pointer delivery before panel
resizing settled, and disappearance of controls while a new chooser was hidden.
The bridge, layout-ready handshake and stable visibility were corrected; finished
progress collapses and the format-switch fixture explicitly scrolls its frame into
view. The superseded broad run was interrupted before final passing runs. Native
Brave verifies all three formats and repeated downloads. No signed-in live Patreon
collection was inspected; arbitrary browser zoom and localization remain outside
this bounded layout matrix.


## November 4, 2026 — Initialise durable product context

Created `PRODUCT.md` from repository evidence and the user's explicit answers:
Patreon users in general, free or paid; equal emphasis on reading comfort and
offline downloads. Recorded existing local-processing, membership-access,
preference/cache, focus and reporting boundaries without inventing a broader
roadmap or competitive claims. Saved the user's comp-first choice for future
new UI surfaces as `buildPath: comp` in `.impeccable/config.json`, separately from
product facts. No visual system, runtime code, permission or CSP was changed.

Validation: parsed the workflow JSON, checked the product schema and web platform,
resolved product-document relative links, and passed whitespace checks. No runtime
or browser tests were rerun for this documentation/configuration change. Live mode
was left unconfigured because this extension operates inside Patreon pages and
extension-origin frames rather than a local application development server.


## November 4, 2026 — Independently review the extension UI

The user authorised two independent reviewers. Design assessment completed before
the parent read detector results. Fresh isolated Chrome fixtures covered collection
ready/busy/error/retry/report states, keyboard focus, narrow layouts, controlled
text enlargement and companion Reader/popup/post chooser surfaces. Heuristic score:
28/40, Good. Two P1 issues remain: busy/recovery controls can be outside the panel's
visible viewport, and collection aria-modal semantics lack modal focus management.
Other findings: format suitability/ZIP accessible naming, 12px disclosure contrast
below 4.5:1 in both themes, and 11px popup descriptions.

The one CLI scan returned three warnings and no errors. Two font-stack warnings
were duplicate stylistic signals; popup text-size was confirmed in rendering.
Local overlay injection failed despite successful mutable preflight. No visible
Human tab/overlay was claimed; CLI findings, screenshots, geometry and computed
styles supplied the evidence. The temporary server was stopped and browsers closed.
No runtime code or access/CSP policy changed, and no live account or formal
screen-reader conformance assessment was performed. Runtime suites were not rerun.
The critique snapshot and documentation checks were committed with this review.


## November 4, 2026 — Keep collection recovery controls visible

Addressed the two approved P1 findings with a scrollable body and separate action
footer, compact busy choices, nonmodal semantics and explicit focus entry/return.
Close/Escape dismiss the panel while work continues; reopening a busy panel reuses
its operation rather than preparing again. Cancel retains its stopping behavior.
The permission frame stays mounted while its busy presentation is compacted.

RED/GREEN verification: the three new collection-control regressions failed on
focus/geometry first, then passed with seven existing menu/progress cases (10
Chrome cases). Fixtures cover 375×667 Cancel/Retry visibility, expanded reports,
retained chapters, and busy dismissal/reopen. The remaining P2 findings are a
separate authorised task. This checkpoint does not establish live Patreon or
formal assistive-technology conformance.


## November 4, 2026 — Resolve all five approved UI critique findings

Added format suitability hints (browser print/save PDF, ebook reader and editable
text), included ZIP in collection button descriptions, corrected disclosure colours
and enlarged popup secondary text to 12.5px. Post chooser space is now 144px and
its fixture renders actual packaged HTML/CSS. This completes the three P2 findings
alongside the earlier committed P1 footer/nonmodal focus fixes.

Final evidence: 84 Chrome cases, 14 Brave cases including installed extension, and
74 tooling cases; syntax for 58 JavaScript files and whitespace checks pass. The
initial seven regressions and two isolated theme-contrast cases failed before
implementation. Both original reviewers then scored all five scoped fixes resolved.
Contrast measures 6.20:1 light and 7.97:1 dark. Narrow Cancel/Retry remain visible,
active dismissal/reopen preserves work, post hints fit and popup text wraps within
320px. The installed fixture additionally verifies actual native completion while
the panel is dismissed and subsequent reopened downloads.

One detector scan retained only two duplicate font-stack style warnings; no font
change was needed. No runtime access/permission/CSP change, live account inspection
or formal assistive-technology conformance claim was introduced. The original
28/40 critique remains historical. Minor pre-existing caveat: reopening after a
finished hidden operation restores the ready headline while retaining its report.


## November 4, 2026 — Remove popup media permission management

Removed Saved media access and Forget media access from the popup, with their
handlers/styles. Exact-origin permission requests and external image fetching
remain in the download flow. Updated the obsolete popup regression accordingly.
Syntax passes for 60 JavaScript files in the working tree; a temporary Node VM
smoke check confirms page status and both preference saves without accessing the
permission API. Scoped whitespace checks pass. The 18 targeted popup/export
browser cases could not start: Chrome aborted at launch, including an elevated
retry. No rendered or live Patreon verification is claimed. Unrelated download
work already in progress was excluded from this focused commit.


## November 4, 2026 — Add combined Markdown collection downloads

Added Single Markdown alongside Markdown ZIP, mirroring EPUB's combined/separate
choices. Combined documents carry collection and chapter metadata, linked contents,
ordered nested headings and embedded inline media. Independent encrypted retry
chapters feed a bounded streaming Markdown writer; raw output is UTF-8 `.md`, not
a renamed ZIP. Existing native delivery, completion reports, cache, ownership,
quota, cancellation and numbered parts are retained. Mode and filename validation
survive worker restoration. The packaged extension includes the writer explicitly.

Final verification: 88 Chrome cases, 12 Brave cases including installed extension,
89 tooling cases, syntax for 60 JavaScript files and whitespace checks. Feature,
backend-mode and package-presence assertions were observed failing before their
implementations. Tests cover ordered metadata/Unicode/embedded media, chapter and
packaging retry, cancel/101-post parts, authenticated stream/CRC/size/UTF-8 failure,
restart, quotas and native MIME/cleanup. Native Brave checks real `.md` content,
completion and reused sources after worker restart.

Independent review reproduced disabled choices when initial doubled text exceeded
the old 600px allowance. A failing initial-render regression now passes with a
1,000px bound; sender/token guards and outer viewport bounds remain. The reviewer
verified all four choices at 360×740 and 1280×900; no other material issue was found
in the scoped review. One mechanical scan was clean. Initial fixture issues were
a fixed three-choice resize baseline and an expectation for the concurrently
removed popup media section; intentional user popup changes were kept separate.
No live private collection, universal viewer rendering or full browser-zoom matrix
was claimed. Existing part/storage limits remain in force.


## November 4, 2026 — Fetch collections only after choosing a format

Removed eager collection/post preflight from the menu entry path. Format choices
are local; the chosen download discovers URLs and reads each uncached chapter
once, retaining its document through any exact-host permission click. Existing
source caches, ordered parts, retry files and native result tracking remain.
Refresh waits for the next selection. Cancellation/dismissal retain their distinct
stop/hide behavior, including an image-permission pause.

Independent review caught unsupported posts becoming mandatory failed entries.
Generation-time skips and persistent archive skip metadata now omit these
slots; sparse book navigation/TOC and Markdown contents retain the valid order.
No empty file is handed off for an all-skipped part. A stale installed Refresh
assertion now performs the selected download before checking cache reuse.

RED→GREEN evidence includes eager chooser/session reads, metadata-only worker
registration, unsupported-post skipping, ZIP/EPUB/Markdown skipped-slot assembly
across restart, and permission-denial reporting. Chrome/Brave still abort during
launch, including elevated attempts; rendered layout, real permission gestures,
native output and live Patreon behavior are unverified for this task. Current
commands and final results are in TESTING.md. No new permission, data source or
Patreon DOM selector was introduced.

Final local evidence: 98 tooling tests pass; 61 JavaScript files pass syntax checks;
whitespace checks pass; Playwright collects 129 cases across 23 files. Browser
execution remains blocked as described above, so no browser success is implied.
