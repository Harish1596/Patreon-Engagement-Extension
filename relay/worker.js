/* Database-free forwarding. Never log requests, upstream URLs or errors. */
(() => {
  const response = (status, value) => new Response(JSON.stringify(value), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
  async function readJson(request) {
    if (!request.body) return null;
    const reader = request.body.getReader();
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) { await reader.cancel(); return null; }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch { return null; }
    finally { reader.releaseLock(); }
  }
  async function handle(request, env, upstream = fetch) {
    const url = new URL(request.url);
    const configured = /^G-[A-Z0-9]+$/.test(env.GA_MEASUREMENT_ID || "")
      && typeof env.GA_API_SECRET === "string" && env.GA_API_SECRET.length > 0;
    if (url.pathname === "/health" && request.method === "GET") return response(configured ? 200 : 503, { ready: configured });
    if (url.pathname !== "/events") return response(404, { error: "Not found" });
    if (request.method !== "POST") return response(405, { error: "POST required" });
    if (!configured) return response(503, { error: "Relay unavailable" });
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return response(400, { error: "Invalid request" });
    const body = globalThis.PatreonTelemetrySchema.envelope(await readJson(request));
    if (!body) return response(400, { error: "Invalid request" });
    const groups = new Map();
    for (const event of body.events) {
      const group = groups.get(event.occurred_at_ms) || [];
      group.push({ name: event.name, params: { schema_version: 1, extension_version: body.extension_version,
        ...(event.scope ? { scope: event.scope } : {}), ...(env.GA_DEBUG_MODE === "true" ? { debug_mode: 1 } : {}) } });
      groups.set(event.occurred_at_ms, group);
    }
    const endpoint = new URL("https://www.google-analytics.com/mp/collect");
    endpoint.searchParams.set("measurement_id", env.GA_MEASUREMENT_ID);
    endpoint.searchParams.set("api_secret", env.GA_API_SECRET);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      for (const [timestamp, events] of groups) {
        const result = await upstream(endpoint.href, {
          method: "POST", headers: { "content-type": "application/json" },
          credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: controller.signal,
          body: JSON.stringify({ client_id: body.client_id, timestamp_micros: timestamp * 1000,
            consent: { ad_user_data: "DENIED", ad_personalization: "DENIED" }, events })
        });
        const ok = result.ok;
        await result.body?.cancel();
        if (!ok) return response(503, { error: "Forwarding unavailable" });
      }
      return response(202, { accepted: true });
    } catch { return response(503, { error: "Forwarding unavailable" }); }
    finally { clearTimeout(timer); }
  }
  globalThis.PatreonAnalyticsRelay = Object.freeze({ handle });
})();
