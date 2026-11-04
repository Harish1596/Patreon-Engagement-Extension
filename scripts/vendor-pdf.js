/* Rebuild packaged PDF assets from the exact dependencies in package-lock.json. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const fontkit = require('fontkit');
const source = path.dirname(require.resolve('pdfmake/package.json'));
const target = path.resolve(__dirname, '../extension/vendor/pdfmake');
fs.mkdirSync(target, { recursive: true });
for (const name of ['pdfmake.min.js', 'vfs_fonts.js']) fs.copyFileSync(path.join(source, 'build', name), path.join(target, name));
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(target, 'LICENSE'));
const styles = ['Regular', 'Medium', 'Italic', 'MediumItalic'].map(style => fontkit.openSync(path.join(source, 'fonts/Roboto', `Roboto-${style}.ttf`)).characterSet);
const points = styles[0].filter(cp => styles.every(set => set.includes(cp))).sort((a, b) => a - b);
const ranges = [];
for (const cp of points) {
  const last = ranges.at(-1);
  if (last && last[1] + 1 === cp) last[1] = cp; else ranges.push([cp, cp]);
}
fs.writeFileSync(path.join(target, 'coverage.js'), `/* Character coverage shared by all four bundled Roboto faces. */\nglobalThis.PatreonPdfGlyphs = ${JSON.stringify(ranges)};\n`);
const hashes = ['pdfmake.min.js', 'vfs_fonts.js', 'coverage.js'].map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(target, name))).digest('hex')}  ${name}`).join('\n');
fs.writeFileSync(path.join(target, 'README.md'), `# Packaged PDF renderer\n\npdfmake ${require('pdfmake/package.json').version}, pinned by package-lock.json.\nRegenerate with npm ci --ignore-scripts followed by node scripts/vendor-pdf.js.\nThe browser bundle and Roboto VFS are copied without modification.\ncoverage.js is derived from the intersection of the four font character sets.\n\nSource: https://github.com/bpampuch/pdfmake\nRoboto source/license: https://github.com/googlefonts/roboto\nRoboto is licensed under Apache-2.0; see ROBOTO-LICENSE.\nThe pdfmake bundle retains its third-party license comments.\n\nSHA-256:\n\n${hashes}\n`);
