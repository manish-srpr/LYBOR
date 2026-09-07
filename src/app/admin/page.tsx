import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataRow, PageHeader, Stat } from "@/components/ui/misc";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatMinutes, formatPaise } from "@/lib/money";

export default async function AdminOverview() {
  await requireRole("ADMIN");
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const [
    workers,
    employers,
    openJobs,
    activeAssignments,
    pendingKyc,
    openAlerts,
    openDisputes,
    attendanceAgg,
    payments,
    flaggedAttendance,
    verifiedKyc,
  ] = await Promise.all([
    prisma.workerProfile.count(),
    prisma.employerProfile.count(),
    prisma.job.count({ where: { status: "OPEN" } }),
    prisma.jobAssignment.count({ where: { status: { in: ["ASSIGNED", "ACTIVE"] } } }),
    prisma.kYCRecord.count({ where: { status: "PENDING" } }),
    prisma.fraudAlert.count({ where: { status: "OPEN" } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    prisma.attendance.aggregate({ _sum: { workingMinutes: true }, _count: true }),
    prisma.payment.findMany({ select: { status: true, netAmountPaise: true } }),
    prisma.attendance.count({ where: { verificationStatus: "FLAGGED" } }),
    prisma.kYCRecord.count({ where: { status: "VERIFIED" } }),
  ]);

  const paid = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.netAmountPaise, 0);
  const inFlight = payments
    .filter((p) => p.status !== "PAID")
    .reduce((sum, p) => sum + p.netAmountPaise, 0);

  const attendanceCount = attendanceAgg._count;
  const flaggedRate =
    attendanceCount > 0 ? Math.round((flaggedAttendance / attendanceCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.overview")}
        description={t("dash.adminIntro")}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/admin/users">
          <Stat
            label={t("nav.workers")}
            value={String(workers)}
            hint={`${employers} ${isHi ? "नियोक्ता" : "employers"}`}
          />
        </Link>
        <Link href="/admin/jobs">
          <Stat
            label={t("nav.allJobs")}
            value={String(openJobs)}
            hint={`${activeAssignments} ${isHi ? "सक्रिय नियुक्तियाँ" : "active assignments"}`}
          />
        </Link>
        <Link href="/admin/payments">
          <Stat
            label={t("common.paid")}
            value={formatPaise(paid, { compact: true })}
            tone="success"
            hint={`${formatPaise(inFlight, { compact: true })} ${isHi ? "प्रक्रिया में" : "in flight"}`}
          />
        </Link>
        <Link href="/admin/attendance">
          <Stat
            label={t("att.verifiedHours")}
            value={formatMinutes(attendanceAgg._sum.workingMinutes ?? 0)}
            hint={`${attendanceCount} ${isHi ? "दिन" : "days"}`}
          />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/admin/kyc">
          <Card className="hover:border-[var(--primary)]">
            <CardHeader>
              <CardTitle className="text-sm">{t("nav.kyc")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{pendingKyc}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {isHi ? "समीक्षा के लिए दस्तावेज़" : "documents to review"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/fraud">
          <Card className="hover:border-[var(--primary)]">
            <CardHeader>
              <CardTitle className="text-sm">{t("nav.fraud")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{openAlerts}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {isHi ? "खुले जोखिम अलर्ट" : "open risk alerts"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/disputes">
          <Card className="hover:border-[var(--primary)]">
            <CardHeader>
              <CardTitle className="text-sm">{t("nav.disputes")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{openDisputes}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {isHi ? "अनसुलझी शिकायतें" : "unresolved disputes"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dash.trustIndicators")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-[var(--border)]">
          <DataRow
            label={isHi ? "चिह्नित उपस्थिति दर" : "Flagged attendance rate"}
            value={`${flaggedRate}%`}
          />
          <DataRow
            label={isHi ? "कुल उपस्थिति दिन" : "Total attendance days"}
            value={String(attendanceCount)}
          />
          <DataRow
            label={isHi ? "चिह्नित दिन" : "Flagged days"}
            value={String(flaggedAttendance)}
          />
          <DataRow
            label={isHi ? "सत्यापित पहचान" : "Verified identities"}
            value={String(verifiedKyc)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
