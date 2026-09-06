"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import type { ActionResult } from "./attendance";

const fraudSchema = z.object({
  alertId: z.string().min(1),
  decision: z.enum(["REVIEWING", "CONFIRMED", "DISMISSED"]),
  notes: z.string().trim().max(500).optional(),
});

export async function reviewFraudAlertAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole("ADMIN");
  const parsed = fraudSchema.safeParse({
    alertId: formData.get("alertId"),
    decision: formData.get("decision"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Invalid review." };
  const { alertId, decision, notes } = parsed.data;

  await prisma.fraudAlert.update({
    where: { id: alertId },
    data: {
      status: decision,
      reviewedByUserId: session.userId,
      reviewedAt: new Date(),
      reviewNotes: notes ?? null,
    },
  });

  revalidatePath("/admin/fraud");
  return { ok: true, message: `Alert marked ${decision.toLowerCase()}.` };
}

const userSchema = z.object({
  userId: z.string().min(1),
  active: z.enum(["yes", "no"]),
});

export async function setUserActiveAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole("ADMIN");
  const parsed = userSchema.safeParse({
    userId: formData.get("userId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  if (parsed.data.userId === session.userId) {
    return { ok: false, message: "You cannot deactivate your own account." };
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { isActive: parsed.data.active === "yes" },
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "User updated." };
}

/**
 * A plain `<form action>` must resolve to void, so the admin users list posts
 * through this wrapper rather than the result-returning action above.
 */
export async function setUserActiveFormAction(formData: FormData): Promise<void> {
  await setUserActiveAction(formData);
}

export async function markNotificationsReadAction(): Promise<void> {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { userId: session.userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath("/worker/notifications");
  revalidatePath("/employer/notifications");
  revalidatePath("/admin/notifications");
}
