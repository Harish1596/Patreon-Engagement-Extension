const { defineConfig } = require("@playwright/test");
const { browserExecutable } = require("./scripts/browser-config");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  workers: 1,
  reporter: "list",
  use: {
    headless: true,
    launchOptions: {
      executablePath: browserExecutable(process.env.TEST_BROWSER || "chrome")
    }
  }
});
