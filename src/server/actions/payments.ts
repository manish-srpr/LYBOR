"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireEmployerProfile } from "@/lib/auth";
import { formatPaise } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { refreshReliability } from "@/lib/reliability";
import type { ActionResult } from "./attendance";

const paySchema = z.object({
  paymentId: z.string().min(1),
  method: z.enum(["LEDGER_MOCK", "UPI", "BANK_TRANSFER", "CASH"]).default("LEDGER_MOCK"),
  reference: z.string().trim().max(60).optional(),
});

/**
 * The prototype settles through a mock ledger rather than a real rail. The
 * boundary is deliberate: a live UPI or escrow provider appends the same
 * PAYOUT entry, so nothing above this line changes when one is plugged in.
 */
export async function markPaymentPaidAction(formData: FormData): Promise<ActionResult> {
  const { profile } = await requireEmployerProfile();
  const parsed = paySchema.safeParse({
    paymentId: formData.get("paymentId"),
    method: formData.get("method") || "LEDGER_MOCK",
    reference: formData.get("reference") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Invalid payment request." };
  const { paymentId, method, reference } = parsed.data;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      assignment: {
        include: { job: true, worker: { include: { user: true } } },
      },
    },
  });
  if (!payment || payment.assignment.job.employerProfileId !== profile.id) {
    return { ok: false, message: "That payment is not yours to release." };
  }
  if (payment.status === "PAID") {
    return { ok: false, message: "This payment has already been released." };
  }
  if (payment.status !== "APPROVED") {
    return { ok: false, message: "Approve the attendance before releasing payment." };
  }

  const providerRef =
    reference || `MOCK-${Date.now().toString(36).toUpperCase()}`;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: method,
        paymentReference: providerRef,
      },
    });

    await tx.paymentLedgerEntry.create({
      data: {
        paymentId,
        entryType: "PAYOUT",
        amountPaise: payment.netAmountPaise,
        fromParty: "ESCROW",
        toParty: "WORKER",
        provider: method === "LEDGER_MOCK" ? "MOCK_LEDGER" : method,
        providerRef,
        status: "SETTLED",
        metadata: JSON.stringify({ reason: "Wage released to the worker." }),
      },
    });

    await tx.workerProfile.update({
      where: { id: payment.assignment.workerProfileId },
      data: {
        totalEarningsPaise: { increment: payment.netAmountPaise },
        totalMinutesWorked: { increment: payment.verifiedMinutes },
      },
    });

    await tx.employerProfile.update({
      where: { id: profile.id },
      data: { totalPaidPaise: { increment: payment.netAmountPaise } },
    });
  });

  await notify({
    userId: payment.assignment.worker.userId,
    type: "PAYMENT_PAID",
    params: {
      amount: formatPaise(payment.netAmountPaise),
      job: payment.assignment.job.title,
    },
    linkUrl: "/worker/earnings",
  });

  await refreshReliability(payment.assignment.workerProfileId);

  revalidatePath("/employer/payments");
  revalidatePath("/worker/earnings");

  return { ok: true, message: `${formatPaise(payment.netAmountPaise)} released.` };
}

const completeSchema = z.object({
  assignmentId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  review: z.string().trim().max(500).optional(),
});

/**
 * Completing an assignment is what mints a WorkHistory row. The snapshot copies
 * job title, employer name and skills rather than referencing them, so the
 * record stays truthful even if the job or the company profile changes later.
 */
export async function completeAssignmentAction(formData: FormData): Promise<ActionResult> {
  const { profile } = await requireEmployerProfile();
  const parsed = completeSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    rating: formData.get("rating") || undefined,
    review: formData.get("review") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { assignmentId, rating, review } = parsed.data;

  const assignment = await prisma.jobAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      job: { include: { requiredSkills: { include: { skill: true } } } },
      worker: { include: { user: true } },
      attendances: { include: { payment: true } },
      workHistory: true,
    },
  });
  if (!assignment || assignment.job.employerProfileId !== profile.id) {
    return { ok: false, message: "That assignment is not yours." };
  }
  if (assignment.workHistory) {
    return { ok: false, message: "This assignment is already closed." };
  }

  const pendingDays = assignment.attendances.filter(
    (a) => a.checkOutTime && a.approvalStatus === "PENDING",
  );
  if (pendingDays.length > 0) {
    return {
      ok: false,
      message: `Review ${pendingDays.length} pending attendance day(s) first.`,
    };
  }

  const approved = assignment.attendances.filter((a) => a.approvalStatus === "APPROVED");
  const totalMinutes = approved.reduce((sum, a) => sum + (a.workingMinutes ?? 0), 0);
  const totalEarnings = approved.reduce(
    (sum, a) => sum + (a.payment?.netAmountPaise ?? 0),
    0,
  );

  await prisma.$transaction(async (tx) => {
    await tx.jobAssignment.update({
      where: { id: assignmentId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    await tx.workHistory.create({
      data: {
        workerProfileId: assignment.workerProfileId,
        jobId: assignment.jobId,
        assignmentId: assignment.id,
        employerProfileId: profile.id,
        jobTitle: assignment.job.title,
        category: assignment.job.category,
        employerName: profile.companyName,
        skillsUsed: JSON.stringify(
          assignment.job.requiredSkills.map((s) => s.skill.nameEn),
        ),
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        totalVerifiedMinutes: totalMinutes,
        totalDaysWorked: approved.length,
        totalEarningsPaise: totalEarnings,
        employerRating: rating ?? null,
        employerReview: review ?? null,
        completionStatus: "COMPLETED",
      },
    });

    await tx.workerProfile.update({
      where: { id: assignment.workerProfileId },
      data: {
        totalJobsCompleted: { increment: 1 },
        availability: "AVAILABLE",
        ...(rating
          ? {
              averageRating:
                (assignment.worker.averageRating * assignment.worker.totalJobsCompleted +
                  rating) /
                (assignment.worker.totalJobsCompleted + 1),
            }
          : {}),
      },
    });

    const remaining = await tx.jobAssignment.count({
      where: { jobId: assignment.jobId, status: { in: ["ASSIGNED", "ACTIVE"] } },
    });
    if (remaining === 0) {
      await tx.job.update({
        where: { id: assignment.jobId },
        data: { status: "COMPLETED" },
      });
    }
  });

  await notify({
    userId: assignment.worker.userId,
    type: "SYSTEM",
    params: {
      message: `${assignment.job.title} is complete. It is now part of your verified work history.`,
    },
    linkUrl: "/worker/history",
  });

  await refreshReliability(assignment.workerProfileId);

  revalidatePath(`/employer/jobs/${assignment.jobId}`);
  revalidatePath("/worker/history");
  revalidatePath("/worker/assignments");

  return { ok: true, message: "Assignment closed and added to the verified work history." };
}
