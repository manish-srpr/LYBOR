/**
 * The locale registry: the single place that knows which languages exist.
 *
 * Every entry carries its own native name (a worker should never need English
 * to find their language), its writing direction, and the BCP-47 tag used for
 * Intl date, number and currency formatting.
 */

export const LOCALES = [
  { code: "en", native: "English", english: "English", dir: "ltr", intl: "en-IN" },
  { code: "hi", native: "हिंदी", english: "Hindi", dir: "ltr", intl: "hi-IN" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi", dir: "ltr", intl: "pa-IN" },
  { code: "ur", native: "اردو", english: "Urdu", dir: "rtl", intl: "ur-IN" },
  { code: "bn", native: "বাংলা", english: "Bengali", dir: "ltr", intl: "bn-IN" },
  { code: "mr", native: "मराठी", english: "Marathi", dir: "ltr", intl: "mr-IN" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", dir: "ltr", intl: "gu-IN" },
  { code: "ta", native: "தமிழ்", english: "Tamil", dir: "ltr", intl: "ta-IN" },
  { code: "te", native: "తెలుగు", english: "Telugu", dir: "ltr", intl: "te-IN" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", dir: "ltr", intl: "kn-IN" },
  { code: "ml", native: "മലയാളം", english: "Malayalam", dir: "ltr", intl: "ml-IN" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia", dir: "ltr", intl: "or-IN" },
  { code: "as", native: "অসমীয়া", english: "Assamese", dir: "ltr", intl: "as-IN" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export type Direction = "ltr" | "rtl";

/**
 * Historical alias. The app was bilingual before it was multilingual and every
 * component signature says `lang: Lang`; keeping the name means adding eleven
 * languages did not touch a single component prop type.
 */
export type Lang = Locale;

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lybor_lang";
/** Historical name, still imported by the session actions. */
export const LANG_COOKIE = LOCALE_COOKIE;

const BY_CODE = new Map(LOCALES.map((l) => [l.code, l]));

export function localeMeta(locale: Locale) {
  return BY_CODE.get(locale) ?? LOCALES[0];
}

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && BY_CODE.has(value as Locale);
}

/** Anything unrecognised becomes English rather than throwing. */
export function normaliseLocale(value: unknown): Locale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

/** Historical name kept so the existing session actions keep compiling. */
export const normaliseLang = normaliseLocale;

export function directionOf(locale: Locale): Direction {
  return localeMeta(locale).dir;
}

export function isRtl(locale: Locale): boolean {
  return directionOf(locale) === "rtl";
}

export function intlLocale(locale: Locale): string {
  return localeMeta(locale).intl;
}

/**
 * Picks the best supported locale from an Accept-Language header. Used only
 * when the visitor has never chosen one, so a first-time Tamil speaker on a
 * Tamil phone gets Tamil rather than English.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split("=")[1]) || 0 : 1 };
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    // Match the base subtag, so "ta-IN" and "ta" both resolve to Tamil.
    const base = tag.split("-")[0];
    if (isSupportedLocale(base)) return base;
  }
  return null;
}
