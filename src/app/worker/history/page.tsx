import { BadgeCheck, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatMinutes, formatPaise } from "@/lib/money";

function parseSkills(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

export default async function WorkerHistoryPage() {
  const { profile } = await requireWorkerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  const history = await prisma.workHistory.findMany({
    where: { workerProfileId: profile.id },
    orderBy: { endDate: "desc" },
  });

  const totals = history.reduce(
    (acc, entry) => {
      acc.minutes += entry.totalVerifiedMinutes;
      acc.days += entry.totalDaysWorked;
      acc.earnings += entry.totalEarningsPaise;
      if (entry.employerRating) {
        acc.ratingSum += entry.employerRating;
        acc.ratingCount += 1;
      }
      return acc;
    },
    { minutes: 0, days: 0, earnings: 0, ratingSum: 0, ratingCount: 0 },
  );
  const averageRating =
    totals.ratingCount > 0 ? totals.ratingSum / totals.ratingCount : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("history.verified")}
        description={
          isHi
            ? "हर रिकॉर्ड जीपीएस-सत्यापित घंटों और नियोक्ता स्वीकृति पर आधारित है।"
            : "Every record is built from GPS-verified hours and employer approvals."
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={isHi ? "पूरे किए गए काम" : "Jobs completed"}
          value={String(history.length)}
        />
        <Stat label={t("history.daysWorked")} value={String(totals.days)} />
        <Stat label={t("att.verifiedHours")} value={formatMinutes(totals.minutes)} />
        <Stat
          label={t("pay.totalEarned")}
          value={formatPaise(totals.earnings, { compact: true })}
          tone="success"
        />
      </div>

      {averageRating > 0 ? (
        <p className="flex items-center gap-1.5 text-sm">
          <Star className="size-4 fill-[var(--warning)] text-[var(--warning)]" aria-hidden />
          <span className="font-medium tabular-nums">{averageRating.toFixed(1)}</span>
          <span className="text-[var(--muted-foreground)]">
            {isHi
              ? `${totals.ratingCount} नियोक्ता रेटिंग का औसत`
              : `average across ${totals.ratingCount} employer rating(s)`}
          </span>
        </p>
      ) : null}

      {history.length === 0 ? (
        <EmptyState
          title={isHi ? "अभी कोई सत्यापित इतिहास नहीं" : "No verified history yet"}
          description={
            isHi
              ? "जैसे ही कोई काम पूरा होगा, वह यहाँ स्थायी रूप से दर्ज हो जाएगा।"
              : "As soon as a job is completed, it is recorded here permanently."
          }
        />
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm">{entry.jobTitle}</CardTitle>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {entry.employerName} · {entry.category}
                    </p>
                  </div>
                  {entry.isVerified ? (
                    <Badge variant="success">
                      <BadgeCheck className="size-3" aria-hidden />
                      {isHi ? "सत्यापित" : "Verified"}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-[var(--muted-foreground)]">
                      {isHi ? "अवधि" : "Period"}
                    </dt>
                    <dd className="font-medium">
                      {entry.startDate.toISOString().slice(0, 10)} →{" "}
                      {entry.endDate.toISOString().slice(0, 10)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">
                      {t("history.daysWorked")}
                    </dt>
                    <dd className="font-medium tabular-nums">{entry.totalDaysWorked}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">
                      {t("att.verifiedHours")}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {formatMinutes(entry.totalVerifiedMinutes)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">
                      {t("pay.totalEarned")}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {formatPaise(entry.totalEarningsPaise)}
                    </dd>
                  </div>
                </dl>

                {parseSkills(entry.skillsUsed).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {parseSkills(entry.skillsUsed).map((skill) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {entry.employerRating ? (
                  <p className="flex items-center gap-1 text-sm">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        className={
                          index < (entry.employerRating ?? 0)
                            ? "size-3.5 fill-[var(--warning)] text-[var(--warning)]"
                            : "size-3.5 text-[var(--muted-foreground)]"
                        }
                        aria-hidden
                      />
                    ))}
                    {entry.employerReview ? (
                      <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                        {entry.employerReview}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
