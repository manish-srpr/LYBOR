import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { MatchExplainer } from "@/components/app/match-explainer";
import { StatusBadge } from "@/components/app/status-badge";
import { wageLabel } from "@/components/app/job-card";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { parseFactors } from "@/lib/matching";
import { withdrawApplicationAction } from "@/server/actions/jobs";

export default async function WorkerApplicationsPage() {
  const { profile } = await requireWorkerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const applications = await prisma.jobApplication.findMany({
    where: { workerProfileId: profile.id },
    include: { job: { include: { employer: true } } },
    orderBy: { appliedAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.applications")}
        description={
          isHi
            ? "आपके भेजे गए आवेदन और उनकी स्थिति।"
            : "Everything you have applied for, and where it stands."
        }
      />

      {applications.length === 0 ? (
        <EmptyState
          title={isHi ? "कोई आवेदन नहीं" : "No applications yet"}
          action={
            <Link href="/worker/jobs" className={buttonVariants({ size: "sm" })}>
              {t("nav.jobs")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {applications.map((application) => {
            const factors = parseFactors(application.matchFactors);
            return (
              <Card key={application.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>
                        <Link
                          href={`/worker/jobs/${application.jobId}`}
                          className="hover:underline"
                        >
                          {application.job.title}
                        </Link>
                      </CardTitle>
                      <p className="truncate text-sm text-[var(--muted-foreground)]">
                        {application.job.employer.companyName} ·{" "}
                        {wageLabel(
                          application.job.wageType,
                          application.job.wageRatePaise,
                          lang,
                        )}
                      </p>
                    </div>
                    <StatusBadge status={application.status} lang={lang} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {application.coverNote ? (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {application.coverNote}
                    </p>
                  ) : null}

                  {application.matchScore !== null && factors.length > 0 ? (
                    <MatchExplainer
                      score={Math.round(application.matchScore)}
                      factors={factors}
                      lang={lang}
                      summary={
                        isHi
                          ? "आवेदन के समय दर्ज किया गया स्कोर।"
                          : "The score recorded at the moment you applied."
                      }
                    />
                  ) : null}

                  {application.status === "ACCEPTED" ? (
                    <Link
                      href="/worker/assignments"
                      className={buttonVariants({ size: "sm", variant: "success" })}
                    >
                      {t("nav.assignments")}
                    </Link>
                  ) : application.status === "PENDING" ||
                    application.status === "SHORTLISTED" ? (
                    <form action={withdrawApplicationAction}>
                      <input
                        type="hidden"
                        name="applicationId"
                        value={application.id}
                      />
                      <button
                        type="submit"
                        className="text-sm font-medium text-[var(--destructive)] underline"
                      >
                        {isHi ? "आवेदन वापस लें" : "Withdraw application"}
                      </button>
                    </form>
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
