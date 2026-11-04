# Packaged PDF renderer

pdfmake 0.3.13, pinned by package-lock.json.
Regenerate with npm ci --ignore-scripts followed by node scripts/vendor-pdf.js.
The browser bundle and Roboto VFS are copied without modification.
coverage.js is derived from the intersection of the four font character sets.

Source: https://github.com/bpampuch/pdfmake
Roboto source/license: https://github.com/googlefonts/roboto
Roboto is licensed under Apache-2.0; see ROBOTO-LICENSE.
The pdfmake bundle retains its third-party license comments.

SHA-256:

1596506cb3f38d4144cc6ea02fdd3ba28e93878eb7f63c079745ec31413329f6  pdfmake.min.js
1483ed267fe00ad90a3834441b019d856dd41ed079b2614404b2fcef425db6fc  vfs_fonts.js
bc940c70b0c2ec348c9897e0e400c099a0abb755c6f3d079e1bdf2e560327195  coverage.js
