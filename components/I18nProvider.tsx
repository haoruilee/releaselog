"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

type Vars = Record<string, string | number>;
type Translator = (key: string, vars?: Vars) => string;

interface I18nContextValue {
  locale: string;
  t: Translator;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function lookupMessage(messages: unknown, key: string): string | undefined {
  const parts = key.split(".");
  let cur: unknown = messages;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

/**
 * Mounts the messages dictionary in React context so that `useT()` and
 * `useLocale()` work in any client component below it. Server components
 * should keep using `getServerTranslator()` directly.
 */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: Record<string, unknown>;
  children: ReactNode;
}) {
  const t = useCallback<Translator>(
    (key, vars) => {
      const raw = lookupMessage(messages, key);
      if (raw === undefined) return key;
      return interpolate(raw, vars);
    },
    [messages],
  );

  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useT(): Translator {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return (key) => key;
  }
  return ctx.t;
}

export function useLocale(): string {
  const ctx = useContext(I18nContext);
  return ctx?.locale ?? "en";
}
