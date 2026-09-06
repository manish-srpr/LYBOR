import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, DataRow, EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { KycReviewForm } from "./review-form";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";

export default async function AdminKycPage(props: PageProps<"/admin/kyc">) {
  await requireRole("ADMIN");
  const { lang, t } = await getTranslator();
  const searchParams = await props.searchParams;
  const isHi = lang === "hi";
  const showAll = String(searchParams.show ?? "") === "all";

  const records = await prisma.kYCRecord.findMany({
    where: showAll ? {} : { status: "PENDING" },
    include: { user: true, reviewedBy: { select: { fullName: true } } },
    orderBy: { submittedAt: "asc" },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.kyc")}
        description={
          isHi
            ? "दस्तावेज़ संख्या कभी पूरी नहीं दिखती - केवल मास्क और हैश संग्रहित हैं।"
            : "The document number is never shown in full. Only a mask and a salted hash are stored."
        }
        action={
          <a
            href={showAll ? "/admin/kyc" : "/admin/kyc?show=all"}
            className="text-sm font-medium text-[var(--primary)] underline"
          >
            {showAll
              ? isHi
                ? "केवल लंबित"
                : "Pending only"
              : isHi
                ? "सभी देखें"
                : "Show all"}
          </a>
        }
      />

      {records.length === 0 ? (
        <EmptyState
          title={
            isHi ? "समीक्षा के लिए कुछ नहीं" : "Nothing waiting for review"
          }
        />
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <Card key={record.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm">{record.user.fullName}</CardTitle>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {record.user.role} · {record.user.phone}
                    </p>
                  </div>
                  <StatusBadge status={record.status} lang={lang} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="divide-y divide-[var(--border)]">
                  <DataRow label={t("kyc.docType")} value={record.docType} />
                  <DataRow label={t("kyc.holderName")} value={record.holderName} />
                  <DataRow
                    label={t("kyc.docNumber")}
                    value={<span className="font-mono">{record.docNumberMasked}</span>}
                  />
                  <DataRow
                    label={isHi ? "जमा किया" : "Submitted"}
                    value={record.submittedAt.toISOString().slice(0, 10)}
                  />
                  {record.reviewedBy ? (
                    <DataRow
                      label={isHi ? "समीक्षक" : "Reviewed by"}
                      value={record.reviewedBy.fullName}
                    />
                  ) : null}
                </div>

                {record.holderName.trim().toLowerCase() !==
                record.user.fullName.trim().toLowerCase() ? (
                  <Alert tone="warning">
                    {isHi
                      ? "दस्तावेज़ का नाम खाते के नाम से मेल नहीं खाता।"
                      : "The name on the document does not match the account name."}
                  </Alert>
                ) : null}

                {record.rejectionReason ? (
                  <p className="text-sm text-[var(--destructive)]">
                    {record.rejectionReason}
                  </p>
                ) : null}

                {record.status === "PENDING" ? (
                  <KycReviewForm recordId={record.id} lang={lang} />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
