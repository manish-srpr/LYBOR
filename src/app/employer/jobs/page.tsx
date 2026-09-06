import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { JobCard } from "@/components/app/job-card";
import { prisma } from "@/lib/db";
import { requireEmployerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";

export default async function EmployerJobsPage() {
  const { profile } = await requireEmployerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const jobs = await prisma.job.findMany({
    where: { employerProfileId: profile.id },
    include: { requiredSkills: { include: { skill: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.myJobs")}
        description={
          isHi ? "आपके पोस्ट किए गए सभी काम।" : "Every job you have posted."
        }
        action={
          <Link href="/employer/jobs/new" className={buttonVariants({ size: "sm" })}>
            {t("nav.postJob")}
          </Link>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          title={isHi ? "अभी कोई काम नहीं" : "No jobs yet"}
          action={
            <Link href="/employer/jobs/new" className={buttonVariants({ size: "sm" })}>
              {t("nav.postJob")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              href={`/employer/jobs/${job.id}`}
              lang={lang}
              job={{
                id: job.id,
                title: job.title,
                city: job.city,
                status: job.status,
                wageType: job.wageType,
                wageRatePaise: job.wageRatePaise,
                startDate: job.startDate,
                endDate: job.endDate,
                shiftStart: job.shiftStart,
                shiftEnd: job.shiftEnd,
                workersRequired: job.workersRequired,
                workersAssigned: job.workersAssigned,
                employerName: profile.companyName,
                skills: job.requiredSkills.map((s) =>
                  isHi ? s.skill.nameHi : s.skill.nameEn,
                ),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
