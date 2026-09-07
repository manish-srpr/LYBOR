import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { renderRiskDetail, renderRiskTitle, type RiskFlag } from "@/lib/risk";
import { translatorFor, type Lang } from "@/lib/i18n";

const SEVERITY_TONE = {
  LOW: "outline",
  MEDIUM: "warning",
  HIGH: "destructive",
} as const;

const SEVERITY_KEY = {
  LOW: "risk.severityLow",
  MEDIUM: "risk.severityMedium",
  HIGH: "risk.severityHigh",
} as const;

/**
 * Risk output is always shown as named rules with their observed values, never
 * as a bare score. An employer who rejects a day has to see which rule fired,
 * and the worker sees the identical explanation.
 */
export function RiskFlagList({
  flags,
  score,
  lang,
}: {
  flags: RiskFlag[];
  score: number;
  lang: Lang;
}) {
  const t = translatorFor(lang);

  if (flags.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-[var(--success)]/40 bg-[var(--success)]/10 p-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--success)]" aria-hidden />
        <div>
          <p className="font-semibold">{t("att.allChecksPassed")}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("att.allChecksPassedBody")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--warning)]/50 bg-[var(--warning)]/5"
      aria-label={t("att.whyFlagged")}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2.5">
        <TriangleAlert className="size-4 text-[var(--warning)]" aria-hidden />
        <h3 className="text-sm font-semibold">{t("att.whyFlagged")}</h3>
        <Badge variant={score >= 50 ? "destructive" : "warning"} className="ms-auto">
          {t("att.riskScore", { score })}
        </Badge>
      </div>

      <ol className="divide-y divide-[var(--border)]">
        {flags.map((flag) => (
          <li key={flag.code} className="bg-[var(--card)] p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">
                {renderRiskTitle(flag, lang)}
              </p>
              <Badge variant={SEVERITY_TONE[flag.severity]}>
                {t(SEVERITY_KEY[flag.severity])} +{flag.points}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {renderRiskDetail(flag, lang)}
            </p>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
              {t("att.rule")}: {flag.code}
            </p>
          </li>
        ))}
      </ol>

      <p className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
        {t("att.notProofOfFraud")}
      </p>
    </section>
  );
}
