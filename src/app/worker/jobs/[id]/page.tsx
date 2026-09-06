import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, DataRow } from "@/components/ui/misc";
import { Textarea } from "@/components/ui/field";
import { MatchExplainer } from "@/components/app/match-explainer";
import { wageLabel } from "@/components/app/job-card";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { computeMatch, perHourPaise, type MatchWorker } from "@/lib/matching";
import { formatDateRange, plural } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { applyToJobAction } from "@/server/actions/jobs";

export default async function WorkerJobDetail(props: PageProps<"/worker/jobs/[id]">) {
  const { id } = await props.params;
  const { profile } = await requireWorkerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const [job, workerSkills, application] = await Promise.all([
    prisma.job.findUnique({
      where: { id },
      include: {
        employer: true,
        requiredSkills: { include: { skill: true } },
      },
    }),
    prisma.workerSkill.findMany({
      where: { workerProfileId: profile.id },
      include: { skill: true },
    }),
    prisma.jobApplication.findFirst({
      where: { jobId: id, workerProfileId: profile.id },
    }),
  ]);

  if (!job) notFound();

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

  const match = computeMatch(matchWorker, {
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
  });

  const days =
    Math.round((job.endDate.getTime() - job.startDate.getTime()) / 86_400_000) + 1;
  const estimatedTotal =
    job.wageType === "HOURLY"
      ? job.wageRatePaise * job.expectedHoursPerDay * days
      : job.wageRatePaise * days;

  return (
    <div className="space-y-5">
      <Link
        href="/worker/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("common.back")}
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{job.title}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
          {job.employer.companyName}
          {job.employer.isVerified ? (
            <BadgeCheck className="size-4 text-[var(--success)]" aria-hidden />
          ) : null}
        </p>
        <p className="mt-3 text-lg font-semibold text-[var(--primary)]">
          {wageLabel(job.wageType, job.wageRatePaise, lang)}
        </p>
      </div>

      <MatchExplainer
        score={match.score}
        factors={match.factors}
        lang={lang}
        summary={isHi ? match.summaryHi : match.summary}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("job.description")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">{job.description}</p>

          <div className="divide-y divide-[var(--border)]">
            <DataRow
              label={t("job.location")}
              value={
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {job.addressLine}, {job.city} · {match.distanceKm} km
                </span>
              }
            />
            <DataRow
              label={t("job.dates")}
              value={
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {formatDateRange(job.startDate, job.endDate, lang)} (
                  {isHi ? `${days} दिन` : plural(days, "day")})
                </span>
              }
            />
            <DataRow
              label={t("job.shift")}
              value={
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {job.shiftStart}–{job.shiftEnd} · {job.expectedHoursPerDay} h/day
                </span>
              }
            />
            <DataRow
              label={t("job.openings")}
              value={
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden />
                  {job.workersAssigned}/{job.workersRequired}
                </span>
              }
            />
            <DataRow
              label={isHi ? "जीपीएस सीमा" : "Check-in radius"}
              value={`${job.checkInRadiusMeters} m`}
            />
            <DataRow
              label={isHi ? "प्रति घंटा (समतुल्य)" : "Equivalent hourly"}
              value={formatPaise(
                perHourPaise({
                  wageType: job.wageType,
                  wageRatePaise: job.wageRatePaise,
                  expectedHoursPerDay: job.expectedHoursPerDay,
                }),
              )}
            />
            <DataRow
              label={isHi ? "अनुमानित कुल" : "Estimated total"}
              value={formatPaise(estimatedTotal)}
            />
          </div>

          {job.requiredSkills.length > 0 ? (
            <div>
              <p className="text-sm font-medium">{t("job.skills")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {job.requiredSkills.map((s) => {
                  const held = workerSkills.some((w) => w.skillId === s.skillId);
                  return (
                    <Badge key={s.id} variant={held ? "success" : "outline"}>
                      {isHi ? s.skill.nameHi : s.skill.nameEn}
                      {s.isMandatory ? " *" : ""}
                    </Badge>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                {isHi
                  ? "* अनिवार्य कौशल। हरा रंग का अर्थ है कि यह कौशल आपके पास है।"
                  : "* mandatory. Green means the skill is already on your profile."}
              </p>
            </div>
          ) : null}

          <p className="text-xs text-[var(--muted-foreground)]">
            {isHi
              ? "अनुमानित कुल केवल संकेत है। भुगतान हमेशा सत्यापित घंटों पर होता है।"
              : "The estimate is a guide only. You are always paid on GPS-verified hours."}
          </p>
        </CardContent>
      </Card>

      {application ? (
        <Alert tone="success" title={isHi ? "आवेदन भेजा गया" : "Application sent"}>
          {isHi
            ? "नियोक्ता के उत्तर की प्रतीक्षा करें।"
            : "Waiting for the employer to respond."}{" "}
          <Link
            href="/worker/applications"
            className="font-medium text-[var(--primary)] underline"
          >
            {t("nav.applications")}
          </Link>
        </Alert>
      ) : job.status !== "OPEN" ? (
        <Alert tone="warning">
          {isHi ? "यह काम अब आवेदन के लिए खुला नहीं है।" : "This job is no longer open."}
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("job.applyNow")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={applyToJobAction} className="space-y-3">
              <input type="hidden" name="jobId" value={job.id} />
              <Textarea
                name="coverNote"
                maxLength={300}
                placeholder={
                  isHi
                    ? "नियोक्ता को बताएँ कि आप इस काम के लिए उपयुक्त क्यों हैं (वैकल्पिक)"
                    : "Tell the employer why you fit this job (optional)"
                }
              />
              <Button type="submit" size="lg" block>
                {t("common.apply")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Link href="/worker/jobs" className={buttonVariants({ variant: "outline", block: true })}>
        {isHi ? "और काम देखें" : "See more jobs"}
      </Link>
    </div>
  );
}
