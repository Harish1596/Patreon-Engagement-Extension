/* Local post export: extracts only the selected post title/body and embeds its media. */
(() => {
  const { api, call } = globalThis.PatreonExtension;
  const { TITLE, BODY, findPost, actionRowFor } = globalThis.PatreonDOM;
  let trigger;
  let anchor;
  let row;
  let host;
  let shadow;
  let dialog;
  let chooser;
  let requestToken = "";
  let route = "";
  let open = false;
  let busy = false;
  const MAX_EXPORT_IMAGE_BYTES = 100 * 1024 * 1024;

  const utf8 = (value) => new TextEncoder().encode(value);
  const escapeText = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const escapeAttribute = (value) => escapeText(value).replaceAll('"', "&quot;");
  const safeUrl = (value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value, location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  };
  const filename = (title, extension) => {
    const clean = title.normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    return `${clean || "Patreon post"}.${extension}`;
  };

  function element(tag, attributes = {}, text) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function dataUrlBytes(value) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
    if (!match) throw new Error("An embedded post image has an invalid data URL.");
    const bytes = match[2]
      ? Uint8Array.from(atob(match[3]), char => char.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(match[3]));
    return { type: (match[1] || "application/octet-stream").toLowerCase(), bytes };
  }

  function imageExtension(type) {
    return ({ "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif" })[type] || "img";
  }

  async function fetchImage(url) {
    if (url.startsWith("data:")) {
      const { type, bytes } = dataUrlBytes(url);
      return { type, bytes, dataUrl: url };
    }
    const result = await call(api.runtime, "sendMessage", { type: "FETCH_POST_EXPORT_IMAGE", url });
    if (!result?.dataUrl) throw new Error(result?.error || "Unable to read an inline post image.");
    const decoded = dataUrlBytes(result.dataUrl);
    return { type: result.type || decoded.type, bytes: decoded.bytes, dataUrl: result.dataUrl };
  }

  async function prepare() {
    const post = findPost();
    if (!post) throw new Error("The current post could not be found.");
    const titles = [...post.scope.querySelectorAll(TITLE)].filter(post.belongs);
    const titleNode = titles.find(node => node.getClientRects().length) || titles[0];
    const bodyNode = [...post.scope.querySelectorAll(BODY)].find(post.belongs);
    if (!titleNode || !bodyNode) throw new Error("This post does not expose a supported text body.");
    const clone = bodyNode.cloneNode(true);
    clone.querySelectorAll("script, style, template, iframe, object, embed, form, button, input, textarea, select").forEach(node => node.remove());
    for (const node of clone.querySelectorAll("*")) {
      for (const attribute of [...node.attributes]) {
        if (attribute.name.startsWith("on") || ["id", "class", "style", "srcset", "sizes", "loading", "decoding"].includes(attribute.name)) {
          node.removeAttribute(attribute.name);
        }
      }
    }
    const originalImages = [...bodyNode.querySelectorAll("img")];
    const clonedImages = [...clone.querySelectorAll("img")];
    const sources = [];
    clonedImages.forEach((image, index) => {
      const source = originalImages[index]?.currentSrc || originalImages[index]?.src || image.src;
      image.setAttribute("data-export-image", String(index));
      image.removeAttribute("src");
      sources.push(source);
    });
    const unique = new Map();
    for (const source of sources) if (!unique.has(source)) unique.set(source, fetchImage(source));
    const assets = [];
    for (let index = 0; index < sources.length; index++) {
      const asset = await unique.get(sources[index]);
      assets.push({ ...asset, path: `images/image-${index + 1}.${imageExtension(asset.type)}` });
    }
    if (assets.reduce((total, asset) => total + asset.bytes.length, 0) > MAX_EXPORT_IMAGE_BYTES) {
      throw new Error("The post images are too large to package safely.");
    }
    const language = /^[a-z0-9-]+$/i.test(document.documentElement.lang) ? document.documentElement.lang : "und";
    return {
      title: titleNode.textContent.trim() || "Patreon post",
      author: authorName(post.scope),
      downloadedAt: downloadTime(),
      sourceUrl: sourceUrl(),
      body: clone,
      assets,
      language
    };
  }

  function currentOrigins() {
    const post = findPost();
    const body = post && [...post.scope.querySelectorAll(BODY)].find(post.belongs);
    if (!body) throw new Error("This post does not expose a supported text body.");
    return [...new Set([...body.querySelectorAll("img")].map(image => image.currentSrc || image.src)
      .filter(source => !source.startsWith("data:")).map(source => {
        const parsed = new URL(source, location.href);
        if (parsed.protocol !== "https:") throw new Error("Only HTTPS post images can be embedded.");
        return `${parsed.origin}/*`;
      }))];
  }

  function authorName(scope) {
    const selectors = [
      '[data-tag="post-details"] a',
      '[class*="_creatorName"]',
      '[class*="CreatorByLine"] a',
      '[data-tag^="creator-info"] a'
    ];
    for (const selector of selectors) {
      const value = [...scope.querySelectorAll(selector)].map(node => node.textContent.trim()).find(Boolean);
      if (value) return value;
    }
    return document.title.match(/\|\s*(.+?)\s+on Patreon\s*$/i)?.[1]?.trim() || "Not available";
  }

  function sourceUrl() {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    return url.href;
  }

  function downloadTime() {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short"
    }).format(new Date());
  }

  function renderHtml(node, assets, imageSource) {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.nodeValue || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    if (tag === "img") {
      const asset = assets[Number(node.getAttribute("data-export-image"))];
      if (!asset) return "";
      return `<figure><img src="${escapeAttribute(imageSource(asset))}" alt="${escapeAttribute(node.getAttribute("alt") || "")}" /></figure>`;
    }
    if (tag === "br") return "<br />";
    const children = [...node.childNodes].map(child => renderHtml(child, assets, imageSource)).join("");
    if (tag === "a") {
      const href = safeUrl(node.getAttribute("href"));
      return href ? `<a href="${escapeAttribute(href)}">${children}</a>` : children;
    }
    const allowed = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "b", "i", "u", "s", "ul", "ol", "li", "blockquote", "pre", "code", "sub", "sup", "hr", "figure", "figcaption"]);
    return allowed.has(tag) ? `<${tag}>${children}</${tag}>` : children;
  }

  function renderMarkdown(node, assets, depth = 0) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    const children = [...node.childNodes].map(child => renderMarkdown(child, assets, depth + (tag === "blockquote" ? 1 : 0))).join("");
    if (tag === "img") {
      const asset = assets[Number(node.getAttribute("data-export-image"))];
      return asset ? `\n![${(node.getAttribute("alt") || "").replaceAll("]", "\\]")}](${asset.dataUrl})\n` : "";
    }
    if (tag === "a") {
      const href = safeUrl(node.getAttribute("href"));
      return href ? `[${children}](${href})` : children;
    }
    if (/^h[1-6]$/.test(tag)) return `\n${"#".repeat(Number(tag[1]))} ${children.trim()}\n\n`;
    if (tag === "p") return `\n${children.trim()}\n\n`;
    if (["strong", "b"].includes(tag)) return `**${children}**`;
    if (["em", "i"].includes(tag)) return `*${children}*`;
    if (tag === "s") return `~~${children}~~`;
    if (tag === "code" && node.parentElement?.tagName !== "PRE") return `\`${children}\``;
    if (tag === "pre") return `\n\`\`\`\n${node.textContent}\n\`\`\`\n\n`;
    if (tag === "br") return "  \n";
    if (tag === "li") return `\n- ${children.trim()}`;
    if (["ul", "ol"].includes(tag)) return `${children}\n\n`;
    if (tag === "blockquote") return `\n${children.trim().split("\n").map(line => `> ${line}`).join("\n")}\n\n`;
    if (tag === "hr") return "\n---\n\n";
    return children;
  }

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = element("a", { href: url, download: name });
    document.documentElement.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function zipHeader(size, crc, nameLength, offset, central = false) {
    const bytes = new Uint8Array(central ? 46 : 30);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, central ? 0x02014b50 : 0x04034b50, true);
    if (central) {
      view.setUint16(4, 20, true); view.setUint16(6, 20, true); view.setUint16(8, 0x800, true);
      view.setUint32(16, crc, true); view.setUint32(20, size, true); view.setUint32(24, size, true);
      view.setUint16(28, nameLength, true); view.setUint32(42, offset, true);
    } else {
      view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
      view.setUint32(14, crc, true); view.setUint32(18, size, true); view.setUint32(22, size, true);
      view.setUint16(26, nameLength, true);
    }
    return bytes;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeZip(entries) {
    const parts = [];
    const central = [];
    let offset = 0;
    for (const entry of entries) {
      const name = utf8(entry.name);
      const data = typeof entry.data === "string" ? utf8(entry.data) : entry.data;
      const crc = crc32(data);
      const local = zipHeader(data.length, crc, name.length, offset, false);
      parts.push(local, name, data);
      central.push(zipHeader(data.length, crc, name.length, offset, true), name);
      offset += local.length + name.length + data.length;
    }
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, entries.length, true); view.setUint16(10, entries.length, true);
    view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: "application/epub+zip" });
  }

  function makeEpub(post) {
    const content = renderHtml(post.body, post.assets, asset => asset.path);
    const metadata = `<dl class="metadata"><div><dt>Creator</dt><dd>${escapeText(post.author)}</dd></div><div><dt>Download time</dt><dd>${escapeText(post.downloadedAt)}</dd></div><div><dt>Source</dt><dd><a href="${escapeAttribute(post.sourceUrl)}">${escapeText(post.sourceUrl)}</a></dd></div></dl>`;
    const imageItems = post.assets.map((asset, index) => `<item id="image-${index + 1}" href="${asset.path}" media-type="${escapeAttribute(asset.type)}" />`).join("\n");
    const identifier = `urn:uuid:${crypto.randomUUID()}`;
    const entries = [
      { name: "mimetype", data: "application/epub+zip" },
      { name: "META-INF/container.xml", data: `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>` },
      { name: "EPUB/styles.css", data: "body{font-family:serif;line-height:1.55;max-width:42em;margin:auto}.metadata{margin:0 0 1.5em;padding:0 0 1em;border-bottom:1px solid #999;font:80%/1.45 sans-serif}.metadata div{display:grid;grid-template-columns:8em minmax(0,1fr);gap:1em;margin:.35em 0}.metadata dt{font-weight:bold}.metadata dd{margin:0;overflow-wrap:anywhere}img{display:block;max-width:100%;height:auto;margin:1em auto}a{text-decoration:underline}blockquote{border-left:.2em solid #888;padding-left:1em}" },
      { name: "EPUB/nav.xhtml", data: `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Contents</title></head><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol><li><a href="post.xhtml">${escapeText(post.title)}</a></li></ol></nav></body></html>` },
      { name: "EPUB/post.xhtml", data: `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeText(post.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body>${metadata}<h1>${escapeText(post.title)}</h1>${content}</body></html>` },
      { name: "EPUB/package.opf", data: `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${identifier}</dc:identifier><dc:title>${escapeText(post.title)}</dc:title><dc:creator>${escapeText(post.author)}</dc:creator><dc:source>${escapeText(post.sourceUrl)}</dc:source><dc:language>${escapeText(post.language)}</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta></metadata><manifest><item id="content" href="post.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="styles.css" media-type="text/css"/>${imageItems}</manifest><spine><itemref idref="content"/></spine></package>` },
      ...post.assets.map(asset => ({ name: `EPUB/${asset.path}`, data: asset.bytes }))
    ];
    return makeZip(entries);
  }

  async function printPdf(post) {
    const content = renderHtml(post.body, post.assets, asset => asset.dataUrl);
    const metadata = `<dl class="metadata"><div><dt>Creator</dt><dd>${escapeText(post.author)}</dd></div><div><dt>Download time</dt><dd>${escapeText(post.downloadedAt)}</dd></div><div><dt>Source</dt><dd><a href="${escapeAttribute(post.sourceUrl)}">${escapeText(post.sourceUrl)}</a></dd></div></dl>`;
    const frame = element("iframe", { "data-patreon-export-print-frame": "", title: "Printable post" });
    frame.style.cssText = "position:fixed;width:1px;height:1px;right:0;bottom:0;opacity:0;border:0";
    document.documentElement.append(frame);
    const printWindow = frame.contentWindow;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeText(post.title)}</title><style>@page{margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font:12pt/1.55 Georgia,serif;color:#222}.document{max-width:48em;margin:auto;padding:18mm}h1{margin:0 0 7mm;font-size:24pt;line-height:1.2}.metadata{margin:0 0 7mm;padding:0 0 4mm;border-bottom:1px solid #bbb;font:9.5pt/1.45 system-ui,sans-serif}.metadata div{display:grid;grid-template-columns:27mm minmax(0,1fr);gap:3mm;margin:1.5mm 0}.metadata dt{font-weight:700}.metadata dd{margin:0;overflow-wrap:anywhere}.metadata a{color:inherit}img{display:block;max-width:100%;height:auto;margin:1em auto}a{color:inherit;text-decoration:underline}blockquote{border-left:3px solid #888;padding-left:1em}</style></head><body><main class="document">${metadata}<h1>${escapeText(post.title)}</h1>${content}</main></body></html>`);
    printWindow.document.close();
    await Promise.all([...printWindow.document.images].map(image => image.complete ? null : new Promise(resolve => { image.onload = image.onerror = resolve; })));
    printWindow.addEventListener("afterprint", () => frame.remove(), { once: true });
    setTimeout(() => frame.remove(), 60_000);
    printWindow.focus();
    printWindow.print();
  }

  function report(message, tone = "") {
    const status = shadow?.querySelector("#export-status");
    if (status) { status.textContent = message; status.dataset.tone = tone; }
  }

  function loadChooser() {
    chooser.src = `${api.runtime.getURL("export/chooser.html")}?instance=${crypto.randomUUID()}#${requestToken}`;
  }

  async function run(format) {
    if (busy) return;
    busy = true;
    report("Preparing the post and its images…");
    try {
      const post = await prepare();
      if (format === "markdown") {
        const markdown = `**Creator:** ${post.author}\n\n**Download time:** ${post.downloadedAt}\n\n**Source:** [${post.sourceUrl}](${post.sourceUrl})\n\n---\n\n# ${post.title}\n\n${renderMarkdown(post.body, post.assets).trim()}\n`;
        saveBlob(new Blob([markdown], { type: "text/markdown;charset=utf-8" }), filename(post.title, "md"));
        report("Markdown download started.", "success");
      } else if (format === "epub") {
        saveBlob(makeEpub(post), filename(post.title, "epub"));
        report("EPUB download started.", "success");
      } else {
        await printPdf(post);
        report("Choose “Save as PDF” in the print dialog.", "success");
      }
    } catch (error) {
      report(error.message || "The post could not be exported.", "error");
    } finally {
      busy = false;
      if (open && chooser?.isConnected && requestToken) {
        loadChooser();
      }
    }
  }

  function close(restoreFocus = false) {
    if (!open || busy) return;
    open = false;
    dialog.hidden = true;
    trigger?.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger?.focus();
  }

  function makeDialog() {
    host = element("div", { "data-patreon-download-panel": "" });
    shadow = host.attachShadow({ mode: "open" });
    const style = element("style");
    style.textContent = `:host{all:initial}*{box-sizing:border-box}[hidden]{display:none!important}section{position:fixed;z-index:2147483647;width:300px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;padding:18px;border:1px solid #dedee3;border-radius:16px;color:#202026;background:#fff;box-shadow:0 12px 48px #0003;font:14px/1.45 system-ui,sans-serif}header{display:flex;align-items:start;justify-content:space-between;gap:12px}h2{margin:0;font-size:18px}p{margin:5px 0 14px;color:#686872;font-size:12px}button{font:inherit;cursor:pointer;color:inherit;background:#f4f4f6;border:1px solid #dedee3;border-radius:8px;padding:8px 10px}button:hover{background:#e9e9ee}.close{padding:5px 9px}iframe{display:block;width:100%;height:42px;border:0}#export-status{min-height:18px;margin:13px 0 0}[data-tone=error]{color:#a32037}[data-tone=success]{color:#216e39}:focus-visible{outline:2px solid #b82d47;outline-offset:2px}@media(prefers-color-scheme:dark){section{color:#f2f2f5;background:#232326;border-color:#48484e}p{color:#b4b4be}button{background:#323237;border-color:#505058}button:hover{background:#414148}[data-tone=error]{color:#ff9bac}[data-tone=success]{color:#82d99b}}`;
    dialog = element("section", { role: "dialog", "aria-modal": "true", "aria-labelledby": "export-heading", hidden: "" });
    const header = element("header");
    header.append(element("h2", { id: "export-heading" }, "Download post"));
    const dismiss = element("button", { type: "button", class: "close", "aria-label": "Close download options" }, "×");
    dismiss.addEventListener("click", () => close(true));
    header.append(dismiss);
    chooser = element("iframe", { title: "Post export formats" });
    dialog.append(header, element("p", {}, "Includes the displayed post text and inline images for offline use."), chooser,
      element("p", { id: "export-status", role: "status", "aria-live": "polite" }, "Nothing leaves this browser."));
    shadow.append(style, dialog);
    document.documentElement.append(host);
  }

  async function openDialog() {
    if (!host?.isConnected) makeDialog();
    open = true; dialog.hidden = false; trigger.setAttribute("aria-expanded", "true"); position();
    shadow.querySelector(".close").focus();
    chooser.src = "about:blank";
    report("Preparing download options…");
    try {
      requestToken = crypto.randomUUID();
      const registered = await call(api.runtime, "sendMessage", {
        type: "REGISTER_POST_EXPORT", token: requestToken, origins: currentOrigins()
      });
      if (!registered?.registered) throw new Error(registered?.error || "Unable to prepare media access.");
      loadChooser();
      report("Nothing leaves this browser.");
    } catch (error) { report(error.message || "Unable to prepare download options.", "error"); }
  }

  function position() {
    if (!open || !trigger?.isConnected) return;
    const rect = trigger.getBoundingClientRect();
    const width = window.visualViewport?.width ?? innerWidth;
    const height = window.visualViewport?.height ?? innerHeight;
    const left = window.visualViewport?.offsetLeft ?? 0;
    const top = window.visualViewport?.offsetTop ?? 0;
    dialog.style.left = `${left + Math.max(12, Math.min(rect.left - left, width - 312))}px`;
    dialog.style.top = `${Math.max(top + 12, Math.min(rect.bottom + 8, top + height - dialog.offsetHeight - 12))}px`;
  }

  function mount(like) {
    anchor = like;
    row = actionRowFor(like);
    trigger = element("button", { type: "button", "data-patreon-download-button": "", title: "Download post", "aria-label": "Download post", "aria-haspopup": "dialog", "aria-expanded": "false" });
    trigger.className = like.className;
    trigger.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M11 3h2v10.2l3.6-3.6L18 11l-6 6-6-6 1.4-1.4 3.6 3.6ZM5 19h14v2H5Z"/></svg>';
    trigger.addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation();
      if (open) return close(true);
      openDialog();
    });
    const reader = row.querySelector("[data-patreon-reader-button]");
    (reader || like).before(trigger);
  }

  function remove() {
    if (busy) return;
    open = false;
    trigger?.remove(); host?.remove();
    trigger = anchor = row = host = shadow = dialog = chooser = undefined;
    requestToken = "";
  }

  function reconcile(isPostPage) {
    if (route !== location.pathname) { route = location.pathname; remove(); }
    if (!isPostPage) { remove(); return; }
    const post = findPost();
    if (!post) { remove(); return; }
    const next = post.like;
    const nextRow = actionRowFor(next);
    const expectedNext = nextRow.querySelector("[data-patreon-reader-button]") || next;
    if (anchor !== next || !trigger?.isConnected || trigger.nextElementSibling !== expectedNext) {
      remove(); mount(next);
    }
    position();
  }

  document.addEventListener("pointerdown", (event) => {
    if (open && !event.composedPath().includes(host) && !event.composedPath().includes(trigger)) close();
  }, true);
  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== api.runtime.id || message?.type !== "POST_EXPORT_CHOICE") return;
    if (!open || message.token !== requestToken) {
      respond({ error: "The export panel is no longer active. Reopen Download." });
      return;
    }
    if (typeof message.error === "string") {
      report(message.error, "error");
      respond({ reported: true });
      return;
    }
    if (busy || !["pdf", "epub", "markdown"].includes(message.format)) {
      respond({ error: busy ? "A post export is already in progress." : "The export format is invalid." });
      return;
    }
    run(message.format);
    respond({ started: true });
  });
  document.addEventListener("keydown", (event) => {
    if (!open) return;
    if (event.key === "Escape") { event.preventDefault(); close(true); return; }
    if (event.key === "Tab") {
      const controls = [...dialog.querySelectorAll("button:not(:disabled), iframe")];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && shadow.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && shadow.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }, true);
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, { passive: true, capture: true });
  globalThis.PatreonExporter = Object.freeze({ reconcile });
})();
