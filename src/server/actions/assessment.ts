"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import {
  QUESTION_BANK_VERSION,
  gradeAssessment,
  hasAssessment,
  questionsFor,
} from "@/lib/skill-questions";
import { TRUST_THRESHOLDS } from "@/lib/skill-trust";
import type { ActionResult } from "./attendance";

/**
 * Submitting a skill check.
 *
 * Everything that decides the outcome happens here, on the server: which
 * questions belong to the skill, what the right answers are, and what counts
 * as a pass. The browser is only trusted to report which option was tapped.
 *
 * Note the shape of the request - a skill id and a set of answers, nothing
 * else. There is no score field to forge and no worker id to swap, because the
 * worker is resolved from the signed session. Every export of a "use server"
 * file is a callable endpoint, so this file exports exactly one action and
 * nothing else.
 */

const submissionSchema = z.object({
  skillId: z.string().min(1),
  /** Question id -> chosen option index. */
  answers: z.record(z.string(), z.number().int().min(0).max(9)),
});

export type AssessmentOutcome = ActionResult & {
  scorePercent?: number;
  correctCount?: number;
  questionCount?: number;
  passed?: boolean;
  /** Per question: the right option, and why. Only returned after grading. */
  review?: {
    questionId: string;
    correctIndex: number;
    chosenIndex: number | null;
    why: string;
    whyHi: string;
  }[];
};

/**
 * Takes the previous outcome as its first argument so it can be driven by
 * `useActionState`, matching every other form in the app.
 *
 * That signature is what makes the paper submittable without JavaScript. An
 * inline `action={(formData) => ...}` closure was the first attempt and it left
 * the form with no action id at all, so a browser that posted it got a 500 -
 * which is exactly the handset this feature is for.
 */
export async function submitSkillCheckAction(
  _prev: AssessmentOutcome | null,
  formData: FormData,
): Promise<AssessmentOutcome> {
  const { profile } = await requireWorkerProfile();

  const answers: Record<string, number> = {};
  for (const [field, value] of formData.entries()) {
    // Answers arrive as answer:<questionId> so they cannot collide with the
    // skill id field or with anything added to the form later.
    if (!field.startsWith("answer:")) continue;
    const parsed = Number(value);
    if (Number.isInteger(parsed)) answers[field.slice("answer:".length)] = parsed;
  }

  const parsed = submissionSchema.safeParse({
    skillId: formData.get("skillId"),
    answers,
  });
  if (!parsed.success) {
    return { ok: false, message: "That submission could not be read. Please try again." };
  }
  const { skillId } = parsed.data;

  // The worker must actually claim the skill. Otherwise a check could be sat
  // for a trade that never appears on their profile, leaving a result with
  // nothing to attach to.
  const workerSkill = await prisma.workerSkill.findUnique({
    where: { workerProfileId_skillId: { workerProfileId: profile.id, skillId } },
    include: { skill: true },
  });
  if (!workerSkill) {
    return { ok: false, message: "Add this skill to your profile before taking its check." };
  }

  const code = workerSkill.skill.code;
  if (!hasAssessment(code)) {
    return { ok: false, message: "No skill check is available for this trade yet." };
  }

  const questions = questionsFor(code);
  const unanswered = questions.filter((q) => !(q.id in parsed.data.answers));
  if (unanswered.length > 0) {
    return { ok: false, message: "Please answer every question before submitting." };
  }

  const { correctCount, questionCount, scorePercent } = gradeAssessment(
    code,
    parsed.data.answers,
  );
  const passed = scorePercent >= TRUST_THRESHOLDS.assessmentPassPercent;

  // One current result per worker per skill, replaced on a retake. Keeping
  // every attempt would let a worker grind the same five questions and then
  // point at their best score; the standing reflects where they are now, and a
  // retake can lower it as well as raise it.
  await prisma.skillAssessment.upsert({
    where: { workerProfileId_skillId: { workerProfileId: profile.id, skillId } },
    create: {
      workerProfileId: profile.id,
      skillId,
      scorePercent,
      correctCount,
      questionCount,
      passed,
      bankVersion: QUESTION_BANK_VERSION,
    },
    update: {
      scorePercent,
      correctCount,
      questionCount,
      passed,
      bankVersion: QUESTION_BANK_VERSION,
      takenAt: new Date(),
    },
  });

  revalidatePath("/worker/profile");
  revalidatePath("/worker/profile/skill-check");

  return {
    ok: true,
    message: passed
      ? "Skill check passed."
      : `Not passed this time. ${TRUST_THRESHOLDS.assessmentPassPercent}% is needed - you can retake it.`,
    scorePercent,
    correctCount,
    questionCount,
    passed,
    review: questions.map((q) => ({
      questionId: q.id,
      correctIndex: q.answer,
      chosenIndex: parsed.data.answers[q.id] ?? null,
      why: q.why,
      whyHi: q.whyHi,
    })),
  };
}
