import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { wageLabel } from "@/components/app/job-card";
import { prisma } from "@/lib/db";
import { requireEmployerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { plural } from "@/lib/format";
import { formatPaise } from "@/lib/money";

export default async function EmployerDashboard() {
  const { profile } = await requireEmployerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const [jobs, pendingApplications, pendingApprovals, payments, flaggedDays] =
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
    ]);

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
        description={
          isHi
            ? "आपके काम, श्रमिक और भुगतान एक जगह।"
            : "Your jobs, your workers and your payments in one place."
        }
        action={
          <Link href="/employer/jobs/new" className={buttonVariants({ size: "sm" })}>
            {t("nav.postJob")}
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("nav.approvals")}
          value={String(pendingApprovals)}
          hint={isHi ? "दिन समीक्षा के लिए" : "days to review"}
          tone={pendingApprovals > 0 ? "warning" : "default"}
        />
        <Stat
          label={t("job.applicants")}
          value={String(pendingApplications)}
          hint={isHi ? "उत्तर की प्रतीक्षा" : "awaiting a response"}
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
        <Alert tone="warning" title={isHi ? "स्वीकृति बाकी" : "Attendance waiting on you"}>
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
        <Alert tone="destructive" title={isHi ? "चिह्नित उपस्थिति" : "Flagged attendance"}>
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
            title={isHi ? "अभी कोई काम पोस्ट नहीं" : "No jobs posted yet"}
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
