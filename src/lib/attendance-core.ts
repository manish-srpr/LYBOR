/**
 * The attendance decision engine.
 *
 * Deliberately NOT a "use server" module. Every export of a "use server" file
 * is a callable Server Action, so `performCheckIn(actor, ...)` living there
 * would hand any client the ability to name somebody else's
 * `workerProfileId` and punch on their behalf - the exact abuse the feature is
 * meant to prevent. Keeping the core here means the only reachable entry
 * points are the thin wrappers in src/server/actions/attendance.ts, which
 * resolve the actor from the session and cannot be told who to be.
 *
 * The separation also makes the logic testable: it takes an actor and a
 * FormData and touches no cookies, so it runs outside a request.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatDistance } from "@/lib/geo";
import { evaluateGeofence } from "@/lib/geofence";
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

export type ActionResult = { ok: boolean; message: string };

/** Who the punch is for. Resolved from the session by the caller, never sent. */
export type AttendanceActor = { workerProfileId: string; userId: string };

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

export async function performCheckIn(
  actor: AttendanceActor,
  formData: FormData,
): Promise<ActionResult> {
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
  if (!assignment || assignment.workerProfileId !== actor.workerProfileId) {
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

  // The distance is recomputed here from the worksite stored on the job. Any
  // distance the client might send is ignored: the browser is the thing being
  // verified, so it cannot also be the thing doing the verifying.
  const verdict = evaluateGeofence({
    worker: { latitude: input.latitude, longitude: input.longitude },
    site: { latitude: job.latitude, longitude: job.longitude },
    radiusM: job.checkInRadiusMeters,
    accuracyM: input.accuracy ?? null,
  });
  const distance = verdict.distanceM;
  const withinRadius = verdict.withinRadius;

  // Under the enforcing policy an out-of-radius punch is refused outright and
  // no attendance row is written, so unverified time can never become billable
  // hours. Under "flag" the punch is kept for a human to judge instead.
  if (!verdict.allowed) {
    return {
      ok: false,
      message: `You are ${formatDistance(distance)} from ${job.title}, outside the ${formatDistance(verdict.radiusM)} check-in area. Move closer to the worksite and try again.`,
    };
  }

  const lateBy = minutesFromRoster(now, job.shiftStart);

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
    userId: actor.userId,
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


  return {
    ok: true,
    message: withinRadius
      ? "Checked in. GPS placed you at the job site."
      : `Checked in from ${formatDistance(distance)} away. Your employer will review it.`,
  };
}

export async function performCheckOut(
  actor: AttendanceActor,
  formData: FormData,
): Promise<ActionResult> {
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
  if (!assignment || assignment.workerProfileId !== actor.workerProfileId) {
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

  // Recomputed server-side, exactly as on check-in.
  const verdict = evaluateGeofence({
    worker: { latitude: input.latitude, longitude: input.longitude },
    site: { latitude: job.latitude, longitude: job.longitude },
    radiusM: job.checkInRadiusMeters,
    accuracyM: input.accuracy ?? null,
  });
  const distance = verdict.distanceM;
  const withinRadius = verdict.withinRadius;

  // Refusing a check-out leaves the shift open rather than closing it with
  // hours nobody can vouch for. The worker keeps their check-in and can close
  // it properly once back on site.
  if (!verdict.allowed) {
    return {
      ok: false,
      message: `You are ${formatDistance(distance)} from ${job.title}, outside the ${formatDistance(verdict.radiusM)} check-out area. Your check-in is still open - return to the worksite to check out.`,
    };
  }

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
    userId: actor.userId,
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

  await refreshReliability(actor.workerProfileId);


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
