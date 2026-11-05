/* Assemble one EPUB from encrypted, independently retryable chapter EPUBs. */
(() => {
  const { zipHeader, dosTimestamp, updateCrc32 } = globalThis.PatreonZip;
  const utf8 = value => new TextEncoder().encode(value);
  const xml = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const number = index => String(index + 1).padStart(3, "0");
  const chapterPath = index => `chapters/${number(index)}/post.xhtml`;
  const container = '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';

  async function write({ job, output, chapterBytes, fileFor, check, progress }) {
    const included = Array.from({ length: job.count }, (_, index) => index).filter(index => !job.entries[index].skipped);
    const timestamp = dosTimestamp();
    const directory = [];
    const manifest = [];
    const names = new Set();
    let offset = 0, copied = 0;
    const total = job.entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
    const mime = { jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif" };
    async function add(name, size, crc, chunks) {
      check(job);
      if (names.has(name)) throw new Error("The EPUB contains a duplicate resource.");
      names.add(name);
      if (directory.length >= 65535 || offset + 30 + utf8(name).length + size > 0xffffffff) throw new Error("The EPUB exceeds the ZIP limits.");
      const encoded = utf8(name);
      await output(zipHeader(size, size, crc, encoded.length, offset, timestamp, 0));
      await output(encoded);
      let length = 0, actualCrc = 0xffffffff;
      for await (const bytes of chunks) {
        check(job); length += bytes.length;
        if (length > size) throw new Error("A chapter resource exceeds its declared size.");
        actualCrc = updateCrc32(actualCrc, bytes);
        await output(bytes);
      }
      if (length !== size || ((actualCrc ^ 0xffffffff) >>> 0) !== crc) throw new Error("A chapter resource is incomplete or corrupt.");
      directory.push([zipHeader(size, size, crc, encoded.length, offset, timestamp, 0, true), encoded]);
      offset += 30 + encoded.length + size;
    }
    async function text(name, value) {
      const data = utf8(value);
      await add(name, data.length, (updateCrc32(0xffffffff, data) ^ 0xffffffff) >>> 0, [data]);
    }
    // EPUB requires this exact first, uncompressed entry with no extra fields.
    await text("mimetype", "application/epub+zip");
    await text("META-INF/container.xml", container);
    for (const index of included) {
      const entry = job.entries[index];
      const iterator = chapterBytes(await fileFor(index), job, index)[Symbol.asyncIterator]();
      const stream = new ReadableStream({
        async pull(controller) {
          try { const result = await iterator.next(); if (result.done) controller.close(); else controller.enqueue(result.value); }
          catch (error) { controller.error(error); }
        },
        async cancel() { await iterator.return?.(); }
      }).pipeThrough(new DecompressionStream("deflate-raw"));
      const reader = stream.getReader();
      const abort = () => { reader.cancel().catch(() => {}); };
      job.controller.signal.addEventListener("abort", abort, { once: true });
      let buffer = new Uint8Array(), position = 0, inflated = 0, crc = 0xffffffff;
      async function take(size, allowEnd = false) {
        const result = new Uint8Array(size);
        let used = 0;
        while (used < size) {
          check(job);
          if (position === buffer.length) {
            const next = await reader.read();
            if (next.done) {
              if (!used && allowEnd) return null;
              throw new Error("The chapter EPUB is truncated.");
            }
            buffer = next.value; position = 0;
            inflated += buffer.length;
            if (inflated > entry.size) throw new Error("The chapter EPUB exceeds its declared size.");
            crc = updateCrc32(crc, buffer);
          }
          const count = Math.min(size - used, buffer.length - position);
          result.set(buffer.subarray(position, position + count), used); position += count; used += count;
        }
        return result;
      }
      async function* payload(size) {
        for (let remaining = size; remaining > 0;) {
          const length = Math.min(64 * 1024, remaining);
          const bytes = await take(length);
          await progress(index, copied + inflated, total, "copy");
          yield bytes; remaining -= length;
        }
      }
      let foundPost = false, foundStyle = false, localEntries = 0;
      try {
        for (;;) {
          const signature = await take(4);
          const value = new DataView(signature.buffer).getUint32(0, true);
          if (value === 0x02014b50) break;
          if (value !== 0x04034b50 || ++localEntries > 65535) throw new Error("The chapter EPUB directory is invalid.");
          const header = new DataView((await take(26)).buffer);
          const flags = header.getUint16(2, true), method = header.getUint16(4, true);
          const size = header.getUint32(14, true), unpacked = header.getUint32(18, true);
          const nameLength = header.getUint16(22, true), extra = header.getUint16(24, true);
          if (method !== 0 || flags & 9 || size !== unpacked || size > entry.size) throw new Error("The chapter EPUB uses an unsupported resource encoding.");
          const name = new TextDecoder("utf-8", { fatal: true }).decode(await take(nameLength));
          await take(extra);
          let target;
          if (name === "EPUB/post.xhtml") {
            if (foundPost) throw new Error("The chapter EPUB contains duplicate content.");
            foundPost = true; target = `EPUB/${chapterPath(index)}`;
          } else if (name === "EPUB/styles.css") {
            if (foundStyle) throw new Error("The chapter EPUB contains duplicate styles.");
            foundStyle = true; if (index === included[0]) target = "EPUB/styles.css";
          } else if (/^EPUB\/images\/image-\d+\.(?:jpg|png|gif|webp|svg|avif)$/.test(name)) {
            target = `EPUB/chapters/${number(index)}/${name.slice(5)}`;
            manifest.push({ name: target.slice(5), type: mime[name.split(".").pop()] });
          } else if (!["mimetype", "META-INF/container.xml", "EPUB/nav.xhtml", "EPUB/package.opf"].includes(name)) {
            throw new Error("The chapter EPUB contains an unexpected resource.");
          }
          if (target && name === "EPUB/post.xhtml" && included.length !== job.count) {
            // Rewrite only chapter XHTML when skips change adjacent chapters.
            // Image resources retain the existing bounded streaming path.
            const original = await take(size);
            if (((updateCrc32(0xffffffff, original) ^ 0xffffffff) >>> 0) !== header.getUint32(10, true)) throw new Error("A chapter resource is corrupt.");
            const position = included.indexOf(index), previous = included[position - 1], next = included[position + 1];
            const navigation = `<nav aria-label="Chapter navigation"><p>${previous === undefined ? "" : `<a href="../${number(previous)}/post.xhtml">Previous chapter</a> · `}<a href="../../nav.xhtml">Contents</a>${next === undefined ? "" : ` · <a href="../${number(next)}/post.xhtml">Next chapter</a>`}</p></nav>`;
            const source = new TextDecoder("utf-8", { fatal: true }).decode(original);
            await text(target, source.replace(/<nav aria-label="Chapter navigation">[\s\S]*?<\/nav>(?=<\/body>)/, navigation));
          } else if (target) await add(target, size, header.getUint32(10, true), payload(size));
          else for await (const ignored of payload(size)) { void ignored; }
        }
        // Consume the central directory too, validating the staged chapter CRC.
        if (position < buffer.length) position = buffer.length;
        for (;;) {
          check(job);
          const next = await reader.read(); if (next.done) break;
          inflated += next.value.length; if (inflated > entry.size) throw new Error("The chapter EPUB is too large.");
          crc = updateCrc32(crc, next.value);
        }
        if (!foundPost || !foundStyle || inflated !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) throw new Error("The chapter EPUB is incomplete or corrupt.");
      } finally {
        job.controller.signal.removeEventListener("abort", abort);
        await reader.cancel().catch(() => {}); reader.releaseLock();
      }
      copied += entry.size;
      await progress(index, copied, total, "copy");
    }
    const creators = [...new Set(job.entries.map(entry => entry.creator).filter(Boolean))];
    const languages = [...new Set(job.entries.filter(entry => !entry.skipped).map(entry => entry.language))];
    const language = languages.length === 1 ? languages[0] : "und";
    const title = xml(job.book.title);
    const page = (heading, content) => `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${xml(language)}" xml:lang="${xml(language)}"><head><title>${heading}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body>${content}</body></html>`;
    const links = included.map(index => `<li><a href="${chapterPath(index)}">${xml(job.entries[index].title)}</a></li>`).join("");
    await text("EPUB/title.xhtml", page(title, `<h1>${title}</h1><dl class="metadata"><div><dt>Creator</dt><dd>${xml(creators.join(", ") || "Not available")}</dd></div><div><dt>Download time</dt><dd>${xml(job.book.downloadedAt)}</dd></div><div><dt>Source</dt><dd><a href="${xml(job.book.source)}">${xml(job.book.source)}</a></dd></div></dl><p>${included.length} chapters</p><p><a href="nav.xhtml">Contents</a></p>`));
    await text("EPUB/nav.xhtml", page("Contents", `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${links}</ol></nav>`));
    const items = manifest.map((item, index) => `<item id="image-${index}" href="${item.name}" media-type="${item.type}"/>`).join("");
    const chapters = included.map(index => `<item id="chapter-${index}" href="${chapterPath(index)}" media-type="application/xhtml+xml"/>`).join("");
    const spine = included.map(index => `<itemref idref="chapter-${index}"/>`).join("");
    await text("EPUB/package.opf", `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${job.id}</dc:identifier><dc:title>${title}</dc:title>${creators.map(creator => `<dc:creator>${xml(creator)}</dc:creator>`).join("")}<dc:source>${xml(job.book.source)}</dc:source><dc:language>${xml(language)}</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta></metadata><manifest><item id="title" href="title.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="styles.css" media-type="text/css"/>${chapters}${items}</manifest><spine><itemref idref="title"/><itemref idref="nav"/>${spine}</spine></package>`);
    const centralSize = directory.reduce((sum, parts) => sum + parts[0].length + parts[1].length, 0);
    if (offset + centralSize + 22 > 0xffffffff) throw new Error("The EPUB exceeds the ZIP limits.");
    for (const parts of directory) for (const bytes of parts) await output(bytes);
    const end = new Uint8Array(22), view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true); view.setUint16(8, directory.length, true); view.setUint16(10, directory.length, true);
    view.setUint32(12, centralSize, true); view.setUint32(16, offset, true); await output(end);
    await progress(included.at(-1), total, total, "finalize");
  }
  globalThis.PatreonEpubBook = Object.freeze({ write });
})();
