/* Compress one chapter at a time into extension-private disk storage. */
(() => {
  const { api, call } = globalThis.PatreonExtension;
  const { updateCrc32 } = globalThis.PatreonZip;
  async function request(action, values, signal) {
    signal?.throwIfAborted();
    const pending = call(api.runtime, "sendMessage", { type: `COLLECTION_ARCHIVE_${action}`, ...values });
    let abort;
    const cancelled = new Promise((resolve, reject) => {
      abort = () => reject(new DOMException("The operation was cancelled.", "AbortError"));
      signal?.addEventListener("abort", abort, { once: true });
    });
    try {
      const result = await Promise.race([pending, cancelled]);
      signal?.throwIfAborted();
      if (result?.error || !result) throw new Error(result?.error || "The temporary archive did not respond.");
      return result;
    } finally { signal?.removeEventListener("abort", abort); }
  }
  function base64(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(binary);
  }
  async function store(id, index, entry, signal) {
    const transferId = crypto.randomUUID();
    let reader;
    let crc = 0xffffffff;
    let size = 0;
    let compressedSize = 0;
    try {
      await request("BEGIN", { id, index, name: entry.name, transferId }, signal);
      const input = new Blob([entry.data]).stream().pipeThrough(new TransformStream({
        async transform(bytes, controller) {
          signal?.throwIfAborted();
          size += bytes.length;
          if (size > 0xffffffff) throw new Error("A chapter exceeds the 4 GiB ZIP limit.");
          crc = updateCrc32(crc, bytes);
          controller.enqueue(bytes);
          // Let Cancel run even while compressing a long, highly repetitive post.
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }), { signal }).pipeThrough(new CompressionStream("deflate"), { signal });
      reader = input.getReader();
      let header = 2;
      let tail = new Uint8Array();
      for (;;) {
        signal?.throwIfAborted();
        const { value, done } = await reader.read();
        if (done) break;
        const skip = Math.min(header, value.length);
        header -= skip;
        const bytes = value.subarray(skip);
        const combined = new Uint8Array(tail.length + bytes.length);
        combined.set(tail); combined.set(bytes, tail.length);
        const end = Math.max(0, combined.length - 4);
        // Drop the zlib header and retain only its four-byte trailer between reads.
        for (let offset = 0; offset < end; offset += 768 * 1024) {
          const chunk = combined.subarray(offset, Math.min(end, offset + 768 * 1024));
          await request("CHUNK", { id, index, transferId, offset: compressedSize, data: base64(chunk) }, signal);
          compressedSize += chunk.length;
        }
        tail = combined.slice(end);
      }
      if (header || tail.length !== 4) throw new Error("Compression did not produce a complete chapter.");
      const result = await request("END", { id, index, transferId, size, compressedSize, crc: (crc ^ 0xffffffff) >>> 0 }, signal);
      return result.entry;
    } catch (error) {
      request("ABORT", { id, index, transferId }).catch(() => {});
      throw error;
    } finally { await reader?.cancel().catch(() => {}); reader?.releaseLock(); }
  }
  globalThis.PatreonArchiveStream = Object.freeze({ request, store });
})();
