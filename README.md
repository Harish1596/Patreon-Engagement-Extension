# Patreon Reader

A small browser extension that hides Patreon's floating engagement bar by
default and optionally customizes post reading appearance. Both features are
controlled from the extension's toolbar popup.

See the [changelog](changelog.md) for features and changes in each release.
Store artwork and regeneration instructions are in [store-assets](store-assets/README.md).

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
3. Click **Load unpacked** and select this repository's `extension/` folder.
4. Open or refresh a Patreon page.

If upgrading an existing unpacked installation from the old repository-root
layout, load `extension/` as the new source directory. A changed unpacked path
may create a different local extension identity, so local preferences may need
to be set again. Published store installations are not changed by this move.

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
Comment Like, Reply, and More icons and counts also follow Post Color, including
parent comments and replies, while retaining their compact native layout.
The membership banner's inner card also uses the selected background, keeping
its text readable while preserving artwork, layout, and native Join buttons.
A subtle foreground-tinted outline and drop shadow distinguish the banner from
the page for non-default Post Colors. Default restores its native shadow.
The comment-entry field's surface, text, placeholder, border, and focus indicator
also follow Post Color. Native disabled opacity, login behavior, and error borders
are preserved; Reader does not enable commenting or change access permissions.
For non-default Post Colors, the comment field uses a slightly darker shade of
the page background to distinguish it as an input. Default restores native styling.
Navigation outside the column, other native controls, images, and embeds keep
their own styling. Links remain underlined when overriding post text color.

Post Color pairs the background with readable text instead of separate color controls:

- Default: restore Patreon's original colors.
- White: white background and charcoal text.
- Sepia: warm cream background and brown text.
- Light Green: pale green background and charcoal text.
- Charcoal: dark background and soft white text.

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

### Download a post

On a supported post, select the **Download** button at the start of the main
action row and choose PDF, EPUB, or Markdown. This feature is independent of
Reader customization and exports only the currently displayed post title,
formatted body, links, and inline post images. It does not include comments,
recommendation cards, membership prompts, navigation, or other surrounding UI.

- **PDF** downloads a self-contained `.pdf` directly, with selectable text,
  embedded images, clickable links and page numbers. Generation happens locally
  in a packaged worker; no print dialog or conversion server is used. Creator,
  local download time and clean Patreon source URL appear above the post title.
- **EPUB** downloads a self-contained EPUB 3 file with packaged image bytes and
  visible Creator, Download time, and Source details above the title, named from
  the sanitized post title.
- **Markdown** downloads one `.md` file with images embedded as data URLs and
  the same three details above the title, also named from the post title.

The download dialog shows an accessible activity bar while it prepares the
available options, post text, and inline images, then clears it when the download
starts or an error is reported.

Export processing happens locally. For remote inline images, the browser asks
for access to each exact media origin when the user starts an export. The
extension then fetches only image URLs found inside that post body. Denying
access cancels the export instead of creating a partial offline copy. The
feature does not bypass Patreon access controls; it can export only content
already rendered for the user. A granted origin can remain in the browser's
extension settings until the user revokes it, but it is used only for a later
user-requested export containing images from that origin.

### Download a collection

On a Patreon `/collection/...` page, select **Download Collection**, choose a
**Format** (EPUB, PDF or Markdown) and **Packaging** (Single file or Separate files
(ZIP)), then press **Download**. The button names the selected output. Opening
the menu or changing a selection does not fetch collection metadata or visit posts.
Fetching starts only when Download is pressed:

- **Single EPUB**: downloads one `.epub` named after the
  collection, with a title page, Creator/Download time/Source metadata, an ordered
  table of contents, and previous/next chapter links. Images are packaged inside
  the book. Open it directly in an EPUB reader; no outer ZIP needs extracting.
- **Single Markdown**: downloads one editable `.md` with collection metadata,
  linked contents and ordered chapters, with embedded inline images.
- **Single PDF**: downloads one `.pdf` with a linked contents page and each
  accessible post starting on a new page, oldest first.
- **Separate files (ZIP)** with EPUB, PDF or Markdown: downloads one numbered
  file per accessible text post inside a ZIP archive.

All options download posts **oldest to newest** and reuse the same cached
sources. Complete publication dates determine reading order, independently of
Patreon's displayed sort. If publication dates are missing or invalid, including
DOM-only discovery, numeric post IDs provide a deterministic oldest-first
approximation. File numbering, book contents and numbered parts follow this same
order. Repeated post links are removed. Unavailable, locked, or unsupported
posts are skipped and reported during discovery or chapter generation. A chapter that fails later must
be retried before the complete book or ZIP is saved; completed encrypted chapters
are retained for retry. Switching between book and separate-file modes reuses
source text/images but rebuilds the format-specific files.

Expand **Download report** in the collection dialog to see each post's result.
It lists ready/prepared chapters, skipped posts (including membership locks),
failed chapters with reasons, cancellations, and posts included in a download
that has started. **Open post** links help identify missing chapters. Where
Patreon exposes no title or precise cause, the report uses its post URL and an
explicitly limited explanation rather than guessing whether it is locked.

Choose **Save report** to download `<collection> - Download Report.txt`. Reports
are available once a selected download discovers its posts, including after
export failures, not just successful
downloads. A packaging failure leaves chapters marked Prepared; a successful
retry replaces failed outcomes. “Download started” means the collection file was
handed to the browser, not confirmation it finished saving. Reports are not
inserted into generated files and are saved only when requested. They contain post
links/titles, status and reasons, not post bodies or media URLs; URLs in failure
messages are omitted. The latest report stays in this page's memory for up to
two hours, survives closing/reopening the dialog, and clears on
navigation/reload or expiry. Cancel updates it so it can be reviewed.
New downloads replace the previous report. Saved report files remain yours.

The single EPUB book is assembled one chapter at a time in temporary storage, using
the same progress, cancellation, two-hour retention and shared archive budget.
They do not retain a complete combined file in page memory. Per-chapter source conversion
still requires memory. EPUB/Markdown viewer compatibility and live Patreon behavior need
user verification.
When Patreon's collection API explicitly marks a post as inaccessible, it is
excluded during discovery and reported separately as a locked post.
Posts without an access flag are checked when their chapter is generated. A collection containing
only locked posts shows a message without opening worker tabs.

Discovered links, access flags, and download session metadata are cached for
two hours on the current collection page. Reopening the panel, changing a selector,
or downloading another format reuses valid cached data. There is no manual Refresh
Collection step. Collection discovery and post retrieval start only when Download
is pressed; expired or missing data is fetched as needed by that download.
New chapters, publication-date changes and access changes are picked up when discovery
is fetched again after expiry. Opening the chooser does not eagerly refresh it.

The download progress reports cached chapters as they are reused. Navigating away
or reloading clears the page's discovery cache. Prepared metadata
uses browser session storage so idle background-worker restarts do not invalidate
the format buttons; it is removed on cancellation, owner-tab closure, or expiry,
and browser-session storage clears when the browser session ends. Missing or
expired sessions produce a visible panel error. Generated file bytes are
released after each download. Fetched chapter text and distinct inline images
are cached once in extension-owned local disk storage for two hours. EPUB and
Markdown are generated from that shared source, one chapter at a time, so another
format can avoid reopening post tabs and fetching their images again. The source
cache uses session-key AES-256-GCM encryption, survives background-worker restarts,
and has a shared 512 MiB limit; older
entries may be evicted to stay within it. Expired, evicted, or unavailable storage
falls back to normal fetching. Cancel and closing the owner tab clear that
collection's source entries. No signed image URLs are stored in
them, and no cached data is sent to another service. Download time remains fresh
for each output.
Expiry cleanup runs automatically through a browser alarm, including while the
extension worker would otherwise be idle. Closing the last normal/popup browser
window clears export caches, and browser startup purges leftovers. Saved Reader
customisations remain in durable local storage. Browser sleep, delayed alarms,
or a forced quit can delay disk cleanup; expired data is not reused, and leftover
files are cleaned on the next browser start. Files already being saved by the
browser remain available until that download completes or is interrupted.

The toolbar popup shows saved optional media-origin access. **Forget media access**
revokes those grants while preserving required Patreon access, Reader preferences
and already cached/exported content. A later remote-media export requests access
again. Revoking access during a download can cause its remaining image requests
to fail; completed cached content remains governed by the normal expiry policy.

Individual post downloads also reuse a format-independent source in page memory
for up to two hours, limited to 16 MiB. Changes to the post content, expiry, or
navigation invalidate it; Reader typography changes do not. Larger single-post
sources are exported normally without being retained in that memory cache.

Temporary collection-API and remote-image failures retry automatically, up to
three total attempts per request. Delays grow from about one second to two seconds
(with a small random spread); the dialog shows the next attempt and wait time.
Retryable failures are connection errors, per-attempt timeouts, HTTP 408/429,
and temporary server responses 500/502/503/504. A readable `Retry-After` header
can increase the delay. If the server asks for more than one minute, the extension
stops and asks you to retry manually later rather than retrying early.

Each network attempt has a 30-second deadline. Cancellation interrupts both
active requests and retry waits. A broken image stream restarts that image from
zero under the same size/origin limits, and its concurrency slot is released
between attempts. Completed chapter files stay intact. Permission denials,
401/403 access failures, unsupported content, invalid/oversized images, and
storage/packaging failures do not get automatic retries. Collection API access
denials or exhausted temporary failures stay visible instead of silently taking
the DOM-discovery fallback. Existing fallback for unavailable/changed API formats
and page-readiness polling remain separate. Finished chapter-build failures are
not repeated by readiness polling or by opening another worker tab.

If a chapter fails during generation or transfer, the remaining chapters continue.
Completed files stay in extension-private temporary disk storage and **Retry failed posts** fetches
only missing files. No ZIP is downloaded until every prepared chapter is ready.
If packaging fails, **Retry packaging** reuses all completed files. You can close
and reopen the panel without losing this progress. Reloading, navigating away,
cancelling or choosing another format clears it.
This recovery does not retry posts already reported as skipped during preparation.
Switching formats clears generated retry files while preserving reusable source
chapters in the disk cache.

Collection ZIPs are assembled as a stream into private temporary storage. Chapters
are compressed and written one at a time; the page keeps file metadata for retry
instead of retaining all chapter contents and a complete ZIP in RAM. One chapter's
source/conversion still needs memory. Temporary storage must be available, and the
completed ZIP must stay below 4 GiB (ZIP64 is not implemented). All temporary
archives additionally share a 1 GiB payload budget, separate from the source
cache: encrypted retry files, pending writes, and the staged/final ZIP count
together, including concurrent exports. Browser filesystem overhead can add to
physical disk use. Reaching the budget stops the operation with a visible error
and preserves completed encrypted chapters for retry after space is freed. These
are disk-payload budgets, not a total RAM limit.

Reusable source snapshots and chapter retry files are encrypted with an
AES-256-GCM key kept in browser-session memory; restarting the worker preserves
it, while ending the browser/extension session discards it. Legacy plaintext
caches are removed. Authentication binds encrypted records/frames to their owner
and transfer position. The browser download still requires a temporary plaintext
ZIP during assembly/handoff and until completion; failed handoffs remove it.
Forced termination can interrupt deletion, so this does not guarantee secure
erasure or protect against a compromised running browser or OS memory capture.
The browser saves the finished disk-backed ZIP through a hidden extension document,
without opening a download tab. The `downloads` permission starts that download and
checks its completion; `offscreen` supplies the hidden document. Temporary archive
files and their Blob URLs are released when the download completes or is interrupted.
Cancel, format changes, and owner-tab closure remove unfinished archives.
Retry metadata survives worker restarts for two hours after activity; missing or
expired temporary files are rebuilt from available source-cache entries. Idle
retry files are deleted by expiry cleanup and cannot be renewed after their
deadline. Startup also removes orphaned files. When a visible panel's metadata
expires, it offers **Start again** instead of keeping stale download options.

The collection dialog keeps an activity bar visible throughout discovery,
preparation, file generation, transfer, and ZIP packaging. It reports completed
posts against the known total during preparation, generation, and transfer;
stages without a reliable total use an indeterminate bar.
The panel shows the current post/file number and title, an elapsed clock for the
current attempt, and completed/cached/failed counts. Receiving, formatting,
compression/saving, ZIP packaging, finalization, and browser handoff have distinct
labels. Compression shows input and compressed bytes; packaging shows copied
bytes against the known payload total. Percentages refer to the labelled stage,
while the completed-post count tracks the whole collection. Compression reaches
100% only after the chapter is saved. The elapsed clock stops on completion,
failure, or cancellation and restarts for each retry; retained completed files
remain counted. Browser download time after handoff is handled by the browser.

Select **Cancel** while discovery, preparation, file generation, transfer, or ZIP
packaging is running. The extension aborts its pending requests, closes its
temporary worker, discards the cancelled export, and offers **Start again** after
cleanup. Already-open post tabs remain open. Completed link discovery stays
cached, so starting again can reuse it. Cancel disappears once the finished ZIP
has been handed to the browser; it cannot undo a browser download that has already
started. A Patreon Load more request already triggered on the page may finish,
but cancellation stops further pagination and export work.

Before preparing files, the extension follows the current page's locally observed,
same-origin collection pagination request until Patreon returns no next cursor.
It validates the collection ID and reported total and does not persist the request
or its response. If that internal request is unavailable or changes, the extension
falls back to repeatedly using Patreon's **Load more** control. A button disabled
during loading is treated as temporary: the extension waits for Patreon to enable
it again and continues instead of preparing a partial collection.

The selected download reads linked posts locally, reusing an already-open
matching post tab when possible. Otherwise, it opens an inactive temporary
Patreon tab for the current uncached chapter. It checks and exports that same
loaded document without a separate preflight visit. Readiness retries stay in
the background, and each chapter closes its temporary worker after receipt.
Cancellation and failures also close the active worker. Before exporting each post, the extension waits for the
requested document to finish loading and verifies its post ID, preventing an old
page from being exported again while the worker navigates. Image
permissions use the same exact-origin prompt as individual post export.

PDF ZIP generation renders one chapter at a time. Single PDF stages encrypted
chapter data, then renders a combined document in a disposable extension worker.
Collections use the existing numbered parts of up to 100 posts. A PDF is limited
to 48 MiB of serialized input and 40 MiB of output; images are limited to 8,192
pixels per side, 16 million pixels per image and 32 million pixels per document.
Rendering has a two-minute deadline. A limit failure is shown explicitly; select
individual files or a smaller collection rather than receiving a truncated PDF.
PDF pagination/encoding holds bounded input/output buffers in worker memory;
it does not have EPUB's fully streamed book-assembly behavior. These PDF limits
are separate from the 512 MiB disk source cache. The output allowance leaves room
for base64 encoding in Chrome runtime messages.

The primary bundled Noto Sans fonts cover tested extended Latin diacritics, Greek
and Cyrillic text, including bold and italic faces. A bundled Noto Sans Cuneiform
fallback renders cuneiform signs such as U+1202D alongside Latin text, using font
runs that retain metadata, contents and links. The Cuneiform regular face serves
all style aliases. Document text uses fallback; SVG text keeps primary-font coverage.
Unsupported characters (including many emoji and scripts
outside that coverage) produce an explicit error suggesting EPUB or Markdown.
GIF/WebP/AVIF images are converted to static PNGs when the browser can decode
them; SVGs use the existing sanitizer and a restricted vector path. PDF files
use a light A4 reading layout independent of Reader appearance settings.

Source snapshots and staged chapter data cross extension boundaries in bounded
chunks; the background assembles disk-backed ZIP/EPUB output locally. PDF renderer messages are separate and carry bounded document data and output;
they are capped by the PDF limits above. The outer ZIP uses actual DEFLATE
compression for macOS archive compatibility without altering nested EPUB files.

Post pages are recognized locally using this pathname structure:

```text
/<creator>/posts/<post-slug>-<numeric-post-id>
/posts/<numeric-post-id>
```

The engagement-bar toggle targets:

```css
div[data-tag="floating-engagement-sheet"]
```

## Notes

- The hide/show setting is stored only on the local device.
- The extension only runs on `https://www.patreon.com/*`.
- Although the content script remains loaded across Patreon to support its
  client-side navigation, it modifies the page only when the URL matches a post
  or collection.
- All executable code and styles are packaged locally. A user-requested offline
  export may fetch the post's displayed inline images directly from their media
  origins; no selectors, scripts, analytics, or other remote code are fetched.
- The extension does not collect or transmit personal or sensitive user data.
  It stores the hide/show preference, Reader enablement, and appearance
  preferences locally in the browser.

## Development

Runtime assets include a pinned, locally packaged pdfmake renderer, Noto Sans
and its Cuneiform fallback fonts (with Roboto retained for explicit SVG font references). Install dependencies
with `npm ci --ignore-scripts`; regenerate PDF assets
with `node scripts/vendor-pdf.js` after a reviewed dependency update. The vendor
README records provenance, licenses, hashes and the bounded PNG decoding patch.
Loading the checked-in extension requires no runtime build or remote code. `extension.js` shares
validated preferences and a small browser API adapter between the popup and
content scripts. `patreon-dom.js` owns Patreon hooks, post discovery, and surface
selection; `reader.js` owns appearance state, markers, and the isolated Shadow
DOM panel. `content.js` coordinates storage and page navigation.

### Repository layout

```text
extension/                   Installable source; manifest at this directory's root
  manifest.json
  shared/extension.js        Browser API adapter and validated preferences
  content/                   Page scripts and page-side CSS
    export.js                PDF, EPUB, and Markdown post export
    collection-export.js     Combined documents and separate-file ZIP export
  background/media.js       Permission-checked inline-image retrieval
  background/pdf-book.js    Encrypted chapter data to combined PDF
  export/pdf-worker.js      Disposable local PDF renderer
  vendor/pdfmake/           Packaged renderer, fonts, coverage and licenses
  popup/                     Toolbar popup HTML, JavaScript, and CSS
  icons/                     Runtime icon assets
tests/
  fixtures/                  Sanitized synthetic post HTML
  helpers/                   Fixture setup, API mocks, and test controls
  tooling/                   Node tests for packaging and browser discovery
  *.spec.js                  Browser regression and installed-extension tests
scripts/                     Local packaging and development tooling
docs/                        Maintained Patreon page reference
store-assets/                Store-listing promotional assets, not runtime assets
dist/                        Ignored release output
```

Run npm commands from the repository root. The runtime uses ordered plain
JavaScript content scripts and packaged styles without a bundler. Post export
adds a packaged background worker and optional, on-demand media-origin access.

See the [maintained Patreon post-page reference](docs/patreon-text-image-post-baseline.md)
for the observed page hierarchy, complete captured hook inventory, current Reader
contract, CSS pitfalls, evidence limits, and future UI-change comparison procedure.
[AGENTS.md](AGENTS.md) directs future coding sessions to read and maintain it.
Start there when planning changes to the common text-and-image post layout.

For development checks, run `npm ci`, `npm run check`, and `npm test`. Playwright
is a development-only dependency; see [TESTING.md](TESTING.md) for browser setup.
`npm run test:tooling` checks packaging/browser discovery independently, and
`npm run test:brave` verifies the Brave suites and actual unpacked extension.
Browser executable overrides and current checks are in the testing guide;
dated results are retained in [testing history](docs/testing-history.md).
Run `npm run package` to create an allowlisted, version-checked, validated ZIP in
`dist/`. It requires `zip` and `unzip` on PATH and refuses to overwrite an existing
release unless you supply `--force`. See [release packaging](docs/release-packaging.md)
for validation details. Tests, dependencies, docs, store assets, and Git data are
excluded; packaging does not publish anything.

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
