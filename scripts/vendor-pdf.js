/* Rebuild packaged PDF assets from the exact dependencies in package-lock.json. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const fontkit = require('fontkit');
const source = path.dirname(require.resolve('pdfmake/package.json'));
const target = path.resolve(__dirname, '../extension/vendor/pdfmake');
fs.mkdirSync(target, { recursive: true });
const fontPacks = [
  { family: 'NotoSans', directory: 'noto-sans', faces: { normal: 'Regular', bold: 'Bold', italics: 'Italic', bolditalics: 'BoldItalic' } },
  { family: 'NotoSansCuneiform', directory: 'noto-sans-cuneiform', faces: { normal: 'Regular', bold: 'Regular', italics: 'Regular', bolditalics: 'Regular' } },
  { family: 'NotoSansSC', directory: 'noto-sans-sc', extension: 'otf', asset: 'vfs_cjk.js', license: 'NOTO-SANS-SC-LICENSE', notice: true,
    faces: { normal: 'Regular', bold: 'Regular', italics: 'Regular', bolditalics: 'Regular' } }
];
function rangesFor(points) {
  const ranges = [];
  for (const cp of [...new Set(points)].sort((a, b) => a - b)) {
    const last = ranges.at(-1);
    if (last && last[1] + 1 === cp) last[1] = cp; else ranges.push([cp, cp]);
  }
  return ranges;
}
const groups = new Map(), licenses = new Map(), coverage = [], union = [], fontSources = [];
for (const pack of fontPacks) {
  const root = path.join(__dirname, 'pdf-fonts', pack.directory);
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'source.json'), 'utf8'));
  const filename = style => `${pack.family}-${style}.${pack.extension || 'ttf'}`;
  const names = [...new Set(Object.values(pack.faces).map(filename))];
  for (const name of [...names, 'OFL.txt']) {
    const expected = provenance.files.find(file => file.file === name)?.sha256;
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
    if (actual !== expected) throw new Error(`The pinned font asset changed: ${pack.family}/${name}`);
  }
  const fonts = names.map(name => fontkit.openSync(path.join(root, name)));
  const license = Buffer.concat([Buffer.from(pack.notice ? fonts[0].copyright + '\n\n' : ''), fs.readFileSync(path.join(root, 'OFL.txt'))]);
  const licenseName = pack.license || 'NOTO-SANS-LICENSE';
  if (licenses.has(licenseName) && !licenses.get(licenseName).equals(license)) throw new Error('A font needs a separately packaged license.');
  licenses.set(licenseName, license);
  const asset = pack.asset || 'vfs_fonts.js';
  if (!groups.has(asset)) groups.set(asset, { vfs: {}, mapping: {} });
  const group = groups.get(asset);
  for (const name of names) group.vfs[name] = fs.readFileSync(path.join(root, name)).toString('base64');
  group.mapping[pack.family] = Object.fromEntries(Object.entries(pack.faces).map(([face, style]) => [face, filename(style)]));
  const sets = fonts.map(font => new Set(font.characterSet));
  const points = [...sets[0]].filter(cp => sets.every(set => set.has(cp)));
  coverage.push({ family: pack.family, ranges: rangesFor(points) }); union.push(...points);
  fontSources.push(`${pack.family}: ${provenance.repository}/tree/${provenance.commit}/${path.posix.dirname(provenance.files[0].source)}`);
}
// Keep the larger CJK font in its own local asset, loaded only for text needing it.
for (const [asset, group] of groups) {
  const original = asset === 'vfs_fonts.js' ? fs.readFileSync(path.join(source, 'build/vfs_fonts.js'), 'utf8') : '';
  const notice = asset === 'vfs_fonts.js' ? 'Noto fonts: unmodified SIL OFL fonts; see NOTO-SANS-LICENSE.' : 'Noto Sans SC: unmodified SIL OFL font; see NOTO-SANS-SC-LICENSE.';
  fs.writeFileSync(path.join(target, asset), original + `\n/* ${notice} */\npdfMake.addVirtualFileSystem(`
    + JSON.stringify(group.vfs) + ');\npdfMake.addFonts(' + JSON.stringify(group.mapping) + ');\n');
}
for (const [name, license] of licenses) fs.writeFileSync(path.join(target, name), license);
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(target, 'LICENSE'));
fs.writeFileSync(path.join(target, 'coverage.js'), `/* Per-family face intersections and their supported union. */\nglobalThis.PatreonPdfFonts = ${JSON.stringify(coverage)};\nglobalThis.PatreonPdfGlyphs = ${JSON.stringify(rangesFor(union))};\n`);
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
const hashes = ['pdfmake.min.js', ...groups.keys(), 'coverage.js', ...licenses.keys()].map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(target, name))).digest('hex')}  ${name}`).join('\n');
fs.writeFileSync(path.join(target, 'README.md'), `# Packaged PDF renderer\n\npdfmake ${require('pdfmake/package.json').version}, pinned by package-lock.json.\nRegenerate with npm ci --ignore-scripts followed by node scripts/vendor-pdf.js.\nThe original Roboto VFS is retained for explicit SVG font references. Primary Noto Sans, Cuneiform and CJK fallback fonts come from pinned, hash-verified\nfiles in scripts/pdf-fonts. Cuneiform and CJK regular faces serve all style aliases.\nvfs_cjk.js is loaded locally only when document text selects NotoSansSC; ordinary\nLatin/Cuneiform PDFs do not load its font data. The CJK glyph design uses the SC locale.\nThe browser bundle is rebuilt\nwith a reviewed PNG adapter: bounded DecompressionStream inflation runs\ninside our existing PDF worker. Its cap derives from the declared dimensions\nand maximum PNG bit depth. This avoids unbounded inflation and Blob workers\nunder strict extension CSP. Terser minifies the result, retaining license comments.\ncoverage.js records each family's common face coverage and their supported union.\n\nSource: https://github.com/bpampuch/pdfmake\nRoboto source/license: https://github.com/googlefonts/roboto\nRoboto is licensed under Apache-2.0; see ROBOTO-LICENSE.\n${fontSources.join("\n")}\nNoto fonts are licensed under SIL OFL-1.1; see NOTO-SANS-LICENSE and NOTO-SANS-SC-LICENSE.\nUnmodified source files, licenses and provenance hashes are committed for offline rebuilds.\nThe pdfmake bundle retains its third-party license comments.\n\nSHA-256:\n\n${hashes}\n`);

}
finish().catch(error => { console.error(error); process.exitCode = 1; });
