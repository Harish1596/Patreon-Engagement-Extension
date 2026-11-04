/* Hidden first-party document: disk File -> Blob URL, without reading it into RAM. */
(() => {
  const urls = new Map();
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || sender.tab || !/^ARCHIVE_BLOB_(OPEN|CLOSE)$/.test(message?.type)) return;
    (async () => {
      if (!/^[0-9a-f-]{36}$/i.test(message.id)) throw new Error("Invalid archive ID.");
      if (message.type === "ARCHIVE_BLOB_CLOSE") {
        const url = urls.get(message.id);
        if (url) URL.revokeObjectURL(url);
        urls.delete(message.id);
        return { closed: true };
      }
      const root = await navigator.storage.getDirectory();
      const folder = await (await root.getDirectoryHandle("patreon-archives-v1")).getDirectoryHandle(message.id);
      const file = await (await folder.getFileHandle("archive.zip")).getFile();
      const mime = message.mime || "application/zip";
      if (!["application/zip", "application/epub+zip", "text/markdown;charset=utf-8"].includes(mime)) throw new Error("Unsupported archive type.");
      // slice() keeps the disk backing while supplying the correct download MIME.
      const url = URL.createObjectURL(file.slice(0, file.size, mime));
      const previous = urls.get(message.id);
      if (previous) URL.revokeObjectURL(previous);
      urls.set(message.id, url);
      return { url };
    })().then(respond, error => respond({ error: error.message }));
    return true;
  });
})();
