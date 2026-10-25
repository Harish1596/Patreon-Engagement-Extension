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
