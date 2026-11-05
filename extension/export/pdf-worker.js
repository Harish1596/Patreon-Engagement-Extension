/* One bounded render per disposable worker. No network requests are permitted. */
importScripts('../vendor/pdfmake/pdfmake.min.js', '../vendor/pdfmake/vfs_fonts.js', '../vendor/pdfmake/coverage.js', '../shared/pdf.js');
self.fetch = () => Promise.reject(new Error('PDF network access is disabled.'));
pdfMake.setUrlAccessPolicy(() => false);
const { MAX_INPUT, MAX_OUTPUT, MAX_PIXELS, MAX_SIDE } = PatreonPdf;
function bytes(dataUrl) {
  const [header, ...parts] = dataUrl.split(',');
  const value = parts.join(',');
  return /;base64$/i.test(header) ? Uint8Array.from(atob(value), c => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(value));
}
function dimensions(data, type) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (type === 'png' && data.length >= 24 && view.getUint32(0) === 0x89504e47) return [view.getUint32(16), view.getUint32(20)];
  if (type === 'gif' && data.length >= 10) return [view.getUint16(6, true), view.getUint16(8, true)];
  if (type === 'jpeg' && data[0] === 255 && data[1] === 216) {
    for (let i = 2; i + 8 < data.length;) {
      if (data[i] !== 255) break;
      const marker = data[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return [view.getUint16(i + 7), view.getUint16(i + 5)];
      const length = view.getUint16(i + 2); if (length < 2) break; i += length + 2;
    }
  }
  if (type === 'webp' && data.length >= 30) {
    const kind = String.fromCharCode(...data.subarray(12, 16));
    if (kind === 'VP8X') return [1 + data[24] + (data[25] << 8) + (data[26] << 16), 1 + data[27] + (data[28] << 8) + (data[29] << 16)];
    if (kind === 'VP8L' && data[20] === 0x2f) return [1 + data[21] + ((data[22] & 63) << 8), 1 + (data[22] >> 6) + (data[23] << 2) + ((data[24] & 15) << 10)];
    if (kind === 'VP8 ') return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
  }
  if (type === 'avif') for (let i = 4; i + 16 <= data.length; i++) {
    if (view.getUint32(i) === 0x69737065 && view.getUint32(i - 4) >= 20) return [view.getUint32(i + 8), view.getUint32(i + 12)];
  }
  throw new Error('The PDF image dimensions could not be validated.');
}
function bounded(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) throw new Error('A PDF image exceeds the 8,192-pixel side or 16-million-pixel limit.');
}
function glyphs(value, ranges = PatreonPdfGlyphs, label = 'PDF font') {
  for (const char of value) {
    const cp = char.codePointAt(0);
    if ('\n\r\t'.includes(char) || ranges.some(([a, b]) => cp >= a && cp <= b)) continue;
    throw new Error(`The ${label} does not support character U+${cp.toString(16).toUpperCase()}. Use EPUB or Markdown for this text.`);
  }
}
async function normalize(chapter, budget) {
  function text(node) { if (typeof node === 'string') glyphs(node); else { if (node.alt) glyphs(node.alt); node.children.forEach(text); } }
  for (const value of [chapter.title, chapter.author, chapter.downloadedAt, chapter.sourceUrl]) glyphs(value);
  text(chapter.body);
  for (const asset of chapter.assets) {
    const type = /^data:image\/([^;,]+)/i.exec(asset.dataUrl)[1].toLowerCase();
    const data = bytes(asset.dataUrl);
    if (type === 'svg+xml') {
      const svg = new TextDecoder('utf-8', { fatal: true }).decode(data);
      if (!/^\s*<svg\b/i.test(svg) || /<!|<(?:script|foreignObject|image|use|style|animate|set)\b|\bon\w+\s*=|\bhref\s*=|url\s*\(\s*[^#]/i.test(svg)) throw new Error('The PDF SVG image contains unsupported markup.');
      // SVG text uses the same primary font coverage as the document.
      glyphs(svg.replace(/<[^>]*>/g, ''), PatreonPdfFonts[0].ranges, 'PDF SVG font');
      continue;
    }
    const [width, height] = dimensions(data, type);
    bounded(width, height);
    budget.pixels += width * height;
    if (budget.pixels > 32_000_000) throw new Error("The PDF exceeds its 32-million-pixel document image budget. Export fewer posts.");
    if (type === 'png' || type === 'jpeg') continue;
    const bitmap = await createImageBitmap(new Blob([data], { type: `image/${type}` }));
    try {
      bounded(bitmap.width, bitmap.height);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const png = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
      let binary = ''; for (let i = 0; i < png.length; i += 0x8000) binary += String.fromCharCode(...png.subarray(i, i + 0x8000));
      asset.dataUrl = `data:image/png;base64,${btoa(binary)}`;
    } finally { bitmap.close(); }
  }
}
self.onmessage = async event => {
  try {
    const { chapters, book } = event.data;
    PatreonPdf.size({ chapters, book });
    if (!Array.isArray(chapters) || !chapters.length || chapters.length > 100) throw new Error('The PDF chapter count is invalid.');
    const validated = chapters.map(PatreonPdf.chapter);
    const budget = { pixels: 0 };
    for (const chapter of validated) await normalize(chapter, budget);
    if (book) { glyphs(book.title || ''); glyphs(book.downloadedAt || ''); }
    PatreonPdf.size({ chapters: validated, book });
    const document = pdfMake.createPdf(PatreonPdf.definition(validated, book));
    // Stop accumulating as soon as output exceeds its explicit byte budget.
    const stream = await document.getStream();
    const chunks = []; let length = 0;
    await new Promise((resolve, reject) => {
      stream.on('data', chunk => {
        length += chunk.length;
        if (length > MAX_OUTPUT) { stream.destroy(); reject(new Error(`This PDF exceeds the ${MAX_OUTPUT / 1024 / 1024} MiB output limit. Export fewer posts or use individual files.`)); }
        else chunks.push(new Uint8Array(chunk));
      });
      stream.on('error', reject); stream.on('end', resolve); stream.end();
    });
    const result = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    self.postMessage({ bytes: result }, [result.buffer]);
  } catch (error) { self.postMessage({ error: typeof error?.message === 'string' ? error.message : 'The PDF could not be rendered.' }); }
};
