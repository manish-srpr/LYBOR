import { LanguageGrid, type LocaleCopy } from "@/components/app/language-grid";
import { LOCALES, resolveNextPath, translate, type Locale } from "@/lib/i18n";
import { getLocale, getSuggestedLocale, hasChosenLocale } from "@/lib/lang";

/**
 * The first-launch language screen.
 *
 * This is the first thing a new visitor sees - before the authentication
 * gateway, and certainly before any product surface. It carries the wordmark,
 * the question, and the thirteen languages; nothing else.
 *
 * It stays reachable afterwards so the header selector on every other screen
 * has somewhere to send someone who wants the full list back.
 */
export default async function LanguagePage(props: PageProps<"/language">) {
  const searchParams = await props.searchParams;

  // Pre-select what they already chose; failing that, what their handset asks
  // for. A Tamil phone should open with தமிழ் highlighted, not English.
  const chosen = await hasChosenLocale();
  const initial: Locale = chosen ? await getLocale() : await getSuggestedLocale();

  // Only same-origin paths, so `?next=` cannot be used to bounce somebody off
  // the site after they pick a language.
  const next = resolveNextPath(searchParams.next);

  // Just the strings the grid needs, for all thirteen locales. The catalogs
  // themselves never reach the browser.
  const copy = Object.fromEntries(
    LOCALES.map((locale) => [
      locale.code,
      {
        title: translate(locale.code, "app.chooseLanguage"),
        body: translate(locale.code, "app.chooseLanguageBody"),
        continue: translate(locale.code, "common.continue"),
        selected: translate(locale.code, "app.languageSelected"),
      },
    ]),
  ) as LocaleCopy;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
      <LanguageGrid initial={initial} copy={copy} next={next} />
    </main>
  );
}
