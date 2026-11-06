# Patreon Reader

**Reading comfort. Offline access.**

Customise Patreon fonts, colours and spacing, then keep accessible posts and
collections as PDF, EPUB or Markdown. Reading preferences are saved on your device;
files are generated locally using your existing access to Patreon.

[Privacy policy](PRIVACY.md) · [User guide](docs/usage.md) · [Changelog](changelog.md) · [Report an issue](https://github.com/Harish1596/Patreon-Engagement-Extension/issues)

## Features

- **Read your way:** change font, text size, page colour, paragraph spacing and
  line spacing, with immediate previews and saved preferences.
- **Save individual posts:** download supported text posts with inline images,
  links and source information.
- **Keep entire collections:** choose PDF, EPUB or Markdown, then a single file
  or a ZIP of separate chapter files. Posts are ordered oldest to newest.
- **Follow long downloads:** see progress and the current chapter, cancel work,
  retry failed chapters and review a compact completion/failure summary.
- **Reuse completed work:** valid text and images are cached locally for up to
  two hours so another format can reuse them.
- **Reduce clutter:** optionally hide Patreon's floating engagement bar.

This checkout is prepared as **1.2.1**. The user confirmed that **1.2.0** was
approved and published in the Chrome Web Store; 1.2.1 publication is pending.
See the [1.2.1 release notes](docs/releases/1.2.1.md) for validation and remaining
packaging/submission work.

## Install

For a local installation in Chrome or Brave:

1. Download or clone the repository. If using a packaged release ZIP, extract it.
2. Open `chrome://extensions` in Chrome or `brave://extensions` in Brave.
3. Enable **Developer mode** and select **Load unpacked**.
4. For the source checkout, select the **`extension/` folder**. For an extracted
   release ZIP, select the folder containing **`manifest.json`**.
5. Open or refresh a Patreon page.

No npm install or build is needed to load the checked-in extension. If upgrading
an unpacked installation, keep the same source location where possible: changing
its path can change the local extension identity and its saved preferences.

## Customise your reading

1. Open the extension popup and enable **Enable Reader Customization**.
2. On a supported Patreon post, select **Aa** beside the Download control.
3. Choose a font, text size, Post Color and spacing. Changes preview immediately.

Reader starts disabled. Preferences apply across supported posts and open tabs
in the same browser profile. Turning Reader off restores the site's appearance
and retains your settings for next time. **Reset to Patreon defaults** clears
appearance overrides without changing the two master toggles.

Font choices use installed system fonts. Text size ranges from 12–32px, with the
title at 1.5× the body size. Post Color offers Default, White, Sepia, Light Green
and Charcoal. Typography applies to the title/body; the selected colour palette
also keeps the post's metadata, actions and comments readable.

The popup also controls **Hide Engagement Bar**, which starts enabled. Its
preferences work independently of the active tab. Errors appear only if settings
cannot be loaded or saved. Keyboard controls, Escape dismissal and individual
resets are described in the [reading guide](docs/usage.md#reader-customization).

## Download a post

1. Open a supported post you can access.
2. Select **Download** in the post's main action row.
3. Choose **PDF**, **EPUB** or **Markdown**.
4. Allow the requested image hosts if the post contains remote inline images.

Downloads work with Reader enabled or disabled. Files include the displayed post
body, links and inline images, with **Creator**, **Download time** and **Source**
above the title. Filenames use a sanitised post title. Comments, recommendations,
membership prompts and surrounding navigation are excluded.

| Format | Best suited to | Output |
| --- | --- | --- |
| PDF | A paginated document with selectable text and clickable links | A directly generated `.pdf`; no print dialog |
| EPUB | Reading in an ebook application | A self-contained EPUB 3 book with packaged images |
| Markdown | Editing or keeping a text copy | A `.md` file with inline images embedded as data URLs |

PDF uses its own light A4 layout rather than reproducing Reader's selected page
appearance. Markdown image display depends on the viewer's support for data URLs.
See the [post-download guide](docs/usage.md#download-a-post) for more detail.

## Download a collection

1. Open a Patreon collection and select **Download Collection**.
2. Choose a **Format**: EPUB, PDF or Markdown.
3. Choose **Packaging**: Single file or Separate files (ZIP).
4. Press the Download button, which names the selected output.

| Packaging | Result |
| --- | --- |
| Single file | One PDF, EPUB or Markdown document with ordered chapters and linked contents |
| Separate files (ZIP) | A ZIP containing one numbered, title-named file per accessible supported post |

Combined files retain collection front matter without repeating Creator,
Download time and Source blocks inside each chapter. EPUB and Markdown front
matter includes Creator, Download time and Source; PDF includes collection title,
Download time and Source. Separate chapter files retain individual post metadata.
PDF contents use blue, underlined chapter links.

Opening the menu or changing selectors does not fetch collection data. Discovery
starts when Download is pressed. It follows collection pagination, with Patreon's
Load more control as a fallback, and skips explicitly locked posts. Other
unavailable or unsupported posts are reported during discovery or generation.
The extension does not bypass membership restrictions.

Downloads run **oldest to newest**, independently of the collection's displayed
sort. Complete publication dates determine order; numeric post IDs provide an
approximation when dates are missing. Larger collections use numbered parts of
up to 100 accessible posts. Discovery is limited to 1,000 posts.

The extension uses inactive temporary tabs for uncached chapters and closes its
own tabs after use. Existing user tabs stay open, and background work does not
repeatedly activate the collection page. After refreshing a collection tab, the
next download can reconnect to its unexpired session and reuse cached sources.

Progress shows the current stage and chapter while work is running. **Cancel**
stops active work; **Retry** can resume retained chapters after a failure. When
work stops, **Download report** appears below the format choices with a completion
summary and a list of failed posts. Skipped, cancelled, saving and unconfirmed
posts are counted separately; there is no report-file download.
“Saving” and “Download started” mean browser handoff. All-post success requires
browser-confirmed completion; an interrupted file counts its posts as failed.
Completion does not validate file contents.

See the [collection guide](docs/usage.md#download-a-collection) for cancellation,
retry, cache reuse, numbered parts and detailed resource limits.

## Privacy, permissions and storage

Export generation happens locally. The developer does not receive post content,
images or cached files through the extension. User-requested exports make direct
requests to Patreon and displayed image hosts; there is no developer-operated
conversion service, analytics backend or remotely executed extension code.

Remote inline images require access to their exact HTTPS origins. Denying that
access cancels the export rather than silently omitting images. Saved grants can
be managed in the browser's extension settings. The popup's Discord and GitHub
links open external services under their own privacy policies.

- **Reading preferences** persist between sessions on your device.
- **Collection metadata, text and images** are temporary, with a two-hour expiry.
  The encrypted source cache has a shared **512 MiB disk budget**; this is not a
  RAM limit. Valid sources are reused across all three formats.
- **Temporary generated files** use a separate shared **1 GiB payload budget**.
  Files backing an active browser download remain until it finishes or is interrupted.
- **Cleanup** removes expired data and clears export caches at last-window closure
  and browser startup. Sleep, crashes or forced quits can delay physical deletion;
  leftover files are cleaned on startup. Saved preferences remain separate.
- **Your downloaded files** remain ordinary files on your device until you delete them.

See the [privacy policy](PRIVACY.md) for the full permission, encryption and
retention details. The [user guide](docs/usage.md) explains cache and retry behaviour.

## Compatibility and limits

Chrome and Brave have automated coverage, including installed-extension checks
in Brave. The user confirmed live operation on November 5, 2026; that report does
not itemise every browser, viewer or accessibility scenario.

The original engagement-bar feature was manually confirmed in Chrome, Brave,
Firefox and Safari for macOS. That does not establish current download compatibility
in Firefox or Safari, which require their own packaging and validation. See
[TESTING.md](TESTING.md) for exact evidence and the current release checklist.

The extension supports recognised Patreon text-post and collection pages. Patreon
markup and internal APIs can change. Missing controls or unsupported post types
may require an extension update.

PDF generation has bounded input, output, image and rendering-time limits. A PDF
currently allows 48 MiB of serialised input and 40 MiB of output, with a two-minute
rendering deadline. Some scripts and emoji remain outside the bundled fonts'
coverage. Version 1.2.1 adds a bundled fallback for common CJK ideographs such as
天, alongside Latin and Cuneiform text. It loads only when needed and does not
cover every CJK character or regional typography. Unsupported characters and
oversized documents produce explicit errors; try separate files or another format. The [download guide](docs/usage.md) records
image limits, supported font fallback and archive behaviour.

## Development

Runtime files live in `extension/`. The extension uses plain JavaScript, packaged
styles and a locally bundled PDF renderer; loading it does not require a bundler.

```text
extension/         Installable extension and manifest
  shared/          Browser API helpers, validated preferences and export utilities
  content/         Patreon integration, Reader and download controls
  background/      Export workers, cache, retention and archive assembly
  export/          Format choosers and local rendering/download documents
  popup/           Reading preferences and community links
  vendor/          Packaged PDF renderer, fonts and licences
  icons/           Extension artwork
scripts/           Validation, packaging, font vendoring and asset capture
tests/             Sanitised fixtures, browser specs and tooling tests
docs/              User guide, integration reference and release evidence
store-assets/      Store artwork and labelled demo captures
dist/              Ignored release ZIP output
```

Run from the repository root with Node.js 22 or later:

```sh
npm ci --ignore-scripts
npm run check
npm run test:tooling
npm test
npm run test:brave
npm run package
```

Browser setup, executable overrides and verification limits are in
[TESTING.md](TESTING.md). Packaging requires `zip` and `unzip`, validates an explicit
allowlist and matching versions, and creates `dist/patreon-reader-VERSION.zip`.
It refuses to replace an existing ZIP unless `--force` is supplied. Packaging
[does not upload or publish the extension](docs/release-packaging.md).

Read the [maintained Patreon reference](docs/patreon-text-image-post-baseline.md)
and [AGENTS.md](AGENTS.md) before changing page integration. Detailed font inputs,
licences and regeneration instructions are in
[scripts/pdf-fonts](scripts/pdf-fonts/noto-sans/README.md) and the
[renderer reference](extension/vendor/pdfmake/README.md).

Configure public community destinations in [popup/links.js](extension/popup/links.js).
Empty or invalid values keep their buttons disabled. These are public HTTPS URLs
committed directly into the package; no `.env` file or generated configuration is
used. Store artwork and screenshot capture instructions are in
[store-assets](store-assets/README.md).

## Help and issues

After updating or reloading the extension, refresh open Patreon tabs before using
their controls. “Extension context invalidated” means an older page script has
lost its connection to the extension; that page must be refreshed to reconnect.
Download Collection now shows refresh guidance and a **Refresh page** button when
it detects that lost connection. Pages opened before this fix need one manual
refresh to load the updated controls.

If controls are missing, refresh the Patreon page and confirm the extension has
site access. For download failures, check the visible error and collection report,
then retry or choose another format as appropriate. Per-post PDF validation
failures identify affected titles and numbers; the collection report provides
character codes and source links while retaining prepared chapters for retry.

Report problems through [GitHub Issues](https://github.com/Harish1596/Patreon-Engagement-Extension/issues)
or the Chrome Web Store listing's Support section. Include your browser and
extension versions, expected behaviour, the error and whether the problem affects
one post or several. The popup's Community links provide Discord and GitHub access.

Remove private post text and account details from screenshots or reports. Never
share cookies, passwords, signed media URLs, payment details or private messages.

## Why I built this

Patreon's floating engagement toolbar originally covered the text while I was
reading. The extension began by hiding that bar and grew into a reading companion
with saved appearance preferences and offline post and collection downloads.

## License

Copyright (C) 2026 Harish Babu. Licensed under the
[GNU General Public License version 3](LICENSE) only (`GPL-3.0-only`).
