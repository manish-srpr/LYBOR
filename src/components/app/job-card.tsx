import Link from "next/link";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MatchExplainer } from "./match-explainer";
import { StatusBadge } from "./status-badge";
import { renderMatchSummary, type MatchResult } from "@/lib/matching";
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
    <article className="relative rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/*
            The whole card is the target, not just the title. `absolute inset-0`
            stretches this one anchor over the card, which keeps a single link
            in the accessibility tree and leaves the match explainer's own
            button clickable above it - wrapping the card in an anchor would
            nest a button inside a link, which is invalid.
          */}
          <Link
            href={href}
            className="font-medium after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          >
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
        <div className="relative z-10 mt-3">
          <MatchExplainer
            score={match.score}
            factors={match.factors}
            lang={lang}
            summary={renderMatchSummary(match, lang)}
          />
        </div>
      ) : null}
    </article>
  );
}

export { formatDateRange };
