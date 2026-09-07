import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, DataRow, EmptyState, PageHeader } from "@/components/ui/misc";
import { MatchExplainer } from "@/components/app/match-explainer";
import { StatusBadge } from "@/components/app/status-badge";
import { wageLabel } from "@/components/app/job-card";
import { prisma } from "@/lib/db";
import { requireEmployerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import {
  computeMatch,
  parseFactors,
  renderMatchSummary,
  type MatchJob,
} from "@/lib/matching";
import { formatDateRange, plural } from "@/lib/format";
import { formatMinutes, formatPaise } from "@/lib/money";
import { closeJobAction, respondToApplicationAction } from "@/server/actions/jobs";
import { CompleteAssignmentForm } from "./complete-form";

export default async function EmployerJobDetail(props: PageProps<"/employer/jobs/[id]">) {
  const { id } = await props.params;
  const { profile } = await requireEmployerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      requiredSkills: { include: { skill: true } },
      applications: {
        include: {
          worker: {
            include: { user: true, skills: { include: { skill: true } } },
          },
        },
        orderBy: [{ matchScore: "desc" }, { appliedAt: "asc" }],
      },
      assignments: {
        include: {
          worker: { include: { user: true } },
          attendances: { include: { payment: true } },
          workHistory: true,
        },
      },
    },
  });

  if (!job || job.employerProfileId !== profile.id) notFound();

  const matchJob: MatchJob = {
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
  };

  const openSlots = job.workersRequired - job.workersAssigned;

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
        title={job.title}
        description={`${formatDateRange(job.startDate, job.endDate, lang)} · ${job.shiftStart}–${job.shiftEnd}`}
        action={<StatusBadge status={job.status} lang={lang} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>{isHi ? "काम का विवरण" : "Job terms"}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-[var(--border)]">
          <DataRow
            label={t("job.wage")}
            value={wageLabel(job.wageType, job.wageRatePaise, lang)}
          />
          <DataRow
            label={t("job.openings")}
            value={`${job.workersAssigned}/${job.workersRequired}`}
          />
          <DataRow
            label={t("job.location")}
            value={`${job.addressLine}, ${job.city}`}
          />
          <DataRow
            label={isHi ? "जीपीएस सीमा" : "Geofence radius"}
            value={`${job.checkInRadiusMeters} m`}
          />
          <DataRow
            label={isHi ? "प्रतिदिन घंटे" : "Hours per day"}
            value={`${job.expectedHoursPerDay} h`}
          />
        </CardContent>
      </Card>

      {job.requiredSkills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {job.requiredSkills.map((s) => (
            <Badge key={s.id} variant="outline">
              {isHi ? s.skill.nameHi : s.skill.nameEn}
              {s.isMandatory ? " *" : ""}
            </Badge>
          ))}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {t("job.assigned")} ({job.assignments.length})
        </h2>

        {job.assignments.length === 0 ? (
          <EmptyState title={isHi ? "अभी कोई श्रमिक नियुक्त नहीं" : "No workers assigned yet"} />
        ) : (
          <div className="space-y-3">
            {job.assignments.map((assignment) => {
              const verified = assignment.attendances.reduce(
                (sum, a) => sum + (a.workingMinutes ?? 0),
                0,
              );
              const approvedEarnings = assignment.attendances
                .filter((a) => a.approvalStatus === "APPROVED")
                .reduce((sum, a) => sum + (a.payment?.netAmountPaise ?? 0), 0);
              const pendingDays = assignment.attendances.filter(
                (a) => a.checkOutTime && a.approvalStatus === "PENDING",
              ).length;

              return (
                <Card key={assignment.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm">
                          <Link
                            href={`/employer/workers/${assignment.workerProfileId}`}
                            className="hover:underline"
                          >
                            {assignment.worker.user.fullName}
                          </Link>
                        </CardTitle>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {assignment.worker.city} ·{" "}
                          {isHi ? "विश्वसनीयता" : "reliability"}{" "}
                          {Math.round(assignment.worker.reliabilityScore)}/100
                        </p>
                      </div>
                      <StatusBadge status={assignment.status} lang={lang} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="divide-y divide-[var(--border)]">
                      <DataRow
                        label={t("att.verifiedHours")}
                        value={formatMinutes(verified)}
                      />
                      <DataRow
                        label={isHi ? "स्वीकृत मजदूरी" : "Approved wages"}
                        value={formatPaise(approvedEarnings)}
                      />
                      <DataRow
                        label={isHi ? "तय दर" : "Frozen rate"}
                        value={wageLabel(
                          assignment.agreedWageType,
                          assignment.agreedWageRatePaise,
                          lang,
                        )}
                      />
                    </div>

                    {pendingDays > 0 ? (
                      <Alert tone="warning">
                        {isHi
                          ? `${pendingDays} दिन स्वीकृति की प्रतीक्षा में।`
                          : `${plural(pendingDays, "day")} waiting on your approval.`}{" "}
                        <Link
                          href="/employer/approvals"
                          className="font-medium text-[var(--primary)] underline"
                        >
                          {t("nav.approvals")}
                        </Link>
                      </Alert>
                    ) : null}

                    {assignment.workHistory ? (
                      <Alert tone="success">
                        {isHi
                          ? "यह नियुक्ति बंद है और सत्यापित इतिहास में दर्ज है।"
                          : "Closed and recorded in the verified work history."}
                        {assignment.workHistory.employerRating ? (
                          <span className="ms-1 inline-flex items-center gap-0.5">
                            <Star
                              className="size-3.5 fill-[var(--warning)] text-[var(--warning)]"
                              aria-hidden
                            />
                            {assignment.workHistory.employerRating}
                          </span>
                        ) : null}
                      </Alert>
                    ) : assignment.status !== "COMPLETED" ? (
                      <CompleteAssignmentForm
                        assignmentId={assignment.id}
                        lang={lang}
                        blocked={pendingDays > 0}
                      />
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("job.applicants")} ({job.applications.length})
          </h2>
          {openSlots > 0 ? (
            <Badge variant="primary">
              {isHi ? `${openSlots} रिक्तियाँ` : `${plural(openSlots, "opening")} left`}
            </Badge>
          ) : (
            <Badge variant="outline">{isHi ? "सभी भर गए" : "All filled"}</Badge>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <Sparkles className="size-3.5 text-[var(--primary)]" aria-hidden />
          {isHi
            ? "आवेदक मिलान स्कोर के अनुसार क्रमबद्ध हैं। हर स्कोर का कारण खोलकर देखें।"
            : "Applicants are ranked by match score. Open any score to see the reasoning."}
        </p>

        {job.applications.length === 0 ? (
          <EmptyState title={isHi ? "अभी कोई आवेदन नहीं" : "No applications yet"} />
        ) : (
          <div className="space-y-3">
            {job.applications.map((application) => {
              // Recomputed live so the employer sees the worker as they are
              // today, next to the score frozen at application time.
              const live = computeMatch(
                {
                  latitude: application.worker.latitude,
                  longitude: application.worker.longitude,
                  travelRadiusKm: application.worker.travelRadiusKm,
                  availability: application.worker.availability,
                  experienceYears: application.worker.experienceYears,
                  reliabilityScore: application.worker.reliabilityScore,
                  preferredWageMinPaise: application.worker.preferredWageMinPaise,
                  skills: application.worker.skills.map((s) => ({
                    skillId: s.skillId,
                    nameEn: s.skill.nameEn,
                    proficiency: s.proficiency,
                  })),
                },
                matchJob,
              );
              const snapshot = parseFactors(application.matchFactors);
              const canAssign =
                openSlots > 0 &&
                (application.status === "PENDING" ||
                  application.status === "SHORTLISTED");

              return (
                <Card key={application.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-1.5 text-sm">
                          <Link
                            href={`/employer/workers/${application.workerProfileId}`}
                            className="hover:underline"
                          >
                            {application.worker.user.fullName}
                          </Link>
                          {application.worker.kycStatus === "VERIFIED" ? (
                            <BadgeCheck
                              className="size-4 text-[var(--success)]"
                              aria-hidden
                            />
                          ) : null}
                        </CardTitle>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {application.worker.city} · {live.distanceKm} km ·{" "}
                          {isHi
                            ? `${application.worker.experienceYears} वर्ष अनुभव`
                            : `${plural(application.worker.experienceYears, "yr")} exp`}{" "}
                          ·{" "}
                          {isHi ? "विश्वसनीयता" : "reliability"}{" "}
                          {Math.round(application.worker.reliabilityScore)}
                        </p>
                      </div>
                      <StatusBadge status={application.status} lang={lang} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {application.coverNote ? (
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {application.coverNote}
                      </p>
                    ) : null}

                    <MatchExplainer
                      score={live.score}
                      factors={live.factors}
                      lang={lang}
                      summary={renderMatchSummary(live, lang)}
                    />

                    {application.matchScore !== null &&
                    Math.round(application.matchScore) !== live.score &&
                    snapshot.length > 0 ? (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {isHi
                          ? `आवेदन के समय स्कोर ${Math.round(application.matchScore)}% था।`
                          : `Score was ${Math.round(application.matchScore)}% when they applied.`}
                      </p>
                    ) : null}

                    {application.worker.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {application.worker.skills.map((s) => (
                          <Badge key={s.id} variant="outline">
                            {isHi ? s.skill.nameHi : s.skill.nameEn}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    {canAssign ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={respondToApplicationAction}>
                          <input
                            type="hidden"
                            name="applicationId"
                            value={application.id}
                          />
                          <input type="hidden" name="decision" value="ACCEPT" />
                          <Button type="submit" size="sm" variant="success">
                            {t("job.assign")}
                          </Button>
                        </form>
                        {application.status === "PENDING" ? (
                          <form action={respondToApplicationAction}>
                            <input
                              type="hidden"
                              name="applicationId"
                              value={application.id}
                            />
                            <input type="hidden" name="decision" value="SHORTLIST" />
                            <Button type="submit" size="sm" variant="outline">
                              {isHi ? "चयन सूची में डालें" : "Shortlist"}
                            </Button>
                          </form>
                        ) : null}
                        <form action={respondToApplicationAction}>
                          <input
                            type="hidden"
                            name="applicationId"
                            value={application.id}
                          />
                          <input type="hidden" name="decision" value="REJECT" />
                          <Button type="submit" size="sm" variant="ghost">
                            {t("common.reject")}
                          </Button>
                        </form>
                      </div>
                    ) : null}

                    <Link
                      href={`/employer/workers/${application.workerProfileId}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
                    >
                      {isHi ? "पूरी प्रोफ़ाइल देखें" : "View full worker profile"}
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {job.status === "OPEN" || job.status === "IN_PROGRESS" ? (
        <form action={closeJobAction}>
          <input type="hidden" name="jobId" value={job.id} />
          <Button type="submit" variant="outline" block>
            {job.status === "OPEN"
              ? isHi
                ? "काम रद्द करें"
                : "Cancel this job"
              : isHi
                ? "काम पूरा चिह्नित करें"
                : "Mark job completed"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
