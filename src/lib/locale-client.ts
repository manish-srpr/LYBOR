import { LOCALE_COOKIE, type Locale } from "./i18n/locales";

/** One year, matching what the server action writes. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Writes the locale preference from the browser.
 *
 * The locale cookie is deliberately not httpOnly - it is a display preference,
 * not a credential - which lets a language switch happen without a form POST.
 * Paired with `router.refresh()`, the server re-renders in the new language
 * while React keeps the existing DOM, so a half-typed sign-in form survives
 * the switch. A server action would remount the page and lose it.
 *
 * The server action remains the no-JavaScript path, and the server re-reads
 * this cookie on every request, so the two agree.
 */
export function applyLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
