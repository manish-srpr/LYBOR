import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { WageBreakdownTable } from "@/components/app/wage-breakdown";
import { PayForm } from "./pay-form";
import { prisma } from "@/lib/db";
import { requireEmployerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatDay } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { parseBreakdown } from "@/lib/wages";

export default async function EmployerPaymentsPage() {
  const { profile } = await requireEmployerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const payments = await prisma.payment.findMany({
    where: { assignment: { job: { employerProfileId: profile.id } } },
    include: {
      assignment: {
        include: { job: true, worker: { include: { user: true } } },
      },
      attendance: true,
      ledgerEntries: { orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const totals = payments.reduce(
    (acc, payment) => {
      if (payment.status === "PAID") acc.paid += payment.netAmountPaise;
      else if (payment.status === "APPROVED") acc.due += payment.netAmountPaise;
      else if (payment.status === "PENDING") acc.pending += payment.netAmountPaise;
      else acc.disputed += payment.netAmountPaise;
      return acc;
    },
    { paid: 0, due: 0, pending: 0, disputed: 0 },
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.payments")}
        description={
          isHi
            ? "हर भुगतान की गणना वही है जो श्रमिक देखता है।"
            : "Every payment shows the same arithmetic the worker sees."
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("pay.readyToPay")}
          value={formatPaise(totals.due)}
          tone={totals.due > 0 ? "warning" : "default"}
        />
        <Stat label={t("common.paid")} value={formatPaise(totals.paid)} tone="success" />
        <Stat label={t("pay.awaiting")} value={formatPaise(totals.pending)} />
        <Stat label={isHi ? "विवादित" : "Disputed"} value={formatPaise(totals.disputed)} />
      </div>

      {payments.length === 0 ? (
        <EmptyState
          title={isHi ? "अभी कोई भुगतान नहीं" : "No payments yet"}
          description={
            isHi
              ? "श्रमिक के चेक-आउट पर मजदूरी की गणना अपने आप बन जाती है।"
              : "A wage calculation is created automatically when a worker checks out."
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
                    <div>
                      <CardTitle className="text-sm">
                        {payment.assignment.worker.user.fullName}
                      </CardTitle>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {payment.assignment.job.title}
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
                    <details className="rounded-lg border border-[var(--border)] p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        {t("wage.breakdown")}
                      </summary>
                      <div className="mt-3">
                        <WageBreakdownTable breakdown={breakdown} lang={lang} />
                      </div>
                    </details>
                  ) : null}

                  {payment.status === "APPROVED" ? (
                    <PayForm paymentId={payment.id} lang={lang} />
                  ) : payment.status === "PENDING" ? (
                    <Alert tone="warning">
                      {isHi
                        ? "पहले उपस्थिति स्वीकृत करें, फिर भुगतान जारी करें।"
                        : "Approve the attendance first, then release the payment."}
                    </Alert>
                  ) : payment.status === "DISPUTED" ? (
                    <Alert tone="destructive">
                      {isHi
                        ? "यह भुगतान विवाद के कारण रोका गया है। प्रशासक समीक्षा कर रहा है।"
                        : "Frozen by a dispute. An administrator is reviewing it."}
                    </Alert>
                  ) : (
                    <p className="font-mono text-xs text-[var(--muted-foreground)]">
                      {payment.paymentMethod} · {payment.paymentReference}
                    </p>
                  )}

                  <details className="rounded-lg border border-[var(--border)] p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      {t("pay.ledger")}{" "}
                      <Badge variant="outline">{payment.ledgerEntries.length}</Badge>
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {payment.ledgerEntries.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex items-baseline justify-between gap-3"
                        >
                          <span className="text-[var(--muted-foreground)]">
                            {entry.entryType} · {entry.fromParty} → {entry.toParty}
                          </span>
                          <span className="whitespace-nowrap tabular-nums">
                            {formatPaise(entry.amountPaise)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
