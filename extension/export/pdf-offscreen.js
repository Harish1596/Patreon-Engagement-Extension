/* Only background extension messages may start/cancel workers in this document. */
(() => {
  const jobs = new Map();
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (!['PDF_HOST_RENDER', 'PDF_HOST_CANCEL'].includes(message?.type)
      || sender.id !== chrome.runtime.id || sender.tab || (sender.url !== undefined && sender.url !== chrome.runtime.getURL('background/media.js'))) return;
    if (!/^[0-9a-f-]{36}$/i.test(message.id)) { respond({ error: 'Invalid PDF request.' }); return; }
    if (message.type === 'PDF_HOST_CANCEL') { jobs.get(message.id)?.abort(); respond({ cancelled: true }); return; }
    if (jobs.has(message.id)) { respond({ error: 'This PDF is already rendering.' }); return; }
    const controller = new AbortController(); jobs.set(message.id, controller);
    (async () => {
      const bytes = await PatreonPdfHost.render(message.chapters, message.book, controller.signal);
      let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { data: btoa(binary) };
    })().then(respond, error => respond({ error: error.message || 'The PDF could not be generated.' }))
      .finally(() => jobs.delete(message.id));
    return true;
  });
})();
