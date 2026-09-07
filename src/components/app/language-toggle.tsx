"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Globe } from "lucide-react";
import { setLanguageAction } from "@/server/actions/session";
import { LOCALES, translate, type Locale } from "@/lib/i18n";
import { applyLocale } from "@/lib/locale-client";
import { cn } from "@/lib/utils";

/**
 * The compact language selector that lives in every header.
 *
 * Deliberately NOT a native <select>. The browser paints an <option> list with
 * its own popup chrome - white on Windows and Chrome - while the option text
 * inherits the app's foreground colour, which in dark mode is near-white. The
 * result was white-on-white text that only appeared under the OS hover
 * highlight. `<option>` background and colour are not reliably stylable, so
 * the element itself had to go.
 *
 * This menu states both background and foreground on every state, so nothing
 * depends on hover to be legible.
 *
 * Switching writes the cookie from the client and calls `router.refresh()`.
 * The server re-renders in the new language while React keeps the existing
 * DOM, so a half-typed sign-in form is not thrown away by changing language.
 * The <noscript> form is the no-JavaScript path.
 */
export function LanguageToggle({
  lang,
  className,
}: {
  lang: Locale;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const label = translate(lang, "app.languageChangeAnytime");
  const current = LOCALES.find((l) => l.code === lang) ?? LOCALES[0];

  // Dismiss on outside click or Escape, the two things a menu must always do.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(locale: Locale) {
    setOpen(false);
    if (locale === lang) return;
    applyLocale(locale);
    router.refresh();
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${label}: ${current.english}`}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
          "border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]",
          "hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]",
        )}
      >
        <Globe className="size-3.5 shrink-0" aria-hidden />
        <span lang={current.code} className="max-w-[7rem] truncate">
          {current.native}
        </span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={label}
          // `end-0` rather than `right-0` so the panel hangs off the correct
          // edge once the document flips to RTL for Urdu.
          className={cn(
            "absolute end-0 z-50 mt-2 max-h-[70vh] w-56 overflow-y-auto rounded-xl border p-1 shadow-lg",
            "border-[var(--border)] bg-[var(--card)]",
          )}
        >
          {LOCALES.map((locale) => {
            const isCurrent = locale.code === lang;
            return (
              <button
                key={locale.code}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                lang={locale.code}
                dir={locale.dir}
                onClick={() => choose(locale.code)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-start",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                  isCurrent
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-transparent text-[var(--card-foreground)] hover:bg-[var(--muted)]",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {locale.native}
                  </span>
                  <span
                    lang="en"
                    dir="ltr"
                    className={cn(
                      "block truncate text-[11px]",
                      isCurrent
                        ? "text-[var(--primary-foreground)]/80"
                        : "text-[var(--muted-foreground)]",
                    )}
                  >
                    {locale.english}
                  </span>
                </span>
                {isCurrent ? <Check className="size-4 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {/*
        Without JavaScript the menu above never opens, so this posts the choice
        the old-fashioned way. Kept visually hidden until it is the only option.
      */}
      <noscript>
        <form action={setLanguageAction} className="mt-1 flex flex-wrap gap-1">
          {LOCALES.map((locale) => (
            <button
              key={locale.code}
              type="submit"
              name="lang"
              value={locale.code}
              lang={locale.code}
              className={cn(
                "rounded-full border px-2 py-1 text-[11px]",
                locale.code === lang
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]",
              )}
            >
              {locale.native}
            </button>
          ))}
        </form>
      </noscript>
    </div>
  );
}
