/* Rebuild packaged PDF assets from the exact dependencies in package-lock.json. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const fontkit = require('fontkit');
const source = path.dirname(require.resolve('pdfmake/package.json'));
const target = path.resolve(__dirname, '../extension/vendor/pdfmake');
fs.mkdirSync(target, { recursive: true });
for (const name of ['vfs_fonts.js']) fs.copyFileSync(path.join(source, 'build', name), path.join(target, name));
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(target, 'LICENSE'));
const styles = ['Regular', 'Medium', 'Italic', 'MediumItalic'].map(style => fontkit.openSync(path.join(source, 'fonts/Roboto', `Roboto-${style}.ttf`)).characterSet);
const points = styles[0].filter(cp => styles.every(set => set.includes(cp))).sort((a, b) => a - b);
const ranges = [];
for (const cp of points) {
  const last = ranges.at(-1);
  if (last && last[1] + 1 === cp) last[1] = cp; else ranges.push([cp, cp]);
}
fs.writeFileSync(path.join(target, 'coverage.js'), `/* Character coverage shared by all four bundled Roboto faces. */\nglobalThis.PatreonPdfGlyphs = ${JSON.stringify(ranges)};\n`);
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
const hashes = ['pdfmake.min.js', 'vfs_fonts.js', 'coverage.js'].map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(target, name))).digest('hex')}  ${name}`).join('\n');
fs.writeFileSync(path.join(target, 'README.md'), `# Packaged PDF renderer\n\npdfmake ${require('pdfmake/package.json').version}, pinned by package-lock.json.\nRegenerate with npm ci --ignore-scripts followed by node scripts/vendor-pdf.js.\nThe Roboto VFS is copied without modification. The browser bundle is rebuilt\nwith a reviewed PNG adapter: bounded DecompressionStream inflation runs\ninside our existing PDF worker. Its cap derives from the declared dimensions\nand maximum PNG bit depth. This avoids unbounded inflation and Blob workers\nunder strict extension CSP. Terser minifies the result, retaining license comments.\ncoverage.js is derived from the intersection of the four font character sets.\n\nSource: https://github.com/bpampuch/pdfmake\nRoboto source/license: https://github.com/googlefonts/roboto\nRoboto is licensed under Apache-2.0; see ROBOTO-LICENSE.\nThe pdfmake bundle retains its third-party license comments.\n\nSHA-256:\n\n${hashes}\n`);

}
finish().catch(error => { console.error(error); process.exitCode = 1; });
