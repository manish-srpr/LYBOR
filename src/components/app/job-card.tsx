import Link from "next/link";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MatchExplainer } from "./match-explainer";
import { StatusBadge } from "./status-badge";
import type { MatchResult } from "@/lib/matching";
import { formatDateRange } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import type { Lang } from "@/lib/i18n";

export function wageLabel(
  wageType: "HOURLY" | "DAILY" | "SHIFT",
  ratePaise: number,
  lang: Lang,
): string {
  const suffix = {
    HOURLY: lang === "hi" ? "प्रति घंटा" : "per hour",
    DAILY: lang === "hi" ? "प्रति दिन" : "per day",
    SHIFT: lang === "hi" ? "प्रति शिफ्ट" : "per shift",
  }[wageType];
  return `${formatPaise(ratePaise)} ${suffix}`;
}


export type JobCardData = {
  id: string;
  title: string;
  city: string;
  status: string;
  wageType: "HOURLY" | "DAILY" | "SHIFT";
  wageRatePaise: number;
  startDate: Date;
  endDate: Date;
  shiftStart: string;
  shiftEnd: string;
  workersRequired: number;
  workersAssigned: number;
  employerName: string;
  skills: string[];
};

export function JobCard({
  job,
  href,
  lang,
  match,
  applied,
}: {
  job: JobCardData;
  href: string;
  lang: Lang;
  match?: MatchResult | null;
  applied?: boolean;
}) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={href} className="font-medium hover:underline">
            {job.title}
          </Link>
          <p className="truncate text-sm text-[var(--muted-foreground)]">
            {job.employerName}
          </p>
        </div>
        {applied ? (
          <Badge variant="success">{lang === "hi" ? "आवेदन किया" : "Applied"}</Badge>
        ) : (
          <StatusBadge status={job.status} lang={lang} />
        )}
      </div>

      <p className="mt-2 text-base font-semibold text-[var(--primary)]">
        {wageLabel(job.wageType, job.wageRatePaise, lang)}
      </p>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
        <div className="flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {job.city}
            {match ? ` · ${match.distanceKm} km` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          <span>
            {job.shiftStart}–{job.shiftEnd}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          <span>{formatDateRange(job.startDate, job.endDate, lang)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="size-3.5 shrink-0" aria-hidden />
          <span>
            {job.workersAssigned}/{job.workersRequired}{" "}
            {lang === "hi" ? "नियुक्त" : "assigned"}
          </span>
        </div>
      </dl>

      {job.skills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skills.map((skill) => (
            <Badge key={skill} variant="outline">
              {skill}
            </Badge>
          ))}
        </div>
      ) : null}

      {match ? (
        <div className="mt-3">
          <MatchExplainer
            score={match.score}
            factors={match.factors}
            lang={lang}
            summary={lang === "hi" ? match.summaryHi : match.summary}
          />
        </div>
      ) : null}
    </article>
  );
}

export { formatDateRange };
