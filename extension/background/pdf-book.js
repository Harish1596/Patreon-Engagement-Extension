/* Encrypted staged PDF chapter data -> one bounded, ordered PDF document. */
(() => {
  async function write({ job, output, chapterBytes, fileFor, check, progress }) {
    const chapters = []; let total = 0; let copied = 0;
    const included = Array.from({ length: job.count }, (_, index) => index).filter(index => !job.entries[index].skipped);
    for (const index of included) total += job.entries[index].size;
    if (total > PatreonPdf.MAX_INPUT) throw new Error(`This PDF part exceeds the ${PatreonPdf.MAX_INPUT / 1024 / 1024} MiB input limit. Use individual PDF files.`);
    for (const index of included) {
      check(job);
      const entry = job.entries[index];
      const iterator = chapterBytes(await fileFor(index), job, index)[Symbol.asyncIterator]();
      const input = new ReadableStream({
        async pull(controller) {
          try { const next = await iterator.next(); if (next.done) controller.close(); else controller.enqueue(next.value); }
          catch (error) { controller.error(error); }
        },
        async cancel() { await iterator.return?.(); }
      }).pipeThrough(new DecompressionStream('deflate-raw'));
      const reader = input.getReader();
      const chunks = []; let length = 0, crc = 0xffffffff;
      const abort = () => { reader.cancel().catch(() => {}); };
      job.controller.signal.addEventListener('abort', abort, { once: true });
      try {
        for (;;) {
          check(job);
          const next = await reader.read();
          if (next.done) break;
          length += next.value.length;
          if (length > entry.size || length > PatreonPdf.MAX_INPUT) throw new Error('A PDF chapter exceeds its declared size.');
          crc = PatreonZip.updateCrc32(crc, next.value); chunks.push(next.value);
        }
        if (length !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) throw new Error('A PDF chapter is incomplete or corrupt.');
        const bytes = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        const chapter = PatreonPdf.chapter(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
        if (chapter.title !== entry.title) throw new Error('The PDF chapter metadata does not match.');
        chapters.push(chapter); copied += length;
        await progress(index, copied, total, 'copy');
      } finally { job.controller.signal.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
    }
    check(job);
    await progress(included.at(-1), copied, total, 'render');
    let bytes;
    try { bytes = await globalThis.PatreonPdfRenderService.render(chapters, job.book, job.controller.signal); }
    catch (error) {
      error.pdfFailures = PatreonPdf.failureDetails(error.pdfFailures, chapters.length).map(item => ({ ...item, index: included[item.index] }));
      throw error;
    }
    check(job);
    for (let offset = 0; offset < bytes.length; offset += 64 * 1024) { check(job); await output(bytes.subarray(offset, offset + 64 * 1024)); }
    await progress(included.at(-1), copied, total, 'finalize');
  }
  globalThis.PatreonPdfBook = Object.freeze({ write });
})();
