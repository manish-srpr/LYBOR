import { cookies } from "next/headers";
import { LANG_COOKIE, normaliseLang, translatorFor, type Lang } from "./i18n";

/** Server-side language resolution. Cookie is set by the header toggle. */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return normaliseLang(store.get(LANG_COOKIE)?.value);
}

export async function getTranslator() {
  const lang = await getLang();
  return { lang, t: translatorFor(lang) };
}
