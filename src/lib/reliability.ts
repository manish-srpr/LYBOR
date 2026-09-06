import { prisma } from "./db";

/**
 * Reliability is a derived, recomputed number - never edited by hand and never
 * an input to a money decision. It only affects ranking and display, so a low
 * score can cost a worker visibility but can never cost them earned wages.
 */
export type ReliabilityBreakdown = {
  score: number;
  attendanceRate: number;
  approvalRate: number;
  cleanRate: number;
  completedJobs: number;
  totalDays: number;
  reasons: { label: string; labelHi: string; detail: string }[];
};

export async function computeReliability(
  workerProfileId: string,
): Promise<ReliabilityBreakdown> {
  const attendances = await prisma.attendance.findMany({
    where: { assignment: { workerProfileId } },
    select: {
      approvalStatus: true,
      verificationStatus: true,
      workingMinutes: true,
    },
  });

  const totalDays = attendances.length;
  const withCheckOut = attendances.filter((a) => a.workingMinutes !== null).length;
  const approved = attendances.filter((a) => a.approvalStatus === "APPROVED").length;
  const clean = attendances.filter((a) => a.verificationStatus === "VERIFIED").length;

  const completedJobs = await prisma.workHistory.count({
    where: { workerProfileId, completionStatus: "COMPLETED" },
  });

  // A brand new worker starts at a neutral 50 rather than 0, so an empty
  // history is not mistaken for a bad history.
  if (totalDays === 0) {
    return {
      score: 50,
      attendanceRate: 0,
      approvalRate: 0,
      cleanRate: 0,
      completedJobs,
      totalDays: 0,
      reasons: [
        {
          label: "No verified shifts yet",
          labelHi: "अभी तक कोई सत्यापित शिफ्ट नहीं",
          detail: "New workers start at a neutral 50 until they build a record.",
        },
      ],
    };
  }

  const attendanceRate = withCheckOut / totalDays;
  const approvalRate = approved / totalDays;
  const cleanRate = clean / totalDays;
  const tenureBonus = Math.min(1, completedJobs / 5);

  const score = Math.round(
    (attendanceRate * 0.3 + approvalRate * 0.35 + cleanRate * 0.25 + tenureBonus * 0.1) * 100,
  );

  return {
    score,
    attendanceRate,
    approvalRate,
    cleanRate,
    completedJobs,
    totalDays,
    reasons: [
      {
        label: "Completed shifts",
        labelHi: "पूरी की गई शिफ्ट",
        detail: `${withCheckOut} of ${totalDays} shifts were checked out properly.`,
      },
      {
        label: "Employer approvals",
        labelHi: "नियोक्ता स्वीकृतियाँ",
        detail: `${approved} of ${totalDays} attendance days were approved.`,
      },
      {
        label: "Clean GPS record",
        labelHi: "स्वच्छ जीपीएस रिकॉर्ड",
        detail: `${clean} of ${totalDays} days passed every risk check.`,
      },
      {
        label: "Jobs completed",
        labelHi: "पूरे किए गए काम",
        detail: `${completedJobs} ${
          completedJobs === 1 ? "job" : "jobs"
        } finished end to end.`,
      },
    ],
  };
}

export async function refreshReliability(workerProfileId: string): Promise<number> {
  const breakdown = await computeReliability(workerProfileId);
  await prisma.workerProfile.update({
    where: { id: workerProfileId },
    data: {
      reliabilityScore: breakdown.score,
      reliabilityUpdatedAt: new Date(),
    },
  });
  return breakdown.score;
}
