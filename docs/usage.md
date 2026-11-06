# Reading and downloads

Detailed behaviour for the 1.2.0 reading and offline-download features. For
installation and a quick overview, start with the [README](../README.md).
See the [privacy policy](../PRIVACY.md) for data processing and retention and
[TESTING.md](../TESTING.md) for validation evidence and limits.

## Reader customization

1. Open the extension's toolbar popup and turn on **Enable Reader Customization**.
2. On a supported post page, select the **Aa** button at the start of the action
   row, beside Download and before Like.
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
with fallbacks; Reader does not download, bundle or enumerate fonts. PDF exports
use separately bundled fonts for offline document rendering.

Reader is off by default. Disabling it removes the Aa button and panel and
restores the site's appearance, retaining preferences for next time. Settings
apply across supported posts and open tabs within the same browser profile.
They do not sync between browsers or edit the creator's actual post.

The Reader panel supports keyboard controls, Escape, outside-click dismissal,
and a bottom-sheet layout in narrow windows. If Patreon changes its post markup,
the button may be unavailable until the selectors are updated.

## Download a post

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

## Download a collection

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

During collection preparation and packaging, the dialog shows progress details.
When work stops, **Download report** replaces those details automatically. The
summary lists nonzero status counts and each file's browser outcome. Successful
chapters share that file outcome instead of repeating a row for every chapter.
Only failed or skipped posts appear individually under **Posts needing attention**.
The report appears above the format choices. **Open post** links help identify
missing chapters. Where
Patreon exposes no title or precise cause, the report uses its post URL and an
explicitly limited explanation rather than guessing whether it is locked.

Choose **Save report** to download `<collection> - Download Report.txt`. The saved
report includes every post and its individual status, even when the
on-screen summary omits successful chapter rows. Reports are available when an
attempt stops, including after cancellation or export failure. A packaging failure
leaves chapters counted as prepared; a successful retry replaces failed outcomes.
“Saving” means the collection file was handed to the browser. Reports update to
Completed or Interrupted when the browser
confirms the outcome; missing download records are labelled Status unavailable.
Completed confirms the browser save, not that a reader validated the file. Reports are not
inserted into generated files and are saved only when requested. They contain post
links/titles, status and reasons, not post bodies or media URLs; URLs in failure
messages are omitted.

If a combined PDF fails a per-post font check, the error identifies affected post
numbers and titles. All detected font-failing posts are marked Failed in the
report with their Unicode error and an Open post link, including when other posts
were skipped. Their staged chapter data stays retained for Retry packaging. The
short error shows up to three titles; the report and saved report list every
identified post. Collection-wide limits or unassignable renderer errors do not
invent a responsible post.

The latest report stays in this page's memory for up to
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
two hours for the current collection tab. Reopening the panel, changing a selector,
or downloading another format reuses valid cached data. There is no manual Refresh
Collection step. Collection discovery and post retrieval start only when Download
is pressed; expired or missing data is fetched as needed by that download.
New chapters, publication-date changes and access changes are picked up when discovery
is fetched again after expiry. Opening the chooser does not eagerly refresh it.

The download progress reports cached chapters as they are reused. Reloading clears
the page's in-memory discovery list and report, but the next Download can reconnect
to an idle, unexpired session for the same collection in the same tab and browser
window. Its post list and cached chapter sources can then be reused without fresh
discovery. Recovery alone does not extend expiry. A busy, missing, expired or
legacy session without a collection URL binding falls back to normal discovery.
Prepared metadata uses browser session storage so idle background-worker restarts
do not invalidate the format buttons; it is removed on cancellation, owner-tab
closure, or expiry,
and browser-session storage clears when the browser session ends. Missing or
expired sessions are rediscovered on the next download when possible. Generated
file bytes are
released after each download. Fetched chapter text and distinct inline images
are cached once in extension-owned local disk storage for two hours. PDF, EPUB and
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

Manage previously granted media-origin access through the browser's extension
settings; the toolbar popup has no permission-management control. Revoking a grant
does not delete cached content or saved downloads. A later export that needs that
origin requests access again. Revoking access during a download can cause remaining
image requests to fail; cached content retains its normal expiry policy.

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
The current source adds an unreleased Noto Sans SC regular fallback for common CJK ideographs,
including U+5929 (天), while preserving Latin and Cuneiform text. Its local font
asset loads only when needed; it is not downloaded from a font service. The font
uses SC-locale glyph designs and its regular face serves all style aliases. This
is not complete CJK, Korean or universal Unicode coverage.
Unsupported characters (including many emoji and scripts
outside that coverage) produce an explicit error suggesting EPUB or Markdown.
GIF/WebP/AVIF images are converted to static PNGs when the browser can decode
them; SVGs use the existing sanitizer and a restricted vector path. PDF files
use a light A4 reading layout independent of Reader appearance settings. Combined
PDF contents show chapter names as blue, underlined links to their chapter pages;
page numbers and chapter headings retain the normal text style.

Source snapshots and staged chapter data cross extension boundaries in bounded
chunks; the background assembles disk-backed ZIP/EPUB output locally. PDF renderer messages are separate and carry bounded document data and output;
they are capped by the PDF limits above. The outer ZIP uses actual DEFLATE
compression for macOS archive compatibility without altering nested EPUB files.

