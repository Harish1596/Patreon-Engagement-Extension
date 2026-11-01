# Changelog

## Unreleased

- Retain completed collection chapters after generation/transfer failures, retry
  missing posts, and retry ZIP packaging without fetching completed posts again.
- Add local post export in PDF, EPUB, and Markdown formats.
- Embed displayed inline post images for offline use with on-demand,
  exact-origin media permission prompts.
- Use the sanitized post title as the default filename for every export format.
- Add separate-file collection export as a ZIP of ordered EPUB or Markdown posts.
- Support direct numeric collection post links and expand every Load more batch.
- Reuse one temporary worker tab throughout each collection export.
- Wait through transient Load more disabled states until pagination is exhausted.
- Prefer validated local API cursor pagination with Load more as a fallback.
- Title-case the Download Collection control and dialog heading.
- Emit collection ZIPs with the canonical MIME type and valid entry timestamps.
- Close collection worker tabs immediately after preflight and file generation.
- Transfer collection files in bounded chunks to avoid browser message limits.
- Use deflate framing for macOS-compatible outer collection ZIP archives.
- Show accessible progress bars while post and collection downloads are prepared
  and generated.
- Compress outer collection ZIPs to prevent nested EPUB markers from confusing
  macOS Archive Utility format detection.
- Verify the loaded post identity before preparing or generating collection files
  so worker navigation cannot export the previous chapter repeatedly.
- Skip explicitly locked collection posts before worker preparation and report
  their count separately from unavailable or unsupported posts.
- Reuse collection discovery and preparation for repeat downloads for 15 minutes,
  with an explicit Refresh collection action.
- Extend collection discovery and prepared-session cache lifetimes to two hours.
- Stop collection preparation and downloads from activating tabs during slow-page
  readiness retries.
- Restore prepared collection sessions after idle background-worker restarts and
  show chooser errors directly in the collection panel.
- Add cancellation during collection discovery, preparation, generation, transfer,
  and ZIP packaging, with worker cleanup and a Start again action.

## 1.1.1

- Fix engagement-bar hiding being lost after page loading or rerendering.
- Restore the hide flag automatically while respecting the saved toggle setting.

## 1.1.0

- Renamed the extension to **Patreon Reader**, with updated icons and store artwork.
- Added Reader controls for fonts, text size, paragraph spacing, and line spacing.
- Added matched Post Color themes for readable text, backgrounds, and icons.
- Added saved reading preferences and a reset to Patreon defaults.
- Improved post and comment styling, avatar visibility, and popup layout.

## 1.0.0

- Initial release as **Patreon Engagement Toggle**.
- Hide or show Patreon’s floating engagement bar using the extension popup.
- Save the visibility preference locally without collecting personal data.
