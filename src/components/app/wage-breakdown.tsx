import { Calculator } from "lucide-react";
import { formatHoursDecimal, unitLabelFor } from "@/lib/format";
import { formatMinutes, formatPaise } from "@/lib/money";
import type { WageBreakdown } from "@/lib/wages";
import type { Lang } from "@/lib/i18n";

const RATE_SUFFIX = {
  HOURLY: { en: "/hr", hi: "/घंटा" },
  DAILY: { en: "/day", hi: "/दिन" },
  SHIFT: { en: "/shift", hi: "/शिफ्ट" },
};

/**
 * The same breakdown object is rendered identically for worker, employer and
 * admin. Nobody sees a different number from anybody else - that symmetry is
 * the whole point of the transparent wage promise.
 */
export function WageBreakdownTable({
  breakdown,
  lang,
}: {
  breakdown: WageBreakdown;
  lang: Lang;
}) {
  const isHi = lang === "hi";
  const suffix = RATE_SUFFIX[breakdown.wageType][isHi ? "hi" : "en"];

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
      aria-label={isHi ? "मजदूरी की गणना" : "Wage calculation"}
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2.5">
        <Calculator className="size-4 text-[var(--primary)]" aria-hidden />
        <h3 className="text-sm font-semibold">
          {isHi ? "मजदूरी की गणना" : "Wage calculation"}
        </h3>
      </div>

      {/* The three numbers that answer "how did you get this?" at a glance. */}
      <dl className="grid grid-cols-3 divide-x divide-[var(--border)] border-b border-[var(--border)]">
        <div className="px-3 py-3 text-center">
          <dt className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
            {isHi ? "दर" : "Rate"}
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">
            {formatPaise(breakdown.rateAppliedPaise)}
            <span className="text-xs font-normal text-[var(--muted-foreground)]">
              {suffix}
            </span>
          </dd>
        </div>
        <div className="px-3 py-3 text-center">
          <dt className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
            {isHi ? "सत्यापित" : "Verified"}
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">
            {formatHoursDecimal(breakdown.verifiedMinutes)}
          </dd>
        </div>
        <div className="px-3 py-3 text-center">
          <dt className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
            {isHi ? "कुल" : "Gross"}
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--primary)]">
            {formatPaise(breakdown.grossAmountPaise)}
          </dd>
        </div>
      </dl>

      <p className="px-4 pt-3 text-sm text-[var(--muted-foreground)]">
        {isHi ? breakdown.summaryHi : breakdown.summary}
      </p>

      <div className="overflow-x-auto p-4 pt-3">
        <table className="w-full text-sm">
          <tbody>
            {breakdown.lines.map((line, index) => {
              const isNet = index === breakdown.lines.length - 1;
              return (
                <tr
                  key={`${line.label}-${index}`}
                  className={
                    isNet
                      ? "border-t-2 border-[var(--border)]"
                      : "border-t border-[var(--border)] first:border-t-0"
                  }
                >
                  <td className="py-2 pr-3 align-top">
                    <div className={isNet ? "font-semibold" : "font-medium"}>
                      {isHi ? line.labelHi : line.label}
                    </div>
                    <div className="text-xs font-normal text-[var(--muted-foreground)]">
                      {line.detail}
                    </div>
                  </td>
                  <td
                    className={
                      isNet
                        ? "whitespace-nowrap py-2 text-right align-top text-lg font-bold tabular-nums text-[var(--success)]"
                        : "whitespace-nowrap py-2 text-right align-top tabular-nums"
                    }
                  >
                    {line.amountPaise === undefined
                      ? "—"
                      : formatPaise(line.amountPaise)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[var(--border)] bg-[var(--muted)]/30 px-4 py-2.5 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-[var(--muted-foreground)]">
            {isHi ? "सत्यापित समय" : "Verified time"}
          </dt>
          <dd className="font-medium tabular-nums">
            {formatMinutes(breakdown.verifiedMinutes)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">
            {isHi ? "लागू दर" : "Rate applied"}
          </dt>
          <dd className="font-medium tabular-nums">
            {formatPaise(breakdown.rateAppliedPaise)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">
            {isHi ? "बिल योग्य" : "Billable"}
          </dt>
          <dd className="font-medium tabular-nums">
            {unitLabelFor(breakdown.billableUnits, breakdown.unitLabel, lang)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">
            {isHi ? "कटौती" : "Deductions"}
          </dt>
          <dd className="font-medium tabular-nums">
            {formatPaise(breakdown.deductionsPaise)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
