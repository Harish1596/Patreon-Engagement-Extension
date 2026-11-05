# Packaged PDF renderer

pdfmake 0.3.13, pinned by package-lock.json.
Regenerate with npm ci --ignore-scripts followed by node scripts/vendor-pdf.js.
The original Roboto VFS is retained for explicit SVG font references. Primary Noto Sans and Cuneiform fallback fonts are added from pinned, hash-verified
files in scripts/pdf-fonts. The Cuneiform regular face serves all style aliases.
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
Noto fonts are licensed under SIL OFL-1.1; see NOTO-SANS-LICENSE.
Unmodified source files, licenses and provenance hashes are committed for offline rebuilds.
The pdfmake bundle retains its third-party license comments.

SHA-256:

5b42f3f679f585c87be3d154f0fef7b43e4999115d4f487765d96ac36c8acda0  pdfmake.min.js
75ed32243ebbc85abec68f41fd2f4e3dad1156e2c995f09e7807c145e7d9ffee  vfs_fonts.js
a27a2804f4f597c8a315f95baaa4eaa366ce8d67398b9bf85edb92cf7fd62862  coverage.js
0dab92d0544f7b233403f14b84a663bdbfa746982eda629e7f4f9ffe1b036feb  NOTO-SANS-LICENSE
