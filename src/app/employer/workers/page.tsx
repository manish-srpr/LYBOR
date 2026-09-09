import Link from "next/link";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { prisma } from "@/lib/db";
import { requireEmployerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { distanceKm } from "@/lib/geo";
import { getWorkerTrustMany } from "@/lib/skill-evidence";
import { TRUST_LEVEL_META, TRUST_LEVELS, type TrustLevel } from "@/lib/skill-trust";
import type { MessageKey } from "@/lib/i18n";

/**
 * The employer's side of the marketplace: workers, not jobs.
 *
 * This screen exists because the employer had no way to find anybody. Worker
 * profiles were reachable only at /employer/workers/[id], which means only
 * from an application they had already received - so an employer with no
 * applicants could not look for one. Their dashboard showed the jobs they had
 * posted, which is a worker's view of the world pointed at themselves.
 *
 * Everything here reads existing columns. Distance comes from the lat/lng both
 * profiles already store, standing from the same deriveSkillTrust ladder the
 * profile page uses, and the trades from the existing Skill table - no second
 * skill vocabulary, no new models, and no tracking: a worker's stored address
 * is what they entered themselves, read once when this page renders.
 */

const RADIUS_CHOICES = [5, 10, 25, 50, 100] as const;
const DEFAULT_RADIUS = 25;

export default async function EmployerWorkersPage(
  props: PageProps<"/employer/workers">,
) {
  // Authorisation, server-side. The layout already requires the EMPLOYER
  // role; this repeats it so the page is safe on its own terms rather than
  // relying on a parent that a future refactor might change.
  const { profile: employer } = await requireEmployerProfile();
  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";
  const searchParams = await props.searchParams;

  const tradeParam = String(searchParams.trade ?? "").trim();
  const levelParam = String(searchParams.level ?? "").trim();
  const availableOnly = String(searchParams.available ?? "") === "1";
  const radiusRaw = Number(searchParams.within ?? DEFAULT_RADIUS);
  const radiusKm = RADIUS_CHOICES.includes(radiusRaw as (typeof RADIUS_CHOICES)[number])
    ? radiusRaw
    : DEFAULT_RADIUS;
  const level = (TRUST_LEVELS as readonly string[]).includes(levelParam)
    ? (levelParam as TrustLevel)
    : null;

  const [skills, candidates] = await Promise.all([
    prisma.skill.findMany({ orderBy: { nameEn: "asc" } }),
    prisma.workerProfile.findMany({
      where: {
        user: { isActive: true },
        ...(availableOnly ? { availability: "AVAILABLE" } : {}),
        ...(tradeParam ? { skills: { some: { skill: { code: tradeParam } } } } : {}),
      },
      include: {
        user: { select: { fullName: true } },
        skills: { include: { skill: true }, orderBy: { skill: { nameEn: "asc" } } },
      },
      // A bound on the set, so one query cannot walk the whole table. Distance
      // and standing are applied below, on this page.
      take: 120,
    }),
  ]);

  const site = { latitude: employer.latitude, longitude: employer.longitude };

  const withDistance = candidates
    .map((worker) => ({ worker, km: distanceKm(site, worker) }))
    .filter((row) => row.km <= radiusKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, 40);

  // One batched lookup for the whole page rather than four queries per row.
  const trustById = await getWorkerTrustMany(withDistance.map((r) => r.worker.id));

  const rows = withDistance
    .map((row) => ({ ...row, trust: trustById.get(row.worker.id) ?? null }))
    .filter((row) => {
      if (!level) return true;
      // Filtering by a level means "at least this good", which is what an
      // employer means when they pick one.
      const held = row.trust?.headline?.level;
      if (!held) return level === "SELF_DECLARED";
      return TRUST_LEVEL_META[held].order >= TRUST_LEVEL_META[level].order;
    });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("emp.findWorkersTitle")}
        description={t("emp.findWorkersIntro")}
      />

      {/* A plain GET form: no JavaScript, bookmarkable, and it survives a
          reload - which matters on the handsets this is built for. */}
      <form action="/employer/workers" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            {t("emp.filterTrade")}
          </span>
          <Select name="trade" defaultValue={tradeParam} className="text-sm">
            <option value="" className="bg-[var(--card)] text-[var(--card-foreground)]">
              {t("emp.anyTrade")}
            </option>
            {skills.map((skill) => (
              <option
                key={skill.id}
                value={skill.code}
                className="bg-[var(--card)] text-[var(--card-foreground)]"
              >
                {isHi ? skill.nameHi : skill.nameEn}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            {t("emp.filterTrust")}
          </span>
          <Select name="level" defaultValue={levelParam} className="text-sm">
            <option value="" className="bg-[var(--card)] text-[var(--card-foreground)]">
              {t("emp.anyLevel")}
            </option>
            {TRUST_LEVELS.map((code) => (
              <option
                key={code}
                value={code}
                className="bg-[var(--card)] text-[var(--card-foreground)]"
              >
                {t(TRUST_LEVEL_META[code].labelKey as MessageKey)}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            {t("emp.filterRadius")}
          </span>
          <Select name="within" defaultValue={String(radiusKm)} className="text-sm">
            {RADIUS_CHOICES.map((km) => (
              <option
                key={km}
                value={km}
                className="bg-[var(--card)] text-[var(--card-foreground)]"
              >
                {km} {t("common.km")}
              </option>
            ))}
          </Select>
        </label>

        <div className="flex items-end gap-2">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm">
            <input
              type="checkbox"
              name="available"
              value="1"
              defaultChecked={availableOnly}
              className="size-4 accent-[var(--primary)]"
            />
            <span className="truncate">{t("emp.availableOnly")}</span>
          </label>
          <button
            type="submit"
            className="h-11 shrink-0 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)]"
          >
            {t("common.search")}
          </button>
        </div>
      </form>

      <p className="text-xs text-[var(--muted-foreground)]">
        {rows.length} {isHi ? "श्रमिक" : rows.length === 1 ? "worker" : "workers"}
        {" · "}
        {t("emp.filterRadius")} {radiusKm} {t("common.km")}
      </p>

      {rows.length === 0 ? (
        <EmptyState title={t("emp.noWorkers")} description={t("emp.noWorkersBody")} />
      ) : (
        <div className="grid gap-3">
          {rows.map(({ worker, km, trust }) => {
            const headline = trust?.headline ?? null;
            const meta = headline ? TRUST_LEVEL_META[headline.level] : null;
            return (
              <Link
                key={worker.id}
                href={`/employer/workers/${worker.id}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{worker.user.fullName}</p>
                      {meta ? (
                        <Badge variant={meta.tone}>
                          {t(meta.labelKey as MessageKey)}
                        </Badge>
                      ) : null}
                      {worker.availability === "AVAILABLE" ? (
                        <Badge variant="success">{t("profile.availability")}</Badge>
                      ) : null}
                    </div>

                    {/* The trades themselves, from the existing Skill table. */}
                    <div className="flex flex-wrap gap-1.5">
                      {worker.skills.slice(0, 4).map((ws) => (
                        <Badge key={ws.id} variant="outline">
                          {isHi ? ws.skill.nameHi : ws.skill.nameEn}
                        </Badge>
                      ))}
                      {worker.skills.length === 0 ? (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {t("profile.noSkills")}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs text-[var(--muted-foreground)]">
                      {t("emp.workerSummary", {
                        years: worker.experienceYears,
                        jobs: worker.totalJobsCompleted,
                      })}
                      {worker.averageRating > 0 ? (
                        <span className="ml-1 inline-flex items-center gap-0.5">
                          · <Star className="size-3 fill-current" aria-hidden />
                          {worker.averageRating.toFixed(1)}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                      <MapPin className="size-3.5" aria-hidden />
                      {km < 1 ? "<1" : km.toFixed(km < 10 ? 1 : 0)} {t("common.km")}
                    </span>
                    <ArrowRight
                      className="size-4 text-[var(--muted-foreground)]"
                      aria-hidden
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[var(--muted-foreground)]">{t("trust.disclaimer")}</p>
    </div>
  );
}
