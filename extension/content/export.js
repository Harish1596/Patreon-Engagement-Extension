/* Local post export: extracts only the selected post title/body and embeds its media. */
(() => {
  const { api, call } = globalThis.PatreonExtension;
  const { TITLE, BODY, findPost, actionRowFor } = globalThis.PatreonDOM;
  const { dosTimestamp, zipHeader, updateCrc32 } = globalThis.PatreonZip;
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
  const portableTransfers = new Map();
  const portableBuilds = new Map();
  const cancelledPortableBuilds = new Set();
  const MAX_TRANSFER_CHARS = 1024 * 1024;
  const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  const MAX_EXPORT_IMAGE_BYTES = 100 * 1024 * 1024;
  const POST_CACHE_MS = 2 * 60 * 60_000;
  const POST_CACHE_BYTES = 16 * 1024 * 1024;
  let preparedCache = null;
  let preparedCacheTimer;
  function clearPreparedCache() {
    clearTimeout(preparedCacheTimer);
    preparedCache = null;
  }
  // This immutable identity distinguishes the old document during tabs.update.
  const documentPostId = postId(location.href);

  function postId(value) {
    try { return /\/(?:[^/]+-)?(\d+)\/?$/.exec(new URL(value).pathname)?.[1] || ""; }
    catch { return ""; }
  }

  function requirePost(expectedPostId) {
    if (typeof expectedPostId !== "string" || !expectedPostId
      || documentPostId !== expectedPostId || postId(location.href) !== expectedPostId
      || document.readyState !== "complete") {
      throw new Error("The requested post has not finished loading.");
    }
  }

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
  const fileStem = (title) => {
    const clean = title.normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    return clean || "Patreon post";
  };
  const filename = (title, extension) => `${fileStem(title)}.${extension}`;

  function base64(bytes) {
    let result = "";
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      result += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
    }
    return btoa(result);
  }

  function element(tag, attributes = {}, text) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function dataUrlBytes(value, limit = MAX_IMAGE_BYTES) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
    if (!match) throw new Error("An embedded post image has an invalid data URL.");
    const type = (match[1] || "application/octet-stream").toLowerCase();
    if (!/^image\/(?:jpeg|png|gif|webp|svg\+xml|avif)$/.test(type)) throw new Error("The embedded image format is not supported.");
    if (match[3].length > (match[2] ? Math.ceil(limit / 3) * 4 : limit * 3)) {
      throw new Error("An inline image is too large to export safely.");
    }
    const bytes = match[2]
      ? Uint8Array.from(atob(match[3]), char => char.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(match[3]));
    if (bytes.length > limit) throw new Error("An inline image is too large to export safely.");
    return { type, bytes };
  }

  function sanitizeSvg(bytes) {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("The SVG contains unsupported declarations.");
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    const ns = "http://www.w3.org/2000/svg";
    if (parsed.querySelector("parsererror") || parsed.documentElement.localName !== "svg"
      || parsed.documentElement.namespaceURI !== ns) throw new Error("The SVG image is invalid.");
    const tags = new Set(["svg", "g", "defs", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
      "text", "tspan", "title", "desc", "linearGradient", "radialGradient", "stop", "clipPath", "mask"]);
    const attributes = new Set(["id", "viewBox", "preserveAspectRatio", "width", "height", "x", "y", "x1", "y1", "x2", "y2",
      "cx", "cy", "r", "rx", "ry", "dx", "dy", "d", "points", "transform", "fill", "fill-rule", "fill-opacity",
      "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset",
      "opacity", "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "spreadMethod", "fx", "fy",
      "clip-path", "clip-rule", "mask", "font-size", "font-weight", "text-anchor"]);
    const output = document.implementation.createDocument(ns, "svg", null);
    function copy(input, target, depth = 0) {
      if (depth > 100) throw new Error("The SVG image is too deeply nested.");
      for (const attr of input.attributes) {
        if (attr.namespaceURI || !attributes.has(attr.name)) continue;
        // No CSS escapes, imports, external URLs, or active attributes survive.
        if (/[\\<>&]/.test(attr.value) || /url\s*\(/i.test(attr.value)
          && !/^url\(#[a-zA-Z_][\w.-]*\)$/.test(attr.value)) continue;
        target.setAttribute(attr.name, attr.value);
      }
      for (const child of input.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) target.append(output.createTextNode(child.nodeValue));
        else if (child.nodeType === Node.ELEMENT_NODE && child.namespaceURI === ns && tags.has(child.localName)) {
          const next = output.createElementNS(ns, child.localName); target.append(next); copy(child, next, depth + 1);
        }
      }
    }
    copy(parsed.documentElement, output.documentElement);
    return utf8(new XMLSerializer().serializeToString(output));
  }

  function safeImage(value, limit = MAX_IMAGE_BYTES) {
    let { type, bytes } = dataUrlBytes(value, limit);
    if (type === "image/svg+xml") bytes = sanitizeSvg(bytes);
    else {
      const signature = [...bytes.subarray(0, 12)].map(byte => byte.toString(16).padStart(2, "0")).join("");
      const valid = type === "image/png" ? signature.startsWith("89504e470d0a1a0a")
        : type === "image/jpeg" ? signature.startsWith("ffd8ff")
        : type === "image/gif" ? /^(474946383761|474946383961)/.test(signature)
        : type === "image/webp" ? signature.startsWith("52494646") && signature.endsWith("57454250")
        : signature.slice(8, 16) === "66747970" && /avif|avis/.test(new TextDecoder().decode(bytes.subarray(8, 32)));
      if (!valid) throw new Error("The image bytes do not match their declared format.");
    }
    if (bytes.length > limit) throw new Error("An inline image is too large to export safely.");
    return { type, bytes, dataUrl: `data:${type};base64,${base64(bytes)}` };
  }

  function imageExtension(type) {
    return ({ "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif" })[type] || "img";
  }

  async function fetchImage(url, transferId, maxBytes) {
    if (url.startsWith("data:")) return safeImage(url, maxBytes);
    const result = await call(api.runtime, "sendMessage", { type: "FETCH_POST_EXPORT_IMAGE", url, transferId, maxBytes });
    if (!result?.dataUrl) throw new Error(result?.error || "Unable to read an inline post image.");
    return safeImage(result.dataUrl, maxBytes);
  }

  async function prepare({ signal, transferId } = {}) {
    signal?.throwIfAborted();
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
    const language = /^[a-z0-9-]+$/i.test(document.documentElement.lang) ? document.documentElement.lang : "und";
    const info = { title: titleNode.textContent.trim() || "Patreon post", author: authorName(post.scope),
      sourceUrl: sourceUrl(), language };
    let signature;
    if (!transferId) {
      const digest = await crypto.subtle.digest("SHA-256", utf8(JSON.stringify([info, clone.innerHTML, sources])));
      signature = base64(new Uint8Array(digest));
      signal?.throwIfAborted();
      if (preparedCache?.signature === signature && preparedCache.expires > Date.now()) {
        return hydrateSnapshot(preparedCache.snapshot);
      }
      clearPreparedCache();
    }
    const occurrences = new Map();
    for (const source of sources) occurrences.set(source, (occurrences.get(source) || 0) + 1);
    const resolved = new Map();
    let remaining = MAX_EXPORT_IMAGE_BYTES;
    // Sequential requests bound decoded memory and stop before fetching over budget.
    for (const [source, count] of occurrences) {
      signal?.throwIfAborted();
      const limit = Math.min(MAX_IMAGE_BYTES, Math.floor(remaining / count));
      if (limit <= 0) throw new Error("The post images are too large to package safely.");
      const asset = await fetchImage(source, transferId, limit);
      signal?.throwIfAborted();
      remaining -= asset.bytes.length * count;
      resolved.set(source, asset);
    }
    const indices = new Map();
    const assets = [...resolved].map(([source, asset], index) => {
      indices.set(source, index);
      return { ...asset, path: `images/image-${index + 1}.${imageExtension(asset.type)}` };
    });
    clonedImages.forEach((image, index) => image.setAttribute("data-export-image", String(indices.get(sources[index]))));
    // Markdown embeds each occurrence, even when EPUB shares the image bytes.
    if (sources.reduce((total, source) => total + resolved.get(source).bytes.length, 0) > MAX_EXPORT_IMAGE_BYTES) {
      throw new Error("The post images are too large to package safely.");
    }
    const prepared = {
      ...info,
      downloadedAt: downloadTime(),
      body: clone,
      assets
    };
    if (!transferId) {
      const snapshot = snapshotFor(prepared);
      if (JSON.stringify(snapshot).length * 2 <= POST_CACHE_BYTES) {
        preparedCache = { signature, snapshot, expires: Date.now() + POST_CACHE_MS };
        preparedCacheTimer = setTimeout(clearPreparedCache, POST_CACHE_MS);
      }
    }
    return prepared;
  }

  // A format-independent, inert tree with one data URL per distinct image.
  // No source DOM, signed image URL, or duplicate decoded image bytes are kept.
  function snapshotFor(post) {
    function tree(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      return { tag: node.tagName.toLowerCase(),
        ...(node.tagName === "IMG" ? { image: Number(node.getAttribute("data-export-image")), alt: node.getAttribute("alt") || "" } : {}),
        ...(node.tagName === "A" ? { href: safeUrl(node.getAttribute("href")) } : {}),
        children: [...node.childNodes].map(tree) };
    }
    return { version: 1, postId: postId(post.sourceUrl), title: post.title, author: post.author,
      sourceUrl: post.sourceUrl, language: post.language, body: tree(post.body),
      assets: post.assets.map(asset => ({ type: asset.type, dataUrl: asset.dataUrl, path: asset.path })) };
  }

  function hydrateSnapshot(snapshot) {
    if (snapshot?.version !== 1 || !Array.isArray(snapshot.assets)
      || ![snapshot.title, snapshot.author, snapshot.sourceUrl, snapshot.language].every(value => typeof value === "string")) {
      throw new Error("The cached post is invalid. Refresh collection to fetch it again.");
    }
    function node(tree, depth = 0) {
      if (depth > 200) throw new Error("The cached post is too deeply nested.");
      if (typeof tree === "string") return document.createTextNode(tree);
      // Unknown elements become inert containers; never instantiate an embed,
      // script, form, or custom element from a cached tree.
      const allowed = /^(?:div|p|h[1-6]|strong|em|b|i|u|s|ul|ol|li|blockquote|pre|code|sub|sup|hr|figure|figcaption|br|img|a)$/;
      const result = element(allowed.test(tree?.tag) ? tree.tag : "div");
      if (tree?.tag === "img") {
        result.setAttribute("data-export-image", String(tree.image));
        result.setAttribute("alt", tree.alt || "");
      }
      if (tree?.tag === "a" && safeUrl(tree.href)) result.setAttribute("href", safeUrl(tree.href));
      for (const child of tree?.children || []) result.append(node(child, depth + 1));
      return result;
    }
    return { ...snapshot, downloadedAt: downloadTime(), body: node(snapshot.body),
      assets: snapshot.assets.map(asset => {
        // Validate older caches on first use, including raster MIME disguises.
        let safe;
        const image = () => (safe ||= safeImage(asset.dataUrl));
        return { ...asset,
          get dataUrl() { return image().dataUrl; },
          get bytes() { return image().bytes; }
        };
      }) };
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

  function describePost() {
    const post = findPost();
    if (!post) throw new Error("The current post could not be found.");
    const titles = [...post.scope.querySelectorAll(TITLE)].filter(post.belongs);
    const titleNode = titles.find(node => node.getClientRects().length) || titles[0];
    if (!titleNode) throw new Error("The current post title is not available.");
    return {
      title: titleNode.textContent.trim() || "Patreon post",
      origins: currentOrigins()
    };
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

  // CommonMark treats CRLF and bare CR as line endings too. Normalize before
  // fencing or adding list/quote prefixes, including when rendering old caches.
  const markdownLines = value => String(value).replace(/\r\n?/g, "\n");
  const markdownText = value => escapeText(markdownLines(value)).replace(/[\\`*_{}\[\]()#+.!|~\-]/g, "\\$&");
  const markdownUrl = value => value.replace(/[<>"()\\\s]/g, char => encodeURIComponent(char).replace(/[()]/g, c => `%${c.charCodeAt(0).toString(16)}`));
  function codeFence(value, minimum) {
    let length = minimum;
    for (const match of value.matchAll(/`+/g)) length = Math.max(length, match[0].length + 1);
    return "`".repeat(length);
  }
  function renderMarkdown(node, assets, depth = 0) {
    if (node.nodeType === Node.TEXT_NODE) return markdownText(node.nodeValue || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    if (tag === "pre") {
      const code = markdownLines(node.textContent);
      // A malformed inline/heading container must not swallow the opening fence.
      if (node.closest("h1,h2,h3,h4,h5,h6,a,strong,em,b,i,s,code")) {
        const text = code.replace(/\n+/g, " ");
        const fence = codeFence(text, 1);
        return `${fence} ${text} ${fence}`;
      }
      const fence = codeFence(code, 3);
      return `\n${fence}\n${code}\n${fence}\n\n`;
    }
    if (tag === "code") {
      const code = markdownLines(node.textContent).replace(/\n/g, " ");
      const fence = codeFence(code, 1);
      return `${fence} ${code} ${fence}`;
    }
    const children = [...node.childNodes].map(child => renderMarkdown(child, assets, depth + (tag === "blockquote" ? 1 : 0))).join("");
    if (tag === "img") {
      const asset = assets[Number(node.getAttribute("data-export-image"))];
      return asset ? `\n![${markdownText(node.getAttribute("alt") || "")}](${asset.dataUrl})\n` : "";
    }
    if (tag === "a") {
      const href = safeUrl(node.getAttribute("href"));
      return href ? `[${children}](${markdownUrl(href)})` : children;
    }
    if (/^h[1-6]$/.test(tag)) return `\n${"#".repeat(Number(tag[1]))} ${children.trim()}\n\n`;
    if (tag === "p") return `\n${children.trim()}\n\n`;
    if (["strong", "b"].includes(tag)) return `**${children}**`;
    if (["em", "i"].includes(tag)) return `*${children}*`;
    if (tag === "s") return `~~${children}~~`;
    if (tag === "br") return "  \n";
    if (tag === "li") {
      const lines = children.trim().split("\n");
      return `\n- ${lines[0]}${lines.slice(1).map(line => `\n  ${line}`).join("")}`;
    }
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

  function crc32(bytes) {
    return (updateCrc32(0xffffffff, bytes) ^ 0xffffffff) >>> 0;
  }

  function makeZip(entries, type = "application/epub+zip") {
    const parts = [];
    const central = [];
    let offset = 0;
    const timestamp = dosTimestamp();
    for (const entry of entries) {
      const name = utf8(entry.name);
      const data = typeof entry.data === "string" ? utf8(entry.data) : entry.data;
      const payload = entry.compressedData || data;
      const method = entry.compressedData ? 8 : 0;
      const crc = entry.crc ?? crc32(data);
      const local = zipHeader(payload.length, data.length, crc, name.length, offset, timestamp, method, false);
      parts.push(local, name, payload);
      central.push(zipHeader(payload.length, data.length, crc, name.length, offset, timestamp, method, true), name);
      offset += local.length + name.length + payload.length;
    }
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, entries.length, true); view.setUint16(10, entries.length, true);
    view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type });
  }

  function makeEpub(post, chapter) {
    const content = renderHtml(post.body, post.assets, asset => asset.path);
    const folder = index => String(index + 1).padStart(3, "0");
    const navigation = chapter ? `<nav aria-label="Chapter navigation"><p>${chapter.index ? `<a href="../${folder(chapter.index - 1)}/post.xhtml">Previous chapter</a> · ` : ""}<a href="../../nav.xhtml">Contents</a>${chapter.index + 1 < chapter.count ? ` · <a href="../${folder(chapter.index + 1)}/post.xhtml">Next chapter</a>` : ""}</p></nav>` : "";
    const metadata = `<dl class="metadata"><div><dt>Creator</dt><dd>${escapeText(post.author)}</dd></div><div><dt>Download time</dt><dd>${escapeText(post.downloadedAt)}</dd></div><div><dt>Source</dt><dd><a href="${escapeAttribute(post.sourceUrl)}">${escapeText(post.sourceUrl)}</a></dd></div></dl>`;
    const imageItems = post.assets.map((asset, index) => `<item id="image-${index + 1}" href="${asset.path}" media-type="${escapeAttribute(asset.type)}" />`).join("\n");
    const identifier = `urn:uuid:${crypto.randomUUID()}`;
    const entries = [
      { name: "mimetype", data: "application/epub+zip" },
      { name: "META-INF/container.xml", data: `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>` },
      { name: "EPUB/styles.css", data: "body{font-family:serif;line-height:1.55;max-width:42em;margin:auto}.metadata{margin:0 0 1.5em;padding:0 0 1em;border-bottom:1px solid #999;font:80%/1.45 sans-serif}.metadata div{display:grid;grid-template-columns:8em minmax(0,1fr);gap:1em;margin:.35em 0}.metadata dt{font-weight:bold}.metadata dd{margin:0;overflow-wrap:anywhere}img{display:block;max-width:100%;height:auto;margin:1em auto}a{text-decoration:underline}blockquote{border-left:.2em solid #888;padding-left:1em}" },
      { name: "EPUB/nav.xhtml", data: `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Contents</title></head><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol><li><a href="post.xhtml">${escapeText(post.title)}</a></li></ol></nav></body></html>` },
      { name: "EPUB/post.xhtml", data: `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeText(post.title)}</title><link rel="stylesheet" type="text/css" href="${chapter ? "../../styles.css" : "styles.css"}"/></head><body>${metadata}<h1>${escapeText(post.title)}</h1>${content}${navigation}</body></html>` },
      { name: "EPUB/package.opf", data: `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${identifier}</dc:identifier><dc:title>${escapeText(post.title)}</dc:title><dc:creator>${escapeText(post.author)}</dc:creator><dc:source>${escapeText(post.sourceUrl)}</dc:source><dc:language>${escapeText(post.language)}</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta></metadata><manifest><item id="content" href="post.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="styles.css" media-type="text/css"/>${imageItems}</manifest><spine><itemref idref="content"/></spine></package>` },
      ...post.assets.map(asset => ({ name: `EPUB/${asset.path}`, data: asset.bytes }))
    ];
    return makeZip(entries);
  }

  function markdownFor(post) {
    return `**Creator:** ${markdownText(post.author)}\n\n**Download time:** ${markdownText(post.downloadedAt)}\n\n**Source:** [${markdownText(post.sourceUrl)}](${markdownUrl(post.sourceUrl)})\n\n---\n\n# ${markdownText(post.title)}\n\n${renderMarkdown(post.body, post.assets).trim()}\n`;
  }

  async function buildPortableFile(format, options) {
    if (!["epub", "markdown", "snapshot"].includes(format)) throw new Error("The collection export format is invalid.");
    const post = await prepare(options);
    if (format === "snapshot") return { title: post.title, extension: "snapshot", encoding: "text", data: JSON.stringify(snapshotFor(post)) };
    return portableFileFor(post, format);
  }

  async function portableFileFor(post, format, chapter) {
    if (format === "markdown") {
      return { title: post.title, extension: "md", encoding: "text", data: markdownFor(post) };
    }
    const bytes = new Uint8Array(await makeEpub(post, chapter).arrayBuffer());
    return { title: post.title, creator: post.author, language: post.language, extension: "epub", encoding: "base64", data: base64(bytes) };
  }

  async function fileFromSnapshot(snapshot, format, expectedUrl, chapter) {
    if (!["epub", "markdown"].includes(format) || snapshot?.postId !== postId(expectedUrl)) {
      throw new Error("The cached post does not match the requested chapter.");
    }
    if (chapter && (format !== "epub" || !Number.isSafeInteger(chapter.index) || !Number.isSafeInteger(chapter.count)
      || chapter.count < 1 || chapter.count > 100 || chapter.index < 0 || chapter.index >= chapter.count)) {
      throw new Error("The collection chapter position is invalid.");
    }
    return portableFileFor(hydrateSnapshot(snapshot), format, chapter);
  }

  async function printPdf(post) {
    const outputTitle = fileStem(post.title);
    const content = renderHtml(post.body, post.assets, asset => asset.dataUrl);
    const metadata = `<dl class="metadata"><div><dt>Creator</dt><dd>${escapeText(post.author)}</dd></div><div><dt>Download time</dt><dd>${escapeText(post.downloadedAt)}</dd></div><div><dt>Source</dt><dd><a href="${escapeAttribute(post.sourceUrl)}">${escapeText(post.sourceUrl)}</a></dd></div></dl>`;
    const frame = element("iframe", { "data-patreon-export-print-frame": "", title: "Printable post" });
    frame.style.cssText = "position:fixed;width:1px;height:1px;right:0;bottom:0;opacity:0;border:0";
    document.documentElement.append(frame);
    const printWindow = frame.contentWindow;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeText(outputTitle)}</title><style>@page{margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font:12pt/1.55 Georgia,serif;color:#222}.document{max-width:48em;margin:auto;padding:18mm}h1{margin:0 0 7mm;font-size:24pt;line-height:1.2}.metadata{margin:0 0 7mm;padding:0 0 4mm;border-bottom:1px solid #bbb;font:9.5pt/1.45 system-ui,sans-serif}.metadata div{display:grid;grid-template-columns:27mm minmax(0,1fr);gap:3mm;margin:1.5mm 0}.metadata dt{font-weight:700}.metadata dd{margin:0;overflow-wrap:anywhere}.metadata a{color:inherit}img{display:block;max-width:100%;height:auto;margin:1em auto}a{color:inherit;text-decoration:underline}blockquote{border-left:3px solid #888;padding-left:1em}</style></head><body><main class="document">${metadata}<h1>${escapeText(post.title)}</h1>${content}</main></body></html>`);
    printWindow.document.close();
    await Promise.all([...printWindow.document.images].map(image => image.complete ? null : new Promise(resolve => { image.onload = image.onerror = resolve; })));
    printWindow.addEventListener("afterprint", () => frame.remove(), { once: true });
    setTimeout(() => frame.remove(), 60_000);
    const previousTitle = document.title;
    document.title = outputTitle;
    try {
      printWindow.focus();
      printWindow.print();
    } finally {
      document.title = previousTitle;
    }
  }

  function report(message, tone = "") {
    const status = shadow?.querySelector("#export-status");
    if (status) { status.textContent = message; status.dataset.tone = tone; }
  }

  function setProgress(label = "") {
    const progress = shadow?.querySelector("#export-progress");
    if (!progress) return;
    progress.hidden = !label;
    if (label) progress.setAttribute("aria-valuetext", label);
    else progress.removeAttribute("aria-valuetext");
  }

  function loadChooser() {
    chooser.src = `${api.runtime.getURL("export/chooser.html")}?instance=${crypto.randomUUID()}#${requestToken}`;
  }

  async function run(format) {
    if (busy) return;
    busy = true;
    setProgress("Preparing the post and its images");
    report("Preparing the post and its images…");
    try {
      const post = await prepare();
      if (format === "markdown") {
        saveBlob(new Blob([markdownFor(post)], { type: "text/markdown;charset=utf-8" }), filename(post.title, "md"));
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
      setProgress();
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
    style.textContent = `:host{all:initial}*{box-sizing:border-box}[hidden]{display:none!important}section{position:fixed;z-index:2147483647;width:300px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;padding:18px;border:1px solid #dedee3;border-radius:16px;color:#202026;background:#fff;box-shadow:0 12px 48px #0003;font:14px/1.45 system-ui,sans-serif}header{display:flex;align-items:start;justify-content:space-between;gap:12px}h2{margin:0;font-size:18px}p{margin:5px 0 14px;color:#686872;font-size:12px}button{font:inherit;cursor:pointer;color:inherit;background:#f4f4f6;border:1px solid #dedee3;border-radius:8px;padding:8px 10px}button:hover{background:#e9e9ee}.close{padding:5px 9px}iframe{display:block;width:100%;height:144px;border:0}progress{display:block;width:100%;height:8px;margin:12px 0 0;accent-color:#b82d47}#export-status{min-height:18px;margin:10px 0 0}[data-tone=error]{color:#a32037}[data-tone=success]{color:#216e39}:focus-visible{outline:2px solid #b82d47;outline-offset:2px}@media(prefers-color-scheme:dark){section{color:#f2f2f5;background:#232326;border-color:#48484e}p{color:#b4b4be}button{background:#323237;border-color:#505058}button:hover{background:#414148}[data-tone=error]{color:#ff9bac}[data-tone=success]{color:#82d99b}}`;
    dialog = element("section", { role: "dialog", "aria-modal": "true", "aria-labelledby": "export-heading", hidden: "" });
    const header = element("header");
    header.append(element("h2", { id: "export-heading" }, "Download post"));
    const dismiss = element("button", { type: "button", class: "close", "aria-label": "Close download options" }, "×");
    dismiss.addEventListener("click", () => close(true));
    header.append(dismiss);
    chooser = element("iframe", { title: "Post export formats" });
    dialog.append(header, element("p", {}, "Includes the displayed post text and inline images for offline use."), chooser,
      element("progress", { id: "export-progress", "aria-label": "Post download progress", hidden: "" }),
      element("p", { id: "export-status", role: "status", "aria-live": "polite" }, "Nothing leaves this browser."));
    shadow.append(style, dialog);
    document.documentElement.append(host);
  }

  async function openDialog() {
    if (!host?.isConnected) makeDialog();
    open = true; dialog.hidden = false; trigger.setAttribute("aria-expanded", "true"); position();
    shadow.querySelector(".close").focus();
    chooser.src = "about:blank";
    setProgress("Preparing download options");
    report("Preparing download options…");
    try {
      requestToken = crypto.randomUUID();
      const registered = await call(api.runtime, "sendMessage", {
        type: "REGISTER_POST_EXPORT", token: requestToken, origins: currentOrigins()
      });
      if (!registered?.registered) throw new Error(registered?.error || "Unable to prepare media access.");
      loadChooser();
      report("Nothing leaves this browser.");
      setProgress();
    } catch (error) {
      report(error.message || "Unable to prepare download options.", "error");
      setProgress();
    }
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
    if (route !== location.pathname) { route = location.pathname; clearPreparedCache(); remove(); }
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
    if (sender.id !== api.runtime.id || !message || typeof message !== "object") return;
    if (message.type === "POST_EXPORT_RETRY") {
      if (busy && !message.transferId && Number.isSafeInteger(message.attempt) && message.attempt >= 2 && message.attempt <= 3
        && Number.isFinite(message.delayMs) && message.delayMs >= 0 && message.delayMs <= 60_000) {
        report(`Image request failed temporarily. Retry ${message.attempt} of 3 in ${Math.ceil(message.delayMs / 1000)}s…`);
      }
      respond({ reported: true }); return;
    }
    if (message.type === "DESCRIBE_POST_EXPORT") {
      try {
        requirePost(message.expectedPostId);
        respond({ post: { ...describePost(), postId: documentPostId } });
      }
      catch (error) { respond({ error: error.message || "The post is not ready for export." }); }
      return;
    }
    if (message.type === "BUILD_POST_EXPORT") {
      try { requirePost(message.expectedPostId); }
      catch (error) { respond({ error: error.message }); return; }
      if (typeof message.transferId !== "string" || !/^[0-9a-f-]{36}$/i.test(message.transferId)) {
        respond({ error: "The post export transfer is invalid." });
        return;
      }
      if (cancelledPortableBuilds.has(message.transferId)) { respond({ error: "The export was cancelled." }); return; }
      const controller = new AbortController();
      portableBuilds.set(message.transferId, controller);
      buildPortableFile(message.format, { signal: controller.signal, transferId: message.transferId }).then((file) => {
        controller.signal.throwIfAborted();
        requirePost(message.expectedPostId);
        portableTransfers.set(message.transferId, file);
        respond({ file: {
          postId: documentPostId,
          title: file.title,
          extension: file.extension,
          encoding: file.encoding,
          length: file.data.length
        } });
      })
        .catch((error) => respond({ error: error.message || "The post could not be exported." }))
        .finally(() => portableBuilds.delete(message.transferId));
      return true;
    }
    if (message.type === "CANCEL_POST_EXPORT") {
      cancelledPortableBuilds.add(message.transferId);
      portableBuilds.get(message.transferId)?.abort();
      portableTransfers.delete(message.transferId);
      respond({ cancelled: true });
      return;
    }
    if (message.type === "GET_POST_EXPORT_CHUNK") {
      const file = portableTransfers.get(message.transferId);
      const offset = message.offset;
      if (!file || !Number.isSafeInteger(offset) || offset < 0 || offset > file.data.length) {
        respond({ error: "The post export transfer expired or is invalid." });
        return;
      }
      let end = Math.min(file.data.length, offset + MAX_TRANSFER_CHARS);
      if (end < file.data.length && /[\uD800-\uDBFF]/.test(file.data[end - 1])) end--;
      const data = file.data.slice(offset, end);
      const done = end === file.data.length;
      if (done) portableTransfers.delete(message.transferId);
      respond({ data, done });
      return;
    }
    if (message.type === "RELEASE_POST_EXPORT") {
      portableTransfers.delete(message.transferId);
      respond({ released: true });
      return;
    }
    if (message.type !== "POST_EXPORT_CHOICE") return;
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
  globalThis.PatreonExporter = Object.freeze({ reconcile, makeZip, saveBlob, fileStem, fileFromSnapshot });
})();
