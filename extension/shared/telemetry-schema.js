/* Deliberately narrow usage schema. No page data or free-form parameters. */
(() => {
  const ownKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every(key => keys.includes(key));
  const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  function event(value, now) {
    if (!ownKeys(value, ["name", "occurred_at_ms", "scope"])) return null;
    if (!["pr_reader_used", "pr_bar_hidden", "pr_download_started"].includes(value.name)) return null;
    if (!Number.isSafeInteger(value.occurred_at_ms) || value.occurred_at_ms < now - 86400000
      || value.occurred_at_ms > now + 300000) return null;
    if (value.name === "pr_download_started") {
      if (!["post", "collection"].includes(value.scope)) return null;
    } else if (Object.hasOwn(value, "scope")) return null;
    return { name: value.name, occurred_at_ms: value.occurred_at_ms,
      ...(value.name === "pr_download_started" ? { scope: value.scope } : {}) };
  }
  function envelope(value, now = Date.now()) {
    if (!ownKeys(value, ["schema_version", "client_id", "extension_version", "events"])
      || value.schema_version !== 1 || !uuid(value.client_id)
      || typeof value.extension_version !== "string" || !/^\d{1,5}(?:\.\d{1,5}){0,3}$/.test(value.extension_version)
      || !Array.isArray(value.events) || value.events.length < 1 || value.events.length > 20) return null;
    const events = value.events.map(item => event(item, now));
    if (events.some(item => item === null)) return null;
    return { schema_version: 1, client_id: value.client_id, extension_version: value.extension_version, events };
  }
  globalThis.PatreonTelemetrySchema = Object.freeze({ event, envelope, uuid });
})();
