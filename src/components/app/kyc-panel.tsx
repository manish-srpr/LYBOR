import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, DataRow, PageHeader } from "@/components/ui/misc";
import { KycForm } from "./kyc-form";
import { StatusBadge } from "./status-badge";
import { prisma } from "@/lib/db";
import type { Lang } from "@/lib/i18n";

const DOC_LABELS: Record<string, { en: string; hi: string }> = {
  AADHAAR: { en: "Aadhaar", hi: "आधार" },
  PAN: { en: "PAN", hi: "पैन" },
  DRIVING_LICENSE: { en: "Driving licence", hi: "ड्राइविंग लाइसेंस" },
  VOTER_ID: { en: "Voter ID", hi: "मतदाता पहचान पत्र" },
  LABOUR_CARD: { en: "Labour card", hi: "श्रमिक कार्ड" },
};

export async function KycPanel({
  userId,
  fullName,
  kycStatus,
  lang,
}: {
  userId: string;
  fullName: string;
  kycStatus: string;
  lang: Lang;
}) {
  const isHi = lang === "hi";
  const records = await prisma.kYCRecord.findMany({
    where: { userId },
    orderBy: { submittedAt: "desc" },
  });
  const canSubmit = !records.some((r) => r.status === "PENDING" || r.status === "VERIFIED");

  return (
    <div className="space-y-5">
      <PageHeader
        title={isHi ? "पहचान सत्यापन" : "Identity verification"}
        description={
          isHi
            ? "सत्यापित पहचान से नियोक्ता का भरोसा बढ़ता है।"
            : "A verified identity is what earns an employer trust."
        }
        action={<StatusBadge status={kycStatus} lang={lang} />}
      />

      {kycStatus === "VERIFIED" ? (
        <Alert tone="success" title={isHi ? "पहचान सत्यापित" : "Identity verified"}>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-[var(--success)]" aria-hidden />
            {isHi
              ? "आपका ट्रस्ट बैज सक्रिय है।"
              : "Your trust badge is active on your profile."}
          </span>
        </Alert>
      ) : null}

      {records.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{isHi ? "जमा किए गए दस्तावेज़" : "Submitted documents"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {records.map((record) => (
              <div
                key={record.id}
                className="rounded-lg border border-[var(--border)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {isHi
                      ? DOC_LABELS[record.docType]?.hi
                      : DOC_LABELS[record.docType]?.en}
                  </span>
                  <StatusBadge status={record.status} lang={lang} />
                </div>
                <div className="mt-1 divide-y divide-[var(--border)]">
                  <DataRow
                    label={isHi ? "नाम" : "Name"}
                    value={record.holderName}
                  />
                  <DataRow
                    label={isHi ? "संख्या" : "Number"}
                    value={
                      <span className="font-mono">{record.docNumberMasked}</span>
                    }
                  />
                  <DataRow
                    label={isHi ? "जमा किया" : "Submitted"}
                    value={record.submittedAt.toISOString().slice(0, 10)}
                  />
                </div>
                {record.rejectionReason ? (
                  <p className="mt-2 text-xs text-[var(--destructive)]">
                    {record.rejectionReason}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canSubmit ? (
        <Card>
          <CardHeader>
            <CardTitle>{isHi ? "दस्तावेज़ जमा करें" : "Submit a document"}</CardTitle>
          </CardHeader>
          <CardContent>
            <KycForm lang={lang} defaultName={fullName} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
