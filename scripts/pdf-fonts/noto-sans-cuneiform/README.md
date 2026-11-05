# Noto Sans Cuneiform fallback

The unmodified static regular TTF comes from the official
[notofonts/noto-fonts repository](https://github.com/notofonts/noto-fonts/tree/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf/NotoSansCuneiform)
at commit `ffebf8c1ee449e544955a7e813c54f9b73848eac`.
`source.json` records its upstream path, byte count and SHA-256 hash.
`OFL.txt` is the upstream license/copyright notice, identical to the packaged
Noto font license. The font is bundled locally; export makes no font requests.

The PDF builder selects this family only for text runs outside primary Noto Sans
coverage that this face supports. Its regular face is registered for all four
style aliases; surrounding Latin retains its original bold/italic styling.
Rebuild with `node scripts/vendor-pdf.js`; it verifies source hashes and generates
per-family coverage plus the supported union. SVG text retains the primary-font
boundary and is not automatically rewritten with script fallback.
