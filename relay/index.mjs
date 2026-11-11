import "../extension/shared/telemetry-schema.js";
import "./worker.js";
export default { fetch: (request, env) => globalThis.PatreonAnalyticsRelay.handle(request, env) };
