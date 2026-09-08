"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireEmployerProfile, requireWorkerProfile } from "@/lib/auth";
import { formatMinutes, formatPaise } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { refreshReliability } from "@/lib/reliability";
import {
  performCheckIn,
  performCheckOut,
  type ActionResult,
} from "@/lib/attendance-core";

export type { ActionResult };

/**
 * The reachable surface for GPS attendance.
 *
 * Each wrapper does two things the decision engine must not: it resolves who
 * is asking from the signed session, and it invalidates the pages the punch
 * changed. The actor is never taken from the request body, so a client cannot
 * punch as another worker.
 */
export async function checkInAction(formData: FormData): Promise<ActionResult> {
  const { session, profile } = await requireWorkerProfile();
  const result = await performCheckIn(
    { workerProfileId: profile.id, userId: session.userId },
    formData,
  );

  if (result.ok) {
    revalidatePath(`/worker/assignments/${String(formData.get("assignmentId") ?? "")}`);
    revalidatePath("/worker");
    revalidatePath("/employer/approvals");
  }
  return result;
}

export async function checkOutAction(formData: FormData): Promise<ActionResult> {
  const { session, profile } = await requireWorkerProfile();
  const result = await performCheckOut(
    { workerProfileId: profile.id, userId: session.userId },
    formData,
  );

  if (result.ok) {
    revalidatePath(`/worker/assignments/${String(formData.get("assignmentId") ?? "")}`);
    revalidatePath("/worker/earnings");
    revalidatePath("/employer/approvals");
  }
  return result;
}

const approvalSchema = z.object({
  attendanceId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(300).optional(),
});

export async function reviewAttendanceAction(formData: FormData): Promise<ActionResult> {
  const { session, profile } = await requireEmployerProfile();
  const parsed = approvalSchema.safeParse({
    attendanceId: formData.get("attendanceId"),
    decision: formData.get("decision"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Invalid review." };
  const { attendanceId, decision, reason } = parsed.data;

  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: {
      assignment: {
        include: { job: true, worker: { include: { user: true } } },
      },
      payment: true,
    },
  });
  if (!attendance || attendance.assignment.job.employerProfileId !== profile.id) {
    return { ok: false, message: "That attendance record is not yours to review." };
  }
  if (attendance.approvalStatus !== "PENDING") {
    return { ok: false, message: "This day has already been reviewed." };
  }
  if (!attendance.checkOutTime) {
    return { ok: false, message: "The worker has not checked out yet." };
  }

  const approved = decision === "APPROVE";
  if (!approved && !reason) {
    return { ok: false, message: "Give the worker a reason for the rejection." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.attendance.update({
      where: { id: attendanceId },
      data: {
        approvalStatus: approved ? "APPROVED" : "REJECTED",
        approvedAt: new Date(),
        approvedByUserId: session.userId,
        rejectionReason: approved ? null : (reason ?? null),
        verificationStatus: approved ? "VERIFIED" : "REJECTED",
      },
    });

    if (attendance.payment) {
      if (approved) {
        await tx.payment.update({
          where: { id: attendance.payment.id },
          data: { status: "APPROVED", approvedAt: new Date() },
        });
        await tx.paymentLedgerEntry.create({
          data: {
            paymentId: attendance.payment.id,
            entryType: "APPROVAL",
            amountPaise: attendance.payment.netAmountPaise,
            fromParty: "ESCROW",
            toParty: "ESCROW",
            metadata: JSON.stringify({
              reason: "Employer approved the verified hours.",
              approvedBy: session.userId,
            }),
          },
        });
      } else {
        // A rejection reverses the accrual rather than deleting it, so the
        // audit trail still shows that the wage was once claimed.
        await tx.paymentLedgerEntry.create({
          data: {
            paymentId: attendance.payment.id,
            entryType: "REVERSAL",
            amountPaise: attendance.payment.netAmountPaise,
            fromParty: "ESCROW",
            toParty: "EMPLOYER",
            metadata: JSON.stringify({ reason: reason ?? "Attendance rejected." }),
          },
        });
      }
    }
  });

  await notify({
    userId: attendance.assignment.worker.userId,
    type: approved ? "ATTENDANCE_APPROVED" : "ATTENDANCE_REJECTED",
    params: {
      job: attendance.assignment.job.title,
      employer: profile.companyName,
      hours: formatMinutes(attendance.workingMinutes ?? 0),
      amount: formatPaise(attendance.payment?.netAmountPaise ?? 0),
      date: attendance.workDate.toISOString().slice(0, 10),
    },
    linkUrl: "/worker/earnings",
  });

  await refreshReliability(attendance.assignment.workerProfileId);

  revalidatePath("/employer/approvals");
  revalidatePath("/employer/payments");
  revalidatePath("/worker/earnings");

  return {
    ok: true,
    message: approved
      ? `Approved ${formatMinutes(attendance.workingMinutes ?? 0)}.`
      : "Attendance rejected. The worker has been told why.",
  };
}
