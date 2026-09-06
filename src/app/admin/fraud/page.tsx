import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataRow, EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { FraudAlertForm } from "./alert-form";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatDistance } from "@/lib/geo";

const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

export default async function AdminFraudPage(props: PageProps<"/admin/fraud">) {
  await requireRole("ADMIN");
  const { lang, t } = await getTranslator();
  const searchParams = await props.searchParams;
  const isHi = lang === "hi";
  const showAll = String(searchParams.show ?? "") === "all";

  const alerts = await prisma.fraudAlert.findMany({
    where: showAll ? {} : { status: { in: ["OPEN", "REVIEWING"] } },
    include: {
      worker: { include: { user: true } },
      job: { select: { title: true, checkInRadiusMeters: true } },
      attendance: true,
      reviewedBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const sorted = [...alerts].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.fraud")}
        description={
          isHi
            ? "हर अलर्ट उस नियम का नाम बताता है जो सक्रिय हुआ और वह मान जिसने उसे सक्रिय किया।"
            : "Every alert names the rule that fired and the value that triggered it."
        }
        action={
          <a
            href={showAll ? "/admin/fraud" : "/admin/fraud?show=all"}
            className="text-sm font-medium text-[var(--primary)] underline"
          >
            {showAll
              ? isHi
                ? "केवल खुले"
                : "Open only"
              : isHi
                ? "सभी देखें"
                : "Show all"}
          </a>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          title={isHi ? "कोई खुला अलर्ट नहीं" : "No open alerts"}
          description={
            isHi
              ? "जीपीएस और घंटों की जाँच अभी तक साफ है।"
              : "The GPS and hours checks are clean so far."
          }
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((alert) => (
            <Card key={alert.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm">{alert.title}</CardTitle>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                      {alert.ruleCode}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge status={alert.severity} lang={lang} />
                    <StatusBadge status={alert.status} lang={lang} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  {alert.description}
                </p>

                <div className="divide-y divide-[var(--border)]">
                  {alert.worker ? (
                    <DataRow
                      label={isHi ? "श्रमिक" : "Worker"}
                      value={`${alert.worker.user.fullName} · ${alert.worker.user.phone}`}
                    />
                  ) : null}
                  {alert.job ? (
                    <DataRow label={t("job.title")} value={alert.job.title} />
                  ) : null}
                  {alert.attendance ? (
                    <>
                      <DataRow
                        label={isHi ? "तारीख" : "Work date"}
                        value={alert.attendance.workDate.toISOString().slice(0, 10)}
                      />
                      <DataRow
                        label={isHi ? "चेक-इन दूरी" : "Check-in distance"}
                        value={formatDistance(alert.attendance.checkInDistanceM)}
                      />
                      {alert.attendance.checkOutDistanceM !== null ? (
                        <DataRow
                          label={isHi ? "चेक-आउट दूरी" : "Check-out distance"}
                          value={formatDistance(alert.attendance.checkOutDistanceM)}
                        />
                      ) : null}
                      <DataRow
                        label={isHi ? "जोखिम स्कोर" : "Risk score"}
                        value={`${Math.round(alert.attendance.riskScore)}/100`}
                      />
                    </>
                  ) : null}
                  {alert.job ? (
                    <DataRow
                      label={isHi ? "अनुमत सीमा" : "Allowed radius"}
                      value={formatDistance(alert.job.checkInRadiusMeters)}
                    />
                  ) : null}
                </div>

                {alert.reviewNotes ? (
                  <p className="text-sm">
                    <span className="font-medium">
                      {isHi ? "समीक्षा: " : "Review: "}
                    </span>
                    {alert.reviewNotes}
                    {alert.reviewedBy ? ` — ${alert.reviewedBy.fullName}` : ""}
                  </p>
                ) : null}

                {alert.status === "OPEN" || alert.status === "REVIEWING" ? (
                  <FraudAlertForm alertId={alert.id} lang={lang} />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
