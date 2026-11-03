# Reader validation

The [maintained post-page reference](docs/patreon-text-image-post-baseline.md)
records the supplied HTML, screenshots, current integration contract, hook
inventory, and UI-drift investigation procedure as architectural evidence.
Its observations are distinct from the synthetic and installed-extension tests
below; documenting the captures does not establish live behavioral coverage.

## Live Patreon verification

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

The popup regression revokes only optional media origins, preserves required
Patreon access and preferences, and reports failed removal. Native installed
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
The current hotfix version is **1.1.1**, following the user-reported 1.1.0
dashboard upload. The 1.1.0 feature release consolidated the local 1.3.9
development series. Historical version numbers below describe their original
checkpoints, not the current release metadata.

The subsequent swatch-order change also passed 28 Chrome and 29 Brave cases,
including exact visual-order semantics via DOM order, keyboard navigation, and
legacy color migration assertions. The 1.3.9 ZIP was rebuilt and validated.
This checkpoint is included in the user's final 1.1.0 testing completion confirmation.

Latest popup-layout verification: **29 Chrome cases and 30 Brave cases passed**,
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

For 1.1.1, enable Hide Engagement Bar, open the same affected post in a new tab,
refresh/reload it, and confirm the bar remains hidden without cycling the toggle.
Repeat with hiding off to confirm it stays visible; check with Reader on/off.
Record live results separately from the synthetic flag-removal regression tests.

Record browser and OS versions and results for Chrome, Brave, Firefox, and Safari
for macOS. Test an actual installed build in each browser. Original manual
support claims are not evidence that the Reader feature passes this checklist.

- Upgrade from 1.0.0 with both possible engagement preferences. Reader starts
  disabled; the engagement choice survives. Restart the browser and verify
  preferences are restored.
- Enable Reader in the extension popup. Exactly one Aa button appears before
  Like on the main post. Exactly one Download button appears before Aa (or before
  Like while Reader is disabled); neither appears in the floating bar or related cards.
- Export a public and legitimately accessible member post to PDF, EPUB, and
  Markdown. Confirm title, formatted body, links, and every inline image are
  present offline, while comments, recommendations, navigation, membership UI,
  and signed source URLs are absent. Deny a media-origin prompt and confirm no
  partial file is produced. Exercise multiple image origins and redirects.
- For PDF, choose Save as PDF and check pagination, selectable text, links, and
  images. Confirm browser-generated date/title headers and URL/page-number footers
  are absent, while the document metadata appears above the title and lists
  Creator, Download time, and Source in that order. Confirm the same visible
  details and ordering in EPUB and Markdown. Confirm all three formats default to
  the sanitized post title as their filename. Open EPUB output in at least two readers and validate it with an EPUB 3
  validator. Check Markdown data-image support in the intended viewer.
- Open a collection and export separate EPUB and Markdown ZIPs. Confirm every
  accessible linked post appears once, in collection order, with numbered
  title-based filenames and embedded images. Confirm locked or unsupported posts
  are reported as skipped, the single temporary worker tab is reused and closed,
  cancellation cleans up,
  and no unrelated post links are included. Confirm Load more is exhausted and
  the prepared count matches Patreon's displayed collection total.
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
background worker. It adds no remote executable code, remote fonts, or third-party
runtime dependency.
