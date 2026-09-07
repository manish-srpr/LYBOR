"use client";

import { Languages } from "lucide-react";
import { setLanguageAction } from "@/server/actions/session";
import { LOCALES, translate, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The language selector.
 *
 * A native <select> inside a real form, which matters more here than a custom
 * dropdown would:
 *
 *  - On a phone it opens the OS picker: large, scrollable, familiar, and able
 *    to render every Indic script the device has a font for.
 *  - Keyboard and screen-reader accessible for free - no focus trap, and no
 *    ARIA of our own to get wrong.
 *  - Without JavaScript the fallback button still submits, so a worker on a
 *    cheap handset or a stalled connection can still change language.
 *
 * Options are labelled in their own script only. Someone hunting for Punjabi
 * scans for ਪੰਜਾਬੀ, and needing English to find your own language defeats the
 * purpose of the selector.
 */
export function LanguageToggle({
  lang,
  className,
}: {
  lang: Locale;
  className?: string;
}) {
  const label = translate(lang, "app.chooseLanguage");

  return (
    <form action={setLanguageAction} className={cn("inline-flex", className)}>
      <div className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] ps-2.5 pe-1.5 text-xs font-medium focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:ring-offset-1 focus-within:ring-offset-[var(--background)]">
        <Languages
          className="size-3.5 shrink-0 text-[var(--muted-foreground)]"
          aria-hidden
        />
        <select
          name="lang"
          defaultValue={lang}
          aria-label={label}
          title={label}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="h-8 max-w-[9rem] cursor-pointer appearance-none truncate bg-transparent pe-1 text-xs font-medium text-[var(--foreground)] outline-none"
        >
          {LOCALES.map((locale) => (
            <option key={locale.code} value={locale.code} lang={locale.code}>
              {locale.native}
            </option>
          ))}
        </select>
        {/*
          Redundant once JavaScript runs, load-bearing before it does. The
          select above submits on change; this is the no-JS path.
        */}
        <noscript>
          <button
            type="submit"
            className="rounded-full bg-[var(--primary)] px-2 py-1 text-[11px] font-medium text-[var(--primary-foreground)]"
          >
            {translate(lang, "common.save")}
          </button>
        </noscript>
      </div>
    </form>
  );
}
