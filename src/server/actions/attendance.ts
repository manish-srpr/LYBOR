"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireEmployerProfile, requireWorkerProfile } from "@/lib/auth";
import { distanceMeters } from "@/lib/geo";
import { formatMinutes, formatPaise } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { refreshReliability } from "@/lib/reliability";
import {
  assessAttendanceRisk,
  renderRiskDetail,
  renderRiskTitle,
  type RiskFlag,
} from "@/lib/risk";
import { calculateWage } from "@/lib/wages";

const locationSchema = z.object({
  assignmentId: z.string().min(1),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(10000).optional(),
  source: z.enum(["GPS", "DEMO"]).default("GPS"),
  note: z.string().trim().max(300).optional(),
});

/** Midnight UTC for the current calendar day - the shift's stable identity. */
function workDateFor(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Minutes past a "HH:MM" roster time on the same calendar day. */
function minutesFromRoster(now: Date, hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const roster = new Date(now);
  roster.setHours(h, m, 0, 0);
  return Math.round((now.getTime() - roster.getTime()) / 60000);
}

export type ActionResult = { ok: boolean; message: string };

export async function checkInAction(formData: FormData): Promise<ActionResult> {
  const { session, profile } = await requireWorkerProfile();
  const parsed = locationSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    accuracy: formData.get("accuracy") || undefined,
    source: formData.get("source") || "GPS",
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: "Location could not be read. Try again." };
  }
  const input = parsed.data;

  const assignment = await prisma.jobAssignment.findUnique({
    where: { id: input.assignmentId },
    include: { job: { include: { employer: true } } },
  });
  if (!assignment || assignment.workerProfileId !== profile.id) {
    return { ok: false, message: "That assignment is not yours." };
  }
  if (assignment.status === "COMPLETED" || assignment.status === "TERMINATED") {
    return { ok: false, message: "This assignment is closed." };
  }

  const now = new Date();
  const workDate = workDateFor(now);

  const already = await prisma.attendance.findUnique({
    where: { assignmentId_workDate: { assignmentId: assignment.id, workDate } },
  });
  if (already) {
    return { ok: false, message: "You have already checked in today." };
  }

  const job = assignment.job;
  const distance = distanceMeters(
    { latitude: input.latitude, longitude: input.longitude },
    { latitude: job.latitude, longitude: job.longitude },
  );
  const withinRadius = distance <= job.checkInRadiusMeters;
  const lateBy = minutesFromRoster(now, job.shiftStart);

  // Check-in is never blocked on a geofence failure: a worker who genuinely
  // turned up should not lose a day to a bad GPS fix. The punch is recorded,
  // flagged, and a human decides.
  const risk = assessAttendanceRisk({
    checkInDistanceM: distance,
    checkInWithinRadius: withinRadius,
    checkInAccuracyM: input.accuracy ?? null,
    checkInSource: input.source,
    checkOutDistanceM: null,
    checkOutWithinRadius: null,
    checkOutAccuracyM: null,
    checkOutSource: null,
    workingMinutes: null,
    expectedHoursPerDay: assignment.expectedHoursPerDay,
    lateByMinutes: lateBy,
    earlyByMinutes: null,
    radiusMeters: job.checkInRadiusMeters,
  });
  // A missing check-out is expected at this point, so it does not count yet.
  const openFlags = risk.flags.filter((f) => f.code !== "MISSING_CHECK_OUT");
  const openScore = Math.min(100, openFlags.reduce((s, f) => s + f.points, 0));

  const attendance = await prisma.attendance.create({
    data: {
      assignmentId: assignment.id,
      workDate,
      checkInTime: now,
      checkInLatitude: input.latitude,
      checkInLongitude: input.longitude,
      checkInAccuracyM: input.accuracy ?? null,
      checkInDistanceM: distance,
      checkInWithinRadius: withinRadius,
      checkInSource: input.source,
      verificationStatus: openScore >= 20 ? "FLAGGED" : "PENDING",
      riskScore: openScore,
      riskFlags: JSON.stringify(openFlags),
      workerNote: input.note ?? null,
    },
  });

  if (assignment.status === "ASSIGNED") {
    await prisma.jobAssignment.update({
      where: { id: assignment.id },
      data: { status: "ACTIVE" },
    });
  }

  await notify({
    userId: session.userId,
    type: "CHECK_IN_SUCCESS",
    params: {
      job: job.title,
      time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    },
    linkUrl: `/worker/assignments/${assignment.id}`,
  });

  if (openFlags.length > 0) {
    await raiseFraudAlerts(attendance.id, assignment.workerProfileId, job.id, openFlags);
    await notify({
      userId: job.employer.userId,
      type: "ATTENDANCE_FLAGGED",
      params: { job: job.title, date: workDate.toISOString().slice(0, 10) },
      linkUrl: "/employer/approvals",
    });
  }

  revalidatePath(`/worker/assignments/${assignment.id}`);
  revalidatePath("/worker");
  revalidatePath("/employer/approvals");

  return {
    ok: true,
    message: withinRadius
      ? "Checked in. GPS confirmed you are at the job site."
      : `Checked in, but you are ${distance} m from the site. Your employer will review it.`,
  };
}

export async function checkOutAction(formData: FormData): Promise<ActionResult> {
  const { session, profile } = await requireWorkerProfile();
  const parsed = locationSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    accuracy: formData.get("accuracy") || undefined,
    source: formData.get("source") || "GPS",
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: "Location could not be read. Try again." };
  }
  const input = parsed.data;

  const assignment = await prisma.jobAssignment.findUnique({
    where: { id: input.assignmentId },
    include: { job: { include: { employer: true } } },
  });
  if (!assignment || assignment.workerProfileId !== profile.id) {
    return { ok: false, message: "That assignment is not yours." };
  }

  const now = new Date();
  const workDate = workDateFor(now);
  const attendance = await prisma.attendance.findUnique({
    where: { assignmentId_workDate: { assignmentId: assignment.id, workDate } },
  });
  if (!attendance) return { ok: false, message: "Check in before checking out." };
  if (attendance.checkOutTime) {
    return { ok: false, message: "You have already checked out today." };
  }

  const job = assignment.job;
  const distance = distanceMeters(
    { latitude: input.latitude, longitude: input.longitude },
    { latitude: job.latitude, longitude: job.longitude },
  );
  const withinRadius = distance <= job.checkInRadiusMeters;
  const workingMinutes = Math.max(
    0,
    Math.round((now.getTime() - attendance.checkInTime.getTime()) / 60000),
  );
  const lateBy = minutesFromRoster(attendance.checkInTime, job.shiftStart);
  const earlyBy = -minutesFromRoster(now, job.shiftEnd);

  const risk = assessAttendanceRisk({
    checkInDistanceM: attendance.checkInDistanceM,
    checkInWithinRadius: attendance.checkInWithinRadius,
    checkInAccuracyM: attendance.checkInAccuracyM,
    checkInSource: attendance.checkInSource,
    checkOutDistanceM: distance,
    checkOutWithinRadius: withinRadius,
    checkOutAccuracyM: input.accuracy ?? null,
    checkOutSource: input.source,
    workingMinutes,
    expectedHoursPerDay: assignment.expectedHoursPerDay,
    lateByMinutes: lateBy,
    earlyByMinutes: earlyBy,
    radiusMeters: job.checkInRadiusMeters,
  });

  // The wage is computed the moment hours are verified, not at approval time,
  // so the worker can see exactly what is at stake while it is still pending.
  const breakdown = calculateWage({
    wageType: assignment.agreedWageType,
    rateAppliedPaise: assignment.agreedWageRatePaise,
    verifiedMinutes: workingMinutes,
    expectedHoursPerDay: assignment.expectedHoursPerDay,
  });

  await prisma.$transaction(async (tx) => {
    await tx.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOutTime: now,
        checkOutLatitude: input.latitude,
        checkOutLongitude: input.longitude,
        checkOutAccuracyM: input.accuracy ?? null,
        checkOutDistanceM: distance,
        checkOutWithinRadius: withinRadius,
        checkOutSource: input.source,
        workingMinutes,
        verificationStatus: risk.verification,
        riskScore: risk.score,
        riskFlags: JSON.stringify(risk.flags),
        workerNote: input.note ?? attendance.workerNote,
      },
    });

    const payment = await tx.payment.create({
      data: {
        assignmentId: assignment.id,
        attendanceId: attendance.id,
        wageType: breakdown.wageType,
        rateAppliedPaise: breakdown.rateAppliedPaise,
        verifiedMinutes: breakdown.verifiedMinutes,
        billableUnits: breakdown.billableUnits,
        unitLabel: breakdown.unitLabel,
        grossAmountPaise: breakdown.grossAmountPaise,
        deductionsPaise: breakdown.deductionsPaise,
        netAmountPaise: breakdown.netAmountPaise,
        calculationBreakdown: JSON.stringify(breakdown),
        status: "PENDING",
      },
    });

    // Money movement is append-only: the accrual records that the wage was
    // earned, long before anyone decides to release it.
    await tx.paymentLedgerEntry.create({
      data: {
        paymentId: payment.id,
        entryType: "ACCRUAL",
        amountPaise: breakdown.netAmountPaise,
        fromParty: "EMPLOYER",
        toParty: "ESCROW",
        metadata: JSON.stringify({
          reason: "Hours verified at check-out, pending employer approval.",
          workDate: workDate.toISOString().slice(0, 10),
        }),
      },
    });
  });

  await notify({
    userId: session.userId,
    type: "CHECK_OUT_SUCCESS",
    params: { job: job.title, hours: formatMinutes(workingMinutes) },
    linkUrl: `/worker/assignments/${assignment.id}`,
  });

  if (risk.flags.length > 0) {
    await raiseFraudAlerts(attendance.id, assignment.workerProfileId, job.id, risk.flags);
    await notify({
      userId: job.employer.userId,
      type: "ATTENDANCE_FLAGGED",
      params: { job: job.title, date: workDate.toISOString().slice(0, 10) },
      linkUrl: "/employer/approvals",
    });
  }

  await refreshReliability(profile.id);

  revalidatePath(`/worker/assignments/${assignment.id}`);
  revalidatePath("/worker/earnings");
  revalidatePath("/employer/approvals");

  return {
    ok: true,
    message: `Checked out. ${formatMinutes(workingMinutes)} verified, ${formatPaise(
      breakdown.netAmountPaise,
    )} pending employer approval.`,
  };
}

async function raiseFraudAlerts(
  attendanceId: string,
  workerProfileId: string,
  jobId: string,
  flags: RiskFlag[],
): Promise<void> {
  // Only material flags escalate to the admin queue; a low-severity late
  // check-in is a conversation between worker and employer, not a fraud case.
  const material = flags.filter((f) => f.severity !== "LOW");
  if (material.length === 0) return;

  const existing = await prisma.fraudAlert.findMany({
    where: { attendanceId },
    select: { ruleCode: true },
  });
  const seen = new Set(existing.map((e) => e.ruleCode));

  await prisma.fraudAlert.createMany({
    data: material
      .filter((f) => !seen.has(f.code))
      .map((f) => ({
        ruleCode: f.code,
        severity: f.severity,
        workerProfileId,
        attendanceId,
        jobId,
        // Stored in English: a fraud alert is an operator-facing audit
        // record read in logs and exports, so it keeps one stable
        // language. The admin UI re-localises from ruleCode for display.
        title: renderRiskTitle(f, "en"),
        description: renderRiskDetail(f, "en"),
        evidence: JSON.stringify({ attendanceId, rule: f.code }),
      })),
  });
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
