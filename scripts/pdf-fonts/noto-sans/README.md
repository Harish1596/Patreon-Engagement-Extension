# Noto Sans source fonts

These four unmodified static TTF faces come from the official
[notofonts/noto-fonts repository](https://github.com/notofonts/noto-fonts/tree/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf/NotoSans)
at commit `ffebf8c1ee449e544955a7e813c54f9b73848eac`.
`source.json` records each upstream path, byte count and SHA-256 hash.
`OFL.txt` is the upstream SIL Open Font License and copyright notice.

`node scripts/vendor-pdf.js` verifies those hashes, embeds all four faces in the
runtime VFS, registers the NotoSans family and derives coverage shared by every
face. Rebuilds use these committed inputs without network access. The package
ships the generated VFS and license; it does not duplicate the raw TTF inputs.
Roboto remains in the VFS for explicit SVG references. PDF documents use Noto Sans
as their primary family to preserve extended Latin diacritics across styles.
