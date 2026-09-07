import { ShieldCheck } from "lucide-react";
import { Progress } from "@/components/ui/misc";
import { renderReliabilityDetail, type ReliabilityBreakdown } from "@/lib/reliability";
import { translatorFor, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function band(score: number) {
  if (score >= 75) return { tone: "success" as const, key: "reliability.strong" } as const;
  if (score >= 50) return { tone: "warning" as const, key: "reliability.building" } as const;
  return { tone: "destructive" as const, key: "reliability.needsWork" } as const;
}

const TONE_TEXT = {
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  destructive: "text-[var(--destructive)]",
};

/**
 * The reliability score with the four inputs that produced it.
 *
 * The disclaimer is load-bearing, not decoration: the score is derived from
 * verified attendance and only ever affects ranking. It must be obvious that it
 * cannot reduce wages a worker has already earned.
 */
export function ReliabilityPanel({
  breakdown,
  lang,
}: {
  breakdown: ReliabilityBreakdown;
  lang: Lang;
}) {
  const t = translatorFor(lang);
  const level = band(breakdown.score);

  const bars = [
    {
      label: t("reliability.shiftsCompleted"),
      value: breakdown.totalDays === 0 ? 0 : breakdown.attendanceRate * 100,
      weight: "30%",
    },
    {
      label: t("reliability.employerApprovals"),
      value: breakdown.approvalRate * 100,
      weight: "35%",
    },
    {
      label: t("reliability.cleanGps"),
      value: breakdown.cleanRate * 100,
      weight: "25%",
    },
    {
      label: t("reliability.jobsCompleted"),
      value: Math.min(100, (breakdown.completedJobs / 5) * 100),
      weight: "10%",
    },
  ];

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
      aria-label={t("reliability.title")}
    >
      <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--muted)]/50 p-4">
        <div
          className="relative grid size-16 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(var(--${level.tone}) ${breakdown.score * 3.6}deg, var(--muted) 0deg)`,
          }}
        >
          <span className="grid size-12 place-items-center rounded-full bg-[var(--card)]">
            <span
              className={cn("text-lg font-bold tabular-nums", TONE_TEXT[level.tone])}
            >
              {breakdown.score}
            </span>
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck className="size-4 text-[var(--primary)]" aria-hidden />
            {t("reliability.title")}
          </h2>
          <p className={cn("mt-0.5 text-sm font-medium", TONE_TEXT[level.tone])}>
            {t(level.key)}
            <span className="ms-1 font-normal text-[var(--muted-foreground)]">
              · {breakdown.score}/100
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {bars.map((bar) => (
          <div key={bar.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium">{bar.label}</span>
              <span className="tabular-nums text-[var(--muted-foreground)]">
                {Math.round(bar.value)}%
                <span className="ms-1 opacity-70">× {bar.weight}</span>
              </span>
            </div>
            <Progress value={bar.value} tone={band(bar.value).tone} className="h-1.5" />
          </div>
        ))}

        <ul className="space-y-0.5 pt-1 text-xs text-[var(--muted-foreground)]">
          {breakdown.reasons.map((reason) => (
            <li key={reason.labelKey}>
              <span className="font-medium text-[var(--foreground)]">
                {t(reason.labelKey)}:
              </span>{" "}
              {renderReliabilityDetail(reason, lang)}
            </li>
          ))}
        </ul>

        <p className="rounded-lg bg-[var(--muted)] p-2.5 text-xs text-[var(--muted-foreground)]">
          {t("reliability.disclaimer")}
        </p>
      </div>
    </section>
  );
}
