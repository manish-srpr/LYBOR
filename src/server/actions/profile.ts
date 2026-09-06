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
  language: z.enum(["en", "hi"]),
});

export async function updateWorkerProfileAction(
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
    // a full replace keeps the proficiency defaults predictable.
    await tx.workerSkill.deleteMany({ where: { workerProfileId: profile.id } });
    if (data.skillIds.length > 0) {
      await tx.workerSkill.createMany({
        data: data.skillIds.map((skillId) => ({
          workerProfileId: profile.id,
          skillId,
          proficiency: "INTERMEDIATE" as const,
          yearsExperience: data.experienceYears,
        })),
      });
    }
  });

  revalidatePath("/worker/profile");
  revalidatePath("/worker/jobs");
  return { ok: true, message: "Profile saved." };
}
