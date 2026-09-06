import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { JobCard } from "@/components/app/job-card";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { computeMatch, type MatchJob, type MatchWorker } from "@/lib/matching";

const SORTS = ["match", "wage", "distance"] as const;
type Sort = (typeof SORTS)[number];

export default async function WorkerJobsPage(props: PageProps<"/worker/jobs">) {
  const { profile } = await requireWorkerProfile();
  const { lang, t } = await getTranslator();
  const searchParams = await props.searchParams;
  const isHi = lang === "hi";

  const query = String(searchParams.q ?? "").trim();
  const sortParam = String(searchParams.sort ?? "match");
  const sort: Sort = SORTS.includes(sortParam as Sort) ? (sortParam as Sort) : "match";

  const [jobs, workerSkills, applications] = await Promise.all([
    prisma.job.findMany({
      where: {
        status: "OPEN",
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { category: { contains: query } },
                { city: { contains: query } },
              ],
            }
          : {}),
      },
      include: {
        employer: true,
        requiredSkills: { include: { skill: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.workerSkill.findMany({
      where: { workerProfileId: profile.id },
      include: { skill: true },
    }),
    prisma.jobApplication.findMany({
      where: { workerProfileId: profile.id },
      select: { jobId: true },
    }),
  ]);

  const appliedIds = new Set(applications.map((a) => a.jobId));

  const matchWorker: MatchWorker = {
    latitude: profile.latitude,
    longitude: profile.longitude,
    travelRadiusKm: profile.travelRadiusKm,
    availability: profile.availability,
    experienceYears: profile.experienceYears,
    reliabilityScore: profile.reliabilityScore,
    preferredWageMinPaise: profile.preferredWageMinPaise,
    skills: workerSkills.map((s) => ({
      skillId: s.skillId,
      nameEn: s.skill.nameEn,
      proficiency: s.proficiency,
    })),
  };

  const scored = jobs.map((job) => {
    const matchJob: MatchJob = {
      latitude: job.latitude,
      longitude: job.longitude,
      wageType: job.wageType,
      wageRatePaise: job.wageRatePaise,
      expectedHoursPerDay: job.expectedHoursPerDay,
      requiredSkills: job.requiredSkills.map((s) => ({
        skillId: s.skillId,
        nameEn: s.skill.nameEn,
        isMandatory: s.isMandatory,
      })),
    };
    return { job, match: computeMatch(matchWorker, matchJob) };
  });

  scored.sort((a, b) => {
    if (sort === "wage") return b.job.wageRatePaise - a.job.wageRatePaise;
    if (sort === "distance") return a.match.distanceKm - b.match.distanceKm;
    return b.match.score - a.match.score;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.jobs")}
        description={
          isHi
            ? "हर काम के साथ मिलान स्कोर और उसका कारण दिखाया गया है।"
            : "Every job shows a match score and the reasoning behind it."
        }
      />

      <form className="flex flex-wrap gap-2" action="/worker/jobs">
        <input
          name="q"
          defaultValue={query}
          placeholder={isHi ? "काम, श्रेणी या शहर खोजें" : "Search title, category or city"}
          className="h-11 min-w-48 flex-1 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-base"
        />
        <select
          name="sort"
          defaultValue={sort}
          className="h-11 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm"
        >
          <option value="match">{isHi ? "मिलान के अनुसार" : "Best match"}</option>
          <option value="wage">{isHi ? "अधिक मजदूरी" : "Highest wage"}</option>
          <option value="distance">{isHi ? "पास का काम" : "Nearest"}</option>
        </select>
        <button
          type="submit"
          className="h-11 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)]"
        >
          {isHi ? "खोजें" : "Search"}
        </button>
      </form>

      {scored.length === 0 ? (
        <EmptyState
          title={isHi ? "कोई काम नहीं मिला" : "No open jobs matched"}
          description={
            isHi
              ? "खोज बदलकर देखें या बाद में फिर आएँ।"
              : "Try a different search, or check back later."
          }
          action={
            query ? (
              <Link href="/worker/jobs" className="text-sm font-medium text-[var(--primary)]">
                {isHi ? "सभी काम देखें" : "Show all jobs"}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {scored.map(({ job, match }) => (
            <JobCard
              key={job.id}
              href={`/worker/jobs/${job.id}`}
              lang={lang}
              match={match}
              applied={appliedIds.has(job.id)}
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
                employerName: job.employer.companyName,
                skills: job.requiredSkills.map((s) =>
                  lang === "hi" ? s.skill.nameHi : s.skill.nameEn,
                ),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
