import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataRow, EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { WageBreakdownTable } from "@/components/app/wage-breakdown";
import { ResolveDisputeForm } from "./resolve-form";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatDistance } from "@/lib/geo";
import { formatMinutes, formatPaise } from "@/lib/money";
import { parseBreakdown } from "@/lib/wages";

export default async function AdminDisputesPage(props: PageProps<"/admin/disputes">) {
  await requireRole("ADMIN");
  const { lang, t } = await getTranslator();
  const searchParams = await props.searchParams;
  const isHi = lang === "hi";
  const showAll = String(searchParams.show ?? "") === "all";

  const disputes = await prisma.dispute.findMany({
    where: showAll ? {} : { status: { in: ["OPEN", "UNDER_REVIEW"] } },
    include: {
      raisedBy: { select: { fullName: true, phone: true, role: true } },
      job: { select: { title: true } },
      attendance: true,
      payment: true,
      resolvedBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.disputes")}
        description={
          isHi
            ? "प्रत्येक शिकायत के साथ वही प्रमाण दिखता है जो दोनों पक्षों ने देखा।"
            : "Each dispute is shown next to the same evidence both parties saw."
        }
        action={
          <a
            href={showAll ? "/admin/disputes" : "/admin/disputes?show=all"}
            className="text-sm font-medium text-[var(--primary)] underline"
          >
            {showAll
              ? isHi
                ? "केवल खुली"
                : "Open only"
              : isHi
                ? "सभी देखें"
                : "Show all"}
          </a>
        }
      />

      {disputes.length === 0 ? (
        <EmptyState title={isHi ? "कोई खुली शिकायत नहीं" : "No open disputes"} />
      ) : (
        <div className="space-y-3">
          {disputes.map((dispute) => {
            const breakdown = parseBreakdown(
              dispute.payment?.calculationBreakdown ?? null,
            );
            return (
              <Card key={dispute.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">{dispute.reason}</CardTitle>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {dispute.category} · {dispute.raisedBy.fullName} (
                        {dispute.raisedByRole}) ·{" "}
                        {dispute.createdAt.toISOString().slice(0, 10)}
                      </p>
                    </div>
                    <StatusBadge status={dispute.status} lang={lang} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {dispute.description}
                  </p>

                  {dispute.evidenceNotes ? (
                    <p className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-sm">
                      {dispute.evidenceNotes}
                    </p>
                  ) : null}

                  <div className="divide-y divide-[var(--border)]">
                    {dispute.job ? (
                      <DataRow label={t("job.title")} value={dispute.job.title} />
                    ) : null}
                    {dispute.attendance ? (
                      <>
                        <DataRow
                          label={isHi ? "तारीख" : "Work date"}
                          value={dispute.attendance.workDate.toISOString().slice(0, 10)}
                        />
                        <DataRow
                          label={t("att.verifiedHours")}
                          value={formatMinutes(dispute.attendance.workingMinutes ?? 0)}
                        />
                        <DataRow
                          label={isHi ? "चेक-इन दूरी" : "Check-in distance"}
                          value={formatDistance(dispute.attendance.checkInDistanceM)}
                        />
                        <DataRow
                          label={isHi ? "जोखिम स्कोर" : "Risk score"}
                          value={`${Math.round(dispute.attendance.riskScore)}/100`}
                        />
                        {dispute.attendance.rejectionReason ? (
                          <DataRow
                            label={isHi ? "अस्वीकार का कारण" : "Rejection reason"}
                            value={dispute.attendance.rejectionReason}
                          />
                        ) : null}
                      </>
                    ) : null}
                    {dispute.payment ? (
                      <DataRow
                        label={t("common.amount")}
                        value={`${formatPaise(dispute.payment.netAmountPaise)} · ${dispute.payment.status}`}
                      />
                    ) : null}
                  </div>

                  {breakdown ? (
                    <details className="rounded-lg border border-[var(--border)] p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        {t("wage.breakdown")}
                      </summary>
                      <div className="mt-3">
                        <WageBreakdownTable breakdown={breakdown} lang={lang} />
                      </div>
                    </details>
                  ) : null}

                  {dispute.adminResolution ? (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-sm">
                      <p className="font-medium">{isHi ? "समाधान" : "Resolution"}</p>
                      <p className="mt-0.5 text-[var(--muted-foreground)]">
                        {dispute.adminResolution}
                        {dispute.resolvedBy ? ` — ${dispute.resolvedBy.fullName}` : ""}
                      </p>
                    </div>
                  ) : null}

                  {dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW" ? (
                    <ResolveDisputeForm
                      disputeId={dispute.id}
                      lang={lang}
                      hasFrozenPayment={dispute.payment?.status === "DISPUTED"}
                    />
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
