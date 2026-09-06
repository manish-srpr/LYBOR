import type { Lang } from "./i18n";

/**
 * One place for every user-facing date, time and count string.
 *
 * Two rules the app depends on:
 *  - Everything renders in IST. A worker looking at a 09:00 shift must see a
 *    09:00 check-in, not the UTC instant behind it.
 *  - `workDate` is anchored at midnight UTC as a calendar label, so it is
 *    formatted in UTC on purpose. Formatting it in IST would shift the date.
 */
export const DISPLAY_TIME_ZONE = "Asia/Kolkata";

function locale(lang: Lang): string {
  return lang === "hi" ? "hi-IN" : "en-IN";
}

/** A calendar-only date (workDate, job start/end): formatted in UTC. */
export function formatDay(value: Date, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(locale(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export function formatDayShort(value: Date, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(locale(lang), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(value);
}

export function formatDateRange(start: Date, end: Date, lang: Lang = "en"): string {
  return start.getTime() === end.getTime()
    ? formatDayShort(start, lang)
    : `${formatDayShort(start, lang)} – ${formatDayShort(end, lang)}`;
}

/** A real instant (a GPS punch): formatted in IST. */
export function formatTime(value: Date, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(locale(lang), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: DISPLAY_TIME_ZONE,
  }).format(value);
}

export function formatDateTime(value: Date, lang: Lang = "en"): string {
  return `${formatDayShort(value, lang)}, ${formatTime(value, lang)}`;
}

/** English pluralisation for the small counts this UI actually shows. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${count} ${word}`;
}

/** "1 day" / "0.5 days" / "8 hours" for wage billable units. */
export function unitLabelFor(units: number, unitLabel: string, lang: Lang = "en"): string {
  if (lang === "hi") {
    const hi: Record<string, string> = { hours: "घंटे", days: "दिन", shifts: "शिफ्ट" };
    return `${units} ${hi[unitLabel] ?? unitLabel}`;
  }
  const singular = unitLabel.replace(/s$/u, "");
  return `${units} ${units === 1 ? singular : unitLabel}`;
}

/** Decimal hours, the unit judges and employers read fastest: "8.0 hrs". */
export function formatHoursDecimal(minutes: number): string {
  return `${(minutes / 60).toFixed(1)} hrs`;
}
