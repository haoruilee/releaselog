"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "./I18nProvider";

const LOCALE_COOKIE = "releaselog_locale";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1y

const LOCALES: { code: string; label: string; ariaLabel: string }[] = [
  { code: "en", label: "EN", ariaLabel: "English" },
  { code: "zh", label: "中", ariaLabel: "中文" },
];

interface Props {
  className?: string;
  /** Slim variant for in-content placement; default is the full pill group. */
  size?: "sm" | "md";
}

export function LanguageSwitcher({ className, size = "sm" }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const locale = useLocale();
  const t = useT();

  const setLocale = (next: string) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  };

  const buttonPad =
    size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <div
      className={
        className ??
        "inline-flex items-center gap-0.5 rounded-full bg-empty-cell/60 p-0.5 ring-1 ring-black/10"
      }
      role="group"
      aria-label={t("language.label")}
    >
      {LOCALES.map(({ code, label, ariaLabel }) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            aria-label={t("language.switch_to_aria", { label: ariaLabel })}
            className={`rounded-full font-semibold transition-colors ${buttonPad} ${
              active
                ? "bg-panel text-primary shadow-sm"
                : "text-secondary hover:text-primary"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
