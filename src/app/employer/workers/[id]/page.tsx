import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataRow, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { ReliabilityPanel } from "@/components/app/reliability-panel";
import { StatusBadge } from "@/components/app/status-badge";
import { prisma } from "@/lib/db";
import { requireEmployerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatDateRange, plural } from "@/lib/format";
import { formatMinutes, formatPaise } from "@/lib/money";
import { computeReliability } from "@/lib/reliability";

function parseSkills(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

export default async function EmployerWorkerProfile(
  props: PageProps<"/employer/workers/[id]">,
) {
  const { id } = await props.params;
  const { profile: employer } = await requireEmployerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const worker = await prisma.workerProfile.findUnique({
    where: { id },
    include: {
      user: true,
      skills: { include: { skill: true } },
      workHistory: { orderBy: { endDate: "desc" }, take: 10 },
    },
  });
  if (!worker) notFound();

  // An employer may only open a worker who has applied to or been assigned one
  // of their own jobs - the profile is not a public directory.
  const connected = await prisma.jobApplication.count({
    where: { workerProfileId: id, job: { employerProfileId: employer.id } },
  });
  if (connected === 0) notFound();

  const reliability = await computeReliability(id);

  const ratings = worker.workHistory
    .map((h) => h.employerRating)
    .filter((r): r is number => typeof r === "number");
  const averageRating =
    ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  return (
    <div className="space-y-5">
      <Link
        href="/employer/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("common.back")}
      </Link>

      <PageHeader
        title={worker.user.fullName}
        description={`${worker.city}, ${worker.state} · ${
          isHi
            ? `${worker.experienceYears} वर्ष अनुभव`
            : `${plural(worker.experienceYears, "year")} of experience`
        }`}
        action={
          <div className="flex flex-wrap gap-1.5">
            {worker.kycStatus === "VERIFIED" ? (
              <Badge variant="success">
                <BadgeCheck className="size-3" aria-hidden />
                {isHi ? "पहचान सत्यापित" : "ID verified"}
              </Badge>
            ) : (
              <StatusBadge status={worker.kycStatus} lang={lang} />
            )}
            <StatusBadge status={worker.availability} lang={lang} />
          </div>
        }
      />

      {worker.bio ? (
        <p className="text-sm text-[var(--muted-foreground)]">{worker.bio}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={isHi ? "पूरे किए गए काम" : "Jobs completed"}
          value={String(worker.totalJobsCompleted)}
        />
        <Stat
          label={t("att.verifiedHours")}
          value={formatMinutes(worker.totalMinutesWorked)}
        />
        <Stat
          label={isHi ? "कुल कमाई" : "Total earned"}
          value={formatPaise(worker.totalEarningsPaise, { compact: true })}
          tone="success"
        />
        <Stat
          label={t("history.rating")}
          value={averageRating > 0 ? `${averageRating.toFixed(1)} / 5` : "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isHi ? "कौशल" : "Skills"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {worker.skills.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              {isHi ? "कोई कौशल दर्ज नहीं।" : "No skills recorded."}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {worker.skills.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {isHi ? s.skill.nameHi : s.skill.nameEn}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{s.proficiency}</Badge>
                    <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                      {isHi
                        ? `${s.yearsExperience} वर्ष`
                        : plural(s.yearsExperience, "yr")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="divide-y divide-[var(--border)] border-t border-[var(--border)] pt-2">
            <DataRow
              label={isHi ? "यात्रा सीमा" : "Travel radius"}
              value={`${worker.travelRadiusKm} km`}
            />
            {worker.preferredWageMinPaise ? (
              <DataRow
                label={isHi ? "अपेक्षित न्यूनतम" : "Expected minimum"}
                value={`${formatPaise(worker.preferredWageMinPaise)}/hr`}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <ReliabilityPanel breakdown={reliability} lang={lang} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {t("history.verified")}
        </h2>
        {worker.workHistory.length === 0 ? (
          <EmptyState
            title={isHi ? "अभी कोई सत्यापित इतिहास नहीं" : "No verified history yet"}
            description={
              isHi
                ? "यह श्रमिक अभी तक कोई काम पूरा नहीं कर पाया है।"
                : "This worker has not completed a job on STRIVER yet."
            }
          />
        ) : (
          <div className="space-y-3">
            {worker.workHistory.map((entry) => (
              <Card key={entry.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">{entry.jobTitle}</CardTitle>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {entry.employerName} ·{" "}
                        {formatDateRange(entry.startDate, entry.endDate, lang)}
                      </p>
                    </div>
                    {entry.isVerified ? (
                      <Badge variant="success">
                        <BadgeCheck className="size-3" aria-hidden />
                        {isHi ? "सत्यापित" : "Verified"}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-[var(--muted-foreground)]">
                        {t("history.daysWorked")}
                      </dt>
                      <dd className="font-medium tabular-nums">{entry.totalDaysWorked}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted-foreground)]">
                        {t("att.verifiedHours")}
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {formatMinutes(entry.totalVerifiedMinutes)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted-foreground)]">
                        {isHi ? "कमाई" : "Earned"}
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {formatPaise(entry.totalEarningsPaise)}
                      </dd>
                    </div>
                  </dl>
                  {parseSkills(entry.skillsUsed).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {parseSkills(entry.skillsUsed).map((skill) => (
                        <Badge key={skill} variant="outline">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {entry.employerRating ? (
                    <p className="flex items-center gap-1 text-sm">
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star
                          key={index}
                          className={
                            index < (entry.employerRating ?? 0)
                              ? "size-3.5 fill-[var(--warning)] text-[var(--warning)]"
                              : "size-3.5 text-[var(--muted-foreground)]"
                          }
                          aria-hidden
                        />
                      ))}
                      {entry.employerReview ? (
                        <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                          {entry.employerReview}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
