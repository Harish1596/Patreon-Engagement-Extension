const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  workers: 1,
  reporter: "list",
  use: {
    headless: true,
    launchOptions: {
      executablePath: process.env.TEST_BROWSER === "brave"
        ? "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
        : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    }
  }
});
