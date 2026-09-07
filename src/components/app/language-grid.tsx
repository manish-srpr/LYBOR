"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Languages } from "lucide-react";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { applyLocale } from "@/lib/locale-client";
import { cn } from "@/lib/utils";

/**
 * Copy for every locale, passed in from the server.
 *
 * Only these few strings cross the boundary - not the catalogs, which stay on
 * the server. That keeps the first-launch bundle at a couple of kilobytes
 * while still letting the heading and the button re-render in the tapped
 * language instantly, so someone sees their language working before they
 * commit to it.
 */
export type LocaleCopy = Record<
  Locale,
  { title: string; body: string; continue: string; selected: string }
>;

export function LanguageGrid({
  initial,
  copy,
  next,
}: {
  initial: Locale;
  copy: LocaleCopy;
  next: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Locale>(initial);
  const [saving, setSaving] = useState(false);

  const active = copy[selected];
  const dir = LOCALES.find((l) => l.code === selected)?.dir ?? "ltr";

  function commit() {
    setSaving(true);
    // Written client-side then refreshed, rather than posted, so the whole
    // screen does not have to round-trip before the person sees their choice.
    applyLocale(selected);
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col" dir={dir} lang={selected}>
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden
          className="grid size-12 place-items-center rounded-2xl bg-[var(--primary)] text-lg font-semibold text-[var(--primary-foreground)]"
        >
          L
        </span>
        <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          LYBOR
        </p>

        <h1 className="mt-4 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Languages className="size-5 text-[var(--primary)]" aria-hidden />
          {active.title}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
          {active.body}
        </p>
      </div>

      {/*
        A radio group, not a listbox: exactly one language applies, and radio
        semantics give screen readers "2 of 13, selected" for free. Arrow keys
        move between options natively; only the selected option is tabbable, so
        the grid is one tab stop rather than thirteen.
      */}
      <div
        role="radiogroup"
        aria-label={active.title}
        className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {LOCALES.map((locale) => {
          const isSelected = locale.code === selected;
          return (
            <button
              key={locale.code}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              lang={locale.code}
              dir={locale.dir}
              onClick={() => setSelected(locale.code)}
              onKeyDown={(event) => {
                // Roving focus across the group, wrapping at both ends.
                const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
                if (!keys.includes(event.key)) return;
                event.preventDefault();
                const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
                const index = LOCALES.findIndex((l) => l.code === selected);
                const nextLocale =
                  LOCALES[(index + step + LOCALES.length) % LOCALES.length];
                setSelected(nextLocale.code);
                document
                  .querySelector<HTMLButtonElement>(`[data-locale="${nextLocale.code}"]`)
                  ?.focus();
              }}
              data-locale={locale.code}
              className={cn(
                // Background AND foreground are both stated on every state.
                // Inheriting either one is what made the old native dropdown
                // render near-white text on the browser's white popup.
                "flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                isSelected
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] hover:border-[var(--primary)]/60 hover:bg-[var(--muted)]",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-medium">
                  {locale.native}
                </span>
                {/* The English name makes every row cross-identifiable even if
                    the device lacks a font for that script. */}
                <span
                  lang="en"
                  dir="ltr"
                  className={cn(
                    "block truncate text-xs",
                    isSelected
                      ? "text-[var(--primary-foreground)]/80"
                      : "text-[var(--muted-foreground)]",
                  )}
                >
                  {locale.english}
                </span>
              </span>
              {isSelected ? (
                <>
                  <Check className="size-5 shrink-0" aria-hidden />
                  <span className="sr-only">{active.selected}</span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={commit}
        disabled={saving}
        className={cn(
          "mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-medium",
          "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        {active.continue}
        {/* Points the way forward, so it mirrors with the writing direction. */}
        <ArrowRight className="size-4 rtl-flip" aria-hidden />
      </button>
    </div>
  );
}
