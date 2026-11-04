# Packaged PDF renderer

pdfmake 0.3.13, pinned by package-lock.json.
Regenerate with npm ci --ignore-scripts followed by node scripts/vendor-pdf.js.
The Roboto VFS is copied without modification. The browser bundle is rebuilt
with a reviewed PNG adapter: bounded DecompressionStream inflation runs
inside our existing PDF worker. Its cap derives from the declared dimensions
and maximum PNG bit depth. This avoids unbounded inflation and Blob workers
under strict extension CSP. Terser minifies the result, retaining license comments.
coverage.js is derived from the intersection of the four font character sets.

Source: https://github.com/bpampuch/pdfmake
Roboto source/license: https://github.com/googlefonts/roboto
Roboto is licensed under Apache-2.0; see ROBOTO-LICENSE.
The pdfmake bundle retains its third-party license comments.

SHA-256:

5b42f3f679f585c87be3d154f0fef7b43e4999115d4f487765d96ac36c8acda0  pdfmake.min.js
1483ed267fe00ad90a3834441b019d856dd41ed079b2614404b2fcef425db6fc  vfs_fonts.js
bc940c70b0c2ec348c9897e0e400c099a0abb755c6f3d079e1bdf2e560327195  coverage.js
