"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWorkerProfile } from "@/lib/auth";
import { rupeesToPaise } from "@/lib/money";
import type { ActionResult } from "./attendance";

const profileSchema = z.object({
  bio: z.string().trim().max(400).optional(),
  experienceYears: z.coerce.number().int().min(0).max(50),
  travelRadiusKm: z.coerce.number().min(1).max(100),
  availability: z.enum(["AVAILABLE", "BUSY", "UNAVAILABLE"]),
  preferredWageType: z.enum(["HOURLY", "DAILY", "SHIFT"]).optional(),
  preferredWageMinRupees: z.coerce.number().min(0).max(100000).optional(),
  skillIds: z.array(z.string()).default([]),
  /**
   * Per-skill self-declared level, keyed by skill id. Anything missing or
   * unrecognised falls back to INTERMEDIATE - the same default the column
   * carries - so an older client that does not send these still saves.
   */
  skillLevels: z.record(z.string(), z.enum(["BEGINNER", "INTERMEDIATE", "EXPERT"])),
  language: z.enum(["en", "hi"]),
});

const PROFICIENCIES = ["BEGINNER", "INTERMEDIATE", "EXPERT"] as const;
type Proficiency = (typeof PROFICIENCIES)[number];

/**
 * Reads the `skillLevel:<skillId>` fields out of the form.
 *
 * These are the worker describing themselves, and that is all they are. They
 * feed job matching and are shown to employers under a "self-declared" heading;
 * they are never counted as evidence, and nothing here can raise the derived
 * trust level in src/lib/skill-trust.ts.
 */
function readSkillLevels(formData: FormData): Record<string, Proficiency> {
  const levels: Record<string, Proficiency> = {};
  for (const [field, value] of formData.entries()) {
    if (!field.startsWith("skillLevel:")) continue;
    const level = String(value);
    // Silently drop anything unrecognised rather than failing the whole save:
    // a bad level costs a default, where a rejected form costs the worker
    // every other edit they just made.
    if ((PROFICIENCIES as readonly string[]).includes(level)) {
      levels[field.slice("skillLevel:".length)] = level as Proficiency;
    }
  }
  return levels;
}

/**
 * Takes the previous result first so `useActionState` can drive it, which is
 * what lets the form submit before hydration or with JavaScript off.
 */
export async function updateWorkerProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { session, profile } = await requireWorkerProfile();
  const parsed = profileSchema.safeParse({
    bio: formData.get("bio") || undefined,
    experienceYears: formData.get("experienceYears"),
    travelRadiusKm: formData.get("travelRadiusKm"),
    availability: formData.get("availability"),
    preferredWageType: formData.get("preferredWageType") || undefined,
    preferredWageMinRupees: formData.get("preferredWageMinRupees") || undefined,
    skillIds: formData.getAll("skillIds").map(String),
    skillLevels: readSkillLevels(formData),
    language: formData.get("language") || "en",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.workerProfile.update({
      where: { id: profile.id },
      data: {
        bio: data.bio ?? null,
        experienceYears: data.experienceYears,
        travelRadiusKm: data.travelRadiusKm,
        availability: data.availability,
        preferredWageType: data.preferredWageType ?? null,
        preferredWageMinPaise: data.preferredWageMinRupees
          ? rupeesToPaise(data.preferredWageMinRupees)
          : null,
      },
    });

    await tx.user.update({
      where: { id: session.userId },
      data: { preferredLanguage: data.language },
    });

    // Skills are replaced wholesale rather than diffed: the set is small, and
    // a full replace means an unticked skill actually disappears.
    //
    // What the replace must NOT do is flatten the levels. It used to write
    // `proficiency: "INTERMEDIATE"` for every skill on every save, so a worker
    // who described themselves as a beginner bricklayer became an intermediate
    // one the moment they edited their bio - and an employer saw that word as
    // though the worker had chosen it. The form now sends a level per skill,
    // and anything it does not send keeps whatever was already stored.
    //
    // Sat skill checks survive this untouched: SkillAssessment hangs off the
    // worker profile and the skill, not off WorkerSkill, so re-saving the
    // profile cannot wipe a result the worker earned.
    const existing = await tx.workerSkill.findMany({
      where: { workerProfileId: profile.id },
      select: { skillId: true, proficiency: true },
    });
    const previous = new Map(existing.map((row) => [row.skillId, row.proficiency]));

    await tx.workerSkill.deleteMany({ where: { workerProfileId: profile.id } });
    if (data.skillIds.length > 0) {
      await tx.workerSkill.createMany({
        data: data.skillIds.map((skillId) => ({
          workerProfileId: profile.id,
          skillId,
          proficiency:
            data.skillLevels[skillId] ?? previous.get(skillId) ?? "INTERMEDIATE",
          yearsExperience: data.experienceYears,
        })),
      });
    }
  });

  revalidatePath("/worker/profile");
  revalidatePath("/worker/jobs");
  return { ok: true, message: "Profile saved." };
}
