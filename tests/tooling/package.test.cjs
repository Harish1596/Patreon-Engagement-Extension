const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { FILES, readPackage, validateArchive, packageExtension } = require("../../scripts/package-extension");
const project = path.resolve(__dirname, "../..");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patreon-package-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of [...FILES.map(name => ["LICENSE", "PRIVACY.md"].includes(name) ? name : "extension/" + name), "package.json", "package-lock.json"]) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    if (name === "extension/popup/links.js") {
      fs.writeFileSync(path.join(root, name), require("../../scripts/configure-links").createLinksScript(root, {}));
    } else fs.copyFileSync(path.join(project, name), path.join(root, name));
  }
  return root;
}

function edit(root, name, update) {
  const file = path.join(root, name), value = JSON.parse(fs.readFileSync(file, "utf8"));
  update(value); fs.writeFileSync(file, JSON.stringify(value));
}

test("package has exact files and root manifest; rejects overwrites and preserves output on failure", t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, "extension", "unlisted-secret.txt"), "synthetic excluded file");
  const output = packageExtension(root), original = fs.readFileSync(output);
  assert.equal(path.basename(output), `patreon-reader-${JSON.parse(fs.readFileSync(path.join(root, "extension/manifest.json"), "utf8")).version}.zip`);
  const manifest = JSON.parse(readPackage(root).files.get("manifest.json").toString("utf8"));
  assert.equal(readPackage(root).files.has("background/markdown-book.js"), true);
  assert.match(readPackage(root).files.get("vendor/pdfmake/NOTO-SANS-LICENSE").toString("utf8"), /SIL OPEN FONT LICENSE/);
  assert.equal(manifest.name, "Patreon Reader");
  assert.equal(manifest.action.default_title, "Patreon Reader");
  validateArchive(output, readPackage(root).files);
  assert.throws(() => packageExtension(root), /already exists/);
  fs.writeFileSync(path.join(root, "extension/manifest.json"), "{");
  assert.throws(() => packageExtension(root, { force: true }), /Invalid JSON/);
  assert.deepEqual(fs.readFileSync(output), original);
});

for (const location of ["manifest", "package", "lock", "lockRoot"]) {
  test(`rejects inconsistent ${location} version`, t => {
    const root = fixture(t);
    const file = location === "manifest" ? "extension/manifest.json" : location === "package" ? "package.json" : "package-lock.json";
    edit(root, file, json => { if (location === "lockRoot") json.packages[""].version = "9.9.9"; else json.version = "9.9.9"; });
    assert.throws(() => readPackage(root), /Version mismatch/);
  });
}

test("rejects missing files, unsafe resources, and unlisted manifest/popup assets", t => {
  const root = fixture(t), popup = path.join(root, "extension/popup/popup.html");
  const original = fs.readFileSync(popup);
  fs.appendFileSync(popup, '<img src="missing.png">');
  assert.throws(() => readPackage(root), /not allowlisted/);
  fs.writeFileSync(popup, '<script src="https://example.invalid/test.js"></script>');
  assert.throws(() => readPackage(root), /Invalid local resource/);
  fs.writeFileSync(popup, original);
  edit(root, "extension/manifest.json", manifest => { manifest.content_scripts[0].js.push("unlisted.js"); });
  assert.throws(() => readPackage(root), /not allowlisted/);
  fs.unlinkSync(popup);
  assert.throws(() => readPackage(root), /Missing or non-regular file/);
});

test("rejects corrupt archives, extra entries, and changed payloads", t => {
  const root = fixture(t), output = packageExtension(root), snapshot = readPackage(root).files;
  const original = fs.readFileSync(output);
  fs.writeFileSync(output, "not a ZIP");
  assert.throws(() => validateArchive(output, snapshot), /unzip failed/);
  const damaged = Buffer.from(original);
  const dataOffset = 30 + damaged.readUInt16LE(26) + damaged.readUInt16LE(28);
  damaged[dataOffset + 5] ^= 0xff;
  fs.writeFileSync(output, damaged);
  assert.throws(() => validateArchive(output, snapshot), /unzip failed/);
  fs.writeFileSync(output, original);
  execFileSync("zip", ["-qd", output, "LICENSE"]);
  assert.throws(() => validateArchive(output, snapshot), /exact allowlist/);
  const duplicate = Buffer.from(original);
  const oldName = Buffer.from("icons/icon-32.png"), duplicateName = Buffer.from("icons/icon-16.png");
  for (let offset = duplicate.indexOf(oldName); offset !== -1; offset = duplicate.indexOf(oldName, offset + oldName.length)) duplicateName.copy(duplicate, offset);
  fs.writeFileSync(output, duplicate);
  assert.throws(() => validateArchive(output, snapshot), /exact allowlist/);
  fs.writeFileSync(output, original);
  fs.writeFileSync(path.join(root, "unexpected.txt"), "unexpected");
  execFileSync("zip", ["-q", output, "unexpected.txt"], { cwd: root });
  assert.throws(() => validateArchive(output, snapshot), /exact allowlist/);
  fs.writeFileSync(output, original);
  fs.writeFileSync(path.join(root, "LICENSE"), "modified synthetic license");
  execFileSync("zip", ["-q", output, "LICENSE"], { cwd: root });
  assert.throws(() => validateArchive(output, snapshot), /differs from the source snapshot/);
});

test("forced rebuild replaces the archive only after successful validation", t => {
  const root = fixture(t), output = packageExtension(root);
  fs.appendFileSync(path.join(root, "extension/popup/popup.css"), "\n/* synthetic change */\n");
  assert.equal(packageExtension(root, { force: true }), output);
  validateArchive(output, readPackage(root).files);
});

test("rejects invalid numeric versions even when all metadata agrees", t => {
  const root = fixture(t);
  for (const name of ["extension/manifest.json", "package.json", "package-lock.json"]) {
    edit(root, name, value => { value.version = "0.0.0"; if (value.packages) value.packages[""].version = "0.0.0"; });
  }
  assert.throws(() => readPackage(root), /Manifest version/);
});

test("rejects source-file and output-directory symlinks", { skip: process.platform === "win32" }, t => {
  const root = fixture(t), file = path.join(root, "extension/popup/popup.css");
  fs.unlinkSync(file); fs.symlinkSync(path.join(root, "LICENSE"), file);
  assert.throws(() => readPackage(root), /Missing or non-regular file/);
  fs.unlinkSync(file); fs.copyFileSync(path.join(project, "extension/popup/popup.css"), file);
  fs.symlinkSync(path.join(root, "extension"), path.join(root, "dist"));
  assert.throws(() => packageExtension(root), /dist must be a real directory/);
});

test("packaging generates public links from dotenv without including the environment file", t => {
  const root = fixture(t);
  fs.unlinkSync(path.join(root, "extension/popup/links.js"));
  fs.writeFileSync(path.join(root, ".env"), 'DISCORD_INVITE_LINK="https://discord.gg/example"\nGITHUB_REPO_LINK="https://github.com/example/repo"\nPRIVATE_TOKEN=synthetic-secret\n');
  const files = readPackage(root).files;
  const links = files.get("popup/links.js").toString("utf8");
  assert.match(links, /https:\/\/discord.gg\/example/);
  assert.match(links, /https:\/\/github.com\/example\/repo/);
  assert.equal(links.includes("synthetic-secret"), false);
  assert.equal(files.has(".env"), false);
});
