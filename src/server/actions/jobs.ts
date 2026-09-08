"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  MAX_GEOFENCE_RADIUS_M,
  MIN_GEOFENCE_RADIUS_M,
} from "@/lib/geofence";
import { requireEmployerProfile, requireWorkerProfile } from "@/lib/auth";
import { computeMatch, type MatchJob, type MatchWorker } from "@/lib/matching";
import { rupeesToPaise } from "@/lib/money";
import { notify } from "@/lib/notifications";
import type { FormState } from "./session";

const jobSchema = z.object({
  title: z.string().trim().min(4, "Give the job a clear title."),
  description: z.string().trim().min(10, "Describe the work in a sentence or two."),
  category: z.string().trim().min(2),
  addressLine: z.string().trim().min(4, "Enter the site address."),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  pincode: z.string().trim().regex(/^\d{6}$/u, "Enter a 6 digit pincode."),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  checkInRadiusMeters: z.coerce
    .number()
    .int()
    .min(MIN_GEOFENCE_RADIUS_M)
    .max(MAX_GEOFENCE_RADIUS_M),
  wageType: z.enum(["HOURLY", "DAILY", "SHIFT"]),
  wageRateRupees: z.coerce.number().positive("Wage must be more than zero."),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/u),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}$/u),
  expectedHoursPerDay: z.coerce.number().min(1).max(16),
  workersRequired: z.coerce.number().int().min(1).max(50),
  skillIds: z.array(z.string()).default([]),
});

export async function createJobAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { profile } = await requireEmployerProfile();

  const parsed = jobSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    addressLine: formData.get("addressLine"),
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    checkInRadiusMeters: formData.get("checkInRadiusMeters"),
    wageType: formData.get("wageType"),
    wageRateRupees: formData.get("wageRateRupees"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    shiftStart: formData.get("shiftStart"),
    shiftEnd: formData.get("shiftEnd"),
    expectedHoursPerDay: formData.get("expectedHoursPerDay"),
    workersRequired: formData.get("workersRequired"),
    skillIds: formData.getAll("skillIds").map(String),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the job details." };
  }
  const data = parsed.data;

  const start = new Date(`${data.startDate}T00:00:00.000Z`);
  const end = new Date(`${data.endDate}T00:00:00.000Z`);
  if (end < start) {
    return { error: "The end date cannot be before the start date." };
  }

  const job = await prisma.job.create({
    data: {
      employerProfileId: profile.id,
      title: data.title,
      description: data.description,
      category: data.category,
      addressLine: data.addressLine,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      latitude: data.latitude,
      longitude: data.longitude,
      checkInRadiusMeters: data.checkInRadiusMeters,
      wageType: data.wageType,
      wageRatePaise: rupeesToPaise(data.wageRateRupees),
      startDate: start,
      endDate: end,
      shiftStart: data.shiftStart,
      shiftEnd: data.shiftEnd,
      expectedHoursPerDay: data.expectedHoursPerDay,
      workersRequired: data.workersRequired,
      status: "OPEN",
      requiredSkills: {
        create: data.skillIds.map((skillId) => ({ skillId, isMandatory: true })),
      },
    },
  });

  await prisma.employerProfile.update({
    where: { id: profile.id },
    data: { totalJobsPosted: { increment: 1 } },
  });

  revalidatePath("/employer/jobs");
  revalidatePath("/worker/jobs");
  redirect(`/employer/jobs/${job.id}`);
}

/** Loads exactly the shape the matching engine needs for one worker. */
export async function loadMatchWorker(workerProfileId: string): Promise<MatchWorker | null> {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerProfileId },
    include: { skills: { include: { skill: true } } },
  });
  if (!worker) return null;
  return {
    latitude: worker.latitude,
    longitude: worker.longitude,
    travelRadiusKm: worker.travelRadiusKm,
    availability: worker.availability,
    experienceYears: worker.experienceYears,
    reliabilityScore: worker.reliabilityScore,
    preferredWageMinPaise: worker.preferredWageMinPaise,
    skills: worker.skills.map((s) => ({
      skillId: s.skillId,
      nameEn: s.skill.nameEn,
      proficiency: s.proficiency,
    })),
  };
}

export async function applyToJobAction(formData: FormData): Promise<void> {
  const { session, profile } = await requireWorkerProfile();
  const jobId = String(formData.get("jobId") ?? "");
  const coverNote = String(formData.get("coverNote") ?? "").trim() || null;
  if (!jobId) return;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      requiredSkills: { include: { skill: true } },
      employer: { include: { user: true } },
    },
  });
  if (!job || job.status !== "OPEN") return;

  const existing = await prisma.jobApplication.findUnique({
    where: { jobId_workerProfileId: { jobId, workerProfileId: profile.id } },
  });
  if (existing) return;

  const matchWorker = await loadMatchWorker(profile.id);
  const matchJob: MatchJob = {
    latitude: job.latitude,
    longitude: job.longitude,
    wageType: job.wageType,
    wageRatePaise: job.wageRatePaise,
    expectedHoursPerDay: job.expectedHoursPerDay,
    requiredSkills: job.requiredSkills.map((s) => ({
      skillId: s.skillId,
      nameEn: s.skill.nameEn,
      isMandatory: s.isMandatory,
    })),
  };
  // The score is frozen onto the application so the employer sees exactly the
  // number the worker saw when they decided to apply.
  const match = matchWorker ? computeMatch(matchWorker, matchJob) : null;

  await prisma.jobApplication.create({
    data: {
      jobId,
      workerProfileId: profile.id,
      coverNote,
      matchScore: match?.score ?? null,
      matchFactors: match ? JSON.stringify(match.factors) : null,
    },
  });

  await notify({
    userId: session.userId,
    type: "APPLICATION_SUBMITTED",
    params: { job: job.title, employer: job.employer.companyName },
    linkUrl: "/worker/applications",
  });
  await notify({
    userId: job.employer.userId,
    type: "APPLICATION_SUBMITTED",
    params: { job: job.title, employer: job.employer.companyName },
    linkUrl: `/employer/jobs/${jobId}`,
  });

  revalidatePath(`/worker/jobs/${jobId}`);
  revalidatePath("/worker/applications");
  revalidatePath(`/employer/jobs/${jobId}`);
}

export async function withdrawApplicationAction(formData: FormData): Promise<void> {
  const { profile } = await requireWorkerProfile();
  const applicationId = String(formData.get("applicationId") ?? "");
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application || application.workerProfileId !== profile.id) return;
  if (application.status === "ACCEPTED") return;

  await prisma.jobApplication.update({
    where: { id: applicationId },
    data: { status: "WITHDRAWN", respondedAt: new Date() },
  });
  revalidatePath("/worker/applications");
}

/**
 * Accepting an application is what creates the assignment - the point where
 * wage terms are frozen. Everything downstream (attendance, wages, payment,
 * history) hangs off the assignment, never off the job, so editing the job
 * later cannot change what an assigned worker is owed.
 */
export async function respondToApplicationAction(formData: FormData): Promise<void> {
  const { profile } = await requireEmployerProfile();
  const applicationId = String(formData.get("applicationId") ?? "");
  const decision = String(formData.get("decision") ?? "");

  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: {
      job: true,
      worker: { include: { user: true } },
    },
  });
  if (!application || application.job.employerProfileId !== profile.id) return;
  if (application.status === "ACCEPTED" || application.status === "WITHDRAWN") return;

  if (decision === "REJECT") {
    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: "REJECTED", respondedAt: new Date() },
    });
    await notify({
      userId: application.worker.userId,
      type: "APPLICATION_REJECTED",
      params: { job: application.job.title },
      linkUrl: "/worker/applications",
    });
    revalidatePath(`/employer/jobs/${application.jobId}`);
    revalidatePath("/worker/applications");
    return;
  }

  if (decision === "SHORTLIST") {
    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: "SHORTLISTED", respondedAt: new Date() },
    });
    revalidatePath(`/employer/jobs/${application.jobId}`);
    return;
  }

  if (decision !== "ACCEPT") return;

  const job = application.job;
  if (job.workersAssigned >= job.workersRequired) return;

  await prisma.$transaction(async (tx) => {
    await tx.jobApplication.update({
      where: { id: applicationId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    await tx.jobAssignment.create({
      data: {
        jobId: job.id,
        workerProfileId: application.workerProfileId,
        applicationId: application.id,
        agreedWageType: job.wageType,
        agreedWageRatePaise: job.wageRatePaise,
        expectedHoursPerDay: job.expectedHoursPerDay,
        startDate: job.startDate,
        endDate: job.endDate,
      },
    });

    const assignedNow = job.workersAssigned + 1;
    await tx.job.update({
      where: { id: job.id },
      data: {
        workersAssigned: assignedNow,
        status: assignedNow >= job.workersRequired ? "IN_PROGRESS" : job.status,
      },
    });

    await tx.workerProfile.update({
      where: { id: application.workerProfileId },
      data: { availability: "BUSY" },
    });

    await tx.employerProfile.update({
      where: { id: profile.id },
      data: { totalWorkersHired: { increment: 1 } },
    });
  });

  await notify({
    userId: application.worker.userId,
    type: "APPLICATION_ACCEPTED",
    params: { job: job.title, employer: profile.companyName },
    linkUrl: "/worker/assignments",
  });
  await notify({
    userId: profile.userId,
    type: "WORKER_ASSIGNED",
    params: { job: job.title, worker: application.worker.user.fullName },
    linkUrl: `/employer/jobs/${job.id}`,
  });

  revalidatePath(`/employer/jobs/${job.id}`);
  revalidatePath("/worker/assignments");
  revalidatePath("/worker/applications");
}

export async function closeJobAction(formData: FormData): Promise<void> {
  const { profile } = await requireEmployerProfile();
  const jobId = String(formData.get("jobId") ?? "");
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.employerProfileId !== profile.id) return;

  await prisma.job.update({
    where: { id: jobId },
    data: { status: job.status === "OPEN" ? "CANCELLED" : "COMPLETED" },
  });
  revalidatePath("/employer/jobs");
  revalidatePath(`/employer/jobs/${jobId}`);
}
