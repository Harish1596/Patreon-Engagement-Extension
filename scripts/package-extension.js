const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");

// Archive paths, never globs or recursively included directories.
const FILES = Object.freeze([
  "manifest.json", "shared/extension.js", "content/reader.js", "content/content.js",
  "content/content.css", "popup/popup.html", "popup/popup.js", "popup/popup.css",
  "icons/icon-16.png", "icons/icon-32.png", "icons/icon-48.png", "icons/icon-128.png",
  "icons/engagement-bar.svg", "LICENSE", "PRIVACY.md"
]);

function command(name, args, cwd, binary = false) {
  const result = spawnSync(name, args, { cwd, encoding: binary ? undefined : "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw new Error(`Cannot run ${name}: install zip and unzip on PATH (${result.error.message}).`);
  if (result.status !== 0) throw new Error(`${name} failed: ${String(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}

function json(buffer, name) {
  try { return JSON.parse(buffer.toString("utf8")); }
  catch { throw new Error(`Invalid JSON in ${name}.`); }
}

function regularFile(root, relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) throw new Error(`Missing or non-regular file: ${relative}`);
  const real = fs.realpathSync(file);
  if (!real.startsWith(fs.realpathSync(root) + path.sep)) throw new Error(`File escapes its source directory: ${relative}`);
  return fs.readFileSync(file);
}

function requireAsset(files, reference, parent = "manifest.json") {
  if (typeof reference !== "string" || !reference || /^(?:[a-z][a-z\d+.-]*:|\/)|[\\\0]/i.test(reference)) {
    throw new Error(`Invalid local resource in ${parent}: ${reference}`);
  }
  const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(parent), clean));
  if (!files.has(resolved)) throw new Error(`Resource is not allowlisted: ${parent} -> ${reference}`);
}

function validateResources(files) {
  const manifest = json(files.get("manifest.json"), "manifest.json");
  const icons = value => typeof value === "string" ? [value] : Object.values(value || {});
  const refs = [...icons(manifest.icons)];
  for (const action of [manifest.action, manifest.browser_action, manifest.page_action]) {
    if (action?.default_popup) refs.push(action.default_popup);
    refs.push(...icons(action?.default_icon));
  }
  for (const script of manifest.content_scripts || []) refs.push(...(script.js || []), ...(script.css || []));
  if (manifest.background?.service_worker) refs.push(manifest.background.service_worker);
  refs.push(...(manifest.background?.scripts || []));
  for (const ref of [manifest.background?.page, manifest.options_page, manifest.options_ui?.page, manifest.devtools_page]) if (ref) refs.push(ref);
  refs.push(...Object.values(manifest.chrome_url_overrides || {}));
  for (const entry of manifest.web_accessible_resources || []) {
    if (typeof entry === "string") refs.push(entry);
    else refs.push(...(entry.resources || []));
  }
  for (const ref of refs) requireAsset(files, ref);
  for (const [name, buffer] of files) {
    const text = buffer.toString("utf8");
    if (/\.(html|svg)$/.test(name)) {
      for (const match of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
        if (!match[1].startsWith("#")) requireAsset(files, match[1], name);
      }
    }
    if (name.endsWith(".css")) {
      for (const match of text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)) {
        if (!match[1].startsWith("#")) requireAsset(files, match[1], name);
      }
      // Fail closed rather than silently allowing an unvalidated stylesheet import.
      if (/@import\b/i.test(text)) throw new Error(`CSS imports require packaging validation support: ${name}`);
    }
  }
}

function readPackage(root) {
  const files = new Map(FILES.map(name => [name, regularFile(
    name === "LICENSE" || name === "PRIVACY.md" ? root : path.join(root, "extension"), name
  )]));
  const manifest = json(files.get("manifest.json"), "manifest.json");
  const pkg = json(regularFile(root, "package.json"), "package.json");
  const lock = json(regularFile(root, "package-lock.json"), "package-lock.json");
  const versions = [manifest.version, pkg.version, lock.version, lock.packages?.[""]?.version];
  if (versions.some(version => typeof version !== "string" || version !== versions[0])) {
    throw new Error("Version mismatch: manifest.json, package.json, package-lock.json, and its root package must agree.");
  }
  const parts = versions[0].split(".");
  if (parts.length > 4 || parts.some(part => !/^(0|[1-9]\d*)$/.test(part) || Number(part) > 65535) || parts.every(part => Number(part) === 0)) {
    throw new Error("Manifest version must contain 1–4 numeric components between 0 and 65535 (not all zero).");
  }
  validateResources(files);
  return { version: versions[0], files };
}

function validateArchive(archive, files) {
  const listing = command("unzip", ["-Z1", archive]).trim().split(/\r?\n/);
  if (listing.length !== files.size || new Set(listing).size !== listing.length || listing.some(name => !files.has(name))) {
    throw new Error("ZIP contents do not match the exact allowlist (missing, duplicate, or unexpected entries).");
  }
  command("unzip", ["-t", archive]);
  const archived = new Map();
  for (const name of listing) {
    const data = command("unzip", ["-p", archive, name], undefined, true);
    if (!data.equals(files.get(name))) throw new Error(`ZIP content differs from the source snapshot: ${name}`);
    archived.set(name, data);
  }
  validateResources(archived);
}

function packageExtension(root, { force = false } = {}) {
  root = path.resolve(root);
  const { version, files } = readPackage(root);
  const directory = path.join(root, "dist");
  if (fs.existsSync(directory) && (!fs.lstatSync(directory).isDirectory() || fs.lstatSync(directory).isSymbolicLink())) {
    throw new Error("dist must be a real directory, not a file or symlink.");
  }
  fs.mkdirSync(directory, { recursive: true });
  const output = path.join(directory, `patreon-engagement-toggle-${version}.zip`);
  if (fs.existsSync(output)) {
    if (!fs.lstatSync(output).isFile()) throw new Error("Release output must be a regular file.");
    if (!force) throw new Error(`Release already exists: ${output}. Use --force to replace it after validation.`);
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "patreon-package-"));
  const pending = path.join(directory, `.package-${randomUUID()}.tmp`);
  try {
    const stage = path.join(temporary, "source");
    fs.mkdirSync(stage);
    for (const [name, data] of files) {
      const target = path.join(stage, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
      fs.chmodSync(target, 0o644);
      fs.utimesSync(target, new Date("2000-01-01T00:00:00Z"), new Date("2000-01-01T00:00:00Z"));
    }
    const archive = path.join(temporary, "release.zip");
    command("zip", ["-X", "-q", "-9", archive, ...FILES], stage);
    validateArchive(archive, files);
    fs.copyFileSync(archive, pending, fs.constants.COPYFILE_EXCL);
    if (!force && fs.existsSync(output)) throw new Error("Release appeared during packaging; refusing to overwrite it.");
    fs.renameSync(pending, output);
    return output;
  } finally {
    if (fs.existsSync(pending)) fs.unlinkSync(pending);
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== "--force")) throw new Error("Usage: npm run package -- [--force]");
    console.log(`Validated release: ${packageExtension(path.resolve(__dirname, ".."), { force: args.includes("--force") })}`);
  } catch (error) { console.error(`Packaging failed: ${error.message}`); process.exitCode = 1; }
}

module.exports = { FILES, readPackage, validateArchive, packageExtension };
