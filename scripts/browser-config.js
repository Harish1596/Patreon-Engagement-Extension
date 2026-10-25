const fs = require("node:fs");
const path = require("node:path");

function browserExecutable(browser, { platform = process.platform, env = process.env, exists = fs.existsSync } = {}) {
  if (!["chrome", "brave"].includes(browser)) throw new Error(`Unsupported test browser: ${browser}`);
  const variable = browser === "brave" ? "BRAVE_EXECUTABLE" : "CHROME_EXECUTABLE";
  const override = env[variable] || env.BROWSER_EXECUTABLE;
  if (override) {
    if (!exists(override)) throw new Error(`${variable}/BROWSER_EXECUTABLE does not exist: ${override}`);
    return override;
  }
  let candidates;
  if (platform === "darwin") {
    candidates = [browser === "brave"
      ? "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
      : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  } else if (platform === "win32") {
    const relative = browser === "brave" ? "BraveSoftware/Brave-Browser/Application/brave.exe" : "Google/Chrome/Application/chrome.exe";
    candidates = [env.ProgramFiles, env["ProgramFiles(x86)"], env.LOCALAPPDATA].filter(Boolean)
      .map(directory => path.win32.join(directory, relative));
  } else {
    candidates = browser === "brave" ? ["/usr/bin/brave-browser", "/usr/bin/brave-browser-stable", "/opt/brave.com/brave/brave-browser"]
      : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  }
  const found = candidates.find(exists);
  if (!found) throw new Error(`Cannot find ${browser}. Install it or set ${variable} to its executable path.`);
  return found;
}

module.exports = { browserExecutable };
