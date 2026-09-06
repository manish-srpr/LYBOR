"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import type { ActionResult } from "./attendance";

const disputeSchema = z.object({
  category: z.enum([
    "WAGE",
    "HOURS",
    "ATTENDANCE",
    "PAYMENT_DELAY",
    "SAFETY",
    "BEHAVIOUR",
    "OTHER",
  ]),
  reason: z.string().trim().min(4, "Give a short reason."),
  description: z.string().trim().min(10, "Describe what happened."),
  jobId: z.string().optional(),
  assignmentId: z.string().optional(),
  attendanceId: z.string().optional(),
  paymentId: z.string().optional(),
  evidenceNotes: z.string().trim().max(1000).optional(),
});

export async function createDisputeAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = disputeSchema.safeParse({
    category: formData.get("category"),
    reason: formData.get("reason"),
    description: formData.get("description"),
    jobId: formData.get("jobId") || undefined,
    assignmentId: formData.get("assignmentId") || undefined,
    attendanceId: formData.get("attendanceId") || undefined,
    paymentId: formData.get("paymentId") || undefined,
    evidenceNotes: formData.get("evidenceNotes") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const data = parsed.data;

  const dispute = await prisma.dispute.create({
    data: {
      raisedByUserId: session.userId,
      raisedByRole: session.role,
      category: data.category,
      reason: data.reason,
      description: data.description,
      evidenceNotes: data.evidenceNotes ?? null,
      jobId: data.jobId || null,
      assignmentId: data.assignmentId || null,
      attendanceId: data.attendanceId || null,
      paymentId: data.paymentId || null,
    },
  });

  // A disputed payment is frozen, not reversed: nobody loses money while a
  // human is still deciding.
  if (data.paymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: data.paymentId } });
    if (payment && payment.status !== "PAID") {
      await prisma.payment.update({
        where: { id: data.paymentId },
        data: { status: "DISPUTED" },
      });
    }
  }

  await notify({
    userId: session.userId,
    type: "DISPUTE_CREATED",
    params: { reason: data.reason },
    linkUrl:
      session.role === "WORKER" ? "/worker/disputes" : "/employer/disputes",
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  for (const admin of admins) {
    await notify({
      userId: admin.id,
      type: "DISPUTE_CREATED",
      params: { reason: data.reason },
      linkUrl: `/admin/disputes/${dispute.id}`,
    });
  }

  revalidatePath("/worker/disputes");
  revalidatePath("/employer/disputes");
  revalidatePath("/admin/disputes");

  return { ok: true, message: "Dispute raised. An administrator will review it." };
}

const resolveSchema = z.object({
  disputeId: z.string().min(1),
  decision: z.enum(["RESOLVED", "REJECTED", "UNDER_REVIEW"]),
  resolution: z.string().trim().min(4, "Explain the decision."),
  releasePayment: z.enum(["yes", "no"]).default("no"),
});

export async function resolveDisputeAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole("ADMIN");
  const parsed = resolveSchema.safeParse({
    disputeId: formData.get("disputeId"),
    decision: formData.get("decision"),
    resolution: formData.get("resolution"),
    releasePayment: formData.get("releasePayment") || "no",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const { disputeId, decision, resolution, releasePayment } = parsed.data;

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { payment: true },
  });
  if (!dispute) return { ok: false, message: "Dispute not found." };

  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: decision,
      adminResolution: resolution,
      resolvedByUserId: decision === "UNDER_REVIEW" ? null : session.userId,
      resolvedAt: decision === "UNDER_REVIEW" ? null : new Date(),
    },
  });

  if (dispute.payment && dispute.payment.status === "DISPUTED") {
    // Unfreezing returns the payment to the state it was in, rather than
    // jumping it straight to PAID - the employer still presses the button.
    await prisma.payment.update({
      where: { id: dispute.payment.id },
      data: { status: releasePayment === "yes" ? "APPROVED" : "PENDING" },
    });
  }

  if (decision !== "UNDER_REVIEW") {
    await notify({
      userId: dispute.raisedByUserId,
      type: "DISPUTE_RESOLVED",
      params: { reason: resolution },
      linkUrl:
        dispute.raisedByRole === "WORKER" ? "/worker/disputes" : "/employer/disputes",
    });
  }

  revalidatePath("/admin/disputes");
  revalidatePath(`/admin/disputes/${disputeId}`);
  revalidatePath("/worker/disputes");
  revalidatePath("/employer/disputes");

  return { ok: true, message: "Dispute updated." };
}
