import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { StatusBadge, statusLabel } from "@/components/app/status-badge";
import { WageBreakdownTable } from "@/components/app/wage-breakdown";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatDay } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { parseBreakdown } from "@/lib/wages";

const STATUSES = ["PENDING", "APPROVED", "PAID", "DISPUTED"] as const;

export default async function AdminPaymentsPage(props: PageProps<"/admin/payments">) {
  await requireRole("ADMIN");
  const { lang, t } = await getTranslator();
  const searchParams = await props.searchParams;
  const isHi = lang === "hi";
  const filter = String(searchParams.status ?? "");
  const active = STATUSES.find((s) => s === filter);

  const [payments, grouped] = await Promise.all([
    prisma.payment.findMany({
      where: active ? { status: active } : {},
      include: {
        assignment: {
          include: {
            job: { include: { employer: true } },
            worker: { include: { user: true } },
          },
        },
        attendance: true,
        ledgerEntries: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.payment.groupBy({
      by: ["status"],
      _count: true,
      _sum: { netAmountPaise: true },
    }),
  ]);

  const sumOf = (status: string) =>
    grouped.find((g) => g.status === status)?._sum.netAmountPaise ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.payments")}
        description={
          isHi
            ? "पूरे प्लेटफ़ॉर्म का पैसा, वही गणना जो श्रमिक और नियोक्ता देखते हैं।"
            : "Money across the whole platform, with the same arithmetic both sides see."
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("pay.awaiting")}
          value={formatPaise(sumOf("PENDING"), { compact: true })}
        />
        <Stat
          label={t("pay.readyToPay")}
          value={formatPaise(sumOf("APPROVED"), { compact: true })}
          tone="warning"
        />
        <Stat
          label={t("common.paid")}
          value={formatPaise(sumOf("PAID"), { compact: true })}
          tone="success"
        />
        <Stat
          label={isHi ? "विवादित" : "Disputed"}
          value={formatPaise(sumOf("DISPUTED"), { compact: true })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {["", ...STATUSES].map((status) => (
          <a
            key={status || "all"}
            href={status ? `/admin/payments?status=${status}` : "/admin/payments"}
            className={
              filter === status
                ? "rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]"
                : "rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]"
            }
          >
            {status ? statusLabel(status, lang) : isHi ? "सभी" : "All"}
          </a>
        ))}
      </div>

      {payments.length === 0 ? (
        <EmptyState title={isHi ? "कोई भुगतान नहीं" : "No payments match this filter"} />
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
                        {payment.assignment.worker.user.fullName}
                      </CardTitle>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {payment.assignment.job.employer.companyName} ·{" "}
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
                    {payment.paymentReference ? (
                      <p className="mt-2 font-mono text-[10px] text-[var(--muted-foreground)]">
                        {payment.paymentMethod} · {payment.paymentReference}
                      </p>
                    ) : null}
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
