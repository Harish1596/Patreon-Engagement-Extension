# Reader validation

The [maintained post-page reference](docs/patreon-text-image-post-baseline.md)
records the supplied HTML, screenshots, current integration contract, hook
inventory, and UI-drift investigation procedure as architectural evidence.
Its observations are distinct from the synthetic and installed-extension tests
below; documenting the captures does not establish live behavioral coverage.

## Current release status — November 6, 2026

Source metadata is **1.2.1**, prepared locally; no 1.2.1 release ZIP, store upload
or publication has been recorded. The user confirmed 1.2.0 approval/publication
and later confirmed downloads were working during hotfix development. That does
not establish a final 1.2.1 package/browser/viewer matrix. See the
[current release record](docs/releases/1.2.1.md) for the remaining checklist.

The latest runtime checkpoint below records 169 Chrome passes (three installed
Brave skips), 153 tooling passes, 21 targeted Brave passes and 95-file syntax
checks before the metadata-only version bump. Packaging tests subsequently passed
11 cases at 1.2.1. Historical checkpoint wording about unreleased work, Save
report, above-chooser placement and earlier versions describes the code at those
dates, not the current UI. Current reports are compact and stay in page memory.

## Live Patreon verification

## November 5, 2026 — User release-readiness confirmation

The user confirms that the live build works as expected and that screenshots and
artwork have been completed. The earlier report of “The PDF renderer did not
respond” was withdrawn by the user; no downloader fix was needed or applied.
This is user-reported live verification, separate from the automated checks and
labelled demo captures below. Browser/OS versions, exact package path and detailed
scenario coverage were not itemised; this does not establish an exhaustive browser,
viewer or accessibility matrix. The final user-prepared visual assets were not
supplied to this checkout, so the committed demo captures remain unchanged.
At that checkpoint, Web Store upload, review and publication had not yet been
confirmed. The later user confirmation of 1.2.0 publication supersedes that status.

The earlier dated release checkpoints below retain the evidence and status
recorded at those checkpoints.

**Release 1.1.0 testing completed — user-confirmed October 25, 2026.** All
completed testing recorded at that confirmation, including live Patreon testing
and the latest 1.1.0 changes, is attributed to the 1.1.0 release. This supersedes earlier live-Patreon-pending
notes in [testing history](docs/testing-history.md). Those notes are retained
as historical records of the status at the time.

The subsequent **1.1.1 hide-bar hotfix** has automated coverage below, but still
needs user confirmation on the affected live post. The 1.1.0 confirmation does
not establish live verification for this hotfix.

Earlier version labels are intermediate development checkpoints for this release,
not separate published versions. Automated execution records retain their actual
counts and build metadata; this confirmation does not imply a new automated run.

This is user-reported verification, separate from the automated results below.
Individual testing dates, browser/OS versions, and scenario coverage were not
itemized in this confirmation; it does not establish an exhaustive browser or
accessibility matrix or guarantee compatibility with future Patreon UI changes.

## Automated checks

## November 6, 2026 — Documentation and privacy alignment for 1.2.1

Updated the current README, user/product guidance, privacy policy, changelog,
release/packaging notes and asset status to match the implementation. The 1.2.0
record now distinguishes user-confirmed publication from its original candidate
checkpoint; 1.2.1 remains prepared locally with packaging/submission checks open.
Historical behavior records retain their original context. Current docs distinguish
standalone/ZIP metadata from combined front matter, page-memory summaries from
saved report files, page-refresh cache recovery from extension-reload recovery,
and bundled CJK support from complete Unicode coverage.

Validation: local Markdown file-link targets exist; all four version fields are
1.2.1; source-package validation includes 54 allowlisted files; all 11 packaging
tests pass. Runtime code, dependencies and permissions were not changed, so this
pass does not claim a fresh browser run, new ZIP, screenshot set or store update.
The local file-link check does not validate external URLs or viewer compatibility.

## November 6, 2026 — Version metadata 1.2.1

The manifest, package metadata and both root lockfile versions are aligned at
1.2.1. `readPackage(process.cwd())` validates the source package;
`node --test tests/tooling/package.test.cjs` passes all 11 tests. No new release
ZIP was generated or published. Earlier versioned results remain historical.

## November 6, 2026 — Omit repeated chapter metadata in combined downloads

Single PDF, Single EPUB and Single Markdown omit visible per-chapter Creator,
Download time and Source blocks. Collection front matter remains; individual
post exports and chapter files in ZIPs retain their metadata. Synthetic export
controller checks inspect real PDF text and generated EPUB/Markdown output,
including separate-file metadata preservation and 101-post PDF parts.

- `node --test tests/tooling/pdf-collection-content.test.cjs`: seven pass. New
  assertions first failed on repeated PDF and Markdown chapter metadata.
- `npm run test:tooling`: 153 pass. Three existing font tests initially expected
  chapter creator text; their metadata coverage now renders standalone PDFs,
  retaining Latin, cuneiform and CJK coverage alongside combined body/TOC checks.
- `npm run check`: 94 JavaScript files pass syntax checks.
- `npm test`: 163 fail at browser launch, two skip. All 163 report
  `browserType.launch`; Chrome exits with SIGABRT before page assertions.
- Targeted `npm run test:brave -- tests/collection-book.spec.js tests/collection-markdown.spec.js --grep 'Single EPUB contains|Single Markdown is one'`:
  both also fail at launch with SIGABRT. Browser assertions were added but could
  not execute; generated-file checks above run through the Node harness instead.

No live Patreon check, version bump or replacement store archive was performed.
Existing downloaded files must be regenerated to receive this change.


## November 6, 2026 — Collection recovery after extension reload

The collection panel now checks runtime identity/URL availability before opening
and guards direct URL use during chooser loading, resize messages and permission
handling. Invalidated scripts hide the iframe, stale report and progress, stop
local work and show refresh guidance with a Refresh page button. Late callbacks
cannot overwrite this latched recovery state. Page navigation remains user driven.

- RED: both API namespaces reproduced an uncaught URL error/blank chooser before
  the guard; the new recovery expectations failed, then passed after the change.
- `npm run check`: 95 JavaScript files pass syntax checks.
- `npm run test:tooling`: 153 pass.
- `npm test -- --workers=2`: 169 pass; three installed-Brave specs skip.
- `npm run test:brave -- tests/extension-context.spec.js tests/collection-controls.spec.js tests/collection-demand.spec.js tests/installed-context.spec.js tests/installed.spec.js tests/installed-pdf.spec.js --trace=retain-on-failure`:
  final run: 21 pass. Includes missing runtime ID/throwing URL cases in both
  namespaces, late chooser resize, normal permission/cancel flows and all three
  installed-extension scenarios.
- The new native test reloads the real unpacked extension through Brave's manager,
  verifies recovery without automatic navigation, clicks Refresh page, checks a
  new document and preserved URL/query, and confirms enabled format controls with
  no uncaught CDP exceptions. Developer mode is enabled only in its disposable
  profile; the user's browser profile is not modified.
- Synthetic visual checks at 360×740/dark and 1280×900/light collapse a previously
  1,000px chooser to 205px/213px recovery panels with visible focused refresh
  controls and no page errors. Screenshots stay outside the repository.

Initial native attempts timed out after refresh because CLI loading permitted an
unpacked extension while the test profile's Developer mode was off; manager state
showed DISABLED/unsupportedDeveloperExtension on reload. Enabling that fixture
setting restored injection. The final test uses an explicit DOM-ready wait after
click and verifies the new document. An existing installed-PDF scenario also
hit its 90-second timeout once in the first combined run; it passed independently
with tracing and in the final 21-test run. No production PDF workaround was added.

No live private Patreon page or universal browser matrix is claimed. The Browser
plugin is unavailable; validation uses existing Playwright tooling. The change is
scoped to the collection UI, not every direct API entry point in the extension.
Existing tabs opened before this guard was loaded need one manual page refresh.
No new permissions, manifest version, cache policy or release ZIP changed.

## November 6, 2026 — Minimal download summary at the bottom

Download report now follows format choices, status and hidden finished progress.
It contains a completion sentence and a failed-post list, with no Save report
button, generated report file or per-file inventory. All-post success requires
browser-confirmed completion of every post. Browser interruptions count affected
posts as failed; skipped, cancelled, saving and unconfirmed counts stay distinct.
Failure rows retain reasons, Unicode diagnostics and canonical source links.

- RED: the new bottom-summary regression first found the unwanted Save report
  button. It now confirms no save action/file inventory, bottom placement and
  that skipped posts prevent all-success wording.
- `npm run check`: 94 JavaScript files pass syntax checks.
- `npm run test:tooling`: 153 pass.
- `npm test -- --workers=2`: 164 pass, two Brave-only specs skip.
- `npm run test:brave -- tests/collection-report.spec.js tests/collection-completion.spec.js tests/installed.spec.js tests/installed-pdf.spec.js`:
  15 pass, including both real installed-extension workflows.
- Responsive synthetic checks at 360×740/dark and 1280×900/light show progress,
  completed and failed states without page errors. The 75-post completed summary
  measures 67px high at both widths; screenshots stay outside the repository.

The first full run found a later-part cancellation message hidden by saving copy;
prioritizing cancellation preserves the earlier-file handoff explanation. It also
found two stale creator-metadata expectations after the separate combined-chapter
metadata change. Those assertions were corrected in focused commit `a531d24`,
retaining body, contents and mixed-script navigation checks. The PDF/batch subset
then passed 13 tests and the final full Chrome run passed as recorded above.

No new live private-page or exhaustive accessibility verification is claimed.
The Browser plugin is unavailable; checks use existing Playwright tooling. Cache
expiry/recovery, output generation and download tracking remain unchanged. No new
permissions, manifest version or replacement store ZIP was produced. This entry
supersedes earlier above-chooser/file-inventory/saved-report presentation notes.

## November 6, 2026 — Reconnect collection sources after page refresh

Collection source entries remain keyed to the original token, and the background
can now return that token plus existing metadata on the next Download after a
page refresh. Recovery is bound to the sender's tab, window and canonical numeric
Patreon collection URL. It runs after retention/worker restoration, rejects busy,
expired or cancelled sessions, and does not extend expiry by itself. Legacy
metadata without a collection URL binding is safely rediscovered. Opening the
chooser does not request recovery or fetch content.

- RED: the new owner-recovery regression failed with no returned token before
  the handler existed; the positive case then passed after implementation.
- `npm run check`: 94 JavaScript files pass syntax checks.
- `npm run test:tooling`: 153 pass, including recovery after worker restart,
  source-cache hits without new post builds, unchanged lookup expiry, owner/tab/
  window/collection/origin boundaries, cancellation, busy work and legacy records.
- `npm test -- --workers=2`: 163 pass; two installed-Brave cases skip.
- `npm run test:brave -- tests/installed-pdf.spec.js`: one installed-extension
  scenario passes, including PDF download → refresh → another PDF download. Both
  chapters are reported cached, collection API discovery count stays unchanged,
  and CDP records no uncaught exceptions during that sequence. Subsequent PDF ZIP
  and large-PDF renderer checks still pass.

This uses synthetic collection/post pages in an isolated browser profile. It
verifies cache reconnection, not the root cause or universal absence of the user's
earlier context-invalidation error. Page reports and generated-file retry UI are
not restored. Missing/evicted sources still fetch normally; the 512 MiB budget,
source expiry, cancellation and browser-close cleanup are unchanged. No new
permission, manifest version or store package was produced. Concurrent unrelated
book-metadata edits appeared after the initial validation and were committed
separately as `5f5b23d`. The tooling suite (153 pass), syntax checks (94 files)
and installed Brave scenario (one pass) were rerun successfully against that
integrated checkout; the full Chrome result above predates that separate commit.

## November 6, 2026 — PDF contents link styling

Combined PDF contents now use blue (#1a0dab), underlined chapter titles. Page
numbers and chapter headings retain normal text styling. A real-renderer test
first failed because contents had no blue link text, then passed while confirming
two distinct destinations still resolve to the expected chapter pages and chapter
body pages do not inherit the contents color.

- `npm run check`: 94 JavaScript files pass syntax checks.
- `npm run test:tooling`: 150 tests pass.
- `npm run test:brave -- tests/pdf.spec.js tests/collection-pdf.spec.js tests/installed-pdf.spec.js`:
  14 pass, covering internal navigation, mixed font fallback and native output.
- A four-page synthetic sample was rendered through the packaged worker and
  rasterized with PDF.js. Visual inspection confirms blue underlined Latin/CJK
  contents entries and normal page numbers; preview files stay outside the repo.

No live/private collection or exhaustive PDF-viewer matrix was tested. Existing
saved PDFs are unchanged; regenerate them to receive the new styling. No font,
permission, manifest version or release archive changed.

## November 6, 2026 — Handle invalidated extension API contexts

The reported stack points to the shared helper's promise-style API branch. A
synchronous `Extension context invalidated.` throw escaped callers' `.catch()`
handlers, unlike the Chrome callback branch. A failing Node regression reproduced
that difference. The helper now always returns a promise and translates this
specific error to refresh-page guidance. Other API errors remain errors; no
request is silently retried or represented as successful. Permissions are still
invoked before returning, preserving the caller's user gesture.

- `node --test tests/tooling/extension-call.test.cjs`: six pass after four failed
  before the fix; covers synchronous throws, promise rejection, ordinary-error
  identity, Chrome callback lastError and immediate permission invocation.
- `npm run check`: 94 JavaScript files pass syntax checks.
- `npm run test:tooling`: 149 pass.
- `npm test -- tests/extension-context.spec.js tests/collection-export.spec.js tests/export.spec.js tests/popup.spec.js --workers=2`:
  37 pass, including mutation-triggered collection registration failures for both
  API namespaces, plus existing export, popup and cancellation coverage.
- `npm run test:brave -- tests/extension-context.spec.js tests/installed.spec.js tests/installed-pdf.spec.js`:
  four pass, including both installed-extension specs and the large PDF fixture.

The invalidation itself is simulated with synchronous runtime API exceptions on
synthetic collection pages. The native tests confirm normal installed operation,
not a real extension-update/reload cycle. No private collection was inspected and
the user's exact invalidation trigger was not supplied. This fix covers the
reported helper call path; it does not reconnect stale content scripts or promise
recovery of every direct runtime API entry point. Refresh affected Patreon tabs
after reloading/updating the extension. No new permissions, version bump or store
archive was produced. The full Chrome suite was not rerun for this focused fix;
prior full-suite results remain recorded in the preceding task's checkpoint.

## November 6, 2026 — Compact collection download reports

Progress details are visible only while collection preparation/packaging is busy.
When work stops, an always-visible Download report appears above format choices,
with counts and file outcomes instead of repeated successful chapter rows. Only
failed/skipped posts receive individual rows; full per-post details remain in
Save report. Browser handoff remains distinct from confirmed completion.

- `npm run check`: syntax checks pass for 92 JavaScript files.
- `npm run test:tooling`: 143 tests pass.
- `npm test -- --workers=2`: 161 pass, two Brave-only tests skip.
- `npm run test:brave -- tests/collection-report.spec.js tests/collection-completion.spec.js tests/collection-progress.spec.js tests/collection-controls.spec.js tests/installed.spec.js tests/installed-pdf.spec.js`:
  20 pass, including actual installed-extension storage and native PDF downloads.
- Responsive Chrome inspection uses synthetic collection 500 at 360×740/dark and
  1280×900/light. Progress, completed and failed outcomes were captured outside
  the repository. A 75-post completed summary measures 147.5px high at both widths;
  checks confirm no report horizontal overflow and no page errors in this flow.

Browser plugin not available; existing Playwright fixtures provide the browser
checks. New regressions first reproduced the overlapping report/progress state at
both widths, then passed for completion, repeat download, cancellation and a saved
report containing all 75 post records. Existing tests retain failure reasons,
source links, skipped membership locks, ordered parts, interruption, unavailable
history, expiry and retry coverage. Initial test adjustments fixed a hardcoded
saved-report filename and narrowed skipped-row selectors to the issue list. A
menu description test also exposed a click during iframe resizing; it now uses
the established enabled/Space/checked interaction, while menu pointer coverage
remains in the menu specs. No production chooser change was needed.

This is synthetic and installed-extension evidence, not new live Patreon or
private-account verification. No permissions, cache lifecycle, version or release
archive changed. Changelog changes remain unreleased.

## November 6, 2026 — Identify posts behind PDF packaging failures

Collection PDF errors now carry bounded, validated chapter indices and reasons
through the worker, offscreen renderer and archive bridge. Font preflight checks
all chapters before rendering; the summary names up to three affected posts and
the Download report includes every identified post, its character error and its
existing source link. Skipped entries retain correct collection numbering.
Prepared data survives packaging retries. Global resource/layout failures remain
generic when no individual post can be identified.

- `npm run check`: 92 JavaScript files pass syntax checks.
- `npm run test:tooling`: 143 tests pass, including multi-chapter font failures,
  bounded metadata validation, duplicate rejection and URL/control redaction.
- `npm test -- --workers=2`: 159 pass; two Brave-only tests skip.
- `npm run test:brave -- tests/pdf.spec.js tests/collection-pdf.spec.js tests/installed-pdf.spec.js`:
  14 pass, including saved reports, retry without refetching and native transport.
- Temporary packaging validation: 54 files, 10,709,695-byte ZIP; the published
  release archive was not overwritten. Manifest remains 1.2.0, changes unreleased.

The installed fixture uses already-ready source tabs, as its successful-download
scenarios do. An initial cold-tab variant exceeded the five-second retry-control
expectation; the adjusted fixture and final targeted suite passed. This does not
establish cold-tab timing or live Patreon/private-collection verification. No post
body or signed URL is added to structured failure metadata; titles/source links
come from existing report context. A chapter reports its first unsupported glyph,
not an exhaustive list of every unsupported character.

## November 6, 2026 — CJK PDF fallback for U+5929

The reported retained-collection packaging failure at U+5929 (天) reproduced in
the real renderer before the change. Neither existing primary Noto Sans nor the
Cuneiform fallback had that glyph. A pinned, unmodified static Noto Sans SC OTF
now supplies supported document-text runs, retaining Latin/Cuneiform text, contents
links, metadata and external links. The SC regular face serves every style alias;
its glyph designs are SC-localised, not a promise of all regional typography or
all CJK/Korean/Unicode coverage. Unsupported characters still fail explicitly and
SVG text retains its existing primary-font guard.

The 8,331,336-byte upstream font and original OFL input are hash-verified during
rebuilds. Its generated local `vfs_cjk.js` is separate from the unchanged base VFS;
workers load it only when structured text selects NotoSansSC. The browser regression
observes zero CJK asset loads for a Latin/Greek/Cyrillic PDF and one for the mixed
CJK document. No fonts are retrieved remotely, and CSP/permissions are unchanged.
The packaged font license includes its embedded Adobe copyright notice.

Validation:

- `npm test -- --workers=2 --output=/tmp/pdf-cjk-chrome-results`:
  **158 passed, 2 Brave-only cases skipped**.
- `npm run test:brave -- tests/pdf.spec.js tests/collection-pdf.spec.js tests/installed-pdf.spec.js --output=/tmp/pdf-cjk-native-final-results`:
  **13 passed**. Actual installed post PDFs, combined collections and every PDF
  ZIP entry independently extract 天地玄黃 alongside Latin diacritics/Cuneiform.
- `npm run test:tooling`: **141 passed**; `npm run check`: **92 JavaScript files**.
  The focused real-renderer suite passed **14 tests**.
- A first sandboxed Chrome launch was blocked before app code; rerunning outside
  that process sandbox passed. An initial installed Brave case timed out once;
  an isolated diagnostic rerun passed every stage in 9.1 seconds and the final
  13-test suite passed in 21.9 seconds. Diagnostic checkpoint logs were removed;
  no production workaround was introduced for the transient timeout.
- The 75-chapter mixed-script/image fixture passes the native runtime bridge:
  33,635,369 input bytes and 21,885,651 PDF bytes. Independent Node extraction
  checks all chapters across its 78 pages. Existing 48/40 MiB PDF limits remain.
- Offline vendor regeneration reproduces all seven generated artifacts exactly.
  A temporary package validates all **54 allowlisted files**, including the lazy
  font asset and license, at **10,708,661 ZIP bytes**. The previous release ZIP in
  dist was not overwritten; version metadata remains 1.2.0 until release preparation.
- An independently rasterised mixed-script sample visibly renders the CJK glyphs
  alongside existing scripts (`/tmp/pdf-cjk-sample.png`). `git diff --check` is clean.

This is an unreleased source correction following the user's confirmation that
1.2.0 was published. The private 75-post Patreon collection was not fetched or
inspected. Membership/origin guards, cache lifecycle and file budgets are retained;
the font/package-size increase is not a RAM-limit guarantee.

## November 5, 2026 — README and user guide refresh

Reorganised the 1.2.0 README around reading customisation, post/collection download
choices, installation, local processing and compatibility limits. Detailed existing
reading/export instructions are retained in `docs/usage.md`. This documentation
branch starts from `feat/download`; the primary checkout's older 1.1.1 `main` was
not changed or represented as containing downloads.

Validation: a local Python link/heading check passed **23 references** across
README.md and docs/usage.md; documented PDF and collection limits were compared
with the source; `git diff --check` is clean. No runtime files or packaged policy
changed, so browser tests and package generation were not repeated. Earlier live
and automated confirmations retain their original scope.

## November 5, 2026 — Compact popup without page status

Removed the permanent Page status heading, connection/success messages and download
hint. Popup preferences no longer query or message the active tab. A hidden
`role="alert"` appears only when preferences fail to load or save. Failed saves
restore the previous toggle value; a successful retry clears the alert. Load
failures leave switches disabled and explain reopening to retry. Product identity,
manifest version, tagline and community links remain.

The callback/promise API regressions first failed against the previous Page status
UI. Final checks passed:

- `npm test -- tests/popup.spec.js tests/ui-readability.spec.js --workers=2 --output=/tmp/popup-remove-status-chrome-results`: **13 passed**.
- `npm run test:brave -- tests/popup.spec.js tests/ui-readability.spec.js tests/installed.spec.js --workers=2 --output=/tmp/popup-remove-status-brave-results`: **14 passed**, including native storage/content-script synchronisation.
- `npm run check`: **91 JavaScript files**; `git diff --check`: clean.
- Package rebuild/validation and installed-ZIP screenshot/Markdown smoke checks pass.
  The package checksum and committed demo capture provenance were refreshed.
- Separate installed-popup checks show settled light/dark layouts at **320×370px**,
  no horizontal overflow, failed-save feedback clearing after a successful retry,
  no page errors and fitting 200% zoom. Theme-transition frames were excluded from
  the final visual inspection using reduced motion. Preview/error images are under
  `/tmp/popup-compact-*`, outside the repository. Browser plugin not available;
  Playwright used Brave's native installed-extension support.

Current local ZIP SHA-256: `db58176679054ebca53bb2291bab42dec18298b4282cd57393f3268d61d260be`.
This supersedes earlier candidate hashes. Full browser suites were not repeated
for this popup-only refinement; earlier full-release results remain dated above
or below. The user's earlier live-build confirmation predates this change. Their
separately prepared artwork is not overwritten; any final image showing the old
popup can be refreshed to reflect this compact layout. No Patreon DOM hooks,
export processing, permissions or cache rules changed.

## November 5, 2026 — Reading-first manifest copy

The 125-character manifest description now names font, colour and spacing
customisation before accessible post/collection downloads in PDF, EPUB and
Markdown. Engagement-bar hiding is omitted from the short description. Only
metadata changed; the version remains 1.2.0 and permissions are unchanged.
Packaging validation and the extracted-ZIP capture/Markdown smoke check passed.
Demo capture provenance was refreshed; user-prepared final artwork is unaffected.
`git diff --check` is clean. Full suites were not repeated for this copy edit.

Current candidate SHA-256: `c328e3b5466b971483f1541cf7601598e355f632dbd3ba9f7df13d20628cbe70`.
This supersedes the preceding local candidate checksum.

## November 5, 2026 — Final manifest description

The 1.2.0 manifest description now includes accessible post and collection
downloads in PDF, EPUB and Markdown with inline images, alongside reading
customisation. Version fields remain 1.2.0 and permissions are unchanged.
`node --test tests/tooling/package.test.cjs` passed all **11 tests**; the release
ZIP was rebuilt and validated. The installed-ZIP capture tool again verified
its real version badge, Reader/format controls and a native Markdown download.
All three demo PNGs are byte-identical; only their package provenance changed.
The user's separately completed artwork/screenshots are unaffected. Full browser
suites were not repeated for this description-only manifest edit.

This supersedes the earlier candidate checksum for the current local ZIP:
`1cc620bc6a9a462071822fb6671672f66153e975ea953a931310f8895742c738`.
Earlier dated checksums remain historical evidence. `git diff --check` is clean.

## November 5, 2026 — 1.2.0 release candidate

The manifest, package metadata and lockfile root now agree on **1.2.0**. README,
product context, changelog, privacy policy and the manual release checklist reflect
current download formats, oldest-first ordering, lazy discovery, two-hour caches,
removed permission/refresh controls and browser-confirmed completion reporting.
Export status copy now says “Files are generated locally” rather than implying
that direct Patreon/media network requests never occur. Existing permissions and
export behaviour are unchanged. Publication is not confirmed.

Final validation on macOS 15.7.3, Node 22.19.0, Playwright 1.64.1, Chrome
157.0.8103.38 and Brave application version 155.1.97.57 (engine 155.0.8059.80):

- `npm ci --ignore-scripts --offline`: installs the locked dependencies from local
  cache. Its cached audit output is not a fresh vulnerability assessment.
- `npm run check`: **91 JavaScript files**.
- `npm run test:tooling`: **140 passed** (final log: `/tmp/release-120-final-tooling.log`).
- `npm test -- --workers=2 --output=/tmp/release-120-final-chrome-results`:
  **157 passed, 2 Brave-only cases skipped**.
- `npm run test:brave -- --workers=2 --output=/tmp/release-120-final-brave-results`:
  **159 passed**, including real installed-extension storage, content/popup,
  direct PDF, combined collection and ZIP downloads, and the 75-chapter PDF bridge.
- An earlier parallel Chrome run timed out creating a browser context before the
  appearance test entered app code. The isolated appearance suite passed all 9
  tests, a clean full rerun passed, and the final suites above passed sequentially
  after the privacy-copy adjustment. The initial failure is not omitted.
- `npm run package -- --force`: validates the exact allowlist, root manifest,
  resources, archive integrity and byte equality of extracted runtime/policy files.
- `node scripts/capture-store-screenshots.js`: loads that extracted ZIP in an
  isolated Brave profile, verifies the real popup's v1.2.0 badge, exercises Reader
  font/colour controls, post formats and collection Markdown ZIP selection, and
  checks a real post Markdown download for title, creator and source metadata.
  Three actual UI captures are 1280×800, with labelled synthetic content, no page
  errors, no private account data and no image compositing. Browser plugin not
  available; Playwright uses Brave's installed-extension support. PNG/package
  SHA-256 values are recorded in screenshot provenance. Screenshots were visually
  inspected; they are demo evidence, not live Patreon screenshots.
- `git diff --check`: clean.

Candidate: `dist/patreon-reader-1.2.0.zip`, SHA-256
`19a50121aa38d340419ebad3ec311377a95a8d7731b671fc142a5d7b637ad1d5`.
The ZIP is local/ignored; source, policy, screenshots and provenance are committed.
See [release notes and outstanding submission work](docs/releases/1.2.0.md).
Live signed-in public/member Patreon checks, upgrade retention on an existing
store installation, third-party EPUB/viewer and macOS Archive Utility checks,
screen-reader verification and dashboard disclosures/version review remain
separate manual checks. This does not publish or establish Firefox/Safari support.

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
Single Markdown collections, November 4, 2026: **88 Chrome cases, 12 Brave cases
including the installed extension, and 89 tooling cases passed**. Syntax covers
60 JavaScript files; whitespace checks pass. Commands:

```sh
npx playwright test tests/collection-markdown.spec.js tests/collection-controls.spec.js tests/ui-readability.spec.js tests/popup.spec.js tests/collection-menu.spec.js tests/collection-completion.spec.js tests/collection-batches.spec.js tests/collection-retry.spec.js tests/collection-refresh.spec.js tests/collection-report.spec.js tests/collection-book.spec.js tests/collection-export.spec.js tests/collection-progress.spec.js tests/archive-stream.spec.js tests/export.spec.js tests/export-security.spec.js
npm run test:brave -- tests/collection-markdown.spec.js tests/collection-menu.spec.js tests/collection-controls.spec.js tests/installed.spec.js
npm run test:tooling
npm run check
git diff --check
```

New feature cases first failed without Single Markdown support. Backend tests
exercise raw UTF-8 output rather than ZIP bytes, restart metadata, escaped titles,
TOC order, bounded reads/writes/decoding, size/CRC/authentication/UTF-8 failures,
quota, cancellation and native MIME/cleanup. Browser cases inspect combined
metadata, local anchors, nested headings, Unicode and embedded images, preserved
Markdown ZIP output, chapter/packaging retry, cancellation and 101-post parts.
The installed Brave fixture saves an actual `.md`, checks content/images/completed
report and confirms cache reuse after worker restart and final disk cleanup.
Packaging includes the new worker module through the explicit allowlist; its
presence assertion was observed failing before the allowlist correction.

Fresh independent review found the four-choice initial 200% text layout exceeded
the former 600px frame allowance, leaving every choice disabled. A dedicated
initial-render case failed before correction, then passed with a 1,000px finite
bound. Source/origin/token/integer guards remain; the outer body still bounds the
panel viewport. Reviewer recheck measured 761px frame/756px content at 360×740 and
613px frame/608px content at 1280×900, all four choices enabled and no inner frame
scrollbar. Normal light/dark/narrow captures were inspected; one mechanical scan
was clean. No second detector scan was needed for the numeric bound correction.

The initial installed run expected a saved-media popup section concurrently
removed in intentional user work. Its obsolete assertion was removed; popup
implementation changes were preserved separately. An enlarged-text fixture also
incorrectly compared against a fixed 300px baseline; it now uses the initial
measured height. These failures were distinct from the new Markdown writer.

Collections retain the 1,000-discovered-post and 100-chapter-part bounds, shared
archive/source disk limits, existing permissions and access checks. There is no
collection-sized aggregate message or buffer. These are synthetic and isolated
installed-extension checks, not a live Patreon or universal Markdown-viewer/zoom
compatibility claim. Earlier test counts remain dated checkpoints below.

All five UI critique findings, November 4, 2026: **84 Chrome cases, 14 Brave cases
including the installed extension, and 74 tooling cases passed**. Syntax covers
58 JavaScript files; whitespace checks pass. Commands:

```sh
npx playwright test tests/collection-controls.spec.js tests/ui-readability.spec.js tests/popup.spec.js tests/collection-menu.spec.js tests/collection-completion.spec.js tests/collection-batches.spec.js tests/collection-retry.spec.js tests/collection-refresh.spec.js tests/collection-report.spec.js tests/collection-book.spec.js tests/collection-export.spec.js tests/collection-progress.spec.js tests/archive-stream.spec.js tests/export.spec.js tests/export-security.spec.js
npm run test:brave -- tests/collection-controls.spec.js tests/ui-readability.spec.js tests/collection-menu.spec.js tests/installed.spec.js
npm run test:brave -- tests/installed.spec.js
npm run test:tooling
npm run check
git diff --check
```

RED/GREEN evidence: the initial seven regression cases failed on the original
control geometry, modal semantics, missing descriptions and popup text size.
Two additional isolated contrast cases failed before correction. Final checks
verify persistent narrow Cancel/Retry controls, expanded reports, nonmodal focus,
active dismissal/reopen without re-preparation, both-theme contrast and format
hints in actual chooser markup. The installed Brave fixture additionally closes
the active panel, observes real native download completion while it is hidden,
and reopens it for later downloads.

Both original reviewers independently marked all five findings resolved in their
scoped fixture checks. At 375×667, Cancel and Retry are inside the panel at
approximately y=539–576. Disclosure contrast now measures 6.20:1 light and 7.97:1
dark, and popup supporting copy is 12.5px without measured horizontal overflow at
320px. Post hints fit the 144px chooser in both themes. The single mechanical scan
now has two duplicate font-stack style warnings; the small-text warning is gone.
The existing system fallback stack is preserved rather than treating that style
warning as a demonstrated defect. No new live overlay server was needed.

Screenshots/measurements were inspected outside the repo. These are scoped fixture
and installed-extension checks, not live account or full accessibility/zoom
certification. Reopening after an already-completed hidden operation still shows
the ready headline; its report retains the detailed outcome. The original critique
score remains historical and was not silently rescored after these fixes.

Collection control remediation, November 4, 2026: **10 Chrome cases passed** via
`npx playwright test tests/collection-controls.spec.js tests/collection-menu.spec.js tests/collection-progress.spec.js`.
The three new cases first failed on the original implementation. They now verify
nonmodal focus entry/return, visible Cancel at 375×667, dismiss/reopen without
re-preparation, and visible Retry with an expanded report and retained chapters.
This checkpoint addresses the two P1 findings; the three P2 findings remain in the
approved follow-up task. Syntax and whitespace checks pass. No live account was
inspected in these fixtures.

Independent UI critique, November 4, 2026: two isolated reviewers inspected
sanitised rendered fixtures and source. Heuristic assessment: **28/40 (Good)**,
with two P1 interaction issues: offscreen busy/recovery actions and modal semantics
without matching focus management. Additional findings cover format/ZIP naming,
Preparation details contrast (3.90:1 light, 4.02:1 dark) and small popup copy.
This is a review with open findings, not a full accessibility certification.

One Impeccable scan of `extension/export extension/popup extension/content`
returned three warnings and no errors: two duplicate font-stack style warnings
and one rendered popup text-size warning. Static coverage does not establish
accessibility of JavaScript-created shadow DOM or the permission frame. A mutable
injection preflight passed, but the local overlay script failed to load in all
three attempts; no user-visible overlay is claimed. The temporary server and
browser contexts were closed. No runtime code, CSP or permission was changed.
Full runtime/browser test suites were not rerun for this review. Snapshot metadata,
source fingerprint, issue counts and documentation whitespace were checked.

[Full independent review](.impeccable/critique/2026-11-04T17-18-35Z__extension-content-collection-export-js.md)
records reproduction details, evidence limits and recommended priorities.

Product context initialisation, November 4, 2026: documentation/configuration
only. `PRODUCT.md` records the user's confirmed audience (free and paid Patreon
users) and equal priority for reading comfort and offline downloads. The selected
comp-first workflow is stored only in `.impeccable/config.json`. JSON parsing,
product schema/platform checks, relative-link checks and `git diff --check` pass.
Runtime/browser suites were not rerun for this documentation-only task. Live-mode
injection is not configured for production Patreon pages or extension frames.

Collection menu layout, November 4, 2026: **71 Chrome export cases,
5 Brave cases including the installed extension, and 74 tooling cases passed**.
Syntax covers 56 JavaScript files; whitespace checks pass. Commands:

```sh
npx playwright test tests/collection-menu.spec.js tests/collection-completion.spec.js tests/collection-batches.spec.js tests/collection-retry.spec.js tests/collection-refresh.spec.js tests/collection-report.spec.js tests/collection-book.spec.js tests/collection-export.spec.js tests/collection-progress.spec.js tests/archive-stream.spec.js tests/export.spec.js tests/export-security.spec.js
npm run test:brave -- tests/collection-menu.spec.js tests/installed.spec.js
npm run test:tooling
npm run check
git diff --check
```

The supplied screenshot showed clipped choices and an inner frame scrollbar.
Synthetic tests now load the packaged chooser HTML/CSS/script through a mock
extension API bridge, rather than plain substitute buttons. At 1280×900 in light
and dark themes and 360×740 in dark theme, tests verify all three descriptive
choices, minimum button heights, no frame overflow, panel bounds and keyboard
Enter downloads. Enlarged text triggers actual resize measurement; stale tokens
and oversized messages are ignored, and Escape closes the panel and restores
focus. Page-error capture is clear. Browser plugin not available; validation uses
the repository Playwright setup with isolated Chrome/Brave profiles.

Batched screenshots outside the repo were inspected. The confirmation pass shows
a quiet collapsed report and preparation details, full-width choices and no inner
chooser scrollbar. The mechanical design scan found two 10px ZIP badges; their
font size is now 11px. The detector was not rerun after that correction.

Initial tooling mocks lacked ResizeObserver/document layout APIs and were updated.
Early browser runs exposed a visibility-dependent animation-frame wait in the mock
API bridge, fast pointer delivery before frame resizing settled, and missing
controls while the chooser was hidden during generation. The bridge no longer
waits on child-frame rendering. The chooser now waits for its owning panel's
layout acknowledgement before enabling choices, and remains in place, dimmed,
during generation. Finished progress details collapse. A format-switch fixture
explicitly brings the permission frame into view after an error. The superseded
broad run was interrupted; final runs above pass with those corrections.

Native Brave exercises all three actual formats and repeated downloads. Synthetic
fixtures establish layout and interaction behavior; the supplied account screenshot
is the live evidence, and the redesign has not been verified on a signed-in live
Patreon collection. Other viewports, localization and arbitrary browser zoom are
not exhaustively covered. Download/cache/access behavior and permissions are
unchanged.

Collection download completion, November 4, 2026: **67 Chrome export cases,
6 Brave cases including the installed extension, and 74 tooling cases passed**.
Syntax covers 55 JavaScript files; whitespace checks pass. Commands:

```sh
npx playwright test tests/collection-completion.spec.js tests/collection-batches.spec.js tests/collection-retry.spec.js tests/collection-refresh.spec.js tests/collection-report.spec.js tests/collection-book.spec.js tests/collection-export.spec.js tests/collection-progress.spec.js tests/archive-stream.spec.js tests/export.spec.js tests/export-security.spec.js
npm run test:brave -- tests/collection-completion.spec.js tests/installed.spec.js
npm run test:tooling
npm run check
git diff --check
```

Worker fixtures exercise native completion/interruption, owner-only notifications,
unrelated/duplicate events, post-download search reconciliation, restart with a
finished download, absent history, error redaction and physical archive cleanup.
The first tooling run counted the session encryption key as an archive record;
assertions now specifically check archive records and disk files. Initial browser
cases raced the asynchronous chooser message; the helper now waits for a recorded
handoff before checking final chooser readiness.

Browser cases cover per-post and per-part results, early completion before the
packaging reply, saved reports, closed/reopened dialogs, stale attempts, rejection
of messages from content scripts, independent numbered parts and expiry without
late-result resurrection. Installed Brave confirms Completed after actual native
EPUB saving. Interruption and restart reconciliation use synthetic browser API
fixtures; live interrupted downloads and live Patreon were not exercised.

The existing page-local report expires after two hours and is cleared by explicit
Refresh, navigation/reload or a new attempt. Worker restart reconciles pending
native archives through browser history; missing history shows Status unavailable
rather than inventing completion/interruption. Reports confirm browser download
state, not archive validity or successful opening. No new permissions or durable
download-history cache are introduced.

Large collection batches, November 3, 2026: **62 Chrome export cases,
7 Brave cases including the installed extension, and 69 tooling cases passed**.
Syntax covers 54 JavaScript files; whitespace checks pass. Commands:

```sh
npx playwright test tests/collection-batches.spec.js tests/collection-retry.spec.js tests/collection-refresh.spec.js tests/collection-report.spec.js tests/collection-book.spec.js tests/collection-export.spec.js tests/collection-progress.spec.js tests/archive-stream.spec.js tests/export.spec.js tests/export-security.spec.js
npm run test:brave -- tests/collection-batches.spec.js tests/installed.spec.js
npm run test:tooling
npm run check
git diff --check
```

Synthetic 101-post fixtures verify two automatically downloaded parts for Markdown
ZIP, EPUB ZIP and Single EPUB. They inspect ordered global filenames, chapter
counts, each book's local TOC/navigation, reports spanning parts, failed later-part
retry without repeating earlier chapters, cancellation after an earlier handoff,
and switching formats after a later failure. Discovery refuses 1,001 posts before
preflight; worker fixtures prepare/restore 1,000 metadata records and build the
last indexed chapter after restart. Installed Brave retains real native-download,
worker-restart and expiry coverage using its smaller fixture; it does not exercise
native multi-part downloads or a live large Patreon collection.

Collections are capped at 1,000 discovered posts, with at most 100 prepared
chapters per output part. Existing single-part names remain unchanged. Source
cache and archive quotas remain 512 MiB and 1 GiB respectively; these are disk
payload limits, not RAM guarantees. Parts are split by chapter count, not measured
bytes. An image-heavy part can still exceed the archive budget or browser quota;
errors remain retryable with committed chapters retained. Earlier native downloads
can temporarily consume the shared archive budget until completion/interruption.
Cancellation stops remaining work without retracting earlier handoffs. Completion
of a native download is still distinct from the report's Download started state.

Automatic network retries, November 3, 2026: **56 Chrome export cases,
14 Brave focused cases including the installed extension, and 68 tooling cases
passed**. Syntax covers 53 JavaScript files; whitespace checks pass. Commands:

```sh
npx playwright test tests/collection-retry.spec.js tests/collection-refresh.spec.js tests/collection-report.spec.js tests/collection-book.spec.js tests/collection-export.spec.js tests/collection-progress.spec.js tests/archive-stream.spec.js tests/export.spec.js tests/export-security.spec.js
npm run test:brave -- tests/collection-retry.spec.js tests/collection-refresh.spec.js tests/collection-report.spec.js tests/installed.spec.js
npm run test:tooling
npm run check
git diff --check
```

Tests verify 503/connection recovery, bounded retries, Retry-After seconds/dates
and long-wait refusal, 401/403 manual failures, no hidden DOM retry after exhaustion,
aborting waits/requests, media origin/credential/redirect policy, discarded partial
stream bytes, and terminal completed-build failures. Existing collection ZIP/book/
report/cache/progress/security cases exercise retained completed chapters and
manual retry flows. Installed Brave injects a temporary API error and verifies
eventual preparation, cache reuse, native downloads and expiry cleanup.

Initial broad and isolated runs exposed repeated synthetic post-chooser pointer/
layout timing failures: captured clicks produced no choice message. The fixture
retains disabled buttons until handlers/rendering are ready. Three post exporter
cases now use the same runtime delivery seam already used by source-reuse tests;
installed Brave retains real chooser gestures. A focused 14-case run then passed,
followed by the final broad suites above. These are exporter behavior tests,
not a claim that synthetic mouse delivery is equivalent to native permission
requests.

Network attempts have a per-attempt deadline; external servers/permissions and
live Patreon behavior remain outside these synthetic fixtures. No new permission
or raw network-error persistence is introduced. Retries do not apply to storage,
packaging or native download side effects.


Incremental collection refresh, November 3, 2026: **36 Chrome collection/
refresh/report/book/progress/streaming cases, 12 Brave refresh/report/book/installed
cases and 60 tooling cases passed**. One existing Chrome cancellation/restart
case timed out waiting for its synthetic chooser download during the broad run;
its isolated rerun passed (35 broad-run passes plus that isolated pass). Syntax
covers 50 JavaScript files; whitespace checks pass. Commands:

```sh
npx playwright test tests/collection-refresh.spec.js tests/collection-report.spec.js tests/collection-book.spec.js tests/collection-export.spec.js tests/collection-progress.spec.js tests/archive-stream.spec.js
npm run test:brave -- tests/collection-refresh.spec.js tests/collection-report.spec.js tests/collection-book.spec.js tests/installed.spec.js
npm run test:tooling
npm run check
git diff --check
```

Worker/cache cases reconcile new/changed/removed/reordered posts, preserve a live
unchanged source across worker restart, reject cross-owner refresh, recheck missing
or expired bytes/revisions, retain original source deadlines, and prevent cancelled
refreshes from publishing late state. Browser cases verify refreshed API body
fingerprints, same owner token/order, new membership locks and absent evidence.
Installed Brave waits for an initial API performance entry, asserts persisted
revisions, downloads cached ZIP/book outputs across worker restarts, then refreshes
without opening post tabs and confirms unchanged-source counts. An early native
fixture ran before its initial API entry, correctly failing to qualify for reuse;
waiting for that evidence made the intended path deterministic. A worker expiry
fixture also exposed that expired retained entries should be pruned during
reconciliation; the cache now prunes them before retaining the requested IDs.

These fixtures do not establish authenticated live Patreon compatibility or that
its private collection endpoint always provides full structured bodies. Without
explicit access and usable content evidence the extension revalidates normally.
Refresh still downloads pagination data to compute comparisons; it saves post-page
and image retrieval when cached sources qualify. No raw body/media URL is persisted
in revision metadata, and reused sources never receive a fresh expiry timestamp.


Collection download report, November 3, 2026: **34 Chrome collection/report/
book/progress/streaming cases, 6 Brave report/installed cases and 56 tooling
cases passed**. Syntax checks cover 49 JavaScript files; whitespace checks pass.

```sh
npx playwright test tests/collection-report.spec.js tests/collection-book.spec.js tests/collection-export.spec.js tests/collection-progress.spec.js tests/archive-stream.spec.js
npm run test:brave -- tests/collection-report.spec.js tests/installed.spec.js
npm run test:tooling
npm run check
git diff --check
```

New fixtures inspect per-post locked/preparation skips, chapter failures,
packaging failures without false success, replaced failures after retry, plaintext
report downloads and canonical URLs, remote-error URL redaction, inert HTML-like
titles, cancellation, reopening, explicit refresh, navigation and two-hour expiry.
Worker fixtures retain individual skip details across restart without signed
URLs and report unsupported-only collections without leaving sessions. Installed
Brave checks report counts, native-handoff wording and Save report availability.
Desktop/light and narrow/dark synthetic screenshots were inspected; the report
uses bounded list/dialog scrolling. The Impeccable detector returned no findings.
The earlier locked-only fixture needed explicit performance-resource discovery
setup; the fixed fixture uses the same seam as existing collection API tests.
An intermediate worker regression caught a shadowed variable in the new skip
handler, corrected before these successful runs. Tests do not claim live Patreon
verification, detailed diagnoses when Patreon exposes no cause, or native-save
completion tracking. Saved reports are explicit user downloads; ephemeral report
state is page-local, while preparation skip metadata follows session retention.


Single EPUB collection download, November 3, 2026: **43 Chrome cases, 44 Brave
cases (including the installed extension), and 54 tooling cases passed**. Syntax
checks cover 48 JavaScript files; whitespace checks pass. Reproduce with:

```sh
npx playwright test tests/collection-book.spec.js tests/collection-export.spec.js tests/collection-progress.spec.js tests/archive-stream.spec.js tests/export.spec.js tests/export-security.spec.js
npm run test:brave -- tests/collection-book.spec.js tests/collection-export.spec.js tests/collection-progress.spec.js tests/archive-stream.spec.js tests/export.spec.js tests/export-security.spec.js tests/installed.spec.js
npm run test:tooling
npm run check
git diff --check
```

New fixtures download a single `.epub`, independently check it with `unzip -t`,
verify first-entry stored mimetype/no extra fields, parse all XML, inspect the
manifest/spine/TOC, resolve chapter image/style/navigation paths, and confirm
creator/source/download-time metadata and sanitized images. Repeated images
share a resource within a chapter. Mode switching retains separate-file ZIPs.
Failed chapters retry independently; packaging retry reuses staged files with
whole-file reads forbidden. Cancellation suppresses late downloads and clears
staging. Node disk fixtures cover streaming/restart, quota errors, rejected paths
and owner closure during inflation/assembly. Installed Brave downloads all three
collection modes using encrypted cached sources across worker restarts, without
opening post tabs again.

The first native filename check caught a ZIP MIME hint on the finished book;
the offscreen handoff now uses a disk-backed Blob slice with explicit EPUB/ZIP
MIME. The full Brave rerun passed and checks the saved extensions. These checks
do not establish live authenticated Patreon behavior or certification in EPUB
readers. The 100-post, 1 GiB temporary-archive and 512 MiB source-cache limits
still apply; source conversion needs memory, and final ZIP/EPUB backing files
are temporarily plaintext until download cleanup.


Single-book writer, November 3, 2026: **54 tooling cases passed**. New worker/disk
fixtures exercise an EPUB assembled from encrypted retry chapters after worker
restart, files exposing only bounded streams, publication quota exhaustion,
unexpected nested paths/invalid metadata, and owner closure during assembly.
These checks validate the writer contract; browser/UI evidence is recorded in
the subsequent collection-book checkpoint.


Markdown newline correction, November 2, 2026: **14 Chrome post/security cases,
15 Brave post/security/installed cases and 50 tooling cases passed**. Syntax
checks cover 46 JavaScript files; whitespace checks pass. Focused commands:

```sh
npx playwright test tests/export-security.spec.js tests/export.spec.js
npm run test:brave -- tests/export-security.spec.js tests/export.spec.js tests/installed.spec.js
npm run test:tooling
npm run check
git diff --check
```

The rendered-output matrix uses LF, CRLF and bare CR in code nested inside lists,
nested lists, blockquotes, quoted lists and headings, plus inline code and ordinary
text. Code includes literal HTML and backticks. Both direct exports and conversion
of raw cached snapshots are parsed with CommonMark and previewed with external
requests blocked. Assertions verify canonical LF output, preserved ordinary text,
HTML remaining code, no script effect and no external request. Installed Brave
checks the real collection download/cross-format cache path. Tests are synthetic;
live Patreon and third-party reader compatibility remain unverified.


Security audit follow-up, November 2, 2026: **41 Chrome cases, 42 Brave cases
(including installed-extension coverage), and 50 tooling cases passed**. Syntax
checks cover 46 JavaScript files; `git diff --check` passes. Reproduce with:

```sh
npx playwright test tests/export-security.spec.js tests/export.spec.js tests/popup.spec.js tests/collection-export.spec.js tests/archive-stream.spec.js tests/collection-progress.spec.js
npm run test:brave -- tests/export-security.spec.js tests/export.spec.js tests/popup.spec.js tests/collection-export.spec.js tests/archive-stream.spec.js tests/collection-progress.spec.js tests/installed.spec.js
npm run test:tooling
npm run check
git diff --check
```

At that historical checkpoint, the popup regression covered optional-origin
revocation. The November 4 UI removal below supersedes that popup behavior. Native installed
Brave checks the real permission-list API plus encryption, downloads, worker
restart and cleanup. Markdown security tests parse the output with development-only
CommonMark. These synthetic/installed fixtures do not establish authenticated
Patreon compatibility or secure disk erasure after forced termination.


Encrypted retry/archive-budget follow-up, November 2, 2026: **50 tooling cases,
25 Chrome collection/progress/streaming cases and 3 Brave installed/streaming
cases passed**. Syntax covers 46 JavaScript files. New cases reject tampered
retry frames, purge legacy plaintext, remove plaintext ZIPs after failed handoff,
and enforce a shared quota across concurrent jobs, pending writes and staging,
including restoration after worker restart. The installed case verifies encrypted
source reuse and native downloads after worker suspension. The limits count disk
payloads, not filesystem overhead or total extension RAM. Temporary download ZIPs
remain plaintext while needed; secure erasure after a crash is not established.


Encrypted source-cache follow-up, November 2, 2026: **46 tooling cases and one installed Brave case passed**.
Tests inspect stored bytes/headers for plaintext, round-trip encrypted sources,
reject tampering and cross-owner substitution, remove legacy plaintext, and verify
budget, cancellation and fixed expiry behavior. Browser-session key material is
kept separate from durable preferences.


Nested Markdown follow-up, November 2, 2026: **12 Chrome post/security cases
passed**, including actual CommonMark rendering of code inside lists, nested
lists, blockquotes and malformed headings. The synthetic preview confirms no
active injected image, script effect or external request. CommonMark is a pinned
development dependency and is not included in extension packages.


Export security hardening, November 2, 2026: **36 Chrome export/security/
collection/progress/streaming cases, 11 Brave post/security cases, one installed
Brave case, and 44 tooling cases passed**. `npm run check` covers 45 JavaScript
files; `git diff --check` passes. Reproduce with:

```sh
npx playwright test tests/export-security.spec.js tests/export.spec.js tests/collection-export.spec.js tests/archive-stream.spec.js tests/collection-progress.spec.js
npm run test:brave -- tests/export-security.spec.js tests/export.spec.js tests/installed.spec.js
npm run test:tooling
npm run check
git diff --check
```

Security fixtures verify literal Markdown/HTML escaping, delimiter-safe links,
backtick-safe code, graphics-only SVG reconstruction, cached SVG sanitization,
raster MIME disguises and rejection of XML declarations/unsupported MIME types.
Worker fixtures verify bounded incremental reads, cancellation before reading the
rest of an oversized response, exact output bytes, a two-request concurrency cap,
and aborting stalled requests at the configured deadline. Network chunks are
coalesced into bounded buffers. Existing assertions were updated to expect escaped
Markdown source; EPUB text expectations remain unchanged. Initial broad checks
exposed those outdated literal-source expectations before the passing runs above.
These are synthetic tests, not authenticated live Patreon/media-host verification
or a third-party Markdown/EPUB reader compatibility audit. SVG effects outside the
allowlist are removed, redirected media requests fail closed, and payload limits
are not a guarantee of total extension RAM usage. Cached data is still unencrypted;
expiry and shutdown deletion retain their documented best-effort limitations.


Export retention, November 2, 2026: **23 Chrome collection/progress cases, 8
isolated Chrome post cases, 26 Brave collection/progress/streaming/installed cases,
and 41 tooling cases passed**. Syntax checks cover 44 JavaScript files.
The installed Brave test advances its worker clock, fires a native browser alarm,
and verifies deletion of cached text/images, prepared session metadata, and an
unfinished OPFS archive entry without another export. Saved Reader/customisation
storage is compared before/after and remains identical. Earlier broad post checks
hit the existing synthetic EPUB chooser timeout; the isolated post suite passed.

New lifecycle tests distinguish worker restarts from browser startup, preserve live
session caches, clean after last-window closure (but not while another window is
open), resume requests for a new window, and disarm alarms once caches are empty.
Concurrent cleanup/scheduling cannot leave an obsolete alarm. Worker sweeps remove
expired source records and archive files; expired archive GET cannot revive them.
The older retry fixture now expects expired disk files to be rebuilt, preserving
chapter order. Tests do not claim guaranteed disk erasure during OS crashes or
forced browser termination. Browser alarm delivery can be delayed by sleep or
scheduling. Active task/download backing files are protected until safe cleanup;
durable preferences and user-saved exports are outside the cleanup scope.

Detailed collection progress, November 2, 2026: **20 existing Chrome collection
cases plus 3 focused Chrome progress cases passed; 26 Brave collection/progress/
streaming/installed cases and 35 tooling cases passed**. Syntax checks cover 42
JavaScript files. New progress cases hold real workflow boundaries to inspect
current titles, cached/failed/completed counts, compression input/output bytes,
stage percentages, packaging payload bytes, and fresh retry counters. A virtual
monotonic clock verifies elapsed updates and cancellation freeze. Untrusted title
markup stays text; wrong attempt IDs and late replies cannot replace active or
cancelled state. Compression is held before disk commit to verify it remains at
99%. Background cases verify cache-hit metadata/title correlation and monotonic
packaging byte totals through finalization. The installed Brave test verifies the
real hidden-document handoff still succeeds with attempt IDs.

Counts and percentages are stage-specific, not an estimated overall percentage or
remaining-time prediction. Elapsed time ends at extension handoff; the browser
tracks subsequent download time. These checks use synthetic pages/media; live
authenticated Patreon progress has not been verified.

Streaming collection archives, November 2, 2026: **20 Chrome collection cases and
10 Chrome post/streaming cases passed; 23 Brave collection/streaming/installed
cases and 8 isolated Brave post cases passed; 35 tooling cases passed**.
Syntax checks cover 41 JavaScript files.
The new 12 MiB random-data case forbids whole-file `Blob.arrayBuffer()` reads,
stores only metadata in retry entries, checks bounded message chunks, and validates
the resulting archive with independent inflation, `unzip`, and macOS `ditto`.
Fixtures use the real OPFS archive controller with a test download handoff.
The unpacked Brave test uses real OPFS, browser-managed downloads into an isolated
test directory, and the hidden extension document. It checks actual file bytes,
no newly opened tabs, empty temporary directories after completion, and closure
of the hidden document. Browser download completion is queried through the
extension's own download IDs rather than a Patreon-page download event.

New cases cancel disk-chunk receipt and packaging, report unavailable temporary
storage without a partial download, restore completed entries after worker restart,
handle quota failure before retry, reject wrong owners/out-of-order chunks, and
remove partial, expired, or orphaned files. Source rendering still needs one
chapter in memory; this is not a full image-to-ZIP streaming renderer or a measured
peak-RAM benchmark. The output must fit classic ZIP's 32-bit size/offset limit
(below 4 GiB); ZIP64 is not supported. The required downloads/offscreen permissions
support safe handoff and completion cleanup without a download tab. Live
authenticated Patreon validation remains pending. One earlier broad Chrome run
hit the existing synthetic post-chooser EPUB click timeout; the isolated post suite
passed afterward.
Six focused Chrome cancellation/recovery cases passed again after adding guards
against late archive creation and late chooser mounting after cancellation.

Shared export sources, November 2, 2026: **18 Chrome collection cases and 8
isolated Chrome post cases passed; 19 Brave collection/installed cases and 8
isolated Brave post cases passed; 33 tooling cases passed**. Syntax checks cover
35 JavaScript files. The installed test downloads Markdown, closes both source
post tabs, terminates the extension worker, and downloads distinct EPUB chapters
without opening any post tab. It inspects extension-origin CacheStorage from a
first-party extension page; Brave blocks CacheStorage inspection from the
third-party chooser iframe, so that frame is not used to inspect disk state.
The new post case checks shared remote-image retrieval across formats, duplicate
image references with one EPUB asset, fresh output time, Reader-style reuse,
content invalidation, and expiry. It drives the existing runtime choice message
to isolate caching from synthetic chooser click timing; the installed case still
clicks the real packaged chooser.

Tooling covers cache byte limits, preservation of already-cached chapters when a
collection exceeds its budget, cross-collection eviction, fixed expiry, corruption,
cancelled writes, owner cleanup, unavailable storage, and worker-restored hits.
Source data is stored on local disk, separate from metadata-only session storage.
The generated-file retry/ZIP buffers still grow with the requested archive;
this feature does not provide streaming ZIP generation. Browser tests use synthetic
pages and media, not an authenticated Patreon collection. Earlier broad runs
encountered the existing PDF-status click flake and a synthetic post chooser click
timeout; the isolated post suites passed. No live authenticated cache-reuse claim
is made.

Collection retry/resume, November 2, 2026: generation now requests and receives
one chapter at a time. **18 Chrome collection tests, 7 isolated Chrome post tests,
19 Brave collection/installed tests, and 28 tooling tests passed**; syntax checks
cover 33 JavaScript files. Browser cases inject chapter-generation and chunk-transfer
failures, verify later chapters still finish, withhold a partial ZIP, and resume
only missing chapters in original order. Recovery covers Markdown and nested EPUB
bytes, panel reopening, missing prepared sessions, packaging failure without
rebuilding, and explicit Refresh clearing retained entries. The background case
verifies index bounds, cleanup after failure, retained prepared metadata, and a
successful indexed retry after worker restart. Completed files stay only in
page memory; reload/navigation, Cancel, Refresh, or format changes discard them.
Preflight skips are outside this recovery scope. Authenticated live recovery is
pending confirmation.

Two focused recovery cases passed again after adding discovery-cache expiry to
the EPUB retry scenario; completed chapters survive re-preparation when ordered
post URLs still match.

During broader post-export runs, the existing PDF status and remote-media
progress checks intermittently failed; the unchanged seven-test post suite
passed in an isolated Chrome run. The first browser launch attempt was blocked
by the filesystem sandbox; subsequent runs used isolated profiles outside it.

Active collection cancellation, November 1, 2026: **all 21 targeted Chrome
collection/post export tests, 22 targeted Brave collection/post/installed tests,
and 27 tooling tests passed**; syntax checks cover 33 JavaScript files. Browser
regressions cancel API discovery (observing request abort without a Load more
fallback), stalled preparation, generation, chunk receipt, cached-session recovery,
and delayed compression. They verify no late ZIP or status replacement occurs and
Start again can prepare/export after cancellation. A post regression cancels
generation in an existing tab while media is pending and rejects a late reuse of
the cancelled transfer ID without closing that tab.

Background cases verify cancellation while preflight has not yet finished,
worker closure before a stalled reply resolves, pending media fetch abort,
rejection of late media requests, saved-session cleanup, owner checks, and closure
of a worker whose creation completes after cancellation. ZIP CRC calculation now
yields between 1 MiB chunks so cancellation remains available during packaging.
Commands: `npm test -- tests/collection-export.spec.js tests/export.spec.js --reporter=dot`,
`npm run test:brave -- tests/collection-export.spec.js tests/export.spec.js tests/installed.spec.js --reporter=dot`,
`npm run test:tooling`, and `npm run check`. Tests use synthetic pages and
intercepted media; authenticated live cancellation remains pending confirmation.
Cancellation applies before handing the finished ZIP to the browser and does not
control already-started browser downloads or Patreon's own in-flight Load more
request. No full browser-suite rerun was performed for this change.

Idle collection sessions, November 1, 2026: **all 8 targeted Chrome collection
tests, 9 targeted Brave collection/installed tests, and 24 tooling tests passed**;
syntax checks cover 33 JavaScript files. The installed Brave test terminates the
actual extension service-worker target after preparation, then clicks Markdown
in the still-open chooser. It terminates the new worker before the following EPUB
click, verifies both restored downloads contain distinct correct chapters, then
cancels the session and verifies the next click shows an expired-session error.

Unit regressions restart the background VM against shared session storage and
verify preparation is not repeated, post/file data is excluded from saved records,
another tab cannot access or invalidate a restored session, expiration removes
stored records, and owner-tab closure cleans up even during startup restoration.
Chooser tests cover missing sessions on initial load and on a later click; the
browser panel test rejects stale tokens and accepts the current frame's error.
Collection handlers wait for restoration before reading session state.

Commands: `npm test -- tests/collection-export.spec.js --reporter=dot`,
`npm run test:brave -- tests/collection-export.spec.js tests/installed.spec.js --reporter=dot`,
`npm run test:tooling`, and `npm run check`. The first Chrome run timed out on the
Markdown download case; its isolated rerun and the full targeted rerun passed.
The installed test uses intercepted synthetic posts; authenticated Patreon export
after a natural idle timeout remains a separate live confirmation.

Background collection focus, November 1, 2026: **all 19 tooling tests and the
targeted installed-Brave test passed**; syntax checks cover 32 JavaScript files.
Two regressions failed against the previous activation fallback and pass after
its removal: one keeps navigation stale for ten replies during preparation and
generation, beyond the old eight-attempt threshold; the other never becomes
ready within the retry budget. Both verify that no worker or owner tab is
activated and worker cleanup occurs; the timeout case reports its skipped post.
The installed Brave case still downloads collection Markdown followed by EPUB.
Commands: `npm run test:tooling`, `npm run check`, and
`npm run test:brave -- tests/installed.spec.js --reporter=dot`. Retry unit tests
use accelerated timers. Live Patreon loading while another tab stays selected
remains pending confirmation; no full browser-suite rerun was performed.

Two-hour collection cache, November 1, 2026: the focused cache lifecycle test
passed in Chrome and Brave, all 17 tooling tests passed, and syntax checks cover
32 JavaScript files. Simulated time verifies page discovery and worker preparation
remain reusable at 119 minutes and expire after 121 minutes. Commands:
`npm test -- --grep 'collection reuses' --reporter=dot`,
`npm run test:brave -- --grep 'collection reuses' --reporter=dot`,
`npm run test:tooling`, and `npm run check`. This changes the 15-minute lifetime
recorded at the earlier checkpoint below to two hours. Cache remains in memory
and clears on navigation/reload; a worker restart can require preparation again.

Collection cache reuse, November 1, 2026: **all 7 targeted Chrome collection
tests, all 8 targeted Brave collection/installed tests, and all 17 tooling tests
passed**; syntax checks cover 32 JavaScript files. The browser lifecycle regression
verifies closing/reopening and consecutive Markdown/EPUB download actions perform
only one API discovery and one preparation pass. It then verifies explicit
refresh discovers new posts, lost background sessions repeat only preparation,
15-minute expiry repeats discovery, and collection navigation clears the cache.
The background regression verifies successful finalization releases transfer data
while retaining prepared metadata, rebuilding creates/closes a fresh worker
without repeating preflight, and cancellation invalidates the retained session.
The installed Brave case downloads Markdown then EPUB using the retained session
and independently checks both archives contain the correct distinct chapters.

Commands: `npm test -- tests/collection-export.spec.js --reporter=dot`,
`npm run test:brave -- tests/collection-export.spec.js tests/installed.spec.js --reporter=dot`,
`npm run test:tooling`, and `npm run check`. These use synthetic pages; live
authenticated caching behavior after extension reload remains unverified. No full
browser-suite rerun was performed for this scoped change.

Locked collection posts, November 1, 2026: **all 6 targeted Chrome collection
tests and all 7 targeted Brave collection/installed-extension tests passed**;
syntax checks cover 32 JavaScript files. The paginated fixture verifies that
`current_user_can_view` is requested on every page, explicit boolean `false`
posts never reach preparation, duplicates are counted once, pagination totals
still include locked posts, and missing or nonboolean flags retain normal
preparation. Separate single-post and multiple-post all-locked cases verify no
worker preparation request or format chooser is started and progress clears.

Commands: `npm test -- tests/collection-export.spec.js --reporter=dot`,
`npm run test:brave -- tests/collection-export.spec.js tests/installed.spec.js --reporter=dot`,
and `npm run check`. No full browser-suite rerun was performed for this scoped fix.

Live read-only Brave inspection found 75 collection posts across four API pages:
74 marked accessible and one explicitly inaccessible. Running the updated
discovery function in that same signed-in collection tab returned
`{ready:74, locked:1}`. This verifies live access filtering, not a complete
installed-extension export after reload. No post text, signed URLs, raw responses,
or account data were committed. DOM-only fallback still relies on the existing
generic preparation failures when the API access flag is unavailable.

Collection archive and identity fixes, November 1, 2026: **45 Chrome cases passed
with one expected skip, all 46 Brave cases passed, and all 17 tooling tests
passed**; syntax checks cover 32 JavaScript files. Browser tests exercise real
compression of a synthetic 1.2 MB nested EPUB, independent raw-DEFLATE inflation,
exact reconstructed contents, its stored first `mimetype` entry, Info-ZIP integrity,
macOS ZIP detection, and `ditto` extraction. Archive Utility also extracted the
browser-generated regression ZIP; `cmp` verified its EPUB matches the independent
extraction byte-for-byte. The installed Brave test verifies distinct Markdown
post bodies after actual extension messaging and compressed download.

The background regression holds each worker navigation on the old document for
two successful replies during both preparation and generation. It verifies eight
stale replies are rejected, all three output titles are distinct, transferred
post bodies match the requested IDs, and worker cleanup still occurs. A browser
regression verifies that incorrect requested IDs and a changed SPA URL with the
previous document cannot generate a file. Content scripts require a completed
document with matching initial/current post IDs, and the worker independently
validates the response ID. Full current authenticated Patreon collection export
still requires user confirmation after reloading the extension and page.

Archive Utility investigation, November 1, 2026: the user reports that the new
method-8 download is still unsupported. Metadata and checksum checks on the newest
76,144,838-byte archive found 74 complete outer entries and valid nested EPUB ZIP
entries. Nevertheless, `/usr/bin/file -b` reports `data`. The previous method-8
checkpoint below did **not** establish Archive Utility compatibility.

Synthetic diagnostics using the then-current ZIP writer reproduced this distinction:

| Outer payload | macOS `file` result |
| --- | --- |
| Large EPUB, ZIP method 0 | `data` |
| Large EPUB, method 8 with stored DEFLATE blocks | `data` |
| Same EPUB, method 8 with actual zlib raw compression | ZIP archive |
| Same stored-block EPUB, longer first filename | ZIP archive |
| Markdown, stored or deflated | ZIP archive |

The local `/usr/share/file/magic/archive` generic ZIP rule excludes
`application/epub+zip` in its early payload search. The newest live outer archive
exposes that nested marker at byte 118; stored DEFLATE blocks leave it readable.
A same-size synthetic marker substitution also restores ZIP detection, isolating
the marker from timestamps, archive size, and ZIP directory structure. Actual
Archive Utility extraction of the compressed synthetic control produced the
expected EPUB. The stored-block control produced no extracted output; reading its
GUI error text was unavailable because `osascript` lacks assistive access.

Checks used: `file -b`, `unzip -t`, a temporary Node diagnostic using the current
writer and `node:zlib`, independent directory/size/CRC checks on outer and nested
entries, and `open -a 'Archive Utility'` on synthetic controls. No runtime change
or full browser-suite run was made for this diagnosis.

Separately, aggregate inspection of all three supplied/local collection archives
found 74 entries but only one unique post title, source URL, and post body in
each. UUID/time metadata explains the distinct EPUB byte hashes. At that checkpoint,
worker navigation did not wait for the destination document or bind export responses to
the requested post, so successful ZIP validation does not establish correct
collection contents. Both issues were unresolved at that diagnostic checkpoint;
the subsequent fixes and verification are recorded above.

Download progress, November 1, 2026: **43 Chrome cases passed with the Brave-only
installed case skipped, all 44 Brave cases passed, and all 16 tooling tests
passed**; syntax checks cover 31 JavaScript files. The post regression holds a
remote image request open and verifies that the accessible activity bar remains
visible until the download starts. The collection regression verifies that the
bar appears immediately during discovery and clears when all posts are ready;
the background-worker test verifies exact `0..N` preparation and generation
updates for a three-post collection.

Outer ZIP deflate compatibility, November 1, 2026: **43 Chrome cases passed with
the Brave-only installed case skipped, all 44 Brave cases passed, and all 16
tooling tests passed**; syntax checks cover 31 JavaScript files. The focused
collection case verifies method 8, valid timestamps, Info-ZIP validation, and
macOS `ditto` extraction with a synthetic entry spanning multiple DEFLATE blocks.
The second supplied live archive was complete and all
74 nested EPUB containers validated, but its method-0 outer archive was still
classified as generic data. The new deflate stored-block output is identified as
ZIP data while leaving individual EPUB ZIP structure unchanged.

Chunked collection transfer, November 1, 2026: **43 Chrome cases passed with the
Brave-only installed case skipped, all 44 Brave cases passed, and all 16 tooling
tests passed**; syntax checks cover 31 JavaScript files. The background regression
uses a synthetic file larger than two chunks and verifies that both messaging
boundaries transfer no more than 1 MiB of file data per response, return metadata
instead of aggregate contents, reconstruct the exact declared length, finish the
session, and close both phase workers. The installed Brave case verifies the real
content-script/service-worker collection path.

Collection worker cleanup, October 31, 2026: all 16 tooling tests passed after
changing the worker lifecycle to close the single reusable tab at the end of
preflight and again at the end of file generation. The regression verifies three
unopened posts per phase create one worker, navigate it twice, and close it once.

Collection ZIP compatibility, October 31, 2026: the focused Chrome collection
download passed Info-ZIP validation and macOS `ditto` extraction after assigning
the outer archive `application/zip` and valid DOS entry timestamps. The reported
74-entry live archive was complete and extracted successfully with both tools;
Archive Utility rejected that earlier noncanonical download.

Collection label adjustment, October 31, 2026: the three focused Chrome
collection cases, the installed-extension Brave case, and syntax checks for 31
JavaScript files passed after changing the control and dialog heading to
**Download Collection**.

Separate-file collection export, October 31, 2026: **43 Chrome cases passed with
the Brave-only installed case skipped, all 44 Brave cases passed, and all 16
tooling tests passed**. Collection and detection cases cover route scoping, the
observed `/posts/<id>` card form, same-origin API cursor pagination without a UI
click, Load more fallback, transient disabled-button recovery across multiple
batches, same-origin filtering, duplicate removal, order, numbered Markdown ZIP
entries, content, and filename.
The unpacked-Brave case exercises real tab registration, extension
messaging, post extraction, ZIP download, and repeat-format preparation against
intercepted synthetic Patreon pages. A background-worker unit case verifies that
all unopened collection posts reuse one temporary tab through preparation and
build, then close it. Syntax checks cover 31 JavaScript files.
A user-supplied October 31 screenshot and sanitized structure establish 20
initial grid cards, a Load more control, 74 displayed total posts, and direct
numeric post paths. Automated export against that authenticated page, locked
collection behavior, remote collection images, and third-party EPUB readers remain
unverified.

Unreleased post-export development, October 29, 2026: **39 Chrome cases, 40
Brave cases, and 15 tooling tests passed**. Chrome skips the Brave-only installed
extension case. Five export cases cover Markdown, EPUB, the PDF print path,
embedded data and remote images, exact-origin permission requests, denial without
partial output, exclusion of comments/recommendations, rerender recovery, and
route cleanup. The Brave installed-extension case also verifies that Download is
mounted independently of Reader and, after changing Reader font and color,
downloads Markdown and then EPUB from the same open packaged chooser panel through
the isolated content script.
Syntax checks cover 27 JavaScript files. These
are synthetic checks; live Patreon image fetching, browser permission prompts,
manual Save as PDF, and third-party EPUB readers still require manual validation.
An additional detection case reproduces the user-supplied live generated class
prefixes and verifies body export, Reader typography, and surface selection.

Current hotfix (1.1.1): **33 Chrome cases, 34 Brave cases, and 15 tooling tests
passed**. Chrome intentionally skips the installed-extension case. New coverage
includes root hide-flag removal with Reader on/off, stable-state mutation counts,
show preference, unsupported routes, actual extension storage, fresh same-post
tabs, simulated load-time flag removal, and reloads with hiding on/off. Two new
Chrome recovery tests failed before the fix and passed afterward. Syntax,
whitespace, and 1.1.1 ZIP validation passed. These are synthetic-page runs, not
new live Patreon sessions.

Artwork refresh (1.1.0, after the release-testing confirmation): 15 tooling
tests and 4 targeted Brave popup/installed-extension tests passed. SVG sources
were rasterized with Chrome; PNG dimensions, color type, matching store/runtime
128px icons, and transparent padding were checked, and the artwork was visually
reviewed. Syntax, whitespace, and rebuilt ZIP validation passed. Full browser
suites and new live Patreon tests were not run for this branding-only update.

Release-renumbering verification (1.1.0): syntax checks and all 13 tooling tests
passed. Packaging validated the consistent version fields and generated
`dist/patreon-reader-1.1.0.zip`. Browser suites were not rerun for this
metadata-only change; earlier browser results remain historical evidence.

Rename verification (Patreon Reader): all 13 tooling tests and 4 targeted Brave
popup/installed-extension tests passed, including the installed name, popup
title, and renamed release filename. Syntax, whitespace, and packaging validation
passed. Full browser suites were not rerun for this metadata-only change.

Latest avatar-separation verification: **30 Chrome cases and 31 Brave cases
passed**, including custom-color shadows, native shape/dimensions, Default and
disable/re-enable, and out-of-scope image/control checks. Syntax, whitespace,
and rebuilt development ZIP validation passed. The user's final 1.1.0 testing
completion confirmation includes these changes.

Run these commands from the repository root with Node.js 22 or later:

```sh
npm ci
npm run check
npm run test:tooling
npm test
npm run test:brave
npm run package -- --force
```

- `check` recursively syntax-checks runtime, development scripts, and tests.
- `test:tooling` runs Node tests for packaging and browser discovery, without launching a browser.
- `test` runs the Chrome browser suites; `test:brave` runs the same suites plus the unpacked-extension case in Brave.
- `package` requires `zip` and `unzip` on PATH. Existing releases require explicit `--force` replacement. See [release packaging](docs/release-packaging.md).

Historical structural-work verification: **28 Chrome cases, 29 Brave cases, and 13
Node tooling cases passed**, plus syntax and whitespace checks. Chrome skips
the Brave-only installed test intentionally. Detailed dated results, earlier
failures/retries, and original browser/OS versions are retained in
[testing history](docs/testing-history.md); historical counts are not current totals.
The current local release target is **1.2.1**; 1.2.0 publication was confirmed
by the user. Confirm the dashboard's highest uploaded version before submitting
1.2.1; repository checks do not inspect that account. The 1.1.0 feature release consolidated the local 1.3.9
development series. Historical version numbers below describe their original
checkpoints, not the current release metadata.

The subsequent swatch-order change also passed 28 Chrome and 29 Brave cases,
including exact visual-order semantics via DOM order, keyboard navigation, and
legacy color migration assertions. The 1.3.9 ZIP was rebuilt and validated.
This checkpoint is included in the user's final 1.1.0 testing completion confirmation.

Historical popup-layout verification: **29 Chrome cases and 30 Brave cases passed**,
including a new 320px popup layout check in light/dark modes with long status
messages and usable switches. Syntax and ZIP packaging validation also passed.
This checkpoint is included in the user's final 1.1.0 testing completion confirmation.

After removing the popup footer, targeted checks passed: 3 Chrome popup tests
and 4 Brave popup/installed-extension tests. The full suites were not rerun for
this footer-only change; syntax, whitespace, and rebuilt ZIP validation passed.

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

Browser specs are grouped into appearance, collection export, comments, detection, export, lifecycle,
popup, settings, and installed-extension suites. Base HTML lives in `tests/fixtures/`;
shared setup, API mocks, and UI controls are in `tests/helpers/reader.js`. The helper
loads runtime scripts/styles in the order declared by `extension/manifest.json`,
including the DOM adapter. Playwright discovers only `*.spec.js`; Node tooling
cases live under `tests/tooling/*.test.cjs`.

Fixture tests intercept Patreon requests with synthetic HTML and mock local
storage/messaging. The promise-based `browser` mock is not Firefox-engine testing.
Brave's installed test uses a temporary profile, loads `extension/`, opens
`popup/popup.html`, and exercises real extension storage/content injection across
two synthetic post tabs. Its export regression uses real extension runtime and
tab messaging and a real browser download, while the Patreon response remains a
synthetic intercepted page. It saves panel/popup screenshots in ignored
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

For the 1.2.0 candidate, retain the 1.1.1 regression check: enable Hide Engagement
Bar, open the same affected post in a new tab,
refresh/reload it, and confirm the bar remains hidden without cycling the toggle.
Repeat with hiding off to confirm it stays visible; check with Reader on/off.
Record live results separately from the synthetic flag-removal regression tests.

For Chrome Web Store submission, record Chrome/OS versions and test the actual
extracted release ZIP. Record Brave checks separately. Firefox and Safari require
their own packaging and validation before advertising current download support;
they are not established by Chrome fixture tests or the original engagement-bar
support claims. Do not mark live account checks complete from synthetic captures.

- Upgrade from the currently published version with both engagement preferences
  and Reader enabled/disabled; saved appearance and visibility choices survive.
  Also check the legacy 1.0.0 upgrade: Reader starts disabled. Restart the browser
  and verify preferences are restored.
- Enable Reader in the extension popup. Exactly one Aa button appears before
  Like on the main post. Exactly one Download button appears before Aa (or before
  Like while Reader is disabled); neither appears in the floating bar or related cards.
- Export a public and legitimately accessible member post to PDF, EPUB, and
  Markdown. Confirm title, formatted body, links, and every inline image are
  present offline, while comments, recommendations, navigation, membership UI,
  and signed source URLs are absent. Deny a media-origin prompt and confirm no
  partial file is produced. Exercise multiple image origins and redirects.
- For PDF, confirm a direct `.pdf` download without opening a print dialog;
  check pagination, selectable/searchable text, clickable links, embedded images
  and page numbers. Confirm the document metadata appears above the title and lists
  Creator, Download time, and Source in that order. Confirm the same visible
  details and ordering in EPUB and Markdown. Confirm all three formats default to
  the sanitized post title as their filename. Open EPUB output in at least two readers and validate it with an EPUB 3
  validator. Check Markdown data-image support in the intended viewer.
- Open a collection and exercise all six combinations: PDF, EPUB and Markdown,
  each as Single file and Separate files (ZIP). Confirm accessible posts appear
  once, oldest to newest, using publication dates when complete or numeric post
  ID order otherwise. Check numbered title-based files, contents/navigation and
  numbered parts for collections over 100 accessible posts. Open ZIPs with macOS
  Archive Utility and inspect their files, rather than relying on browser completion.
- Opening the collection menu or changing selectors must not fetch collection
  data. Download starts discovery; API cursor pagination retrieves all pages,
  with Load more exhausted only on fallback. Reconcile included plus locked and
  other skipped posts against the discovered total; accessible counts need not
  equal Patreon's displayed total. Do not include unrelated post links.
- Verify the two-hour cache across output formats and worker restarts, expiry
  refetch, automatic cleanup after the last browser window closes and at startup,
  and persistence of Reader preferences separately. Cancelling or closing the
  owner tab cleans up its temporary work. Extension-created inactive post tabs
  close after use; existing user tabs stay open and focus stays where the user chose.
- Exercise cancellation, retained-chapter retry and packaging failure recovery.
  Reports must distinguish prepared chapters, Download started, browser-confirmed
  Completed/Interrupted and Status unavailable when history is missing. Save a
  report and confirm it contains no post bodies, signed media URLs or raw errors.
- While opening a post download and exporting a collection, confirm the progress
  bar is visible during work, advances by post when totals are known, and clears
  on completion or error without blocking another format choice.
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
Post export adds optional, on-demand HTTPS media-origin access and a packaged
background worker. The PDF renderer and fonts are bundled locally; no remote
executable code or remote fonts are used.


November 4, 2026 — Saved media access popup UI removal. Removed the count,
Forget action and associated popup code/styles; download permission requests and
external-image fetching remain unchanged. The popup regression now checks that
opening it does not query/revoke grants and exposes no permission-management UI.

Current checks: `npm run check` passes (60 JavaScript files in the working tree).
A temporary Node VM smoke check passes: popup initialization/page status and both
preference saves work with a permission API that throws on any access; markup has
no media-management section. `git diff --check` passes for the changed files.

Attempted `npx playwright test tests/popup.spec.js tests/export-security.spec.js
tests/export.spec.js` (18 cases). Chrome aborted during launch (SIGABRT/EPERM),
including an elevated retry, before any test body ran. Browser plugin not
available; regular Playwright was used. Rendered light/dark layout and remote
image export regressions remain unverified in this task; no live Patreon check.
Unrelated in-progress download changes were present and excluded from this commit.


November 4, 2026 — On-demand collection downloads. Opening the chooser now
performs no collection fetch or preflight visits. Selecting a format starts URL
discovery, then describes/builds each uncached chapter in the same document.
New image hosts pause for a direct extension-frame permission click. Denial stops
the attempt. Unsupported/unavailable posts are skipped at generation time and
omitted from all four output modes; sparse EPUB navigation and Markdown anchors
preserve discovered numbering. Refresh defers rereading until a format is chosen.

Checks and reproducible commands:

```sh
npm run test:tooling
npm run check
git diff --check
npx playwright test --list
npx playwright test tests/collection-demand.spec.js tests/collection-menu.spec.js tests/collection-export.spec.js tests/collection-refresh.spec.js tests/collection-retry.spec.js tests/collection-report.spec.js tests/collection-batches.spec.js tests/collection-book.spec.js tests/collection-markdown.spec.js tests/collection-controls.spec.js tests/collection-progress.spec.js tests/collection-completion.spec.js
npm run test:brave -- tests/collection-demand.spec.js tests/collection-menu.spec.js tests/installed.spec.js
```

Node regressions first demonstrated the old eager chooser/session and post visits,
then passed after the change. Follow-up failing regressions reproduced unsupported
chapter blocking and skip-aware assembly, then passed after the fix. The permission
denial flag was also verified RED→GREEN. Final checks pass: **98 tooling tests**, syntax for **61 JavaScript files**,
and `git diff --check`. `npx playwright test --list` collects **129 browser cases
in 23 files**; collection does not execute them. One independent read-only reviewer found the
unsupported-post regression (fixed with generation-time skips and writer tests)
and an installed Refresh assertion that no longer exercised download reuse (now
selects a format before asserting). No additional reviewer pass was performed.

Browser plugin not available. `npm run test:brave -- tests/collection-menu.spec.js`
failed to launch for all five cases. `npm test -- --max-failures=1` collected 124
cases at that point, then stopped at the first Chrome launch failure (appearance
spec); 123 were not run. Both browsers aborted with SIGABRT and kill EPERM,
including elevated execution. Later added skip/permission fixtures have not run.
This is an environment blocker, not a passing rendered/browser/native-download
check. No live Patreon request, account payload, image URL or permission was used.
