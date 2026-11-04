/* Assemble plain Markdown on disk from encrypted, compressed chapter streams. */
(() => {
  const { updateCrc32 } = globalThis.PatreonZip;
  const utf8 = value => new TextEncoder().encode(value);
  const escape = value => String(value).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replace(/[\\`*_{}\[\]()#+.!|~-]/g, "\\$&");

  const url = value => value.replace(/[<>"()\\\s]/g, char => encodeURIComponent(char).replace(/[()]/g, c => `%${c.charCodeAt(0).toString(16)}`));

  async function write({ job, output, chapterBytes, fileFor, check, progress }) {
    const included = Array.from({ length: job.count }, (_, index) => index).filter(index => !job.entries[index].skipped);
    const creators = [...new Set(job.entries.map(entry => entry.creator).filter(Boolean))];
    const total = job.entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
    const text = async value => { check(job); await output(utf8(value)); };
    await text(`**Creator:** ${escape(creators.join(", ") || "Not available")}\n\n**Download time:** ${escape(job.book.downloadedAt)}\n\n**Source:** [${escape(job.book.source)}](${url(job.book.source)})\n\n# ${escape(job.book.title)}\n\n## Contents\n\n`);
    for (const index of included) {
      await text(`- [${escape(job.entries[index].title)}](#chapter-${String(index + 1).padStart(3, "0")})\n`);
    }
    await text("\n---\n\n");
    let copied = 0;
    for (const index of included) {
      check(job);
      const entry = job.entries[index];
      const iterator = chapterBytes(await fileFor(index), job, index)[Symbol.asyncIterator]();
      const stream = new ReadableStream({
        async pull(controller) {
          try { const next = await iterator.next(); if (next.done) controller.close(); else controller.enqueue(next.value); }
          catch (error) { controller.error(error); }
        },
        async cancel() { await iterator.return?.(); }
      }).pipeThrough(new DecompressionStream("deflate-raw"));
      const reader = stream.getReader();
      const abort = () => { reader.cancel().catch(() => {}); };
      job.controller.signal.addEventListener("abort", abort, { once: true });
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let size = 0, crc = 0xffffffff;
      try {
        for (;;) {
          check(job);
          const next = await reader.read();
          if (next.done) break;
          for (let offset = 0; offset < next.value.length; offset += 64 * 1024) {
            check(job);
            const bytes = next.value.subarray(offset, offset + 64 * 1024);
            size += bytes.length;
            if (size > entry.size) throw new Error("The Markdown chapter exceeds its declared size.");
            decoder.decode(bytes, { stream: true });
            crc = updateCrc32(crc, bytes);
            await output(bytes);
            await progress(index, copied + size, total, "copy");
          }
        }
        decoder.decode();
        if (size !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) throw new Error("The Markdown chapter is incomplete or corrupt.");
        check(job);
      } finally {
        job.controller.signal.removeEventListener("abort", abort);
        await reader.cancel().catch(() => {}); reader.releaseLock();
      }
      copied += size;
      await text(index === included.at(-1) ? "\n" : "\n\n---\n\n");
    }
    await progress(included.at(-1), copied, total, "finalize");
  }
  globalThis.PatreonMarkdownBook = Object.freeze({ write });
})();
