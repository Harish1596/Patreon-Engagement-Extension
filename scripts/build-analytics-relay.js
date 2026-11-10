/* Produces a self-contained module for Cloudflare's dashboard editor. */
const fs = require("node:fs");
const path = require("node:path");
function build(target = path.resolve(__dirname, "../dist/patreon-reader-analytics-dev.mjs")) {
  const source = ["../extension/shared/telemetry-schema.js", "../relay/worker.js"]
    .map(name => fs.readFileSync(path.resolve(__dirname, name), "utf8")).join("\n");
  const entry = '\nexport default { fetch: (request, env) => globalThis.PatreonAnalyticsRelay.handle(request, env) };\n';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source + entry);
  return target;
}
if (require.main === module) console.log(build());
module.exports = { build };
