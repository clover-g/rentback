const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
module.exports = { content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"], theme: { extend: {
  colors: { bg: v("bg"), surface: v("surface"), raised: v("raised"), line: v("line"), ink: v("ink"), mute: v("mute"), faint: v("faint"),
    accent: { DEFAULT: v("accent"), hover: v("accent-hover"), ink: v("accent-ink"), fg: v("accent-fg"), soft: "rgb(var(--accent) / 0.12)" },
    danger: { DEFAULT: v("danger"), fg: v("danger-fg"), soft: "rgb(var(--danger) / 0.10)" },
    warn: { bg: "rgb(var(--warn) / 0.12)", line: "rgb(var(--warn) / 0.30)", fg: v("warn-fg") } },
  fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Hiragino Sans", "Noto Sans JP", "sans-serif"], mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"] },
} }, plugins: [] };
