import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataRow, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { AttendanceStatusStrip } from "@/components/app/attendance-status";
import { GeofenceMap } from "@/components/app/geofence-map";
import { RiskFlagList } from "@/components/app/risk-flags";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatDay, formatTime } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import { formatMinutes } from "@/lib/money";
import { parseRiskFlags } from "@/lib/risk";

export default async function AdminAttendancePage(props: PageProps<"/admin/attendance">) {
  await requireRole("ADMIN");
  const { lang, t } = await getTranslator();
  const searchParams = await props.searchParams;
  const isHi = lang === "hi";
  const flaggedOnly = String(searchParams.filter ?? "") === "flagged";

  const [attendances, totals, flaggedCount] = await Promise.all([
    prisma.attendance.findMany({
      where: flaggedOnly ? { verificationStatus: "FLAGGED" } : {},
      include: {
        assignment: {
          include: {
            job: { include: { employer: true } },
            worker: { include: { user: true } },
          },
        },
        payment: true,
      },
      orderBy: [{ riskScore: "desc" }, { workDate: "desc" }],
      take: 60,
    }),
    prisma.attendance.aggregate({ _sum: { workingMinutes: true }, _count: true }),
    prisma.attendance.count({ where: { verificationStatus: "FLAGGED" } }),
  ]);

  const pendingCount = await prisma.attendance.count({
    where: { approvalStatus: "PENDING", checkOutTime: { not: null } },
  });

  const flaggedRate =
    totals._count > 0 ? Math.round((flaggedCount / totals._count) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.attendance")}
        description={
          isHi
            ? "हर जीपीएस-सत्यापित दिन, सबसे अधिक जोखिम वाले सबसे ऊपर।"
            : "Every GPS-verified day across the platform, riskiest first."
        }
        action={
          <a
            href={flaggedOnly ? "/admin/attendance" : "/admin/attendance?filter=flagged"}
            className="text-sm font-medium text-[var(--primary)] underline"
          >
            {flaggedOnly
              ? isHi
                ? "सभी दिखाएँ"
                : "Show all"
              : isHi
                ? "केवल चिह्नित"
                : "Flagged only"}
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={isHi ? "कुल दिन" : "Attendance days"}
          value={String(totals._count)}
        />
        <Stat
          label={t("att.verifiedHours")}
          value={formatMinutes(totals._sum.workingMinutes ?? 0)}
        />
        <Stat
          label={isHi ? "चिह्नित" : "Flagged"}
          value={String(flaggedCount)}
          hint={`${flaggedRate}%`}
          tone={flaggedCount > 0 ? "warning" : "default"}
        />
        <Stat
          label={isHi ? "स्वीकृति बाकी" : "Awaiting approval"}
          value={String(pendingCount)}
        />
      </div>

      {attendances.length === 0 ? (
        <EmptyState title={isHi ? "कोई उपस्थिति नहीं" : "No attendance records"} />
      ) : (
        <div className="space-y-3">
          {attendances.map((attendance) => {
            const flags = parseRiskFlags(attendance.riskFlags);
            return (
              <Card key={attendance.id}>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {attendance.assignment.worker.user.fullName}
                  </CardTitle>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {attendance.assignment.job.title} ·{" "}
                    {attendance.assignment.job.employer.companyName} ·{" "}
                    {formatDay(attendance.workDate, lang)}
                  </p>
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
                    <DataRow
                      label={t("att.checkedOutAt")}
                      value={
                        attendance.checkOutTime
                          ? `${formatTime(attendance.checkOutTime, lang)} · ${formatDistance(
                              attendance.checkOutDistanceM ?? 0,
                            )}`
                          : "—"
                      }
                    />
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
