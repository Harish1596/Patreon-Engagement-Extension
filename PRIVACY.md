# Privacy Policy

Last updated: November 6, 2026

Patreon Reader (the "extension") provides reading customisation and offline
exports of accessible Patreon content. The developer does not receive post
content, images or personal data from the extension. Export generation and storage
happen locally in the user's browser. User-requested exports can make direct
network requests to Patreon and the displayed media origins, as described below.

## Information Processed Locally

The extension processes only the information needed to hide or show Patreon's
floating engagement bar, apply optional reading appearance preferences, and
create user-requested local exports:

- It checks the pathname of pages on `https://www.patreon.com` to determine
  whether the current page is a recognized Patreon post or collection.
- It stores the Boolean `isHidden` preference, the Boolean `readerEnabled`
  preference, and a `readerPreferences` object in local extension storage. The
  object contains the selected system-font identifier, text size, paired Post
  Color preset, paragraph spacing, and line spacing. Legacy separate colors are
  read for migration and replaced on the next settings change. These settings contain
  no post identifiers, creator identifiers, or personal information.
- It observes page structure changes and inspects DOM attributes and hierarchy
  to locate the post title, body, and action row, respond to navigation, and
  insert Reader and Download controls.
- When the user explicitly exports a post, it temporarily processes the rendered
  post title, displayed creator name, source URL, formatted body, links, and
  inline-image URLs in memory to create the selected PDF, EPUB, or Markdown
  output. Exports also record the local download time. It excludes comments and
  surrounding page UI. A small, format-independent copy may stay in page memory
  for two hours so another format can reuse the same text and images. Changes
  to the displayed post invalidate that copy; it is limited to 16 MiB and is
  discarded on page navigation or reload. Download time is generated for each
  output rather than taken from the cached copy.
- Opening the collection download menu does not fetch posts or collection data.
  When the user presses Download, the extension retrieves collection metadata using
  validated same-origin API pagination, or rendered post links and Load more as a
  fallback. It temporarily opens inactive Patreon post tabs or reuses matching tabs to
  create one combined EPUB, Markdown or PDF file, or separate EPUB/PDF/Markdown
  files inside a local ZIP.
  A single book also processes the collection title and builds local chapter
  navigation and a table of contents. Creator and source details remain local
  export inputs even when combined documents omit visible per-chapter metadata.
  Extension-created tabs are closed after preparation or individual chapter generation, and on
  cancellation. Discovered links and prepared metadata are cached for two hours;
  prepared metadata uses local browser-session storage to survive worker restarts.
  It includes the canonical collection URL, without query parameters, so a refreshed
  page can reconnect to an idle, unexpired session in the same tab and browser
  window when the user next presses Download. Reconnecting alone does not extend
  expiry; metadata without a valid collection binding is fetched again as needed.
  After a chapter is fetched for export, its sanitized text, creator, source URL,
  and distinct inline-image data are cached in extension-owned disk storage for
  up to two hours, allowing EPUB, PDF and Markdown to reuse one source copy without
  reopening post tabs or retrieving images again. This shared disk cache is
  limited to 512 MiB; older entries may be evicted when it is full. Signed image
  request URLs are not included in source-cache records. Neither the metadata
  nor source cache is sent to the developer or another service. The extension
  does not request broad browser-history or tab-access permission.
- Collection export compresses generated chapters into encrypted extension-private
  retry files and streams decrypted chunks into a temporary ZIP, EPUB or PDF on local
  disk. Combined PDF chapter data is encrypted while staged; the renderer
  processes bounded document data in extension-owned worker memory. Packaged
  PDF code and fonts require no third-party conversion service or font request.
  Collection output modes share the documented retention, encryption and archive
  payload budget.
  It retains only filenames,
  sizes, checksums, owner IDs, and expiry/download IDs in browser-session storage.
  A hidden extension document creates a local Blob URL for the finished file;
  the browser downloads it without an extra visible tab or intermediary service.
- The collection download report processes post titles, canonical Patreon post
  URLs, status and failure/skip reasons locally. The latest report stays in page
  memory for up to two hours and is cleared on navigation/reload, expiry or
  replacement by a new download attempt. Cancelling an export leaves its cancellation report available to review.
  Per-post preparation skips are included in prepared browser-session metadata
  under the same expiry/owner cleanup policy. The extension does not persist raw
  error URLs, media links, post bodies or credentials in reports. Reports are not
  downloaded, uploaded or included in exported collections. The visible summary
  shows completed counts and failed posts, with skipped, cancelled, saving and
  unconfirmed counts distinguished. Reports update when the browser confirms the
  result. Missing download records remain unconfirmed; completion is not a guarantee
  of file validity.
- To embed remote inline images, it asks the browser for access to the exact
  image origins used by that post. After permission is granted, the locally
  installed extension fetches those image bytes directly from the media origin.
  It rejects non-HTTPS sources and does not send post content or image data to
  the developer or an intermediary service.
- Reader font choices reference fonts already available on the device through
  CSS, without enumerating installed fonts or reading their files. PDF generation
  uses fonts packaged with the extension; it does not download fonts.

The developer does not collect browsing history, authentication information,
financial information, personal communications, post content or personally
identifiable information through the extension. Titles, creator names, source
URLs, text and images selected for export are processed locally at the user's
request. The extension uses the browser's existing signed-in Patreon session to
open accessible pages; it does not ask for or read the user's password.

## How Information Is Used

The locally processed pathname is used only to decide whether the extension is
on a supported post or collection page. The locally stored preference is used only to apply
the user's selected visibility and reading appearance settings. Saved Reader
preferences are retained while Reader is disabled so they can be restored when
it is enabled again. Appearance changes affect only local display.

Information processed by the extension is not used for analytics, advertising,
profiling, tracking, or any purpose unrelated to improving the local Patreon
reading and offline-export experience.

## Data Transmission and Sharing

Feature-initiated network requests retrieve collection pagination, normal Patreon
post pages, and user-approved inline images for the requested export. They go
directly from the user's browser to Patreon or the displayed media origin.
Temporary connection/time-out and selected HTTP failures may trigger up to three
attempts for the same collection-API or inline-image read. Backoff and available
Retry-After headers delay repeat requests; long server waits stay manual.
Cancellation stops active reads and retry waits. Retries do not request broader
permissions, send media credentials, or add network destinations. Source-cache
operations are local disk reads/writes; their synthetic cache keys
do not cause network requests. The extension does not
transmit exported post content or images to the developer, analytics services,
or any other intermediary. No information is sold, shared, or made available
for human review by the developer.

## Permissions

The extension uses the following access:

- **Storage:** Saves engagement visibility, Reader enablement, and appearance
  preferences, prepared collection metadata, and reusable export sources locally
  in the browser.
- **Downloads:** Starts collection PDF, EPUB, Markdown and ZIP downloads and
  observes their completion or
  interruption to release temporary files safely. Download queries are restricted
  to IDs created for those exports; unrelated download records are not processed
  or retained.
- **Offscreen:** Provides a hidden local extension document for local file handoff
  and PDF rendering. Download documents release their Blob URLs and temporary files
  after active downloads finish; PDF rendering uses disposable local workers.
- **Alarms:** Schedules export-data expiry cleanup even when the extension worker
  is idle. The alarm is removed when no export data remains to expire.
- **Access to `https://www.patreon.com/*`:** Loads the packaged content script
  and stylesheets, identifies supported post URLs and DOM elements, hides or
  restores the floating engagement bar, adds Reader/export controls and appearance
  styles, and locally processes user-selected post or collection exports.
- **Optional media-origin access:** Requested only after the user chooses an
  export containing remote inline images. The prompt is limited to the exact
  HTTPS origins found in that post body and allows the extension to retrieve
  image bytes for local embedding. Denying the request cancels the export.

## Retention and Deletion

Preferences remain in local extension storage until the user changes them,
clears the extension's stored data, or uninstalls the extension. Resetting Reader
replaces its appearance preferences with site defaults; it preserves the Reader
enablement and engagement visibility choices. Disabling Reader retains its
appearance preferences.
Collection source entries are scoped to the prepared collection session and are
removed on Cancel or closure of its owning tab. Refreshing the Patreon page clears
its in-memory report and retry UI, but does not by itself delete valid background
source entries; the next Download can reconnect under the ownership rules above.
There is no manual Refresh Collection control. Valid discovery and source data is reused for up to two hours;
missing or expired data is fetched when the user next presses Download. Source
records keep their original expiry rather than extending it for each format.
Collection metadata can include locally computed SHA-256 fingerprints of relevant
post-content/title/media/author fields for comparison; raw API responses and signed
request URLs are not retained as fingerprints. New posts or access changes can
remain unseen until discovery is fetched again after expiry. Generated retry files
and the page-local report have their separate lifetimes described below. Expired
entries are not reused. A browser alarm deletes expired sources, prepared metadata,
and idle archive files without waiting for another export. Closing the last normal
or popup browser window clears export data; browser startup purges leftovers.
Worker startup also removes expired/orphaned records while preserving live caches
in the same browser session. Browser sleep or delayed alarms may delay deletion.
A forced quit, crash, or interrupted shutdown can prevent final disk cleanup, so
files may remain while the browser is closed until startup cleanup runs; there is
no guaranteed shutdown-time secure erasure. Saved Reader preferences are separate
and persist normally. Clearing the extension's data or uninstalling it
also removes the cache. Closing a download panel preserves its caches so another
format can reuse them.

Reusable source snapshots (including titles/text/images) and chapter retry files
use authenticated AES-256-GCM encryption. Their key is kept only in browser-session
memory, survives worker suspension, and is discarded when the browser/extension
session ends. No encryption key is saved to durable preference storage. Legacy
plaintext caches are deleted rather than reused. This reduces exposure from
leftover cache files, but does not protect a compromised running browser, OS memory
inspection, swap/hibernation captures or previously saved exports. Deletion is not
secure erasure.

Completed files retained for retry stay encrypted in extension-private temporary
disk storage. All archive jobs share a 1 GiB payload budget for encrypted retry
files, pending writes and staged/final ZIPs, separate from the 512 MiB source-cache
budget. Browser filesystem metadata/overhead and user-saved files are outside those
payload limits. The browser download requires a temporary plaintext ZIP, EPUB,
Markdown or PDF during
assembly/handoff and until completion or interruption. Failed packaging/handoffs
remove it; a forced quit can leave it for startup/browser cleanup. There is no
guaranteed crash-time erasure. Cancel, format changes, and owner-tab
closure remove unfinished archives. Files already handed to the browser are held until their downloads
complete or are interrupted, then deleted. Retry metadata expires after two hours
of inactivity. Automatic cleanup removes expired idle files, and expired jobs
cannot be revived by reopening the panel. A live, unexpired checkpoint can extend
its activity deadline. Startup additionally removes orphaned files. Navigation/reload
drops that page's retry checkpoint. Source-cache records are separate from
generated archive files and retain their original two-hour limit.
An approved optional media-origin permission may remain in the browser's extension
settings until the user revokes it or uninstalls the extension. Manage grants in
the browser's extension settings; the toolbar popup has no Forget media access
control. Revoking a grant does not delete cached content or user-saved files.
The extension uses that access only for a user-requested export containing an
image from the same origin.
The developer operates no remote export-storage service. Patreon and media hosts
receive the direct requests needed to retrieve content and handle them under their
own policies. This is distinct from sending exported content to the developer.

## Security

All executable code and styles are packaged with the extension. The extension
does not download or execute remotely hosted code.

## Third-Party Services

The extension operates on Patreon webpages but is not affiliated with, endorsed
by, or sponsored by Patreon. A user's interaction with Patreon remains subject
to Patreon's own terms and privacy practices. Opening the popup's Discord or
GitHub links navigates to those external services, which apply their own privacy
policies; the extension does not attach post contents or cached files to those links.

## Changes to This Policy

This policy may be updated if the extension's functionality or data practices
change. Updates will be published in this repository with a revised "Last
updated" date.

## Contact

Questions about this policy can be submitted through the project's
[GitHub issue tracker](https://github.com/Harish1596/Patreon-Engagement-Extension/issues).
