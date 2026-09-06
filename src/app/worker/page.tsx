import Link from "next/link";
import { ArrowRight, Clock, LogIn, LogOut, MapPin, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { JobCard, wageLabel } from "@/components/app/job-card";
import { ReliabilityPanel } from "@/components/app/reliability-panel";
import { StatusBadge } from "@/components/app/status-badge";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatTime } from "@/lib/format";
import { formatMinutes, formatPaise } from "@/lib/money";
import { computeMatch, type MatchWorker } from "@/lib/matching";
import { computeReliability } from "@/lib/reliability";

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function WorkerDashboard() {
  const { profile } = await requireWorkerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";
  const today = todayUtcMidnight();

  const [activeAssignments, pendingApplications, payments, reliability, openJobs, workerSkills] =
    await Promise.all([
      prisma.jobAssignment.findMany({
        where: { workerProfileId: profile.id, status: { in: ["ASSIGNED", "ACTIVE"] } },
        include: {
          job: { include: { employer: true } },
          attendances: { where: { workDate: today } },
        },
        orderBy: { startDate: "asc" },
      }),
      prisma.jobApplication.count({
        where: { workerProfileId: profile.id, status: { in: ["PENDING", "SHORTLISTED"] } },
      }),
      prisma.payment.findMany({
        where: { assignment: { workerProfileId: profile.id } },
        select: { status: true, netAmountPaise: true, verifiedMinutes: true },
      }),
      computeReliability(profile.id),
      prisma.job.findMany({
        where: {
          status: "OPEN",
          applications: { none: { workerProfileId: profile.id } },
        },
        include: { employer: true, requiredSkills: { include: { skill: true } } },
        take: 20,
      }),
      prisma.workerSkill.findMany({
        where: { workerProfileId: profile.id },
        include: { skill: true },
      }),
    ]);

  const paid = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.netAmountPaise, 0);
  const awaitingApproval = payments
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + p.netAmountPaise, 0);
  const readyToPay = payments
    .filter((p) => p.status === "APPROVED")
    .reduce((sum, p) => sum + p.netAmountPaise, 0);
  const verifiedMinutes = payments.reduce((sum, p) => sum + p.verifiedMinutes, 0);

  // Rank the jobs this worker has not applied to, so the dashboard opens on a
  // recommendation rather than an empty prompt to go looking.
  const matchWorker: MatchWorker = {
    latitude: profile.latitude,
    longitude: profile.longitude,
    travelRadiusKm: profile.travelRadiusKm,
    availability: profile.availability,
    experienceYears: profile.experienceYears,
    reliabilityScore: profile.reliabilityScore,
    preferredWageMinPaise: profile.preferredWageMinPaise,
    skills: workerSkills.map((s) => ({
      skillId: s.skillId,
      nameEn: s.skill.nameEn,
      proficiency: s.proficiency,
    })),
  };
  const recommended = openJobs
    .map((job) => ({
      job,
      match: computeMatch(matchWorker, {
        latitude: job.latitude,
        longitude: job.longitude,
        wageType: job.wageType,
        wageRatePaise: job.wageRatePaise,
        expectedHoursPerDay: job.expectedHoursPerDay,
        requiredSkills: job.requiredSkills.map((s) => ({
          skillId: s.skillId,
          nameEn: s.skill.nameEn,
          isMandatory: s.isMandatory,
        })),
      }),
    }))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 2);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isHi ? `नमस्ते, ${profile.user.fullName}` : `Hello, ${profile.user.fullName}`}
        description={
          isHi
            ? "आपका काम, आपके घंटे और आपकी कमाई एक जगह।"
            : "Your work, your verified hours and your earnings in one place."
        }
      />

      {/* Today: the single most important thing a worker needs on opening the app. */}
      {activeAssignments.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("att.today")}
          </h2>
          {activeAssignments.map((assignment) => {
            const attendance = assignment.attendances[0];
            const state = !attendance
              ? "TO_CHECK_IN"
              : !attendance.checkOutTime
                ? "WORKING"
                : "DONE";
            return (
              <div
                key={assignment.id}
                className="overflow-hidden rounded-xl border-2 border-[var(--primary)]/40 bg-[var(--card)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] bg-[var(--primary)]/5 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{assignment.job.title}</p>
                    <p className="truncate text-sm text-[var(--muted-foreground)]">
                      {assignment.job.employer.companyName}
                    </p>
                  </div>
                  <StatusBadge status={assignment.status} lang={lang} />
                </div>

                <dl className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                  <div>
                    <dt className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                      <MapPin className="size-3.5" aria-hidden />
                      {isHi ? "कहाँ जाना है" : "Where to go"}
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {assignment.job.addressLine}, {assignment.job.city}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                      <Clock className="size-3.5" aria-hidden />
                      {isHi ? "शिफ्ट" : "Shift"}
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums">
                      {assignment.job.shiftStart}–{assignment.job.shiftEnd}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted-foreground)]">
                      {isHi ? "आप कितना कमाएँगे" : "What you earn"}
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold text-[var(--primary)]">
                      {wageLabel(
                        assignment.agreedWageType,
                        assignment.agreedWageRatePaise,
                        lang,
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="border-t border-[var(--border)] p-4">
                  {state === "TO_CHECK_IN" ? (
                    <Link
                      href={`/worker/assignments/${assignment.id}`}
                      className={buttonVariants({ size: "lg", block: true })}
                    >
                      <LogIn aria-hidden />
                      {isHi ? "जीपीएस से चेक इन करें" : "Check in with GPS"}
                    </Link>
                  ) : state === "WORKING" ? (
                    <div className="space-y-2">
                      <p className="text-center text-sm text-[var(--muted-foreground)]">
                        {isHi ? "चेक-इन समय " : "Checked in at "}
                        <strong className="text-[var(--foreground)]">
                          {formatTime(attendance.checkInTime, lang)}
                        </strong>
                      </p>
                      <Link
                        href={`/worker/assignments/${assignment.id}`}
                        className={buttonVariants({
                          size: "lg",
                          block: true,
                          variant: "success",
                        })}
                      >
                        <LogOut aria-hidden />
                        {isHi ? "जीपीएस से चेक आउट करें" : "Check out with GPS"}
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href={`/worker/assignments/${assignment.id}`}
                      className={buttonVariants({ size: "lg", block: true, variant: "outline" })}
                    >
                      {formatMinutes(attendance.workingMinutes ?? 0)}{" "}
                      {isHi ? "सत्यापित · विवरण देखें" : "verified · view details"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <EmptyState
          title={isHi ? "अभी कोई सक्रिय काम नहीं" : "No active work right now"}
          description={
            isHi
              ? "नीचे दी गई सिफ़ारिशों में से अपने लिए सही काम चुनें।"
              : "Pick one of the recommendations below to get started."
          }
          action={
            <Link href="/worker/jobs" className={buttonVariants({ size: "sm" })}>
              {t("nav.jobs")}
            </Link>
          }
        />
      )}

      {profile.kycStatus !== "VERIFIED" ? (
        <Alert tone="warning" title={isHi ? "पहचान सत्यापित करें" : "Verify your identity"}>
          {isHi
            ? "सत्यापित पहचान वाले श्रमिकों को नियोक्ता पहले चुनते हैं।"
            : "Employers pick verified workers first."}{" "}
          <Link href="/worker/kyc" className="font-medium text-[var(--primary)] underline">
            {t("kyc.submit")}
          </Link>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("pay.totalEarned")}
          value={formatPaise(paid, { compact: true })}
          hint={isHi ? "भुगतान हो चुका" : "released to you"}
          tone="success"
        />
        <Stat
          label={t("pay.awaiting")}
          value={formatPaise(awaitingApproval, { compact: true })}
          hint={isHi ? "स्वीकृति बाकी" : "employer to approve"}
          tone="warning"
        />
        <Stat
          label={t("pay.readyToPay")}
          value={formatPaise(readyToPay, { compact: true })}
          hint={isHi ? "भुगतान बाकी" : "approved, unpaid"}
        />
        <Stat
          label={t("att.verifiedHours")}
          value={formatMinutes(verifiedMinutes)}
          hint={isHi ? "जीपीएस सत्यापित" : "GPS verified"}
        />
      </div>

      {recommended.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              <Sparkles className="size-4 text-[var(--primary)]" aria-hidden />
              {isHi ? "आपके लिए सुझाए गए काम" : "Recommended for you"}
            </h2>
            <Link href="/worker/jobs" className="text-sm font-medium text-[var(--primary)]">
              {isHi ? "सभी देखें" : "See all"}
            </Link>
          </div>
          <div className="grid gap-3">
            {recommended.map(({ job, match }) => (
              <JobCard
                key={job.id}
                href={`/worker/jobs/${job.id}`}
                lang={lang}
                match={match}
                job={{
                  id: job.id,
                  title: job.title,
                  city: job.city,
                  status: job.status,
                  wageType: job.wageType,
                  wageRatePaise: job.wageRatePaise,
                  startDate: job.startDate,
                  endDate: job.endDate,
                  shiftStart: job.shiftStart,
                  shiftEnd: job.shiftEnd,
                  workersRequired: job.workersRequired,
                  workersAssigned: job.workersAssigned,
                  employerName: job.employer.companyName,
                  skills: job.requiredSkills.map((s) =>
                    isHi ? s.skill.nameHi : s.skill.nameEn,
                  ),
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      <ReliabilityPanel breakdown={reliability} lang={lang} />

      {pendingApplications > 0 ? (
        <Alert title={isHi ? "आवेदन लंबित" : "Applications in progress"}>
          {isHi
            ? `${pendingApplications} आवेदन नियोक्ता के उत्तर की प्रतीक्षा में हैं।`
            : `${pendingApplications} application(s) waiting on an employer response.`}{" "}
          <Link
            href="/worker/applications"
            className="font-medium text-[var(--primary)] underline"
          >
            {t("common.viewDetails")}
          </Link>
        </Alert>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <Badge variant="outline">{isHi ? "सुझाव" : "Tip"}</Badge>
          {isHi
            ? "हर काम पर मिलान स्कोर और उसका कारण देखें।"
            : "Every job shows a match score and the reasoning behind it."}
          <ArrowRight className="size-3.5" aria-hidden />
        </p>
      )}
    </div>
  );
}
