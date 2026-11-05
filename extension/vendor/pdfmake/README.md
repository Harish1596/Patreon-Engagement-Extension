# Packaged PDF renderer

pdfmake 0.3.13, pinned by package-lock.json.
Regenerate with npm ci --ignore-scripts followed by node scripts/vendor-pdf.js.
The original Roboto VFS is retained for explicit SVG font references. Primary Noto Sans
fonts are added from the pinned, hash-verified files in scripts/pdf-fonts/noto-sans.
The browser bundle is rebuilt
with a reviewed PNG adapter: bounded DecompressionStream inflation runs
inside our existing PDF worker. Its cap derives from the declared dimensions
and maximum PNG bit depth. This avoids unbounded inflation and Blob workers
under strict extension CSP. Terser minifies the result, retaining license comments.
coverage.js is derived from the intersection of the four Noto Sans character sets.

Source: https://github.com/bpampuch/pdfmake
Roboto source/license: https://github.com/googlefonts/roboto
Roboto is licensed under Apache-2.0; see ROBOTO-LICENSE.
Noto Sans source: https://github.com/notofonts/noto-fonts/tree/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf/NotoSans
Noto Sans is licensed under SIL OFL-1.1; see NOTO-SANS-LICENSE.
Unmodified source files, licenses and provenance hashes are committed for offline rebuilds.
The pdfmake bundle retains its third-party license comments.

SHA-256:

5b42f3f679f585c87be3d154f0fef7b43e4999115d4f487765d96ac36c8acda0  pdfmake.min.js
608b7b1bbd7260d3bf2855c149aa1c99145cfc4c17abcab57b71c99cdba6045b  vfs_fonts.js
a73e8ff072780474e3a3cce342bca9912f9e0a9816267e4c5dba8021936762d3  coverage.js
0dab92d0544f7b233403f14b84a663bdbfa746982eda629e7f4f9ffe1b036feb  NOTO-SANS-LICENSE
