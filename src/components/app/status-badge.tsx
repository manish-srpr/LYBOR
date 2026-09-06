import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { Lang } from "@/lib/i18n";

type Tone = NonNullable<BadgeProps["variant"]>;

/**
 * One place that maps every workflow enum to a colour and a bilingual label.
 * Keeping it central is what stops "APPROVED" from being green on one screen
 * and grey on another.
 */
const STATUS_MAP: Record<string, { tone: Tone; en: string; hi: string }> = {
  // Job
  DRAFT: { tone: "outline", en: "Draft", hi: "मसौदा" },
  OPEN: { tone: "primary", en: "Open", hi: "खुला" },
  IN_PROGRESS: { tone: "warning", en: "In progress", hi: "चल रहा है" },
  COMPLETED: { tone: "success", en: "Completed", hi: "पूरा" },
  CANCELLED: { tone: "outline", en: "Cancelled", hi: "रद्द" },

  // Application
  PENDING: { tone: "warning", en: "Pending", hi: "लंबित" },
  SHORTLISTED: { tone: "primary", en: "Shortlisted", hi: "चयन सूची में" },
  ACCEPTED: { tone: "success", en: "Accepted", hi: "स्वीकृत" },
  REJECTED: { tone: "destructive", en: "Rejected", hi: "अस्वीकृत" },
  WITHDRAWN: { tone: "outline", en: "Withdrawn", hi: "वापस लिया" },

  // Assignment
  ASSIGNED: { tone: "primary", en: "Assigned", hi: "नियुक्त" },
  ACTIVE: { tone: "success", en: "Active", hi: "सक्रिय" },
  TERMINATED: { tone: "destructive", en: "Terminated", hi: "समाप्त" },

  // Attendance verification
  VERIFIED: { tone: "success", en: "Verified", hi: "सत्यापित" },
  FLAGGED: { tone: "warning", en: "Flagged", hi: "चिह्नित" },

  // Approval
  APPROVED: { tone: "success", en: "Approved", hi: "स्वीकृत" },

  // Payment
  PAID: { tone: "success", en: "Paid", hi: "भुगतान हुआ" },
  DISPUTED: { tone: "destructive", en: "Disputed", hi: "विवादित" },

  // Dispute
  UNDER_REVIEW: { tone: "warning", en: "Under review", hi: "समीक्षा में" },
  RESOLVED: { tone: "success", en: "Resolved", hi: "हल" },

  // KYC
  NOT_SUBMITTED: { tone: "outline", en: "Not submitted", hi: "जमा नहीं" },

  // Fraud
  REVIEWING: { tone: "warning", en: "Reviewing", hi: "समीक्षा" },
  CONFIRMED: { tone: "destructive", en: "Confirmed", hi: "पुष्ट" },
  DISMISSED: { tone: "outline", en: "Dismissed", hi: "खारिज" },

  // Severity
  LOW: { tone: "outline", en: "Low", hi: "कम" },
  MEDIUM: { tone: "warning", en: "Medium", hi: "मध्यम" },
  HIGH: { tone: "destructive", en: "High", hi: "उच्च" },
};

export function StatusBadge({
  status,
  lang = "en",
  className,
}: {
  status: string;
  lang?: Lang;
  className?: string;
}) {
  const entry = STATUS_MAP[status];
  if (!entry) {
    return (
      <Badge variant="outline" className={className}>
        {status}
      </Badge>
    );
  }
  return (
    <Badge variant={entry.tone} className={className}>
      {lang === "hi" ? entry.hi : entry.en}
    </Badge>
  );
}

export function statusLabel(status: string, lang: Lang): string {
  const entry = STATUS_MAP[status];
  if (!entry) return status;
  return lang === "hi" ? entry.hi : entry.en;
}
