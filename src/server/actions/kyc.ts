"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import type { ActionResult } from "./attendance";

const kycSchema = z.object({
  docType: z.enum(["AADHAAR", "PAN", "DRIVING_LICENSE", "VOTER_ID", "LABOUR_CARD"]),
  holderName: z.string().trim().min(2, "Enter the name printed on the document."),
  docNumber: z.string().trim().min(6, "Enter the full document number."),
});

/** Keeps the last four characters visible, everything else masked. */
function maskDocNumber(value: string): string {
  const cleaned = value.replace(/\s+/gu, "");
  if (cleaned.length <= 4) return "*".repeat(cleaned.length);
  return `${"*".repeat(cleaned.length - 4)}${cleaned.slice(-4)}`;
}

function hashDocNumber(value: string): string {
  const pepper = process.env.JWT_SECRET ?? "lybor";
  return createHash("sha256")
    .update(`${pepper}:${value.replace(/\s+/gu, "").toUpperCase()}`)
    .digest("hex");
}

/**
 * A raw government ID never reaches the database. The mask is what humans see;
 * the salted hash is what duplicate detection compares. Neither can be reversed
 * back into the original number.
 */
export async function submitKycAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = kycSchema.safeParse({
    docType: formData.get("docType"),
    holderName: formData.get("holderName"),
    docNumber: formData.get("docNumber"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const { docType, holderName, docNumber } = parsed.data;
  const docNumberHash = hashDocNumber(docNumber);

  const duplicate = await prisma.kYCRecord.findFirst({
    where: { docNumberHash, userId: { not: session.userId } },
  });
  if (duplicate) {
    return {
      ok: false,
      message: "That document is already registered to another account.",
    };
  }

  const pending = await prisma.kYCRecord.findFirst({
    where: { userId: session.userId, status: "PENDING" },
  });
  if (pending) {
    return { ok: false, message: "You already have a document awaiting review." };
  }

  await prisma.kYCRecord.create({
    data: {
      userId: session.userId,
      docType,
      holderName,
      docNumberMasked: maskDocNumber(docNumber),
      docNumberHash,
      status: "PENDING",
    },
  });

  if (session.role === "WORKER") {
    await prisma.workerProfile.updateMany({
      where: { userId: session.userId },
      data: { kycStatus: "PENDING" },
    });
  } else if (session.role === "EMPLOYER") {
    await prisma.employerProfile.updateMany({
      where: { userId: session.userId },
      data: { kycStatus: "PENDING" },
    });
  }

  revalidatePath("/worker/kyc");
  revalidatePath("/employer/kyc");
  revalidatePath("/admin/kyc");

  return { ok: true, message: "Document submitted. An administrator will review it." };
}

const reviewSchema = z.object({
  recordId: z.string().min(1),
  decision: z.enum(["VERIFIED", "REJECTED"]),
  reason: z.string().trim().max(300).optional(),
});

export async function reviewKycAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole("ADMIN");
  const parsed = reviewSchema.safeParse({
    recordId: formData.get("recordId"),
    decision: formData.get("decision"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Invalid review." };
  const { recordId, decision, reason } = parsed.data;

  if (decision === "REJECTED" && !reason) {
    return { ok: false, message: "Give a reason for the rejection." };
  }

  const record = await prisma.kYCRecord.findUnique({
    where: { id: recordId },
    include: { user: true },
  });
  if (!record) return { ok: false, message: "Record not found." };

  await prisma.kYCRecord.update({
    where: { id: recordId },
    data: {
      status: decision,
      reviewedByUserId: session.userId,
      reviewedAt: new Date(),
      rejectionReason: decision === "REJECTED" ? (reason ?? null) : null,
    },
  });

  if (record.user.role === "WORKER") {
    await prisma.workerProfile.updateMany({
      where: { userId: record.userId },
      data: { kycStatus: decision },
    });
  } else if (record.user.role === "EMPLOYER") {
    await prisma.employerProfile.updateMany({
      where: { userId: record.userId },
      data: { kycStatus: decision, isVerified: decision === "VERIFIED" },
    });
  }

  await notify({
    userId: record.userId,
    type: decision === "VERIFIED" ? "KYC_VERIFIED" : "KYC_REJECTED",
    params: { reason: reason ?? "" },
    linkUrl: record.user.role === "WORKER" ? "/worker/kyc" : "/employer/kyc",
  });

  revalidatePath("/admin/kyc");
  revalidatePath("/worker/kyc");
  revalidatePath("/employer/kyc");

  return { ok: true, message: `Identity ${decision.toLowerCase()}.` };
}
