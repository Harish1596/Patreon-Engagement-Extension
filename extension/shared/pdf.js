/* Validated inert post snapshots -> PDF document data. No HTML execution or fetching. */
(() => {
  const MAX_INPUT = 24 * 1024 * 1024;
  const MAX_OUTPUT = 32 * 1024 * 1024;
  const MAX_PIXELS = 16_000_000;
  const MAX_SIDE = 8192;
  const tags = new Set('div p h1 h2 h3 h4 h5 h6 strong em b i u s ul ol li blockquote pre code sub sup hr figure figcaption br img a'.split(' '));
  const inlineTags = new Set('strong em b i u s code sub sup a br'.split(' '));
  function url(value, post = false) {
    try {
      const parsed = new URL(value);
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw 0;
      if (post) { if (parsed.origin !== 'https://www.patreon.com') throw 0; parsed.search = ''; parsed.hash = ''; }
      return parsed.href;
    } catch { throw new Error('The PDF contains an invalid source or link.'); }
  }
  function size(value) {
    const json = JSON.stringify(value);
    if (typeof json !== 'string' || json.length > MAX_INPUT || new TextEncoder().encode(json).length > MAX_INPUT) {
      throw new Error('This PDF exceeds the 24 MiB input limit. Export fewer posts or use individual files.');
    }
    return json;
  }
  function chapter(snapshot) {
    size(snapshot);
    if (snapshot?.version !== 1 || !Array.isArray(snapshot.assets) || snapshot.assets.length > 1000
      || !['title', 'author', 'sourceUrl', 'language'].every(key => typeof snapshot[key] === 'string')
      || snapshot.title.length > 4000 || snapshot.author.length > 2000) throw new Error('The PDF source is invalid.');
    let count = 0;
    function tree(node, depth = 0) {
      if (++count > 100_000 || depth > 200) throw new Error('The PDF content exceeds its nesting or node limit.');
      if (typeof node === 'string') return node;
      if (!node || !tags.has(node.tag) || (node.children !== undefined && !Array.isArray(node.children))) throw new Error('The PDF contains an unsupported or invalid element.');
      return { tag: node.tag,
        ...(node.tag === 'img' ? { image: node.image, alt: typeof node.alt === 'string' ? node.alt : '' } : {}),
        ...(node.tag === 'a' && node.href ? { href: url(node.href) } : {}),
        children: (node.children || []).map(child => tree(child, depth + 1)) };
    }
    const assets = snapshot.assets.map(asset => {
      if (typeof asset?.dataUrl !== 'string' || !/^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)(?:;base64)?,/i.test(asset.dataUrl)) throw new Error('PDF images must be embedded supported images.');
      return { dataUrl: asset.dataUrl };
    });
    const body = tree(snapshot.body);
    function images(node) {
      if (typeof node === 'string') return;
      if (node.tag === 'img' && (!Number.isSafeInteger(node.image) || node.image < 0 || node.image >= assets.length)) throw new Error('A PDF image reference is invalid.');
      node.children.forEach(images);
    }
    images(body);
    return { version: 1, title: snapshot.title, author: snapshot.author, sourceUrl: url(snapshot.sourceUrl, true),
      language: snapshot.language, downloadedAt: typeof snapshot.downloadedAt === 'string' ? snapshot.downloadedAt : '', body, assets };
  }
  function definition(inputs, book) {
    size(inputs);
    if (!Array.isArray(inputs) || !inputs.length || inputs.length > 100) throw new Error('The PDF chapter count is invalid.');
    const chapters = inputs.map(chapter);
    if (book && (typeof book.title !== 'string' || book.title.length > 4000 || typeof book.downloadedAt !== 'string')) throw new Error('The PDF collection metadata is invalid.');
    const content = [];
    if (book) content.push({ text: book.title, style: 'title' },
      { text: `Download time: ${book.downloadedAt}`, style: 'metadata' },
      { text: url(book.source, true), link: url(book.source, true), style: 'metadata' },
      { toc: { title: { text: 'Contents', style: 'heading' } }, margin: [0, 16, 0, 12] });
    function inline(node, style = {}) {
      if (typeof node === 'string') return [{ text: node, ...style }];
      if (node.tag === 'img') return [{ pdfImage: node.image, ...style }];
      const next = { ...style };
      if (['strong', 'b'].includes(node.tag)) next.bold = true;
      if (['em', 'i'].includes(node.tag)) next.italics = true;
      if (node.tag === 'u') next.decoration = 'underline';
      if (node.tag === 's') next.decoration = 'lineThrough';
      if (node.tag === 'code') next.background = '#f0f0f0';
      if (node.tag === 'a' && node.href) { next.link = node.href; next.decoration = 'underline'; }
      if (node.tag === 'sub' || node.tag === 'sup') { next[node.tag] = true; next.fontSize = 8; }
      return node.tag === 'br' ? [{ text: '\n', ...next }] : node.children.flatMap(child => inline(child, next));
    }
    function blocks(node, assets) {
      if (typeof node === 'string') return node.trim() ? [{ text: node, margin: [0, 0, 0, 8] }] : [];
      if (node.tag === 'img') {
        const data = assets[node.image].dataUrl;
        const [head, ...tail] = data.split(',');
        const svg = /^data:image\/svg\+xml/i.test(head);
        const graphic = svg ? { svg: /;base64$/i.test(head) ? new TextDecoder().decode(Uint8Array.from(atob(tail.join(',')), c => c.charCodeAt(0))) : decodeURIComponent(tail.join(',')) } : { image: data };
        return [{ ...graphic, fit: [493, 650], margin: [0, 8, 0, 12], alignment: 'center' }];
      }
      if (/^h[1-6]$/.test(node.tag)) return [{ text: inline(node), fontSize: Math.max(12, 22 - Number(node.tag[1]) * 2), bold: true, margin: [0, 12, 0, 8], headlineLevel: Number(node.tag[1]) }];
      if (node.tag === 'ul' || node.tag === 'ol') return [{ [node.tag]: node.children.filter(child => typeof child !== 'string' || child.trim()).map(child => ({ stack: blocks(child, assets) })), margin: [0, 2, 0, 10] }];
      if (node.tag === 'blockquote') return [{ stack: flow(node.children, assets), margin: [18, 4, 0, 10], color: '#444444', italics: true }];
      if (node.tag === 'pre') return [{ text: inline(node), preserveLeadingSpaces: true, fontSize: 9, margin: [0, 4, 0, 10] }];
      if (node.tag === 'hr') return [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 493, y2: 0, lineWidth: 0.5, lineColor: '#999999' }], margin: [0, 10, 0, 10] }];
      return flow(inlineTags.has(node.tag) ? [node] : node.children, assets);
    }
    function flow(children, assets) {
      const result = []; let run = [];
      const flush = () => { if (run.length) result.push({ text: run, margin: [0, 0, 0, 8] }); run = []; };
      for (const child of children) {
        if (typeof child === 'string' || inlineTags.has(child.tag)) {
          for (const fragment of inline(child)) {
            if (fragment.pdfImage !== undefined) {
              flush();
              const image = blocks({ tag: 'img', image: fragment.pdfImage, children: [] }, assets)[0];
              if (fragment.link) image.link = fragment.link;
              result.push(image);
            } else run.push(fragment);
          }
        }
        else { flush(); result.push(...blocks(child, assets)); }
      }
      flush(); return result;
    }
    for (const [index, post] of chapters.entries()) {
      const metadata = [
        { text: `Creator: ${post.author}`, style: 'metadata' },
        { text: `Download time: ${post.downloadedAt}`, style: 'metadata' },
        { text: [{ text: 'Source: ' }, { text: post.sourceUrl, link: post.sourceUrl }], style: 'metadata' }
      ];
      // A chapter's heading starts the page; its metadata follows in books.
      if (!book) content.push(...metadata);
      content.push({ text: post.title, style: 'title', ...(book ? { pageBreak: 'before', tocItem: true, id: `chapter-${index}` } : {}) });
      if (book) content.push(...metadata);
      content.push(...blocks(post.body, post.assets));
    }
    return { pageSize: 'A4', pageMargins: [51, 51, 51, 51],
      info: { title: book?.title || chapters[0].title, author: book ? 'Patreon creators' : chapters[0].author },
      defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.35, color: '#222222' },
      styles: { title: { fontSize: 24, bold: true, margin: [0, 10, 0, 16] }, heading: { fontSize: 18, bold: true }, metadata: { fontSize: 9, margin: [0, 0, 0, 4] } },
      footer: page => ({ text: String(page), alignment: 'center', fontSize: 9, margin: [0, 15, 0, 0] }), content };
  }
  globalThis.PatreonPdf = Object.freeze({ chapter, definition, size, MAX_INPUT, MAX_OUTPUT, MAX_PIXELS, MAX_SIDE });
})();
