import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { DisputeForm } from "@/components/app/dispute-form";
import { DisputeList } from "@/components/app/dispute-list";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";

export default async function WorkerDisputesPage(props: PageProps<"/worker/disputes">) {
  const { session } = await requireWorkerProfile();
  const { lang, t } = await getTranslator();
  const searchParams = await props.searchParams;
  const isHi = lang === "hi";

  const context = {
    jobId: searchParams.jobId ? String(searchParams.jobId) : undefined,
    assignmentId: searchParams.assignmentId
      ? String(searchParams.assignmentId)
      : undefined,
    attendanceId: searchParams.attendanceId
      ? String(searchParams.attendanceId)
      : undefined,
    paymentId: searchParams.paymentId ? String(searchParams.paymentId) : undefined,
  };

  const disputes = await prisma.dispute.findMany({
    where: { raisedByUserId: session.userId },
    include: { job: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.disputes")}
        description={
          isHi
            ? "मजदूरी, घंटे या भुगतान पर असहमति दर्ज करें। एक प्रशासक समीक्षा करेगा।"
            : "Raise a disagreement about wages, hours or payment. An administrator reviews it."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("dispute.raise")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DisputeForm lang={lang} context={context} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {isHi ? "आपकी शिकायतें" : "Your disputes"}
        </h2>
        <DisputeList
          lang={lang}
          emptyTitle={isHi ? "कोई शिकायत नहीं" : "No disputes raised"}
          disputes={disputes.map((dispute) => ({
            id: dispute.id,
            category: dispute.category,
            reason: dispute.reason,
            description: dispute.description,
            status: dispute.status,
            createdAt: dispute.createdAt,
            adminResolution: dispute.adminResolution,
            jobTitle: dispute.job?.title ?? null,
          }))}
        />
      </section>
    </div>
  );
}
