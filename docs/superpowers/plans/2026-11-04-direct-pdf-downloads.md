# Direct PDF Downloads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Direct local PDF downloads for posts, combined collections, and individual collection PDFs in ZIPs.

**Architecture:** A shared adapter converts sanitized inert snapshots to bounded PDF chapter data. An extension-owned offscreen document runs a packaged pdfmake worker; collection staging remains encrypted and uses existing download reporting.

**Tech Stack:** Manifest V3 JavaScript, bundled pinned pdfmake/Roboto, Playwright and Node tests; PDF.js for independent output inspection.

**Spec:** docs/superpowers/specs/2026-11-04-direct-pdf-downloads-design.md (approved by the user's instruction to proceed).

## Global Constraints

- No native print UI, remote renderer, remote executable code, or remote fonts.
- Keep existing access/media permission checks and source-cache ownership.
- Collection choices: Single PDF directly, PDF files in ZIP; 100 posts per part and 1,000 discovered posts.
- Preserve encrypted retry staging, two-hour expiry, existing disk budgets and native completion reports.
- Use an isolated worktree; commit focused changes; do not integrate other sessions' uncommitted work.

## Review Focus

- Malformed cached trees and image URLs cannot trigger library network requests or active HTML.
- Long/image-heavy input must fail visibly within explicit limits rather than freeze the page.
- Cancelling rendering must stop its worker and prevent late downloads.
- Simultaneous archive downloads and PDF rendering must not close each other's offscreen document.
- Large collections retain ordering, part names and completed-part reports when later work fails.

### Task 1: PDF chapter adapter and worker

**Files:** create extension/shared/pdf.js, extension/export/pdf-worker.js, extension/vendor/pdfmake/*, tests/pdf.spec.js; modify package metadata and package allowlist.

**Interfaces:** `PatreonPdf.chapter(snapshot)` returns a validated serializable chapter; `PatreonPdf.definition(chapters, book?)` returns the pdfmake definition. Worker accepts `{chapters, book}` and returns transferable PDF bytes or a fixed error.

- [ ] Write and run failing tests for real PDF bytes/text, links, formatting, fonts, images and unsafe/malformed input.
- [ ] Vendor pinned pdfmake with fonts and license notices; document reproducible source/integrity.
- [ ] Implement bounded tree mapping, glyph coverage validation, image normalization and pagination. Initial limits: 24 MiB serialized input, 32 MiB generated PDF, 16 million decoded pixels per image, 8,192 pixels per side, 120-second render deadline. Measure with synthetic long/image-heavy fixtures; tighten if needed.
- [ ] Run adapter/renderer tests and inspect a rendered sample; commit.

### Task 2: Render service and post download

**Files:** create extension/background/pdf-renderer.js, extension/background/offscreen.js, extension/export/pdf-host.js; modify extension/export/archive-download.html, extension/background/media.js, extension/content/export.js, extension/manifest.json, chooser help, tests/helpers/reader.js and tests/export.spec.js.

**Interfaces:** `PatreonPdfRenderer.render(chapters, book?, signal?) -> Promise<Uint8Array>`; a content client uses validated extension messages and returns PDF bytes. Offscreen leases coordinate active PDF jobs and archive Blob URLs. Cancellation terminates the matching worker. No content is stored in session metadata.

- [ ] Replace native-print regression with failing direct-download assertions; add cancellation and sender-validation tests.
- [ ] Implement bounded input/output transport, owner validation, deadlines and worker termination; route only embedded assets to the library.
- [ ] Replace print iframe with PDF generation and existing filename/download behavior.
- [ ] Run post export/security regressions and real installed-extension PDF download; commit.

### Task 3: Collection PDF modes

**Files:** modify extension/content/collection-export.js, extension/background/archives.js, extension/background/media.js, extension/export/archive-download.js, extension/export/collection-chooser.html; create extension/background/pdf-book.js and tests/collection-pdf.spec.js; extend archive tooling fixtures.

**Interfaces:** collection `pdf` emits chapter PDFs staged for ZIP; `pdf-book` emits PDF-ready JSON chapters staged encrypted. `PatreonPdfBook.write({job, output, chapterBytes, fileFor, check, progress})` validates/decompresses chapters and invokes the shared renderer with job cancellation.

- [ ] Write and run failing tests for both modes, chapter order, contents links, packaging retry, failed chapter retry, format changes and cancellation.
- [ ] Add format handling, MIME, encrypted chapter staging, restoration validation and combined-document assembly. Retain bounded input and CRC validation when reading staged data.
- [ ] Add chooser choices and labels; retain narrow-view footer controls and current frame sizing.
- [ ] Run PDF cases, 101-post parts, archive/storage tests and existing collection regressions; commit.

### Task 4: Verification and documentation

**Files:** maintained baseline, TESTING.md, docs/testing-history.md, approved spec status and this plan.

- [ ] Run full browser suite, tooling suite, syntax checks and package validation; report every unresolved failure.
- [ ] Run installed Brave downloads for all PDF modes; inspect PDF pages and chooser screenshots at desktop and narrow sizes. Browser plugin is unavailable, so use repository Playwright.
- [ ] Obtain an independent whole-branch review and resolve material findings with regression checks.
- [ ] Record dated behavior, measured limits, commands/results and live-verification boundaries; commit all changes and report branch/commits.

## Execution record

Ruling: execute natively without another approval checkpoint because the user explicitly instructed implementation after reviewing the design. Existing uncommitted primary-checkout work is excluded; implementation starts from c4032cc in the already assigned linked worktree.
