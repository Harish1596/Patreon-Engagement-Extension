# Changelog

## Unreleased

- Add local post export in PDF, EPUB, and Markdown formats.
- Embed displayed inline post images for offline use with on-demand,
  exact-origin media permission prompts.
- Use the sanitized post title as the default filename for every export format.
- Add separate-file collection export as a ZIP of ordered EPUB or Markdown posts.
- Support direct numeric collection post links and expand every Load more batch.
- Reuse one temporary worker tab throughout each collection export.
- Wait through transient Load more disabled states until pagination is exhausted.
- Prefer validated local API cursor pagination with Load more as a fallback.

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
