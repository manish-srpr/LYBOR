import { BadgeCheck, ClipboardCheck, Star, UserPen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TRUST_LEVEL_META, type SkillTrust, type TrustSentence } from "@/lib/skill-trust";
import { translatorFor, type Lang, type MessageKey } from "@/lib/i18n";

/**
 * A worker's skills with the evidence behind each one, shown side by side.
 *
 * The layout is the argument. Before this, an employer saw "EXPERT" as a bare
 * badge next to a skill and had no way to know the worker had typed it into a
 * dropdown themselves. So each row has two columns that are always both
 * present: what the worker says, and what could be corroborated. An empty
 * right-hand column is informative - it says this claim is untested, which is
 * the true state of a new worker's profile and not a defect to hide.
 *
 * Used by the worker's own profile and by the employer's view of them, from one
 * component, so the two can never drift into telling different stories.
 * `showNextSteps` is the only difference: the worker gets told how to move up,
 * where an employer would only be reading coaching notes about somebody else.
 */

const LEVEL_ICON = {
  SELF_DECLARED: UserPen,
  SKILLED: ClipboardCheck,
  VERIFIED: BadgeCheck,
  EXPERT: BadgeCheck,
} as const;

/** Self-declared proficiency, which is a claim and is labelled as one. */
const PROFICIENCY_KEY: Record<string, MessageKey> = {
  BEGINNER: "trust.proficiencyBeginner",
  INTERMEDIATE: "trust.proficiencyIntermediate",
  EXPERT: "trust.proficiencyExpert",
};

export function SkillTrustPanel({
  skills,
  lang,
  showNextSteps = false,
}: {
  skills: SkillTrust[];
  lang: Lang;
  showNextSteps?: boolean;
}) {
  const t = translatorFor(lang);
  const say = (sentence: TrustSentence) =>
    t(sentence.key as MessageKey, sentence.params);

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
      aria-label={t("trust.sectionTitle")}
    >
      <div className="border-b border-[var(--border)] bg-[var(--muted)]/50 p-4">
        <h2 className="text-sm font-semibold">{t("trust.sectionTitle")}</h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {t("trust.sectionIntro")}
        </p>
      </div>

      {skills.length === 0 ? (
        <p className="p-4 text-sm text-[var(--muted-foreground)]">
          {t("trust.noSkills")}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {skills.map((skill) => {
            const meta = TRUST_LEVEL_META[skill.level];
            const Icon = LEVEL_ICON[skill.level];
            return (
              <li key={skill.skillCode} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{skill.skillName}</h3>
                  <Badge variant={meta.tone}>
                    <Icon className="size-3" aria-hidden />
                    {t(meta.labelKey as MessageKey)}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* The claim. */}
                  <div className="rounded-lg border border-dashed border-[var(--border)] p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      {t("trust.selfDeclaredHeading")}
                    </p>
                    <p className="mt-1.5 text-sm">
                      {t(
                        PROFICIENCY_KEY[skill.selfDeclaredProficiency] ??
                          "trust.proficiencyIntermediate",
                      )}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {t.plural("trust.selfDeclaredYears", skill.selfDeclaredYears)}
                    </p>
                  </div>

                  {/* What somebody else can corroborate. */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      {t("trust.verifiedHeading")}
                    </p>
                    <ul className="mt-1.5 space-y-0.5 text-sm">
                      <li>
                        {skill.assessmentPercent === null
                          ? t("trust.checkNotTaken")
                          : t("trust.checkScore", { percent: skill.assessmentPercent })}
                      </li>
                      <li>
                        {t.plural("trust.verifiedJobs", skill.verifiedJobs)}
                      </li>
                      {skill.averageRating !== null ? (
                        <li className="flex items-center gap-1">
                          <Star
                            className="size-3.5 fill-[var(--warning)] text-[var(--warning)]"
                            aria-hidden
                          />
                          <span className="tabular-nums">
                            {skill.averageRating.toFixed(1)}/5
                          </span>
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {t.plural("trust.fromEmployers", skill.ratingCount)}
                          </span>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </div>

                <p className="text-xs text-[var(--muted-foreground)]">
                  <span className="font-medium text-[var(--foreground)]">
                    {t("trust.basisLabel")}:
                  </span>{" "}
                  {say(skill.basis)}
                </p>

                {showNextSteps && skill.nextStep ? (
                  <p className="rounded-lg bg-[var(--primary)]/10 p-2.5 text-xs text-[var(--foreground)]">
                    <span className="font-medium">{t("trust.nextStepLabel")}:</span>{" "}
                    {say(skill.nextStep)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/*
        Load-bearing, like the reliability disclaimer. Five questions and a
        handful of ratings are evidence, not a guarantee about a person, and
        saying so is what keeps the badges honest.
      */}
      <p className="border-t border-[var(--border)] p-4 text-xs text-[var(--muted-foreground)]">
        {t("trust.disclaimer")}
      </p>
    </section>
  );
}
