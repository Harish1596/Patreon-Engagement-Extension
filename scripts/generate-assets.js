const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const { browserExecutable } = require("./browser-config");

const root = path.resolve(__dirname, "..");
const ASSETS = Object.freeze([
  ...[16, 32, 48, 128].map(size => ({
    source: "extension/icons/reader.svg", output: `extension/icons/icon-${size}.png`,
    width: size, height: size, padding: size === 128 ? 16 : 0, transparent: true
  })),
  { source: "extension/icons/reader.svg", output: "store-assets/store-icon-128.png", width: 128, height: 128, padding: 16, transparent: true },
  { source: "store-assets/small-promo-tile.svg", output: "store-assets/small-promo-tile.png", width: 440, height: 280 },
  { source: "store-assets/marquee-promo-tile.svg", output: "store-assets/marquee-promo-tile.png", width: 1400, height: 560 }
]);

function validatePNG(buffer, asset) {
  if (buffer.length < 33 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      buffer.toString("ascii", 12, 16) !== "IHDR" || buffer.readUInt32BE(16) !== asset.width ||
      buffer.readUInt32BE(20) !== asset.height || buffer[24] !== 8 || buffer[25] !== (asset.transparent ? 6 : 2)) {
    throw new Error(`Invalid PNG dimensions/format: ${asset.output}`);
  }
}

async function generateAssets() {
  const icon = fs.readFileSync(path.join(root, "extension/icons/reader.svg"), "utf8");
  const embeddedIcon = `data:image/svg+xml;base64,${Buffer.from(icon).toString("base64")}`;
  const browser = await chromium.launch({ executablePath: browserExecutable("chrome"), headless: true });
  try {
    for (const asset of ASSETS) {
      const page = await browser.newPage({ viewport: { width: asset.width, height: asset.height },
        deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: "light" });
      await page.route("**/*", route => route.abort());
      const svg = fs.readFileSync(path.join(root, asset.source), "utf8")
        .replaceAll("../extension/icons/reader.svg", embeddedIcon)
        .replace("<svg ", '<svg style="display:block;width:100%;height:100%" ');
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head>
        <body style="margin:0;background:transparent"><main style="width:${asset.width}px;height:${asset.height}px;padding:${asset.padding || 0}px;box-sizing:border-box">${svg}</main></body></html>`);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.querySelectorAll("image")].map(node => new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = resolve;
          image.onerror = () => reject(new Error("Unable to render embedded reader icon"));
          image.src = node.getAttribute("href");
        })));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const buffer = await page.screenshot({ path: path.join(root, asset.output), omitBackground: Boolean(asset.transparent) });
      validatePNG(buffer, asset);
      if (asset.padding) {
        const padded = await page.evaluate(async ({ png, padding }) => {
          const image = new Image();
          image.src = `data:image/png;base64,${png}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width; canvas.height = image.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(image, 0, 0);
          const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
          for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
            if ((x < padding || y < padding || x >= image.width - padding || y >= image.height - padding) &&
                pixels[(y * image.width + x) * 4 + 3] !== 0) return false;
          }
          return pixels[((image.height / 2) * image.width + image.width / 2) * 4 + 3] === 255;
        }, { png: buffer.toString("base64"), padding: asset.padding });
        if (!padded) throw new Error(`Invalid transparent padding: ${asset.output}`);
      }
      console.log(`Generated ${asset.output} (${asset.width}×${asset.height})`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) generateAssets().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { ASSETS, validatePNG };
