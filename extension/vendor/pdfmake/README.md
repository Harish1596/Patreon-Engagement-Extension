# Packaged PDF renderer

pdfmake 0.3.13, pinned by package-lock.json.
Regenerate with npm ci --ignore-scripts followed by node scripts/vendor-pdf.js.
The original Roboto VFS is retained for explicit SVG font references. Primary Noto Sans, Cuneiform and CJK fallback fonts come from pinned, hash-verified
files in scripts/pdf-fonts. Cuneiform and CJK regular faces serve all style aliases.
vfs_cjk.js is loaded locally only when document text selects NotoSansSC; ordinary
Latin/Cuneiform PDFs do not load its font data. The CJK glyph design uses the SC locale.
The browser bundle is rebuilt
with a reviewed PNG adapter: bounded DecompressionStream inflation runs
inside our existing PDF worker. Its cap derives from the declared dimensions
and maximum PNG bit depth. This avoids unbounded inflation and Blob workers
under strict extension CSP. Terser minifies the result, retaining license comments.
coverage.js records each family's common face coverage and their supported union.

Source: https://github.com/bpampuch/pdfmake
Roboto source/license: https://github.com/googlefonts/roboto
Roboto is licensed under Apache-2.0; see ROBOTO-LICENSE.
NotoSans: https://github.com/notofonts/noto-fonts/tree/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf/NotoSans
NotoSansCuneiform: https://github.com/notofonts/noto-fonts/tree/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf/NotoSansCuneiform
NotoSansSC: https://github.com/notofonts/noto-cjk/tree/523d033d6cb47f4a80c58a35753646f5c3608a78/Sans/SubsetOTF/SC
Noto fonts are licensed under SIL OFL-1.1; see NOTO-SANS-LICENSE and NOTO-SANS-SC-LICENSE.
Unmodified source files, licenses and provenance hashes are committed for offline rebuilds.
The pdfmake bundle retains its third-party license comments.

SHA-256:

5b42f3f679f585c87be3d154f0fef7b43e4999115d4f487765d96ac36c8acda0  pdfmake.min.js
75ed32243ebbc85abec68f41fd2f4e3dad1156e2c995f09e7807c145e7d9ffee  vfs_fonts.js
9da1acfb96b7cbbf4793159b70f18b7b5fd93597d72db06746e22d9b0075b1f8  vfs_cjk.js
34f3d8e278cb5fd799a51ce24393314b02000d7d349359e9bc2a8c4dcfe5fc56  coverage.js
0dab92d0544f7b233403f14b84a663bdbfa746982eda629e7f4f9ffe1b036feb  NOTO-SANS-LICENSE
af55b908a0ccf969b7bdd0e6cac6f4866a7ed0d1aeb9c7b29516ca0d24422981  NOTO-SANS-SC-LICENSE
