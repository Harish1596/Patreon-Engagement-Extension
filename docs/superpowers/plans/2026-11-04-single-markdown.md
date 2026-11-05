# Single Markdown Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Offer one combined Markdown document as well as a ZIP of individual
Markdown chapters, matching the existing EPUB collection choices.

**Architecture:** Keep independent encrypted chapter staging and stream their
validated UTF-8 contents into one disk-backed `.md` file. Reuse the existing
collection session, cache, 100-chapter parts, retry, cancellation, quota, native
handoff and completion-report lifecycle. Add a fourth descriptive chooser action.

**Tech Stack:** Existing plain JS/HTML/CSS, browser streams, Node and Playwright.

**Spec:** User request: Markdown must offer multiple files or a single file, like EPUB.

## Global Constraints

- Local processing only; unchanged membership/media access and optional permissions.
- Preserve existing EPUB and Markdown ZIP outputs and standalone-post exports.
- Keep existing 1,000-discovered-post, 100-chapter-part and disk-budget limits.
- No collection-sized messages or in-memory aggregate document buffers.
- Collection metadata, contents links, ordered chapters and embedded images.
- Scoped extension of the existing chooser identity, not a new visual world.

## Interfaces

- New UI format: `markdown-book`; content builds existing `snapshot` sources.
- Archive CREATE uses `markdown:true`, existing validated `book` metadata and `.md`.
- New `PatreonMarkdownBook.write` consumes the EPUB writer's streaming interface.
- Each staged chapter has local generated anchor `chapter-001`, level-two title,
  per-post metadata, nested body headings and self-contained inline images.
- Native MIME: `text/markdown;charset=utf-8`; completed parts share existing reports.

## Review Focus

- Plain `.md` bytes/MIME/filename, not a ZIP renamed to Markdown.
- Ordered Unicode/escaped titles and working contents anchors with duplicate names.
- Worker restart, chapter and packaging retry, cancellation and corruption/quota failures.
- Four choices on narrow/light/dark UI without losing fixed recovery actions.
- Large collections retain EPUB's numbered parts and global ZIP numbering.

### Backend writer

- [x] Add failing storage/writer tests for plain Markdown, metadata and integrity.
- [x] Stream validated decrypted/deflated chapters and generate collection metadata/TOC.
- [x] Persist validated document mode and use native Markdown MIME through cleanup.
- [x] Pass backend tests without changing EPUB/ZIP behavior.

### Content and chooser

- [x] Add failing end-to-end Single Markdown generation and recovery cases.
- [x] Add fourth choice and validate its mode in worker/content message paths.
- [x] Format Markdown chapters and integrate single-file progress/parts/reports.
- [x] Verify contents, embedded media, retry/cancel and single-versus-ZIP behavior.

### Integration and completion

- [x] Add module imports to worker and browser fixtures; verify native `.md` download.
- [x] Run Chrome/Brave/tooling/syntax checks and bounded rendered inspection.
- [x] Update maintained reference, README, testing records and commit completed work.

## Execution notes

- Backend and content integration were implemented in separate file-ownership
  domains, then integrated and reviewed together; no user popup changes were included.
- RED/GREEN: missing Single Markdown UI and unsupported backend CREATE failed
  before implementation; package dependency presence failed before allowlisting.
- Scoped independent review found one Important initial doubled-text sizing issue;
  the new regression failed, the bound was corrected, and recheck resolved it.
- Final checks: 88 Chrome, 12 Brave and 89 tooling cases; 60 JS syntax checks.
- EPUB/ZIP and single-post Markdown structures, existing limits and privacy/access
  boundaries remain unchanged. Combined Markdown uses the same numbered-part limit.
