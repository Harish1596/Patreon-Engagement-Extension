# Changelog

## 1.2.0 — Release candidate

This version is prepared locally; Chrome Web Store publication is not yet confirmed.

- Download accessible posts as PDF, EPUB or Markdown with embedded inline images,
  title-based filenames and Creator, Download time and Source details.
- Download collections as a combined file or separate files in a ZIP, in any of
  the three formats. Read oldest to newest, with numbered parts for large collections.
- Choose Format and Packaging independently, then download with one action.
- Discover posts only when Download is pressed, using validated API pagination
  with Load more as a fallback. Skip explicitly locked posts and report other skips.
- Reuse text and images across formats through a shared, encrypted two-hour source
  cache bounded to 512 MiB on local disk, including across worker restarts.
- Keep saved reading preferences while automatically expiring temporary export data
  and clearing export caches at browser-session cleanup.
- Fetch uncached chapters in inactive temporary tabs, close extension-created tabs
  after use, and preserve the user's chosen browser focus.
- Show progress, current chapter, elapsed time and packaging activity. Cancel work
  or retry failures while retaining completed chapters where supported.
- Generate macOS-compatible compressed ZIPs and stream archive assembly through
  bounded local storage instead of retaining every generated file in page memory.
- Track browser-confirmed collection download completion or interruption, and
  provide an optional local report of included, skipped and failed posts.
- Generate PDFs directly with packaged code and fonts, selectable text, clickable
  links and embedded images. Preserve extended Latin diacritics and supported
  Cuneiform characters using local font fallback.
- Enforce PDF input/output, image and render-time limits; show explicit errors for
  unsupported characters or conversions rather than silently losing content.
- Identify the popup as Patreon Reader with a manifest-derived version badge,
  reading preferences and Discord/GitHub community links. Show preference errors
  only when needed, without a permanent page-status section.
- Preserve the existing Reader customisations and engagement-bar fixes.

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
