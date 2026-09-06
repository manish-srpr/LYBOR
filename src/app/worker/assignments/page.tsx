import Link from "next/link";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { wageLabel } from "@/components/app/job-card";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatDateRange, plural } from "@/lib/format";
import { formatMinutes } from "@/lib/money";

export default async function WorkerAssignmentsPage() {
  const { profile } = await requireWorkerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const assignments = await prisma.jobAssignment.findMany({
    where: { workerProfileId: profile.id },
    include: {
      job: { include: { employer: true } },
      attendances: { select: { workingMinutes: true, approvalStatus: true } },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.assignments")}
        description={
          isHi
            ? "हर नियुक्ति पर चेक-इन, चेक-आउट और सत्यापित घंटे।"
            : "Check in, check out and see verified hours for each assignment."
        }
      />

      {assignments.length === 0 ? (
        <EmptyState
          title={isHi ? "अभी कोई नियुक्ति नहीं" : "No assignments yet"}
          description={
            isHi
              ? "काम के लिए आवेदन करें। स्वीकृति मिलते ही नियुक्ति यहाँ दिखेगी।"
              : "Apply for work. Once an employer accepts you, the assignment appears here."
          }
          action={
            <Link href="/worker/jobs" className={buttonVariants({ size: "sm" })}>
              {t("nav.jobs")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {assignments.map((assignment) => {
            const verifiedMinutes = assignment.attendances.reduce(
              (sum, a) => sum + (a.workingMinutes ?? 0),
              0,
            );
            const pendingDays = assignment.attendances.filter(
              (a) => a.approvalStatus === "PENDING",
            ).length;
            return (
              <Link
                key={assignment.id}
                href={`/worker/assignments/${assignment.id}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--primary)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{assignment.job.title}</p>
                    <p className="truncate text-sm text-[var(--muted-foreground)]">
                      {assignment.job.employer.companyName}
                    </p>
                  </div>
                  <StatusBadge status={assignment.status} lang={lang} />
                </div>

                <p className="mt-2 text-sm font-semibold text-[var(--primary)]">
                  {wageLabel(
                    assignment.agreedWageType,
                    assignment.agreedWageRatePaise,
                    lang,
                  )}
                </p>

                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{assignment.job.city}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3.5 shrink-0" aria-hidden />
                    <span>{formatMinutes(verifiedMinutes)} {isHi ? "सत्यापित" : "verified"}</span>
                  </div>
                  <div className="col-span-2">
                    {formatDateRange(assignment.startDate, assignment.endDate, lang)}
                    {pendingDays > 0
                      ? isHi
                        ? ` · ${pendingDays} दिन स्वीकृति बाकी`
                        : ` · ${plural(pendingDays, "day")} awaiting approval`
                      : ""}
                  </div>
                </dl>

                <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]">
                  {t("att.checkIn")} / {t("att.checkOut")}
                  <ArrowRight className="size-3.5" aria-hidden />
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
