# Changelog

Notable changes to Patreon Reader, previously named Patreon Engagement Toggle.
This document lists release versions only. Intermediate development labels in
the [testing history](docs/testing-history.md) belong to the work consolidated
into version 1.1.0; they are not separate published releases.

## 1.1.0

Status: prepared for release; testing completed and confirmed by the user.
Publication is not yet recorded. Updates the existing 1.0.0 extension.

### Added

- Optional Reader customization, enabled independently from the engagement-bar
  toggle in the extension popup.
- An **Aa** Reader button before Like in the post's main action row.
- Font family, text size (12–32px), paragraph spacing (0–48px), and line spacing
  (1–2.5×) controls, with immediate previews.
- System-font choices: System Sans, Arial, Verdana, Trebuchet, Georgia, Times,
  and Monospace, plus Patreon default. No bundled or downloaded fonts.
- Paired Post Color presets that coordinate background, text, and action colors:
  Default, Charcoal, Light Green, Sepia, and White, in that display order.
- Saved local reading preferences, shared across open post tabs in the same
  browser profile and retained when Reader is disabled.
- Individual default controls and a reset to Patreon defaults without changing
  the Reader or engagement-bar enablement settings.
- Keyboard navigation, focus management, Escape/outside-click dismissal, and a
  narrow-window layout for the Reader panel.

### Changed

- Renamed the extension from **Patreon Engagement Toggle** to **Patreon Reader**.
- Expanded appearance customization across the post column, including metadata,
  comments, the membership banner, and the comment-entry field.
- Kept Page Color selection to matched presets rather than independent text and
  background colors; preserved migration from intermediate development settings.
- Reduced the extension popup width from 360px to 320px and removed its bottom
  "Runs locally on Patreon post pages" line and lock icon.
- Added a theme-aware outline and shadow to the membership banner and creator
  byline avatar for non-default Post Colors.
- Made the comment-entry surface slightly darker than the selected page color,
  with matching text, placeholder, border, and focus styling.

### Fixed

- Main-post detection and Reader-button placement with responsive duplicate
  titles, post-card wrappers, page navigation, and rerendered action rows.
- Low-contrast post actions, parent-comment text, commenter names, and comment
  Like, Reply, and More icons when custom colors are active.
- Membership-banner backgrounds and nested comment-entry styling that retained
  native dark colors on light custom surfaces.
- Restoration of native appearance when selecting Default or disabling Reader,
  while preserving native controls, disabled states, and access permissions.

### Development and packaging

- Reorganized installable source under `extension/`, with separate runtime,
  tests, scripts, documentation, and store assets.
- Added allowlisted ZIP packaging, consistent-version checks, resource-path
  checks, archive integrity/content validation, and safe overwrite handling.
- Organized browser regression suites and tooling tests, with shared browser
  discovery and an installed-extension check.
- Added maintained post-page integration documentation and testing history.
- Renamed release archives to `patreon-reader-VERSION.zip`.

## 1.0.0

Initial release, published as **Patreon Engagement Toggle**.

### Added

- Hide Patreon's floating engagement bar on supported post pages by default.
- An extension-popup toggle to show or hide the floating bar.
- Local storage of the engagement-bar visibility preference.
- Local-only operation without collecting or transmitting personal information.

Reader appearance customization was not included in this release.
