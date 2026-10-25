/* Shared by the popup and the isolated content-script world. */
(() => {
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  function call(target, method, ...args) {
    if (globalThis.browser?.runtime) return target[method](...args);
    return new Promise((resolve, reject) => {
      target[method](...args, (result) => {
        const error = api.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(result);
      });
    });
  }
  const fonts = Object.freeze({
    default: { label: "Patreon default", value: null },
    systemSans: { label: "System Sans", value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
    arial: { label: "Arial", value: "Arial, Helvetica, sans-serif" },
    verdana: { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
    trebuchet: { label: "Trebuchet", value: '"Trebuchet MS", Arial, sans-serif' },
    georgia: { label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
    times: { label: "Times", value: '"Times New Roman", Times, serif' },
    monospace: { label: "Monospace", value: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace' }
  });
  const defaults = Object.freeze({
    font: "default", textSize: null, textColor: null,
    backgroundColor: null, paragraphSpacing: null, lineSpacing: null
  });
  function normalize(value) {
    const input = value && typeof value === "object" ? value : {};
    const number = (key, min, max, step) => {
      const n = input[key];
      return typeof n === "number" && Number.isFinite(n)
        ? Math.round(Math.min(max, Math.max(min, n)) / step) * step : null;
    };
    const color = (key) => typeof input[key] === "string" && /^#[0-9a-f]{6}$/i.test(input[key])
      ? input[key].toLowerCase() : null;
    return {
      font: Object.hasOwn(fonts, input.font) ? input.font : "default",
      textSize: number("textSize", 12, 32, 1),
      textColor: color("textColor"),
      backgroundColor: color("backgroundColor"),
      paragraphSpacing: number("paragraphSpacing", 0, 48, 1),
      lineSpacing: number("lineSpacing", 1, 2.5, 0.1)
    };
  }
  globalThis.PatreonExtension = { api, call, fonts, defaults, normalize };
})();
