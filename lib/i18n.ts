/**
 * Tiny in-house i18n.
 *
 * Translates the *site chrome* (nav, controls, headings) — release/event
 * content stays in its source language. Locale comes from a cookie set by
 * `<LanguageSwitcher>`, falling back to `Accept-Language`, then default.
 *
 * Usage:
 *   - Server components / Route Handlers: `await getServerTranslator()`
 *   - Client components: `useT()` from `@/components/I18nProvider`
 *
 * Adding a language: add `messages/<code>.json`, register it in `MESSAGES`
 * below, and append the code to `SUPPORTED_LOCALES` (and to the
 * `<LanguageSwitcher>` UI map).
 */
import enMessages from "@/messages/en.json";
import zhMessages from "@/messages/zh.json";

export const SUPPORTED_LOCALES = ["en", "zh"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "releaselog_locale";

export type Messages = typeof enMessages;

const MESSAGES: Record<Locale, Messages> = {
  en: enMessages,
  zh: zhMessages as unknown as Messages,
};

export function isLocale(s: string | undefined | null): s is Locale {
  return (
    typeof s === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(s)
  );
}

/**
 * Read locale from request cookie. Server-only because it touches
 * `next/headers`. Wrapped in try/catch so a static-export build (which has
 * no request context) silently falls back to `DEFAULT_LOCALE` instead of
 * throwing.
 *
 * Note: we deliberately do NOT sniff `Accept-Language`. The default is
 * always `DEFAULT_LOCALE` (English) for new visitors; users opt in to
 * another language via the in-page picker, which sets the
 * `releaselog_locale` cookie.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const { cookies } = await import("next/headers");
    const c = await cookies();
    const fromCookie = c.get(LOCALE_COOKIE)?.value;
    if (isLocale(fromCookie)) return fromCookie;
    return DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function getMessagesFor(locale: Locale): Messages {
  return MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
}

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

export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

export type Translator = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

export function makeTranslator(messages: Messages): Translator {
  return (key, vars) => {
    const raw = lookupMessage(messages, key);
    if (raw === undefined) return key;
    return interpolate(raw, vars);
  };
}

/** Convenience for server components: one call returns a ready translator. */
export async function getServerTranslator(): Promise<{
  locale: Locale;
  messages: Messages;
  t: Translator;
}> {
  const locale = await getLocale();
  const messages = getMessagesFor(locale);
  return { locale, messages, t: makeTranslator(messages) };
}
