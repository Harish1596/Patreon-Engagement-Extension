# Patreon Reader artwork

Editable SVG sources and generated PNGs for the 1.1.0 branding update.
The blue open-book mark with a gold bookmark represents reading customization;
no Patreon logo, third-party artwork, or downloadable fonts are used.

| File | Use | Size |
| --- | --- | --- |
| `store-icon-128.png` | Store listing icon; matches the packaged 128px icon | 128×128, transparent |
| `small-promo-tile.png` | Small promotional tile | 440×280, opaque RGB |
| `marquee-promo-tile.png` | Optional marquee promotional tile | 1400×560, opaque RGB |
| `../extension/icons/icon-{16,32,48,128}.png` | Browser extension icons | Corresponding pixel sizes |

The 128px icons contain 96px artwork with 16px transparent padding on each side.
Smaller runtime icons use the available area for legibility. The popup uses
[`reader.svg`](../extension/icons/reader.svg), the shared source for all icon PNGs
and the book marks in the promotional tiles.

## Regenerate

From the repository root, after `npm ci`, run:

```sh
npm run assets
npm run test:tooling
npm run package -- --force
```

Generation uses the installed Chrome browser via Playwright and the existing
browser-path resolver (`CHROME_EXECUTABLE` override supported). It overwrites the
seven generated PNGs, checks dimensions/PNG color type, and checks transparent
padding for the 128px icons. No external images or network requests are used.
Font rendering may differ between operating systems; review regenerated tiles
visually. The PNGs, not SVGs, are the store-upload deliverables.

Promotional graphics are not product screenshots. Separately supply at least
one current screenshot of the actual extension at 1280×800 or 640×400; do not
represent these promotional tiles as captured Patreon UI. The optional marquee
and other store-only assets are excluded from the release ZIP.

Dimensions and icon padding follow the
[Chrome Web Store image guidance](https://developer.chrome.com/docs/webstore/images).
Artwork regeneration does not upload or publish a store update.

## Release screenshots

Current source version is 1.2.1. Its simplified result summary and reload-recovery
UI postdate the 1.2.0 captures below. A validated 1.2.1 ZIP is now recorded in the
[release notes](../docs/releases/1.2.1.md); a refreshed screenshot set has not been
generated. Use that validated build when regenerating captures; do not relabel
old provenance as a new build.

Version 1.2.0 screenshots are under `screenshots/1.2.0/`. They show the actual
installed extension from the validated release ZIP on labelled synthetic pages,
not private content or a signed-in account. They are captured at 1280×800 without
compositing. `provenance.json` records package and image hashes and the browser.
Review the images before store upload; these demo captures do not establish live
Patreon compatibility. Existing 1.1.0 promotional artwork remains unchanged.

To regenerate after release checks and packaging:

```sh
npm ci --ignore-scripts
npm run package -- --force
node scripts/capture-store-screenshots.js
```

The capture tool uses Brave's installed-extension support in an isolated temporary
profile and never opens the user's browser profile. It rejects a package that no
longer matches the current allowlisted source files. The three captures show Reader
appearance controls, post download formats and collection format/packaging choices.


On November 5, 2026, the user confirmed completing the final screenshots and
artwork for the store update. Those files were not supplied to this checkout;
the demo assets and their provenance above are retained unchanged. Asset readiness
does not establish that the store listing has been uploaded or published.

The user subsequently confirmed approval and publication of 1.2.0. That
confirmation does not establish publication or artwork validation for 1.2.1.
