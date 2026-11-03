import type { CSSProperties } from "react";
import { defaultTheme } from "@/data/defaultTheme";
import type { ThemeConfig } from "@/data/types";

export function resolveTheme(theme?: ThemeConfig): ThemeConfig {
  return { ...defaultTheme, ...theme };
}

export function themeToCssVars(theme: ThemeConfig): CSSProperties {
  // Entity colors identify a feed; the reading surface stays consistently light.
  // Darken unusually bright accents so normal-size links remain readable on white.
  const match = /^#([a-f\d]{6})$/i.exec(theme.primary);
  let channels = match ? [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16)) : [194, 65, 12];
  const luminance = (values: number[]) => values.map(v => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  for (let i = 0; i < 16 && 1.05 / (luminance(channels) + .05) < 4.5; i++) channels = channels.map(v => Math.floor(v * .9));
  const accent = `#${channels.map(v => v.toString(16).padStart(2, "0")).join("")}`;
  return {
    "--bg-page": "#ffffff", "--bg-panel": "#f7f8fa", "--bg-empty-cell": "#f2f3f5",
    "--bg-active-cell": "#fff0e6", "--text-primary": "#191b20", "--text-secondary": "#62666f",
    "--accent": accent, "--accent-number": accent,
    "--accent-rgb": channels.join(" "),
  } as CSSProperties;
}
