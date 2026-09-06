import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataRow, EmptyState, PageHeader } from "@/components/ui/misc";
import { RiskFlagList } from "@/components/app/risk-flags";
import { AttendanceStatusStrip } from "@/components/app/attendance-status";
import { GeofenceMap } from "@/components/app/geofence-map";
import { WageBreakdownTable } from "@/components/app/wage-breakdown";
import { ReviewForm } from "./review-form";
import { prisma } from "@/lib/db";
import { requireEmployerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatDay, formatTime } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import { formatMinutes } from "@/lib/money";
import { parseRiskFlags } from "@/lib/risk";
import { parseBreakdown } from "@/lib/wages";

export default async function EmployerApprovalsPage(
  props: PageProps<"/employer/approvals">,
) {
  const { profile } = await requireEmployerProfile();
  const { lang, t } = await getTranslator();
  const searchParams = await props.searchParams;
  const isHi = lang === "hi";
  const showAll = String(searchParams.show ?? "") === "all";

  const attendances = await prisma.attendance.findMany({
    where: {
      assignment: { job: { employerProfileId: profile.id } },
      checkOutTime: { not: null },
      ...(showAll ? {} : { approvalStatus: "PENDING" }),
    },
    include: {
      assignment: {
        include: { job: true, worker: { include: { user: true } } },
      },
      payment: true,
    },
    orderBy: [{ riskScore: "desc" }, { workDate: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.approvals")}
        description={
          isHi
            ? "सत्यापित घंटों की समीक्षा करें। सबसे अधिक जोखिम वाले दिन सबसे ऊपर हैं।"
            : "Review GPS-verified hours. The riskiest days are listed first."
        }
        action={
          <a
            href={showAll ? "/employer/approvals" : "/employer/approvals?show=all"}
            className="text-sm font-medium text-[var(--primary)] underline"
          >
            {showAll
              ? isHi
                ? "केवल लंबित"
                : "Pending only"
              : isHi
                ? "सभी दिन देखें"
                : "Show all days"}
          </a>
        }
      />

      {attendances.length === 0 ? (
        <EmptyState
          title={
            showAll
              ? isHi
                ? "कोई उपस्थिति दर्ज नहीं"
                : "No attendance recorded"
              : isHi
                ? "कुछ भी स्वीकृति के लिए बाकी नहीं"
                : "Nothing waiting on your approval"
          }
          description={
            isHi
              ? "श्रमिक के चेक-आउट करते ही दिन यहाँ आ जाएगा।"
              : "A day appears here as soon as a worker checks out."
          }
        />
      ) : (
        <div className="space-y-3">
          {attendances.map((attendance) => {
            const flags = parseRiskFlags(attendance.riskFlags);
            const breakdown = parseBreakdown(
              attendance.payment?.calculationBreakdown ?? null,
            );
            return (
              <Card key={attendance.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">
                        {attendance.assignment.worker.user.fullName}
                      </CardTitle>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {attendance.assignment.job.title} ·{" "}
                        {formatDay(attendance.workDate, lang)}
                      </p>
                    </div>
                    <AttendanceStatusStrip
                      verification={attendance.verificationStatus}
                      approval={attendance.approvalStatus}
                      payment={attendance.payment?.status ?? null}
                      lang={lang}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="divide-y divide-[var(--border)]">
                    <DataRow
                      label={t("att.checkedInAt")}
                      value={`${formatTime(attendance.checkInTime, lang)} · ${formatDistance(
                        attendance.checkInDistanceM,
                      )}`}
                    />
                    <DataRow
                      label={t("att.checkedOutAt")}
                      value={`${
                        attendance.checkOutTime
                          ? formatTime(attendance.checkOutTime, lang)
                          : "—"
                      } · ${formatDistance(attendance.checkOutDistanceM ?? 0)}`}
                    />
                    <DataRow
                      label={t("att.verifiedHours")}
                      value={formatMinutes(attendance.workingMinutes ?? 0)}
                    />
                  </div>

                  {attendance.workerNote ? (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {isHi ? "श्रमिक का नोट: " : "Worker note: "}
                      {attendance.workerNote}
                    </p>
                  ) : null}

                  <GeofenceMap
                    distanceM={attendance.checkInDistanceM}
                    radiusM={attendance.assignment.job.checkInRadiusMeters}
                    withinRadius={attendance.checkInWithinRadius}
                    accuracyM={attendance.checkInAccuracyM}
                    label={attendance.assignment.job.addressLine}
                    lang={lang}
                  />

                  <RiskFlagList
                    flags={flags}
                    score={Math.round(attendance.riskScore)}
                    lang={lang}
                  />

                  {breakdown ? (
                    <WageBreakdownTable breakdown={breakdown} lang={lang} />
                  ) : null}

                  {attendance.approvalStatus === "PENDING" ? (
                    <ReviewForm attendanceId={attendance.id} lang={lang} />
                  ) : attendance.rejectionReason ? (
                    <p className="text-sm text-[var(--destructive)]">
                      {isHi ? "अस्वीकार का कारण: " : "Rejected because: "}
                      {attendance.rejectionReason}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
