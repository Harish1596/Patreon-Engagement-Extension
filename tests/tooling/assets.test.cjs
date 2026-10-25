const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ASSETS, validatePNG } = require("../../scripts/generate-assets");
const root = path.resolve(__dirname, "../..");

test("release artwork has the required PNG sizes, color formats, and matching store icon", () => {
  for (const asset of ASSETS) {
    const buffer = fs.readFileSync(path.join(root, asset.output));
    assert.doesNotThrow(() => validatePNG(buffer, asset));
    assert.throws(() => validatePNG(buffer, { ...asset, width: asset.width + 1 }), /Invalid PNG/);
    assert.throws(() => validatePNG(Buffer.from("not a PNG"), asset), /Invalid PNG/);
  }
  assert.deepEqual(fs.readFileSync(path.join(root, "extension/icons/icon-128.png")),
    fs.readFileSync(path.join(root, "store-assets/store-icon-128.png")));
});

test("promotional sources use current branding and reference the shared reader icon", () => {
  for (const name of ["small-promo-tile.svg", "marquee-promo-tile.svg"]) {
    const svg = fs.readFileSync(path.join(root, "store-assets", name), "utf8");
    assert.match(svg, /Patreon Reader/);
    assert.match(svg, /href="\.\.\/extension\/icons\/reader\.svg"/);
    assert.doesNotMatch(svg, /Engagement Bar Toggle|eye-slash|PDF|EPUB/);
  }
});
