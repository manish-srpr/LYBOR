import { prisma } from "./db";
import { hasAssessment } from "./skill-questions";
import {
  deriveSkillTrust,
  headlineTrust,
  type SkillEvidence,
  type SkillTrust,
} from "./skill-trust";

/**
 * Collects the evidence behind a worker's skills and hands it to the trust
 * ladder.
 *
 * This is the only place that reads the three sources, so there is one answer
 * to "what is this worker's standing" rather than a worker page and an
 * employer page quietly disagreeing.
 *
 * One wart, called out rather than hidden: WorkHistory records the skills a job
 * used as a JSON array of English skill *names*, not ids - an immutable
 * snapshot written at completion in src/server/actions/payments.ts. Counting
 * verified jobs per skill therefore means matching on that name. It is looser
 * than a foreign key, so the match is trimmed and case-folded, and a renamed
 * skill would stop matching its own history. Fixing it properly means a join
 * table on WorkHistory, which is a migration for real data rather than a
 * prototype, and inventing a second skills-used column would leave two
 * disagreeing records of the same fact.
 */

export type WorkerTrust = {
  skills: SkillTrust[];
  /** Strongest level across their skills, for a headline badge. */
  headline: SkillTrust | null;
  /** Share of assignments finished rather than abandoned; feeds Expert. */
  completionRate: number;
  /** True when at least one skill has evidence beyond the worker's own word. */
  hasAnyEvidence: boolean;
};

function parseSkillsUsed(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.map((v) => String(v).trim().toLowerCase()) : [];
  } catch {
    // A malformed snapshot costs that job's contribution, not the page.
    return [];
  }
}

/**
 * Standing for many workers at once.
 *
 * The employer's worker directory needs this for every row it shows. Calling
 * the single-worker version in a loop would issue four queries per worker,
 * which against a network database (Turso in production) turns a twenty-row
 * list into eighty round trips. These are the same four queries, widened to
 * the whole set and then grouped in memory, so the cost is four regardless of
 * how many workers are listed.
 *
 * The derivation itself is untouched - it still goes through deriveSkillTrust,
 * so the ladder has exactly one implementation.
 */
export async function getWorkerTrustMany(
  workerProfileIds: string[],
): Promise<Map<string, WorkerTrust>> {
  const ids = [...new Set(workerProfileIds)];
  const result = new Map<string, WorkerTrust>();
  if (ids.length === 0) return result;

  const [workerSkills, assessments, history, assignmentCounts] = await Promise.all([
    prisma.workerSkill.findMany({
      where: { workerProfileId: { in: ids } },
      include: { skill: true },
      orderBy: { skill: { nameEn: "asc" } },
    }),
    prisma.skillAssessment.findMany({ where: { workerProfileId: { in: ids } } }),
    prisma.workHistory.findMany({
      where: { workerProfileId: { in: ids }, completionStatus: "COMPLETED" },
      select: { workerProfileId: true, skillsUsed: true, employerRating: true },
    }),
    prisma.jobAssignment.groupBy({
      by: ["workerProfileId", "status"],
      where: { workerProfileId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const group = <T,>(rows: T[], key: (row: T) => string) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const k = key(row);
      const bucket = map.get(k);
      if (bucket) bucket.push(row);
      else map.set(k, [row]);
    }
    return map;
  };

  const skillsBy = group(workerSkills, (r) => r.workerProfileId);
  const assessmentsBy = group(assessments, (r) => r.workerProfileId);
  const historyBy = group(history, (r) => r.workerProfileId);
  const countsBy = group(assignmentCounts, (r) => r.workerProfileId);

  for (const id of ids) {
    const mySkills = skillsBy.get(id) ?? [];
    const myHistory = historyBy.get(id) ?? [];
    const bySkillId = new Map((assessmentsBy.get(id) ?? []).map((a) => [a.skillId, a]));

    // Completion rate over assignments that have actually reached an end
    // state. Counting live assignments as failures would punish a worker for
    // having work in progress.
    // ASSIGNED and ACTIVE are still running; COMPLETED and TERMINATED are the
    // two ways an assignment ends.
    const settled = (countsBy.get(id) ?? []).filter(
      (row) => row.status === "COMPLETED" || row.status === "TERMINATED",
    );
    const settledTotal = settled.reduce((sum, row) => sum + row._count._all, 0);
    const completed = settled.find((row) => row.status === "COMPLETED")?._count._all ?? 0;
    // A worker with nothing settled yet gets the benefit of the doubt here,
    // because the Expert rung already requires completed jobs of its own.
    const completionRate = settledTotal === 0 ? 1 : completed / settledTotal;

    const skills = mySkills.map((ws) => {
      const needle = ws.skill.nameEn.trim().toLowerCase();
      const matching = myHistory.filter((h) =>
        parseSkillsUsed(h.skillsUsed).includes(needle),
      );
      const assessment = bySkillId.get(ws.skillId);

      const evidence: SkillEvidence = {
        skillCode: ws.skill.code,
        skillName: ws.skill.nameEn,
        selfDeclaredProficiency: ws.proficiency,
        selfDeclaredYears: ws.yearsExperience,
        assessment: assessment
          ? {
              scorePercent: assessment.scorePercent,
              passed: assessment.passed,
              takenAt: assessment.takenAt,
            }
          : null,
        verifiedJobs: matching.length,
        ratings: matching
          .map((h) => h.employerRating)
          .filter((r): r is number => typeof r === "number"),
      };

      return deriveSkillTrust(evidence, completionRate);
    });

    result.set(id, {
      skills,
      headline: headlineTrust(skills),
      completionRate,
      hasAnyEvidence: skills.some((s) => s.level !== "SELF_DECLARED"),
    });
  }

  return result;
}

export async function getWorkerTrust(workerProfileId: string): Promise<WorkerTrust> {
  const many = await getWorkerTrustMany([workerProfileId]);
  return (
    many.get(workerProfileId) ?? {
      skills: [],
      headline: null,
      completionRate: 1,
      hasAnyEvidence: false,
    }
  );
}

/**
 * The worker's own skills, annotated with whether a check exists and how they
 * did on it. Drives the skill-check screen's list.
 */
export type SkillCheckOption = {
  skillId: string;
  skillCode: string;
  nameEn: string;
  nameHi: string;
  available: boolean;
  result: { scorePercent: number; passed: boolean; takenAt: Date } | null;
};

export async function getSkillCheckOptions(
  workerProfileId: string,
): Promise<SkillCheckOption[]> {
  const [workerSkills, assessments] = await Promise.all([
    prisma.workerSkill.findMany({
      where: { workerProfileId },
      include: { skill: true },
      orderBy: { skill: { nameEn: "asc" } },
    }),
    prisma.skillAssessment.findMany({ where: { workerProfileId } }),
  ]);

  const bySkillId = new Map(assessments.map((a) => [a.skillId, a]));

  return workerSkills.map((ws) => {
    const result = bySkillId.get(ws.skillId);
    return {
      skillId: ws.skillId,
      skillCode: ws.skill.code,
      nameEn: ws.skill.nameEn,
      nameHi: ws.skill.nameHi,
      available: hasAssessment(ws.skill.code),
      result: result
        ? {
            scorePercent: result.scorePercent,
            passed: result.passed,
            takenAt: result.takenAt,
          }
        : null,
    };
  });
}
