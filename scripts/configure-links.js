const fs = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");

function createLinksScript(root, env = process.env, envFile = path.join(root, ".env")) {
  const local = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, "utf8")) : {};
  const links = {};
  for (const [name, key] of [["discord", "DISCORD_INVITE_LINK"], ["github", "GITHUB_REPO_LINK"]]) {
    const value = (env[key] ?? local[key] ?? "").trim();
    if (value) {
      let url;
      try { url = new URL(value); } catch (_) { /* Validated below. */ }
      if (!url || url.protocol !== "https:" || url.username || url.password) {
        throw new Error(`${key} must be an HTTPS URL without credentials.`);
      }
    }
    links[name] = value;
  }
  return `// Generated public popup URLs. Regenerate with npm run configure-links.\nglobalThis.PatreonLinks = ${JSON.stringify(links)};\n`;
}

if (require.main === module) {
  try {
    const root = path.resolve(__dirname, "..");
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== "--env-file")) {
      throw new Error("Usage: npm run configure-links -- [--env-file path]");
    }
    const envFile = args.length ? path.resolve(args[1]) : path.join(root, ".env");
    if (args.length && !fs.existsSync(envFile)) throw new Error("Environment file not found.");
    fs.writeFileSync(path.join(root, "extension/popup/links.js"), createLinksScript(root, process.env, envFile));
    console.log("Configured public popup links. Reload the extension to apply changes.");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { createLinksScript };
