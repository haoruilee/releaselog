import type { CSSProperties } from "react";
import { defaultTheme } from "@/data/defaultTheme";
import type { ThemeConfig } from "@/data/types";

export function resolveTheme(theme?: ThemeConfig): ThemeConfig {
  return { ...defaultTheme, ...theme };
}

export function themeToCssVars(theme: ThemeConfig): CSSProperties {
  return {
    "--bg-page": theme.bgPage,
    "--bg-panel": theme.bgPanel,
    "--bg-empty-cell": theme.bgEmptyCell,
    "--bg-active-cell": theme.bgActiveCell,
    "--text-primary": theme.textPrimary,
    "--text-secondary": theme.textSecondary,
    "--accent": theme.primary,
    "--accent-number": theme.accentNumber,
  } as CSSProperties;
}
