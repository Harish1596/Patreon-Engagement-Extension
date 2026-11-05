const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createLinksScript } = require("../../scripts/configure-links");

test("includes only public link settings, with environment overriding dotenv", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "popup-links-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, ".env"), 'DISCORD_INVITE_LINK="https://discord.gg/example"\nGITHUB_REPO_LINK="https://github.com/example/repo"\nPRIVATE_TOKEN=secret\n');
  const source = createLinksScript(root, { GITHUB_REPO_LINK: "https://github.com/example/override" });
  const context = {};
  vm.runInNewContext(source, context);
  assert.equal(context.PatreonLinks.discord, "https://discord.gg/example");
  assert.equal(context.PatreonLinks.github, "https://github.com/example/override");
  assert.equal(source.includes("secret"), false);
  assert.throws(() => createLinksScript(root, { DISCORD_INVITE_LINK: "javascript:alert(1)" }), /DISCORD_INVITE_LINK must be an HTTPS URL/);
  assert.throws(() => createLinksScript(root, { GITHUB_REPO_LINK: "https://user:password@example.com" }), /GITHUB_REPO_LINK must be an HTTPS URL/);
});
