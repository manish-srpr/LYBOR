import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { WageBreakdownTable } from "@/components/app/wage-breakdown";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatDay } from "@/lib/format";
import { formatMinutes, formatPaise } from "@/lib/money";
import { parseBreakdown } from "@/lib/wages";

const LEDGER_LABELS: Record<string, { en: string; hi: string }> = {
  ACCRUAL: { en: "Wage earned", hi: "मजदूरी अर्जित" },
  APPROVAL: { en: "Employer approved", hi: "नियोक्ता ने स्वीकृत किया" },
  PAYOUT: { en: "Paid to worker", hi: "श्रमिक को भुगतान" },
  REVERSAL: { en: "Reversed", hi: "वापस" },
  ADJUSTMENT: { en: "Adjustment", hi: "समायोजन" },
};

export default async function WorkerEarningsPage() {
  const { profile } = await requireWorkerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const payments = await prisma.payment.findMany({
    where: { assignment: { workerProfileId: profile.id } },
    include: {
      assignment: { include: { job: { include: { employer: true } } } },
      attendance: true,
      ledgerEntries: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totals = payments.reduce(
    (acc, payment) => {
      if (payment.status === "PAID") acc.paid += payment.netAmountPaise;
      else if (payment.status === "APPROVED") acc.approved += payment.netAmountPaise;
      else if (payment.status === "PENDING") acc.pending += payment.netAmountPaise;
      else acc.disputed += payment.netAmountPaise;
      acc.minutes += payment.verifiedMinutes;
      return acc;
    },
    { paid: 0, approved: 0, pending: 0, disputed: 0, minutes: 0 },
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.earnings")}
        description={
          isHi
            ? "हर रुपये की गणना पूरी तरह दिखाई गई है।"
            : "Every rupee, with the arithmetic behind it shown in full."
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("common.paid")} value={formatPaise(totals.paid)} tone="success" />
        <Stat label={t("pay.readyToPay")} value={formatPaise(totals.approved)} />
        <Stat
          label={t("pay.awaiting")}
          value={formatPaise(totals.pending)}
          tone="warning"
        />
        <Stat label={t("att.verifiedHours")} value={formatMinutes(totals.minutes)} />
      </div>

      {payments.length === 0 ? (
        <EmptyState
          title={isHi ? "अभी कोई कमाई नहीं" : "No earnings yet"}
          description={
            isHi
              ? "चेक-आउट करते ही मजदूरी की गणना यहाँ दिखेगी।"
              : "As soon as you check out of a shift, the wage calculation appears here."
          }
        />
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => {
            const breakdown = parseBreakdown(payment.calculationBreakdown);
            return (
              <Card key={payment.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-sm">
                        {payment.assignment.job.title}
                      </CardTitle>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {payment.assignment.job.employer.companyName}
                        {payment.attendance
                          ? ` · ${formatDay(payment.attendance.workDate, lang)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold tabular-nums">
                        {formatPaise(payment.netAmountPaise)}
                      </span>
                      <StatusBadge status={payment.status} lang={lang} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {breakdown ? (
                    <WageBreakdownTable breakdown={breakdown} lang={lang} />
                  ) : null}

                  <details className="rounded-lg border border-[var(--border)] p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      {t("pay.ledger")}{" "}
                      <Badge variant="outline">{payment.ledgerEntries.length}</Badge>
                    </summary>
                    <ul className="mt-2 space-y-1.5 text-xs">
                      {payment.ledgerEntries.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex items-baseline justify-between gap-3"
                        >
                          <span>
                            <span className="font-medium">
                              {isHi
                                ? LEDGER_LABELS[entry.entryType]?.hi
                                : LEDGER_LABELS[entry.entryType]?.en}
                            </span>{" "}
                            <span className="text-[var(--muted-foreground)]">
                              {entry.fromParty} → {entry.toParty}
                            </span>
                          </span>
                          <span className="whitespace-nowrap tabular-nums">
                            {formatPaise(entry.amountPaise)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {payment.paymentReference ? (
                      <p className="mt-2 font-mono text-[10px] text-[var(--muted-foreground)]">
                        {payment.paymentMethod} · {payment.paymentReference}
                      </p>
                    ) : null}
                  </details>

                  {payment.status !== "PAID" ? (
                    <Link
                      href={`/worker/disputes?paymentId=${payment.id}`}
                      className="text-sm font-medium text-[var(--primary)] underline"
                    >
                      {t("dispute.raise")}
                    </Link>
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
