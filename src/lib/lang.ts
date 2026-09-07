import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  directionOf,
  isSupportedLocale,
  negotiateLocale,
  translatorFor,
  type Direction,
  type Locale,
} from "./i18n";

/**
 * Locale resolution, in strict precedence order:
 *
 *   1. The `lybor_lang` cookie — an explicit choice the person made, and the
 *      only source that survives a browser restart on a shared handset.
 *   2. The Accept-Language header — used to pre-select a sensible option on the
 *      first-launch screen, never treated as a decision the person made.
 *   3. English.
 *
 * The signed-in user's `preferredLanguage` column is deliberately NOT consulted
 * here. That column is a two-value Prisma enum (en | hi) and cannot represent
 * the other eleven locales; reading it would silently downgrade a Punjabi
 * speaker to English on every request. The cookie already satisfies every
 * stated persistence requirement, so widening the enum would be a migration
 * bought for nothing. See the report for the cross-device caveat.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const chosen = store.get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(chosen)) return chosen;

  const headerList = await headers();
  return negotiateLocale(headerList.get("accept-language")) ?? DEFAULT_LOCALE;
}

/**
 * Whether this visitor has actually picked a language.
 *
 * The distinction matters and cannot be recovered from `getLocale()`: header
 * negotiation always returns *something*, so "resolved to English" and "never
 * chose anything" are indistinguishable downstream. Only the presence of a
 * valid cookie counts as a decision, which is what routes a first-time visitor
 * to the language screen and lets a returning one skip it.
 */
export async function hasChosenLocale(): Promise<boolean> {
  const store = await cookies();
  return isSupportedLocale(store.get(LOCALE_COOKIE)?.value);
}

/**
 * What to pre-select on the first-launch screen: the visitor's browser
 * language when we support it, so a Tamil handset opens with தமிழ் already
 * highlighted rather than making them hunt for it.
 */
export async function getSuggestedLocale(): Promise<Locale> {
  const headerList = await headers();
  return negotiateLocale(headerList.get("accept-language")) ?? DEFAULT_LOCALE;
}

/** Historical name; the whole app imports this. */
export const getLang = getLocale;

export async function getDirection(): Promise<Direction> {
  return directionOf(await getLocale());
}

export async function getTranslator() {
  const lang = await getLocale();
  return { lang, locale: lang, t: translatorFor(lang), dir: directionOf(lang) };
}
