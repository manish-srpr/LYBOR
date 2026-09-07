import { Calculator } from "lucide-react";
import { formatHoursDecimal, unitLabelFor } from "@/lib/format";
import { formatMinutes, formatPaise } from "@/lib/money";
import {
  renderWageLineDetail,
  renderWageLineLabel,
  renderWageSummary,
  type WageBreakdown,
} from "@/lib/wages";
import { translatorFor, type Lang } from "@/lib/i18n";

const RATE_SUFFIX_KEY = {
  HOURLY: "wage.perHourSuffix",
  DAILY: "wage.perDaySuffix",
  SHIFT: "wage.perShiftSuffix",
} as const;

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
  const t = translatorFor(lang);
  const suffix = t(RATE_SUFFIX_KEY[breakdown.wageType]);

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
      aria-label={t("wage.calculation")}
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2.5">
        <Calculator className="size-4 text-[var(--primary)]" aria-hidden />
        <h3 className="text-sm font-semibold">{t("wage.calculation")}</h3>
      </div>

      {/* The three numbers that answer "how did you get this?" at a glance. */}
      <dl className="grid grid-cols-3 divide-x divide-[var(--border)] border-b border-[var(--border)]">
        <div className="px-3 py-3 text-center">
          <dt className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("wage.rateShort")}
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
            {t("wage.verifiedShort")}
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">
            {formatHoursDecimal(breakdown.verifiedMinutes)}
          </dd>
        </div>
        <div className="px-3 py-3 text-center">
          <dt className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("wage.gross")}
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--primary)]">
            {formatPaise(breakdown.grossAmountPaise)}
          </dd>
        </div>
      </dl>

      <p className="px-4 pt-3 text-sm text-[var(--muted-foreground)]">
        {renderWageSummary(breakdown, lang)}
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
                  <td className="py-2 pe-3 align-top">
                    <div className={isNet ? "font-semibold" : "font-medium"}>
                      {renderWageLineLabel(line, lang)}
                    </div>
                    <div className="text-xs font-normal text-[var(--muted-foreground)]">
                      {renderWageLineDetail(line, lang)}
                    </div>
                  </td>
                  <td
                    className={
                      isNet
                        ? "whitespace-nowrap py-2 text-end align-top text-lg font-bold tabular-nums text-[var(--success)]"
                        : "whitespace-nowrap py-2 text-end align-top tabular-nums"
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
            {t("wage.verifiedTime")}
          </dt>
          <dd className="font-medium tabular-nums">
            {formatMinutes(breakdown.verifiedMinutes)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">
            {t("wage.rate")}
          </dt>
          <dd className="font-medium tabular-nums">
            {formatPaise(breakdown.rateAppliedPaise)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">
            {t("wage.billable")}
          </dt>
          <dd className="font-medium tabular-nums">
            {unitLabelFor(breakdown.billableUnits, breakdown.unitLabel, lang)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">
            {t("wage.deductions")}
          </dt>
          <dd className="font-medium tabular-nums">
            {formatPaise(breakdown.deductionsPaise)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
