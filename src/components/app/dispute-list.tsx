import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "./status-badge";
import type { Lang } from "@/lib/i18n";

const CATEGORY_LABELS: Record<string, { en: string; hi: string }> = {
  WAGE: { en: "Wage amount", hi: "मजदूरी की राशि" },
  HOURS: { en: "Hours recorded", hi: "दर्ज घंटे" },
  ATTENDANCE: { en: "Attendance decision", hi: "उपस्थिति का निर्णय" },
  PAYMENT_DELAY: { en: "Payment delay", hi: "भुगतान में देरी" },
  SAFETY: { en: "Safety", hi: "सुरक्षा" },
  BEHAVIOUR: { en: "Behaviour", hi: "व्यवहार" },
  OTHER: { en: "Other", hi: "अन्य" },
};

export type DisputeListItem = {
  id: string;
  category: string;
  reason: string;
  description: string;
  status: string;
  createdAt: Date;
  adminResolution: string | null;
  jobTitle?: string | null;
  raisedByName?: string | null;
};

export function DisputeList({
  disputes,
  lang,
  emptyTitle,
}: {
  disputes: DisputeListItem[];
  lang: Lang;
  emptyTitle: string;
}) {
  const isHi = lang === "hi";
  if (disputes.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <div className="space-y-3">
      {disputes.map((dispute) => (
        <Card key={dispute.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm">{dispute.reason}</CardTitle>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {isHi
                    ? CATEGORY_LABELS[dispute.category]?.hi
                    : CATEGORY_LABELS[dispute.category]?.en}
                  {dispute.jobTitle ? ` · ${dispute.jobTitle}` : ""}
                  {dispute.raisedByName ? ` · ${dispute.raisedByName}` : ""}
                  {" · "}
                  {dispute.createdAt.toISOString().slice(0, 10)}
                </p>
              </div>
              <StatusBadge status={dispute.status} lang={lang} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-[var(--muted-foreground)]">{dispute.description}</p>
            {dispute.adminResolution ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-sm">
                <p className="font-medium">{isHi ? "समाधान" : "Resolution"}</p>
                <p className="mt-0.5 text-[var(--muted-foreground)]">
                  {dispute.adminResolution}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
