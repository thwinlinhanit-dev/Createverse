/**
 * ICU message translator (ADR-0008, task P1-02).
 *
 * - One catalog per locale; `en` is the source of truth for keys.
 * - ICU syntax (placeholders, `select`, `plural`) via `intl-messageformat` —
 *   never string concatenation (ADR-0008 consequences).
 * - Missing locale key falls back to `en` at runtime (TESTING.md section 6:
 *   "key lookup, ICU plurals, fallback to en, locale selection per child").
 * - An unknown key returns the key itself: loud and debuggable, never a crash
 *   mid-render. The `MessageKey` type makes unknown keys a compile error, so
 *   this is a safety net, not a pathway.
 */
import IntlMessageFormat from "intl-messageformat";
import { en } from "./messages.en.ts";
import { zhHant } from "./messages.zhHant.ts";
import type { MessageKey } from "./messages.en.ts";

export type { MessageKey } from "./messages.en.ts";

/** Locales the app ships (ADR-0008: en + zh-Hant, no per-request sniffing). */
export type Locale = "en" | "zh-Hant";
export const LOCALES: readonly Locale[] = ["en", "zh-Hant"];

/** Values interpolated into an ICU message. */
export type MessageValues = Record<string, string | number>;

export type Catalog = Record<string, string>;
export type Catalogs = Record<Locale, Catalog>;

/** The shipped catalogs. Exported for tests and tooling. */
export const catalogs: Catalogs = { en, "zh-Hant": zhHant };

export type Translator = (key: MessageKey, values?: MessageValues) => string;

/**
 * Compiled-message cache keyed by locale + message text. Catalogs are static,
 * so each message is parsed once per process (keeps per-render cost to a
 * format() call — relevant for the Workers CPU budget, P0-09).
 */
const compiled = new Map<string, IntlMessageFormat>();

function format(locale: Locale, message: string, values?: MessageValues): string {
  const cacheKey = locale + "\u0000" + message;
  let formatter = compiled.get(cacheKey);
  if (!formatter) {
    formatter = new IntlMessageFormat(message, locale);
    compiled.set(cacheKey, formatter);
  }
  const output = formatter.format(values);
  // intl-messageformat may return a Promise for async skeletons; our
  // catalogs are synchronous, so a string is expected.
  return typeof output === "string" ? output : String(output);
}

/**
 * Builds a translator bound to one locale (locale comes from the child's
 * profile — ADR-0008: "Locale is per child with a parent default").
 *
 * `source` exists for tests (exercising the en fallback with a deliberately
 * incomplete catalog); production callers use the shipped catalogs.
 */
export function createTranslator(
  locale: Locale,
  source: Catalogs = catalogs,
): Translator {
  return (key, values) => {
    const message = source[locale][key] ?? source.en[key] ?? key;
    return format(locale, message, values);
  };
}

/** One-off translation without keeping a translator (used by tests/tools). */
export function translate(
  locale: Locale,
  key: MessageKey,
  values?: MessageValues,
): string {
  return createTranslator(locale)(key, values);
}

/** True when the string exists in every shipped catalog (tests, tooling). */
export function hasKey(key: string): boolean {
  return LOCALES.every((locale) => key in catalogs[locale]);
}
