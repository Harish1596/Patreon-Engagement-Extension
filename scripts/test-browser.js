const { spawnSync } = require("node:child_process");
const browser = process.argv[2];
if (!["chrome", "brave"].includes(browser)) {
  console.error("Usage: node scripts/test-browser.js chrome|brave [Playwright arguments]");
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, [require.resolve("@playwright/test/cli"), "test", ...process.argv.slice(3)], {
    stdio: "inherit", env: { ...process.env, TEST_BROWSER: browser }
  });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
