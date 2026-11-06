# Noto Sans SC PDF fallback

The unmodified static regular OTF comes from the official
[notofonts/noto-cjk repository](https://github.com/notofonts/noto-cjk/tree/523d033d6cb47f4a80c58a35753646f5c3608a78/Sans/SubsetOTF/SC)
at commit `523d033d6cb47f4a80c58a35753646f5c3608a78` (font version 2.004).
`source.json` records immutable upstream paths, byte sizes and SHA-256 hashes.
`OFL.txt` is the unmodified upstream root LICENSE. The packaged
NOTO-SANS-SC-LICENSE includes the font's embedded Adobe copyright notice followed
by that license. Source font/license hashes are verified during every rebuild.

This language-specific upstream subset has 30,890 mapped characters, including
U+5929 (天), common simplified/traditional ideographs and kana. Its glyph design
uses the Simplified Chinese locale. It does not establish every CJK character,
regional Japanese/Korean typography, all Korean text or universal Unicode support.
The single regular face serves all four style aliases; surrounding Latin keeps
its primary bold/italic faces. Unsupported characters remain explicit errors.

`node scripts/vendor-pdf.js` generates a separate local `vfs_cjk.js`. PDF workers
load it only when the structured document selects this fallback. Ordinary Latin
and Cuneiform documents do not load it. The font is never fetched remotely during
export, and generated PDFs embed the needed glyphs. SVG text keeps the existing
primary-font guard because document-text fallback does not rewrite SVG text.
