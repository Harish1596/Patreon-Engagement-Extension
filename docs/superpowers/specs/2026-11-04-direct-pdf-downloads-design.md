# Direct PDF downloads

Status: approved by the user on November 4, 2026; implemented on
`agent/pdf-implementation`. Current verification results and remaining browser
limits are recorded in TESTING.md. This design is not verification evidence.

## Intent and confirmed scope

Generate PDF files locally without the browser's Print/Save as PDF flow. The user
wants PDF for individual posts and collections, with the same collection choices
as EPUB: one combined file downloaded directly, or individual files in a ZIP.

## Approaches

Recommended engineering choice: bundle pdfmake and licensed fonts, convert the
existing sanitized post representation into its document definition, and generate
PDF bytes. This provides document pagination and real text rather than images of
paragraphs. The user has confirmed output choices; the library and layout below
are recommendations, not separately confirmed preferences.

Screenshot-based PDFs would preserve more visual appearance but sacrifice text
selection/search and produce awkward page splits and larger output. A remote
renderer adds a service and sends post content away from the extension. Neither
is proposed. Keep generation local and independent of Patreon's presentation CSS.

## User-visible behavior

- A post's PDF action downloads `<sanitized-post-title>.pdf` directly.
- Collections offer Single PDF and PDF files (ZIP), alongside existing formats.
- Single PDF contains accessible prepared posts in collection order, a linked
  contents page, chapter boundaries, and page numbers. Each chapter starts on a
  new page. Collection metadata appears first; each post retains its creator,
  download time, clean source link, title, text formatting, and inline images.
- PDF ZIP contains one self-contained PDF per prepared post. Filenames use the
  existing global chapter numbering and sanitized title conventions.
- Proposed layout: A4 portrait, a light background, dark text, approximately
  18 mm margins, readable bundled fonts, and proportionally fitted images.
  Reader theme/font preferences do not alter exported document layout.
- Preserve current accessible-content checks and skipped-post reporting. A
  formatting/image failure must not silently produce an incomplete part.
- Preserve current collection parts of up to 100 prepared posts, maximum 1,000
  discovered posts. Single PDF means one PDF per part, matching Single EPUB's
  existing large-collection behavior. Disclose numbered parts before download.
  Do not promise one unbounded PDF for every collection size.

## Integration and ownership

`content/export.js` continues to own sanitized post extraction and format
generation. Add a shared PDF adapter that maps supported headings, paragraphs,
inline emphasis, lists, quotes, code, links and images without executing HTML or
preserving page scripts/styles. Replace `printPdf` and its iframe/title mutation
with generation and the normal download handoff.

For PDF ZIP, generate one chapter PDF at a time and stage its bytes through the
existing encrypted retry-file/ZIP pipeline. For Single PDF, stage a validated
PDF-ready chapter representation rather than trying to concatenate PDF bytes;
assemble one document with collection navigation during packaging. Keep staged
content encrypted with the existing expiry and owner isolation. Persist only
bounded non-content metadata in session storage.

Extend collection format validation, output MIME/extension handling, packaging,
progress, retry checkpoints and native download reports for both PDF modes.
Use a packaged worker or extension document for rendering so large jobs do not
block page controls. Final context selection is an implementation decision,
subject to Manifest V3 CSP compatibility and working cancellation. Cancel must
terminate renderer work and prevent a late file handoff.

Bundle all executable code and fonts; no CDN or remote font runtime dependency.
Update explicit package allowlists and retain license notices. Existing media
fetch permissions, redirect rules, access checks, cache ownership, two-hour
expiry and disk quotas remain applicable. Share validated source snapshots
across formats rather than fetching chapters again just to switch formats.

## Fonts, images, and resource limits

Use embedded fonts with explicit tested language coverage and bold/italic faces.
Do not describe Unicode support as universal: choose and document fallback
coverage, and surface unsupported text rather than silently dropping glyphs.
Convert browser-decodable GIF/WebP/AVIF to bounded PNG/JPEG when necessary;
animated images use a static frame. Sanitized SVG may be converted to raster or
supported vector graphics. Conversion failure fails that post. Never fetch an
image directly through the PDF library.

Enforce decoded-image dimensions/pixel budgets and PDF input/output limits in
addition to existing encoded-image/disk limits. Final numeric limits and rendering
context belong to the implementation plan after measuring representative
synthetic long/image-heavy posts. A count of 100 chapters is not a memory bound.
If a part exceeds a PDF resource limit, fail visibly with a useful smaller-export
suggestion; do not silently truncate, download a partial book or secretly switch
the requested format. Retain reusable chapters for manual packaging retry and
preserve results for parts already handed off.

## Validation and documentation

Test PDF parsing/text extraction, post ordering, metadata and clean clickable
links, image embedding, fonts, chapter navigation and page breaks. Cover both
collection modes, part boundaries, cancellation, failed-post/packaging retries,
format switching, expired/restored jobs, and native completion/interruption.
Assert that PDF export never calls `window.print` or mounts the old print frame.
Inspect rendered sample pages as well as parsing their structure. Verify actual
downloads in the installed extension, chooser geometry/keyboard behavior, local
CSP compatibility and absence of PDF-related external requests. Run appropriate
existing EPUB/Markdown regressions and packaging checks.

During implementation update the maintained Patreon reference with dated PDF
differences, preserving historical print-path facts; record actual commands,
results and limits in TESTING.md and dated evidence in docs/testing-history.md.
Synthetic fixtures and installed-extension checks must remain distinct from live
Patreon verification. This proposal adds no new live-site observations.

## Explicit limits

This is a document export, not a screenshot-perfect copy of the Patreon page.
It does not add access bypasses, attachment/video export, remote conversion,
print automation, PDF editing, or a claim of PDF/UA accessibility certification.
Existing EPUB and Markdown outputs retain their behavior.

References: [pdfmake](https://pdfmake.github.io/docs/0.3/),
[output methods](https://pdfmake.github.io/docs/0.3/getting-started/client-side/methods/),
[image formats](https://pdfmake.github.io/docs/0.3/document-definition-object/images/).
