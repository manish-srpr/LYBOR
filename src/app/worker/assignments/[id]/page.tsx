import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, DataRow, EmptyState, PageHeader } from "@/components/ui/misc";
import { AttendanceStatusStrip } from "@/components/app/attendance-status";
import { GeofenceMap } from "@/components/app/geofence-map";
import { GpsPunch } from "@/components/app/gps-punch";
import { RiskFlagList } from "@/components/app/risk-flags";
import { StatusBadge } from "@/components/app/status-badge";
import { WageBreakdownTable } from "@/components/app/wage-breakdown";
import { wageLabel } from "@/components/app/job-card";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatDateRange, formatDay, formatTime } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import { formatMinutes, formatPaise } from "@/lib/money";
import { parseRiskFlags } from "@/lib/risk";
import { parseBreakdown } from "@/lib/wages";

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function AssignmentDetail(
  props: PageProps<"/worker/assignments/[id]">,
) {
  const { id } = await props.params;
  const { profile } = await requireWorkerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const assignment = await prisma.jobAssignment.findUnique({
    where: { id },
    include: {
      job: { include: { employer: true } },
      attendances: {
        include: { payment: true },
        orderBy: { workDate: "desc" },
      },
    },
  });

  if (!assignment || assignment.workerProfileId !== profile.id) notFound();

  const today = todayUtcMidnight();
  const todayAttendance = assignment.attendances.find(
    (a) => a.workDate.getTime() === today.getTime(),
  );
  const isClosed =
    assignment.status === "COMPLETED" || assignment.status === "TERMINATED";

  const totalVerified = assignment.attendances.reduce(
    (sum, a) => sum + (a.workingMinutes ?? 0),
    0,
  );
  const totalApproved = assignment.attendances
    .filter((a) => a.approvalStatus === "APPROVED")
    .reduce((sum, a) => sum + (a.payment?.netAmountPaise ?? 0), 0);

  const site = {
    latitude: assignment.job.latitude,
    longitude: assignment.job.longitude,
  };

  return (
    <div className="space-y-5">
      <Link
        href="/worker/assignments"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("common.back")}
      </Link>

      <PageHeader
        title={assignment.job.title}
        description={`${assignment.job.employer.companyName} · ${formatDateRange(
          assignment.startDate,
          assignment.endDate,
          lang,
        )}`}
        action={<StatusBadge status={assignment.status} lang={lang} />}
      />

      {/* The three things a worker needs before leaving home. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <Wallet className="size-3.5" aria-hidden />
            {isHi ? "आपकी दर" : "Your rate"}
          </p>
          <p className="mt-1 text-base font-semibold text-[var(--primary)]">
            {wageLabel(assignment.agreedWageType, assignment.agreedWageRatePaise, lang)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <Clock className="size-3.5" aria-hidden />
            {isHi ? "शिफ्ट" : "Shift"}
          </p>
          <p className="mt-1 text-base font-semibold">
            {assignment.job.shiftStart}–{assignment.job.shiftEnd}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <MapPin className="size-3.5" aria-hidden />
            {isHi ? "कहाँ जाना है" : "Where to go"}
          </p>
          <p className="mt-1 text-sm font-medium">
            {assignment.job.addressLine}, {assignment.job.city}
          </p>
        </div>
      </div>

      {!isClosed ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("att.today")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!todayAttendance ? (
              <>
                <GeofenceMap
                  distanceM={0}
                  radiusM={assignment.job.checkInRadiusMeters}
                  withinRadius
                  label={assignment.job.addressLine}
                  lang={lang}
                />
                <p className="text-sm text-[var(--muted-foreground)]">
                  {isHi
                    ? "कार्यस्थल पहुँचकर चेक-इन करें।"
                    : "Check in once you reach the worksite."}
                </p>
                <GpsPunch
                  assignmentId={assignment.id}
                  mode="IN"
                  site={site}
                  radiusMeters={assignment.job.checkInRadiusMeters}
                  lang={lang}
                />
              </>
            ) : !todayAttendance.checkOutTime ? (
              <>
                <Alert tone="success" title={isHi ? "काम चल रहा है" : "Work in progress"}>
                  {isHi ? "चेक-इन समय " : "Checked in at "}
                  <strong>{formatTime(todayAttendance.checkInTime, lang)}</strong>
                  {isHi ? "। शिफ्ट खत्म होने पर चेक-आउट करें।" : ". Check out when your shift ends."}
                </Alert>
                <GeofenceMap
                  distanceM={todayAttendance.checkInDistanceM}
                  radiusM={assignment.job.checkInRadiusMeters}
                  withinRadius={todayAttendance.checkInWithinRadius}
                  accuracyM={todayAttendance.checkInAccuracyM}
                  label={assignment.job.addressLine}
                  lang={lang}
                />
                <GpsPunch
                  assignmentId={assignment.id}
                  mode="OUT"
                  site={site}
                  radiusMeters={assignment.job.checkInRadiusMeters}
                  lang={lang}
                />
              </>
            ) : (
              <Alert tone="success" title={isHi ? "आज का काम पूरा" : "Today is complete"}>
                {formatMinutes(todayAttendance.workingMinutes ?? 0)}{" "}
                {isHi ? "सत्यापित।" : "verified."}{" "}
                {todayAttendance.approvalStatus === "PENDING"
                  ? isHi
                    ? "नियोक्ता की स्वीकृति बाकी है।"
                    : "Waiting for employer approval."
                  : ""}
              </Alert>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <DataRowCard
          label={t("att.verifiedHours")}
          value={formatMinutes(totalVerified)}
        />
        <DataRowCard
          label={isHi ? "स्वीकृत कमाई" : "Approved earnings"}
          value={formatPaise(totalApproved)}
          tone="success"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {t("nav.attendance")}
        </h2>

        {assignment.attendances.length === 0 ? (
          <EmptyState
            title={isHi ? "अभी कोई उपस्थिति नहीं" : "No attendance recorded yet"}
            description={
              isHi
                ? "आपका पहला चेक-इन यहाँ दिखेगा।"
                : "Your first GPS check-in will appear here."
            }
          />
        ) : (
          <div className="space-y-3">
            {assignment.attendances.map((attendance) => {
              const flags = parseRiskFlags(attendance.riskFlags);
              const breakdown = parseBreakdown(
                attendance.payment?.calculationBreakdown ?? null,
              );
              return (
                <Card key={attendance.id}>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      {formatDay(attendance.workDate, lang)}
                    </CardTitle>
                    <AttendanceStatusStrip
                      verification={attendance.verificationStatus}
                      approval={attendance.approvalStatus}
                      payment={attendance.payment?.status ?? null}
                      lang={lang}
                    />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="divide-y divide-[var(--border)]">
                      <DataRow
                        label={t("att.checkedInAt")}
                        value={`${formatTime(attendance.checkInTime, lang)} · ${formatDistance(
                          attendance.checkInDistanceM,
                        )}`}
                      />
                      {attendance.checkOutTime ? (
                        <DataRow
                          label={t("att.checkedOutAt")}
                          value={`${formatTime(attendance.checkOutTime, lang)} · ${formatDistance(
                            attendance.checkOutDistanceM ?? 0,
                          )}`}
                        />
                      ) : null}
                      <DataRow
                        label={t("att.verifiedHours")}
                        value={
                          attendance.workingMinutes === null
                            ? "—"
                            : formatMinutes(attendance.workingMinutes)
                        }
                      />
                    </div>

                    <GeofenceMap
                      distanceM={attendance.checkInDistanceM}
                      radiusM={assignment.job.checkInRadiusMeters}
                      withinRadius={attendance.checkInWithinRadius}
                      accuracyM={attendance.checkInAccuracyM}
                      label={assignment.job.addressLine}
                      lang={lang}
                    />

                    {attendance.rejectionReason ? (
                      <Alert tone="destructive" title={isHi ? "अस्वीकृत" : "Rejected"}>
                        {attendance.rejectionReason}{" "}
                        <Link
                          href={`/worker/disputes?attendanceId=${attendance.id}`}
                          className="font-medium text-[var(--primary)] underline"
                        >
                          {t("dispute.raise")}
                        </Link>
                      </Alert>
                    ) : null}

                    <RiskFlagList
                      flags={flags}
                      score={Math.round(attendance.riskScore)}
                      lang={lang}
                    />

                    {breakdown ? (
                      <WageBreakdownTable breakdown={breakdown} lang={lang} />
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function DataRowCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          tone === "success" ? "text-[var(--success)]" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
