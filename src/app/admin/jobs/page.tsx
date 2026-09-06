import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { StatusBadge, statusLabel } from "@/components/app/status-badge";
import { wageLabel } from "@/components/app/job-card";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatDateRange, plural } from "@/lib/format";

const STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export default async function AdminJobsPage(props: PageProps<"/admin/jobs">) {
  await requireRole("ADMIN");
  const { lang, t } = await getTranslator();
  const searchParams = await props.searchParams;
  const isHi = lang === "hi";
  const filter = String(searchParams.status ?? "");
  const active = STATUSES.find((s) => s === filter);

  const [jobs, counts] = await Promise.all([
    prisma.job.findMany({
      where: active ? { status: active } : {},
      include: {
        employer: true,
        requiredSkills: { include: { skill: true } },
        _count: { select: { applications: true, assignments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.job.groupBy({ by: ["status"], _count: true }),
  ]);

  const countOf = (status: string) =>
    counts.find((c) => c.status === status)?._count ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={isHi ? "सभी काम" : "All jobs"}
        description={
          isHi
            ? "प्लेटफ़ॉर्म पर पोस्ट किया गया हर काम, नियोक्ता और भर्ती की स्थिति सहित।"
            : "Every job posted on the platform, with its employer and fill status."
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("common.open")} value={String(countOf("OPEN"))} />
        <Stat
          label={isHi ? "चल रहे" : "In progress"}
          value={String(countOf("IN_PROGRESS"))}
          tone="warning"
        />
        <Stat
          label={isHi ? "पूरे" : "Completed"}
          value={String(countOf("COMPLETED"))}
          tone="success"
        />
        <Stat label={isHi ? "रद्द" : "Cancelled"} value={String(countOf("CANCELLED"))} />
      </div>

      <div className="flex flex-wrap gap-2">
        {["", ...STATUSES].map((status) => (
          <a
            key={status || "all"}
            href={status ? `/admin/jobs?status=${status}` : "/admin/jobs"}
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

      {jobs.length === 0 ? (
        <EmptyState title={isHi ? "कोई काम नहीं मिला" : "No jobs match this filter"} />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm">{job.title}</CardTitle>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {job.employer.companyName} · {job.city} ·{" "}
                      {formatDateRange(job.startDate, job.endDate, lang)}
                    </p>
                  </div>
                  <StatusBadge status={job.status} lang={lang} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-[var(--muted-foreground)]">{t("job.wage")}</dt>
                    <dd className="font-medium">
                      {wageLabel(job.wageType, job.wageRatePaise, lang)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">
                      {t("job.openings")}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {job.workersAssigned}/{job.workersRequired}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">
                      {t("job.applicants")}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {job._count.applications}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">
                      {isHi ? "जीपीएस सीमा" : "Geofence"}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {job.checkInRadiusMeters} m
                    </dd>
                  </div>
                </dl>
                {job.requiredSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {job.requiredSkills.map((s) => (
                      <Badge key={s.id} variant="outline">
                        {isHi ? s.skill.nameHi : s.skill.nameEn}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <p className="text-xs text-[var(--muted-foreground)]">
                  {isHi
                    ? `${job._count.assignments} नियुक्तियाँ`
                    : plural(job._count.assignments, "assignment")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
