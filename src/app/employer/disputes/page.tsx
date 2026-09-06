import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { DisputeForm } from "@/components/app/dispute-form";
import { DisputeList } from "@/components/app/dispute-list";
import { prisma } from "@/lib/db";
import { requireEmployerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";

export default async function EmployerDisputesPage() {
  const { session, profile } = await requireEmployerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  // An employer sees both what they raised and what was raised against their
  // jobs; hiding the latter would let a dispute be resolved behind their back.
  const [raised, against] = await Promise.all([
    prisma.dispute.findMany({
      where: { raisedByUserId: session.userId },
      include: { job: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dispute.findMany({
      where: {
        job: { employerProfileId: profile.id },
        raisedByUserId: { not: session.userId },
      },
      include: {
        job: { select: { title: true } },
        raisedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.disputes")}
        description={
          isHi
            ? "आपके कामों से जुड़ी सभी शिकायतें।"
            : "Every dispute connected to your jobs."
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {isHi ? "आपके कामों पर शिकायतें" : "Raised against your jobs"}
        </h2>
        <DisputeList
          lang={lang}
          emptyTitle={isHi ? "कोई शिकायत नहीं" : "No disputes raised against you"}
          disputes={against.map((dispute) => ({
            id: dispute.id,
            category: dispute.category,
            reason: dispute.reason,
            description: dispute.description,
            status: dispute.status,
            createdAt: dispute.createdAt,
            adminResolution: dispute.adminResolution,
            jobTitle: dispute.job?.title ?? null,
            raisedByName: dispute.raisedBy.fullName,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {isHi ? "आपकी शिकायतें" : "Disputes you raised"}
        </h2>
        <DisputeList
          lang={lang}
          emptyTitle={isHi ? "आपने कोई शिकायत नहीं की" : "You have not raised any disputes"}
          disputes={raised.map((dispute) => ({
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

      <Card>
        <CardHeader>
          <CardTitle>{t("dispute.raise")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DisputeForm lang={lang} />
        </CardContent>
      </Card>
    </div>
  );
}
