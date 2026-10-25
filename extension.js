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
    font: "default", textSize: null, postColor: null,
    paragraphSpacing: null, lineSpacing: null
  });
  // Independently chosen reading colors; no remote assets or branded palettes.
  const colors = Object.freeze({
    postColor: [
      { label: "White", value: "#ffffff", ink: "#222222" },
      { label: "Sepia", value: "#f4ecd8", ink: "#5b4636" },
      { label: "Light Green", value: "#e3eddf", ink: "#222222" },
      { label: "Black", value: "#202124", ink: "#f5f5f0" }
    ]
  });
  function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map((part) => {
      const n = parseInt(part, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  function contrast(a, b) {
    const first = luminance(a), second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  }
  function pageInk(background) {
    return colors.postColor.find((option) => option.value === background)?.ink ?? null;
  }
  function presetColor(key, value) {
    if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) return null;
    const hex = value.toLowerCase();
    const exact = colors[key].find((option) => option.value === hex);
    if (exact) return exact.value;
    // Migrate older full-picker preferences to the nearest offered swatch.
    const distance = (candidate) => [1, 3, 5].reduce((sum, offset) =>
      sum + (parseInt(candidate.slice(offset, offset + 2), 16) - parseInt(hex.slice(offset, offset + 2), 16)) ** 2, 0);
    return [...colors[key]].sort((a, b) => distance(a.value) - distance(b.value))[0].value;
  }
  function normalize(value) {
    const input = value && typeof value === "object" ? value : {};
    const number = (key, min, max, step) => {
      const n = input[key];
      return typeof n === "number" && Number.isFinite(n)
        ? Math.round(Math.min(max, Math.max(min, n)) / step) * step : null;
    };
    // An explicit new value (including Site default) wins over legacy settings.
    // Legacy text overrides are discarded so each post preset stays a matched pair.
    const postColor = presetColor("postColor", Object.hasOwn(input, "postColor") ? input.postColor : input.backgroundColor);
    return {
      font: Object.hasOwn(fonts, input.font) ? input.font : "default",
      textSize: number("textSize", 12, 32, 1),
      postColor,
      paragraphSpacing: number("paragraphSpacing", 0, 48, 1),
      lineSpacing: number("lineSpacing", 1, 2.5, 0.1)
    };
  }
  globalThis.PatreonExtension = { api, call, fonts, colors, contrast, pageInk, defaults, normalize };
})();
