import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireWorkerProfile } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { getSkillCheckOptions } from "@/lib/skill-evidence";
import { publicQuestionsFor } from "@/lib/skill-questions";
import { TRUST_THRESHOLDS } from "@/lib/skill-trust";
import { SkillCheckForm } from "./skill-check-form";

/**
 * The skill check screen.
 *
 * Questions are loaded here, on the server, and sent to the browser through
 * `publicQuestionsFor` - which strips the answer key. The client component
 * genuinely cannot mark the paper, which is the point: with the answers in the
 * page source the check would prove only that the worker can read HTML.
 */
export default async function SkillCheckPage(
  props: PageProps<"/worker/profile/skill-check">,
) {
  const { profile } = await requireWorkerProfile();
  const { lang, t } = await getTranslator();

  const search = await props.searchParams;
  const requested = typeof search.skill === "string" ? search.skill : undefined;

  const options = await getSkillCheckOptions(profile.id);
  const available = options.filter((option) => option.available);
  const selected =
    available.find((option) => option.skillId === requested) ?? available[0] ?? null;

  return (
    <div className="space-y-5">
      <Link
        href="/worker/profile"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("nav.profile")}
      </Link>

      <PageHeader title={t("assess.title")} description={t("assess.intro")} />

      {available.length === 0 ? (
        <EmptyState
          title={t("assess.unavailableTitle")}
          description={
            options.length === 0 ? t("assess.addSkillsFirst") : t("assess.unavailableBody")
          }
        />
      ) : (
        <>
          {available.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("assess.chooseSkill")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {available.map((option) => {
                  const active = option.skillId === selected?.skillId;
                  return (
                    <Link
                      key={option.skillId}
                      href={`/worker/profile/skill-check?skill=${option.skillId}`}
                      className={
                        active
                          ? "rounded-full border border-[var(--primary)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)]"
                          : "rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm"
                      }
                    >
                      {lang === "hi" ? option.nameHi : option.nameEn}
                      {option.result ? (
                        <span className="ms-1.5 text-xs tabular-nums opacity-80">
                          {option.result.scorePercent}%
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          {selected ? (
            <SkillCheckForm
              lang={lang}
              skillId={selected.skillId}
              skillName={lang === "hi" ? selected.nameHi : selected.nameEn}
              questions={publicQuestionsFor(selected.skillCode)}
              passPercent={TRUST_THRESHOLDS.assessmentPassPercent}
              previous={
                selected.result
                  ? {
                      scorePercent: selected.result.scorePercent,
                      passed: selected.result.passed,
                    }
                  : null
              }
            />
          ) : null}
        </>
      )}
    </div>
  );
}
