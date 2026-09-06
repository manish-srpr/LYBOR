import { ShieldCheck } from "lucide-react";
import { Progress } from "@/components/ui/misc";
import type { ReliabilityBreakdown } from "@/lib/reliability";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function band(score: number) {
  if (score >= 75) return { tone: "success" as const, en: "Strong", hi: "मजबूत" };
  if (score >= 50) return { tone: "warning" as const, en: "Building", hi: "बन रहा है" };
  return { tone: "destructive" as const, en: "Needs work", hi: "सुधार चाहिए" };
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
  const isHi = lang === "hi";
  const level = band(breakdown.score);

  const bars = [
    {
      label: isHi ? "शिफ्ट पूरी की" : "Shifts completed",
      value: breakdown.totalDays === 0 ? 0 : breakdown.attendanceRate * 100,
      weight: "30%",
    },
    {
      label: isHi ? "नियोक्ता स्वीकृति" : "Employer approvals",
      value: breakdown.approvalRate * 100,
      weight: "35%",
    },
    {
      label: isHi ? "स्वच्छ जीपीएस रिकॉर्ड" : "Clean GPS record",
      value: breakdown.cleanRate * 100,
      weight: "25%",
    },
    {
      label: isHi ? "पूरे किए गए काम" : "Jobs completed",
      value: Math.min(100, (breakdown.completedJobs / 5) * 100),
      weight: "10%",
    },
  ];

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
      aria-label={isHi ? "स्ट्राइवर विश्वसनीयता स्कोर" : "STRIVER Reliability Score"}
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
            {isHi ? "स्ट्राइवर विश्वसनीयता स्कोर" : "STRIVER Reliability Score"}
          </h2>
          <p className={cn("mt-0.5 text-sm font-medium", TONE_TEXT[level.tone])}>
            {isHi ? level.hi : level.en}
            <span className="ml-1 font-normal text-[var(--muted-foreground)]">
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
                <span className="ml-1 opacity-70">× {bar.weight}</span>
              </span>
            </div>
            <Progress value={bar.value} tone={band(bar.value).tone} className="h-1.5" />
          </div>
        ))}

        <ul className="space-y-0.5 pt-1 text-xs text-[var(--muted-foreground)]">
          {breakdown.reasons.map((reason) => (
            <li key={reason.label}>
              <span className="font-medium text-[var(--foreground)]">
                {isHi ? reason.labelHi : reason.label}:
              </span>{" "}
              {reason.detail}
            </li>
          ))}
        </ul>

        <p className="rounded-lg bg-[var(--muted)] p-2.5 text-xs text-[var(--muted-foreground)]">
          {isHi
            ? "यह स्कोर सत्यापित उपस्थिति से बनता है और केवल रैंकिंग को प्रभावित करता है। यह आपकी अर्जित मजदूरी कभी कम नहीं करता।"
            : "Derived from verified attendance. It only affects ranking — it never reduces wages you have already earned."}
        </p>
      </div>
    </section>
  );
}
