/* Rebuild packaged PDF assets from the exact dependencies in package-lock.json. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const fontkit = require('fontkit');
const source = path.dirname(require.resolve('pdfmake/package.json'));
const target = path.resolve(__dirname, '../extension/vendor/pdfmake');
fs.mkdirSync(target, { recursive: true });
const fontRoot = path.join(__dirname, 'pdf-fonts/noto-sans');
const fontSource = JSON.parse(fs.readFileSync(path.join(fontRoot, 'source.json'), 'utf8'));
const faces = { normal: 'Regular', bold: 'Bold', italics: 'Italic', bolditalics: 'BoldItalic' };
const fontNames = Object.values(faces).map(style => `NotoSans-${style}.ttf`);
for (const name of [...fontNames, 'OFL.txt']) {
  const expected = fontSource.files.find(file => file.file === name)?.sha256;
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(fontRoot, name))).digest('hex');
  if (actual !== expected) throw new Error(`The pinned Noto Sans asset changed: ${name}`);
}
const vfs = Object.fromEntries(fontNames.map(name => [name, fs.readFileSync(path.join(fontRoot, name)).toString('base64')]));
const mapping = { NotoSans: Object.fromEntries(Object.entries(faces).map(([face, style]) => [face, `NotoSans-${style}.ttf`])) };
// Retain the original family for SVGs that explicitly request Roboto.
const originalVfs = fs.readFileSync(path.join(source, 'build/vfs_fonts.js'), 'utf8');
fs.writeFileSync(path.join(target, 'vfs_fonts.js'), originalVfs + '\n/* Noto Sans: unmodified SIL OFL fonts; see NOTO-SANS-LICENSE. */\npdfMake.addVirtualFileSystem('
  + JSON.stringify(vfs) + ');\npdfMake.addFonts(' + JSON.stringify(mapping) + ');\n');
fs.copyFileSync(path.join(fontRoot, 'OFL.txt'), path.join(target, 'NOTO-SANS-LICENSE'));
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(target, 'LICENSE'));
const styles = fontNames.map(name => fontkit.openSync(path.join(fontRoot, name)).characterSet);
const points = styles[0].filter(cp => styles.every(set => set.includes(cp))).sort((a, b) => a - b);
const ranges = [];
for (const cp of points) {
  const last = ranges.at(-1);
  if (last && last[1] + 1 === cp) last[1] = cp; else ranges.push([cp, cp]);
}
fs.writeFileSync(path.join(target, 'coverage.js'), `/* Character coverage shared by all four primary Noto Sans faces. */\nglobalThis.PatreonPdfGlyphs = ${JSON.stringify(ranges)};\n`);
async function finish() {
// png-js otherwise starts a Blob worker for each PNG inflate. The PDF renderer
// already has its own disposable worker; decode there under script-src 'self'.
let bundle = fs.readFileSync(path.join(source, 'build/pdfmake.js'), 'utf8');
const marker = 'const png_js_browser_inflate = unzlib ;';
if (bundle.split(marker).length !== 2) throw new Error('The pdfmake PNG adapter changed; review the worker patch.');
bundle = bundle.replace(marker, `const png_js_browser_inflate = (data, callback, limit) => {
  (async () => {
    const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    const chunks = []; let size = 0;
    try {
      for (;;) {
        const next = await reader.read(); if (next.done) break;
        size += next.value.length;
        if (size > limit) throw new Error('The inflated PNG exceeds its declared pixel dimensions.');
        chunks.push(next.value);
      }
      const result = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
      return result;
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  })().then(result => callback(null, result), error => callback(error));
  return () => {};
};`);
const decodeMarker = 'return png_js_browser_inflate(new Uint8Array(this.imgData),';
if (bundle.split(decodeMarker).length !== 2) throw new Error('The PNG dimension adapter changed; review the patch.');
bundle = bundle.replace(decodeMarker, 'return ((data, callback) => png_js_browser_inflate(data, callback, this.width * this.height * 8 + this.height * 8 + 65536))(new Uint8Array(this.imgData),');
const result = await require('terser').minify(bundle, { format: { comments: /@license|@preserve|^!/ }, ecma: 2020 });
if (!result.code) throw new Error('PDF minification failed.');
fs.writeFileSync(path.join(target, 'pdfmake.min.js'), result.code + '\n');
const hashes = ['pdfmake.min.js', 'vfs_fonts.js', 'coverage.js', 'NOTO-SANS-LICENSE'].map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(target, name))).digest('hex')}  ${name}`).join('\n');
fs.writeFileSync(path.join(target, 'README.md'), `# Packaged PDF renderer\n\npdfmake ${require('pdfmake/package.json').version}, pinned by package-lock.json.\nRegenerate with npm ci --ignore-scripts followed by node scripts/vendor-pdf.js.\nThe original Roboto VFS is retained for explicit SVG font references. Primary Noto Sans\nfonts are added from the pinned, hash-verified files in scripts/pdf-fonts/noto-sans.\nThe browser bundle is rebuilt\nwith a reviewed PNG adapter: bounded DecompressionStream inflation runs\ninside our existing PDF worker. Its cap derives from the declared dimensions\nand maximum PNG bit depth. This avoids unbounded inflation and Blob workers\nunder strict extension CSP. Terser minifies the result, retaining license comments.\ncoverage.js is derived from the intersection of the four Noto Sans character sets.\n\nSource: https://github.com/bpampuch/pdfmake\nRoboto source/license: https://github.com/googlefonts/roboto\nRoboto is licensed under Apache-2.0; see ROBOTO-LICENSE.\nNoto Sans source: ${fontSource.repository}/tree/${fontSource.commit}/hinted/ttf/NotoSans\nNoto Sans is licensed under SIL OFL-1.1; see NOTO-SANS-LICENSE.\nUnmodified source files, licenses and provenance hashes are committed for offline rebuilds.\nThe pdfmake bundle retains its third-party license comments.\n\nSHA-256:\n\n${hashes}\n`);

}
finish().catch(error => { console.error(error); process.exitCode = 1; });
