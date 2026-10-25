const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : entry.isFile() && /\.(?:js|cjs)$/.test(file) ? [file] : [];
  });
}
const sources = ["extension", "scripts", "tests"].flatMap(name => files(path.join(root, name)));
sources.push(path.join(root, "playwright.config.js"));
for (const file of sources) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.error || result.status !== 0) {
    if (result.error) console.error(result.error.message);
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode) console.log(`Syntax checked ${sources.length} JavaScript files.`);
