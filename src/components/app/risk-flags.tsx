import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RiskFlag } from "@/lib/risk";
import type { Lang } from "@/lib/i18n";

const SEVERITY_TONE = {
  LOW: "outline",
  MEDIUM: "warning",
  HIGH: "destructive",
} as const;

const SEVERITY_LABEL = {
  LOW: { en: "Low", hi: "कम" },
  MEDIUM: { en: "Medium", hi: "मध्यम" },
  HIGH: { en: "High", hi: "उच्च" },
};

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
  const isHi = lang === "hi";

  if (flags.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-[var(--success)]/40 bg-[var(--success)]/10 p-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--success)]" aria-hidden />
        <div>
          <p className="font-semibold">
            {isHi ? "सभी जाँच पास" : "All attendance checks passed"}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {isHi
              ? "जीपीएस कार्यस्थल के भीतर था और घंटे सामान्य दिखते हैं।"
              : "GPS was inside the job site and the hours look normal."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--warning)]/50 bg-[var(--warning)]/5"
      aria-label={isHi ? "यह क्यों चिह्नित हुआ?" : "Why was this flagged?"}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2.5">
        <TriangleAlert className="size-4 text-[var(--warning)]" aria-hidden />
        <h3 className="text-sm font-semibold">
          {isHi ? "यह क्यों चिह्नित हुआ?" : "Why was this flagged?"}
        </h3>
        <Badge variant={score >= 50 ? "destructive" : "warning"} className="ml-auto">
          {isHi ? `जोखिम ${score}/100` : `risk ${score}/100`}
        </Badge>
      </div>

      <ol className="divide-y divide-[var(--border)]">
        {flags.map((flag) => (
          <li key={flag.code} className="bg-[var(--card)] p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">
                {isHi ? flag.titleHi : flag.title}
              </p>
              <Badge variant={SEVERITY_TONE[flag.severity]}>
                {isHi
                  ? SEVERITY_LABEL[flag.severity].hi
                  : SEVERITY_LABEL[flag.severity].en}{" "}
                +{flag.points}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {isHi ? flag.detailHi : flag.detail}
            </p>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
              {isHi ? "नियम" : "rule"}: {flag.code}
            </p>
          </li>
        ))}
      </ol>

      <p className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
        {isHi
          ? "ये नियम-आधारित जाँच हैं, धोखाधड़ी का प्रमाण नहीं। अंतिम निर्णय हमेशा व्यक्ति लेता है।"
          : "These are rule-based checks, not proof of fraud. A person always makes the final decision."}
      </p>
    </section>
  );
}
