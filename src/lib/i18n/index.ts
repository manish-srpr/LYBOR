import en, {
  type MessageKey,
  type Messages,
  type PartialMessages,
} from "./messages/en";
import as from "./messages/as";
import bn from "./messages/bn";
import gu from "./messages/gu";
import hi from "./messages/hi";
import kn from "./messages/kn";
import ml from "./messages/ml";
import mr from "./messages/mr";
import or from "./messages/or";
import pa from "./messages/pa";
import ta from "./messages/ta";
import te from "./messages/te";
import ur from "./messages/ur";

import {
  DEFAULT_LOCALE,
  intlLocale,
  type Locale,
} from "./locales";

export * from "./locales";
export type { MessageKey, Messages };
/** Historical alias - the app shell and nav items are typed against it. */
export type TranslationKey = MessageKey;

/**
 * All catalogs are plain objects imported statically.
 *
 * Thirteen locales of short UI strings is a few tens of kilobytes of server-side
 * data, and every page here is server-rendered - the catalogs never reach the
 * browser bundle. Dynamic import would buy nothing and would make `t()` async
 * in server components for no benefit.
 */
const CATALOGS: Record<Locale, PartialMessages> = {
  en,
  hi,
  pa,
  ur,
  bn,
  mr,
  gu,
  ta,
  te,
  kn,
  ml,
  or,
  as,
};

/** Exposed for the coverage and integrity check script. */
export const CATALOGS_FOR_TEST = CATALOGS;

/** Reported once per key per process so a dev sees gaps without log spam. */
const warned = new Set<string>();

function reportMissing(locale: Locale, key: string) {
  if (process.env.NODE_ENV === "production") return;
  const id = `${locale}:${key}`;
  if (warned.has(id)) return;
  warned.add(id);
  console.warn(`[i18n] missing "${key}" for locale "${locale}" - falling back to English`);
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? whole : String(value);
  });
}

export type TranslateParams = Record<string, string | number | undefined | null>;

/**
 * Resolves a key for a locale, falling back to English and finally to the key
 * itself. It never returns undefined, so a missing translation degrades to
 * readable English rather than a blank button.
 */
function resolve(locale: Locale, key: string): string {
  const catalog = CATALOGS[locale] as Record<string, string | undefined>;
  const hit = catalog?.[key];
  if (hit !== undefined) return hit;

  if (locale !== DEFAULT_LOCALE) reportMissing(locale, key);

  const fallback = (en as Record<string, string | undefined>)[key];
  if (fallback !== undefined) return fallback;

  reportMissing(DEFAULT_LOCALE, key);
  return key;
}

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: TranslateParams,
): string {
  return interpolate(resolve(locale, key), params);
}

/**
 * Plural lookup. `key` is the base; the catalog holds `key_one` / `key_other`.
 *
 * Indic plural rules split at one for every language supported here, so a
 * one/other pair is sufficient. Languages needing more categories would add
 * `_few` / `_many` keys and a rule here rather than changing call sites.
 */
export function translatePlural(
  locale: Locale,
  key: string,
  count: number,
  params?: TranslateParams,
): string {
  const suffix = count === 1 ? "_one" : "_other";
  return interpolate(resolve(locale, `${key}${suffix}`), { count, ...params });
}

export type Translator = {
  (key: MessageKey, params?: TranslateParams): string;
  /** Plural form: `t.plural("job.applicantCount", 3)`. */
  plural: (key: string, count: number, params?: TranslateParams) => string;
  locale: Locale;
};

export function translatorFor(locale: Locale): Translator {
  const t = ((key: MessageKey, params?: TranslateParams) =>
    translate(locale, key, params)) as Translator;
  t.plural = (key, count, params) => translatePlural(locale, key, count, params);
  t.locale = locale;
  return t;
}

/**
 * Picks the right side of an en/hi string pair.
 *
 * Retained for the parts of the app still carrying inline bilingual prose.
 * Anything other than Hindi gets the English side, which is the documented
 * fallback rather than an error.
 */
export function pick(locale: Locale, enText: string, hiText: string): string {
  return locale === "hi" ? hiText : enText;
}

/** How complete each catalog is. Used by the coverage check script. */
export function coverage(): Record<Locale, { done: number; total: number; pct: number }> {
  const keys = Object.keys(en) as MessageKey[];
  const out = {} as Record<Locale, { done: number; total: number; pct: number }>;
  for (const [code, catalog] of Object.entries(CATALOGS) as [Locale, PartialMessages][]) {
    const done = keys.filter((k) => catalog[k] !== undefined).length;
    out[code] = { done, total: keys.length, pct: Math.round((done / keys.length) * 100) };
  }
  return out;
}

// --- Locale-aware formatting ----------------------------------------------
// Presentation only. Money is still integer paise everywhere and no
// calculation reads these.

export function formatNumberLocalised(locale: Locale, value: number): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

export function formatPercentLocalised(locale: Locale, fraction: number): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(fraction);
}
