import Link from "next/link";
import { ArrowRight, MapPin, Star, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { RoleJourney } from "@/components/app/role-journey";
import { StatusBadge } from "@/components/app/status-badge";
import { wageLabel } from "@/components/app/job-card";
import { prisma } from "@/lib/db";
import { requireEmployerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { plural } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { distanceKm } from "@/lib/geo";
import { getWorkerTrustMany } from "@/lib/skill-evidence";
import { TRUST_LEVEL_META } from "@/lib/skill-trust";
import type { MessageKey } from "@/lib/i18n";

export default async function EmployerDashboard() {
  const { profile } = await requireEmployerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const [jobs, pendingApplications, pendingApprovals, payments, flaggedDays, nearby] =
    await Promise.all([
      prisma.job.findMany({
        where: { employerProfileId: profile.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { applications: true } } },
      }),
      prisma.jobApplication.count({
        where: {
          job: { employerProfileId: profile.id },
          status: { in: ["PENDING", "SHORTLISTED"] },
        },
      }),
      prisma.attendance.count({
        where: {
          assignment: { job: { employerProfileId: profile.id } },
          approvalStatus: "PENDING",
          checkOutTime: { not: null },
        },
      }),
      prisma.payment.findMany({
        where: { assignment: { job: { employerProfileId: profile.id } } },
        select: { status: true, netAmountPaise: true },
      }),
      prisma.attendance.count({
        where: {
          assignment: { job: { employerProfileId: profile.id } },
          verificationStatus: "FLAGGED",
        },
      }),
      // Workers this employer could actually hire. Their stored address is
      // what they entered themselves; nothing is tracked and nothing is read
      // from their device here.
      prisma.workerProfile.findMany({
        where: { user: { isActive: true }, availability: "AVAILABLE" },
        include: {
          user: { select: { fullName: true } },
          skills: { include: { skill: true }, orderBy: { skill: { nameEn: "asc" } } },
        },
        take: 60,
      }),
    ]);

  // Nearest few, measured from the employer's own registered location.
  const site = { latitude: profile.latitude, longitude: profile.longitude };
  const nearest = nearby
    .map((worker) => ({ worker, km: distanceKm(site, worker) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 4);
  const trustById = await getWorkerTrustMany(nearest.map((r) => r.worker.id));

  const owed = payments
    .filter((p) => p.status === "APPROVED")
    .reduce((sum, p) => sum + p.netAmountPaise, 0);
  const paid = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.netAmountPaise, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.companyName}
        description={t("dash.employerIntro")}
        action={
          <Link href="/employer/jobs/new" className={buttonVariants({ size: "sm" })}>
            {t("nav.postJob")}
          </Link>
        }
      />

      <RoleJourney role="EMPLOYER" lang={lang} />

      {/*
        Workers first, and deliberately above the employer's own postings.
        Finding somebody to do the work is what an employer opens this app
        for; the jobs they have already written are a record of that, not the
        task itself.
      */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            <Users className="size-4 text-[var(--primary)]" aria-hidden />
            {t("emp.nearMe")}
          </h2>
          <Link
            href="/employer/workers"
            className="text-sm font-medium text-[var(--primary)]"
          >
            {t("common.viewAll")}
          </Link>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">{t("emp.nearMeIntro")}</p>

        {nearest.length === 0 ? (
          <EmptyState title={t("emp.noWorkers")} description={t("emp.noWorkersBody")} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {nearest.map(({ worker, km }) => {
                const headline = trustById.get(worker.id)?.headline ?? null;
                const meta = headline ? TRUST_LEVEL_META[headline.level] : null;
                return (
                  <Link
                    key={worker.id}
                    href={`/employer/workers/${worker.id}`}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-medium">{worker.user.fullName}</p>
                          {meta ? (
                            <Badge variant={meta.tone}>
                              {t(meta.labelKey as MessageKey)}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {worker.skills.slice(0, 3).map((ws) => (
                            <Badge key={ws.id} variant="outline">
                              {isHi ? ws.skill.nameHi : ws.skill.nameEn}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {t("emp.workerSummary", {
                            years: worker.experienceYears,
                            jobs: worker.totalJobsCompleted,
                          })}
                          {worker.averageRating > 0 ? (
                            <span className="ml-1 inline-flex items-center gap-0.5">
                              · <Star className="size-3 fill-current" aria-hidden />
                              {worker.averageRating.toFixed(1)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                        <MapPin className="size-3.5" aria-hidden />
                        {km < 1 ? "<1" : km.toFixed(km < 10 ? 1 : 0)} {t("common.km")}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
            <Link
              href="/employer/workers"
              className={buttonVariants({ variant: "outline", size: "sm", block: true })}
            >
              {t("emp.browseWorkers")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </>
        )}
      </section>

      {pendingApplications > 0 ? (
        <Alert tone="warning" title={t("emp.applicationsWaiting")}>
          {isHi
            ? `${pendingApplications} आवेदन आपके उत्तर की प्रतीक्षा में हैं।`
            : `${plural(pendingApplications, "application")} waiting on your response.`}{" "}
          <Link href="/employer/jobs" className="font-medium underline">
            {t("common.viewDetails")}
          </Link>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("nav.approvals")}
          value={String(pendingApprovals)}
          hint={t("nav.attendance")}
          tone={pendingApprovals > 0 ? "warning" : "default"}
        />
        <Stat
          label={t("job.applicants")}
          value={String(pendingApplications)}
          hint={t("pay.awaiting")}
        />
        <Stat
          label={t("pay.readyToPay")}
          value={formatPaise(owed, { compact: true })}
          tone={owed > 0 ? "warning" : "default"}
        />
        <Stat
          label={t("common.paid")}
          value={formatPaise(paid, { compact: true })}
          tone="success"
        />
      </div>

      {pendingApprovals > 0 ? (
        <Alert tone="warning" title={t("nav.approvals")}>
          {isHi
            ? `${pendingApprovals} दिन की उपस्थिति स्वीकृति के बिना मजदूरी रुकी हुई है।`
            : `${plural(pendingApprovals, "day")} of verified hours are holding up wages.`}{" "}
          <Link
            href="/employer/approvals"
            className="font-medium text-[var(--primary)] underline"
          >
            {t("nav.approvals")}
          </Link>
        </Alert>
      ) : null}

      {flaggedDays > 0 ? (
        <Alert tone="destructive" title={t("att.riskFlags")}>
          {isHi
            ? `${flaggedDays} दिन जोखिम जाँच में चिह्नित हैं। हर संकेत का कारण दिखाया गया है।`
            : `${plural(flaggedDays, "day")} tripped a risk check. Each flag names the rule that fired.`}
        </Alert>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("nav.myJobs")}
          </h2>
          <Link href="/employer/jobs" className="text-sm font-medium text-[var(--primary)]">
            {t("common.viewDetails")}
          </Link>
        </div>

        {jobs.length === 0 ? (
          <EmptyState
            title={t("job.noneFound")}
            action={
              <Link href="/employer/jobs/new" className={buttonVariants({ size: "sm" })}>
                {t("nav.postJob")}
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/employer/jobs/${job.id}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--primary)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.title}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {wageLabel(job.wageType, job.wageRatePaise, lang)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {isHi
                        ? `${job._count.applications} आवेदक`
                        : plural(job._count.applications, "applicant")}{" "}
                      · {job.workersAssigned}/{job.workersRequired}{" "}
                      {isHi ? "नियुक्त" : "assigned"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={job.status} lang={lang} />
                    <ArrowRight className="size-4 text-[var(--muted-foreground)]" aria-hidden />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
