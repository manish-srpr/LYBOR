/**
 * How much an employer should trust a worker's claim to a skill.
 *
 * The rule this file exists to enforce: a claim is never a credential. A
 * worker can set their proficiency to EXPERT in their profile in ten seconds,
 * and before this existed that word appeared to an employer as a bare badge
 * with nothing behind it. Standing here is derived only from things somebody
 * else can corroborate:
 *
 *   - a skill check they sat and scored           (SkillAssessment)
 *   - jobs they finished that used the skill      (WorkHistory)
 *   - what the employers who hired them said      (WorkHistory.employerRating)
 *
 * Self-declared years and proficiency are carried through so the UI can show
 * them, clearly labelled as claims, beside the derived level. They never move
 * the level.
 *
 * Nothing here is a guarantee about a person. It is a summary of the evidence
 * that happens to exist, and a worker with no evidence is unproven rather than
 * bad - most of them are simply new.
 */

/** Ordered weakest to strongest. */
export const TRUST_LEVELS = ["SELF_DECLARED", "SKILLED", "VERIFIED", "EXPERT"] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

/**
 * Every threshold in one place, so the ladder can be explained to a worker and
 * argued about without reading the code. These are prototype figures, chosen
 * to be reachable with the seeded data rather than derived from real hiring
 * outcomes - which is a thing to be honest about, not to bury.
 */
export const TRUST_THRESHOLDS = {
  /** Marks below this are a fail; the worker keeps SELF_DECLARED and may retake. */
  assessmentPassPercent: 60,
  /** Verified: this many completed jobs that used the skill. */
  verifiedJobsRequired: 2,
  /** Expert: completed jobs, plus the rating and completion bars below. */
  expertJobsRequired: 5,
  expertRatingRequired: 4.2,
  expertAssessmentPercent: 80,
  /** Ratings are only meaningful once a few exist. */
  minRatingsForExpert: 3,
  /** Share of assignments finished rather than abandoned. */
  expertCompletionRate: 0.85,
} as const;

export type SkillEvidence = {
  skillCode: string;
  skillName: string;
  /** What the worker says. Displayed, never scored. */
  selfDeclaredProficiency: "BEGINNER" | "INTERMEDIATE" | "EXPERT";
  selfDeclaredYears: number;
  /** Their current skill-check result, if they have sat it. */
  assessment: { scorePercent: number; passed: boolean; takenAt: Date } | null;
  /** Completed jobs whose recorded skills included this one. */
  verifiedJobs: number;
  /** Employer ratings from those jobs, 1-5. */
  ratings: number[];
};

/**
 * A sentence the UI shows, as a catalogue key plus its numbers.
 *
 * The reasoning has to reach the worker in their own language - they are the
 * person it is about, and a level they cannot read the reason for is just
 * another opaque score. So this layer returns keys, not prose; `english` exists
 * for tests and logs, where a fixed string is what you want to assert on.
 */
export type TrustSentence = {
  key: string;
  params: Record<string, string | number>;
  english: string;
};

export type SkillTrust = {
  skillCode: string;
  skillName: string;
  level: TrustLevel;
  selfDeclaredProficiency: string;
  selfDeclaredYears: number;
  assessmentPercent: number | null;
  assessmentPassed: boolean;
  verifiedJobs: number;
  averageRating: number | null;
  ratingCount: number;
  /** Why this level was reached. */
  basis: TrustSentence;
  /** What would move them up, or null at the top. */
  nextStep: TrustSentence | null;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Derives one skill's standing.
 *
 * Deliberately not a weighted score. A number would invite comparing a 71 to a
 * 68 as though the difference meant something; a ladder with stated
 * requirements can be explained to the worker who is standing on it.
 */
export function deriveSkillTrust(
  evidence: SkillEvidence,
  completionRate = 1,
  thresholds = TRUST_THRESHOLDS,
): SkillTrust {
  const ratingAvg = average(evidence.ratings);
  const assessmentPercent = evidence.assessment?.scorePercent ?? null;
  const assessmentPassed = evidence.assessment?.passed ?? false;

  const base = {
    skillCode: evidence.skillCode,
    skillName: evidence.skillName,
    selfDeclaredProficiency: evidence.selfDeclaredProficiency,
    selfDeclaredYears: evidence.selfDeclaredYears,
    assessmentPercent,
    assessmentPassed,
    verifiedJobs: evidence.verifiedJobs,
    averageRating: ratingAvg,
    ratingCount: evidence.ratings.length,
  };

  // Expert: a real body of finished work, corroborated by the people who paid
  // for it. Every condition must hold - this is the one an employer is most
  // likely to lean on, so it is the one that should be hardest to reach.
  const expert =
    assessmentPassed &&
    (assessmentPercent ?? 0) >= thresholds.expertAssessmentPercent &&
    evidence.verifiedJobs >= thresholds.expertJobsRequired &&
    evidence.ratings.length >= thresholds.minRatingsForExpert &&
    (ratingAvg ?? 0) >= thresholds.expertRatingRequired &&
    completionRate >= thresholds.expertCompletionRate;

  if (expert) {
    const rating = ratingAvg?.toFixed(1) ?? "0.0";
    return {
      ...base,
      level: "EXPERT",
      basis: {
        key: "trust.basisExpert",
        params: {
          percent: assessmentPercent ?? 0,
          jobs: evidence.verifiedJobs,
          rating,
          raters: evidence.ratings.length,
        },
        english: `Passed the skill check at ${assessmentPercent}%, completed ${evidence.verifiedJobs} verified jobs using this skill, and averages ${rating}/5 from ${evidence.ratings.length} employers.`,
      },
      nextStep: null,
    };
  }

  // Verified: demonstrated the skill and then actually done the work.
  if (assessmentPassed && evidence.verifiedJobs >= thresholds.verifiedJobsRequired) {
    const jobsShort = Math.max(0, thresholds.expertJobsRequired - evidence.verifiedJobs);
    return {
      ...base,
      level: "VERIFIED",
      basis: {
        key: "trust.basisVerified",
        params: { percent: assessmentPercent ?? 0, jobs: evidence.verifiedJobs },
        english: `Passed the skill check at ${assessmentPercent}% and completed ${evidence.verifiedJobs} verified jobs using this skill.`,
      },
      nextStep:
        jobsShort > 0
          ? {
              key: "trust.nextExpertJobs",
              params: { jobs: jobsShort, rating: thresholds.expertRatingRequired },
              english: `${jobsShort} more verified job${jobsShort === 1 ? "" : "s"} and a ${thresholds.expertRatingRequired}/5 employer average for Expert.`,
            }
          : {
              key: "trust.nextExpertRating",
              params: { rating: thresholds.expertRatingRequired },
              english: `Keep employer ratings at ${thresholds.expertRatingRequired}/5 or above for Expert.`,
            },
    };
  }

  // Skilled: passed the check, but not yet enough completed work for Verified.
  //
  // Note the two variants below, here and in the SELF_DECLARED case. Being
  // short of the job requirement is not the same as having done none, and a
  // basis that says "no completed jobs" beside a panel showing one job is a
  // plain falsehood - it appeared on a seeded profile exactly that way before
  // this was split.
  if (assessmentPassed) {
    const need = thresholds.verifiedJobsRequired - evidence.verifiedJobs;
    return {
      ...base,
      level: "SKILLED",
      basis:
        evidence.verifiedJobs > 0
          ? {
              key: "trust.basisSkilledSomeJobs",
              params: { percent: assessmentPercent ?? 0, jobs: evidence.verifiedJobs },
              english: `Passed the skill check at ${assessmentPercent}% and completed ${evidence.verifiedJobs} verified job${evidence.verifiedJobs === 1 ? "" : "s"} using this skill.`,
            }
          : {
              key: "trust.basisSkilled",
              params: { percent: assessmentPercent ?? 0 },
              english: `Passed the skill check at ${assessmentPercent}%. No completed jobs using this skill yet.`,
            },
      nextStep: {
        key: "trust.nextVerifiedJobs",
        params: { jobs: need },
        english: `${need} verified job${need === 1 ? "" : "s"} using this skill for Verified.`,
      },
    };
  }

  // Self-declared: the claim, with no passed check behind it.
  const failed = Boolean(evidence.assessment) && !assessmentPassed;
  return {
    ...base,
    level: "SELF_DECLARED",
    basis: failed
      ? {
          key: "trust.basisFailed",
          params: {
            percent: assessmentPercent ?? 0,
            pass: thresholds.assessmentPassPercent,
          },
          english: `Skill check scored ${assessmentPercent}%, below the ${thresholds.assessmentPassPercent}% pass mark. Can be retaken.`,
        }
      : evidence.verifiedJobs > 0
        ? {
            key: "trust.basisJobsNoCheck",
            params: { jobs: evidence.verifiedJobs },
            english: `Added by the worker. ${evidence.verifiedJobs} completed job${evidence.verifiedJobs === 1 ? "" : "s"} using this skill, but the skill check has not been taken.`,
          }
        : {
            key: "trust.basisNone",
            params: {},
            english:
              "Added by the worker. No skill check taken and no completed jobs using this skill yet.",
          },
    nextStep: {
      key: "trust.nextSkilled",
      params: { pass: thresholds.assessmentPassPercent },
      english: `Pass the skill check (${thresholds.assessmentPassPercent}% or above) for Skilled.`,
    },
  };
}

/** Display metadata. The UI reads labels from the i18n catalogue, not here. */
export const TRUST_LEVEL_META: Record<
  TrustLevel,
  { tone: "outline" | "primary" | "success" | "warning"; labelKey: string; order: number }
> = {
  SELF_DECLARED: { tone: "outline", labelKey: "trust.levelSelfDeclared", order: 0 },
  SKILLED: { tone: "warning", labelKey: "trust.levelSkilled", order: 1 },
  VERIFIED: { tone: "primary", labelKey: "trust.levelVerified", order: 2 },
  EXPERT: { tone: "success", labelKey: "trust.levelExpert", order: 3 },
};

/** The strongest level across a worker's skills, for a profile headline. */
export function headlineTrust(skills: SkillTrust[]): SkillTrust | null {
  if (skills.length === 0) return null;
  return [...skills].sort(
    (a, b) =>
      TRUST_LEVEL_META[b.level].order - TRUST_LEVEL_META[a.level].order ||
      b.verifiedJobs - a.verifiedJobs,
  )[0];
}
