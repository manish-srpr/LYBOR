import type { NotificationType } from "@prisma/client";
import { prisma } from "./db";
import type { Lang } from "./i18n";

/**
 * Notifications store an i18n key plus params rather than a rendered sentence,
 * so a worker who switches to Hindi sees their whole history in Hindi.
 */
type NotificationCopy = {
  en: string;
  hi: string;
};

const COPY: Record<NotificationType, { title: NotificationCopy; body: NotificationCopy }> = {
  APPLICATION_SUBMITTED: {
    title: { en: "Application sent", hi: "आवेदन भेजा गया" },
    body: {
      en: "Your application for {job} was sent to {employer}.",
      hi: "{job} के लिए आपका आवेदन {employer} को भेज दिया गया।",
    },
  },
  APPLICATION_ACCEPTED: {
    title: { en: "You got the job", hi: "आपको काम मिल गया" },
    body: {
      en: "{employer} accepted your application for {job}.",
      hi: "{employer} ने {job} के लिए आपका आवेदन स्वीकार कर लिया।",
    },
  },
  APPLICATION_REJECTED: {
    title: { en: "Application not selected", hi: "आवेदन चयनित नहीं" },
    body: {
      en: "Your application for {job} was not selected this time.",
      hi: "इस बार {job} के लिए आपका आवेदन चयनित नहीं हुआ।",
    },
  },
  WORKER_ASSIGNED: {
    title: { en: "Worker assigned", hi: "श्रमिक नियुक्त" },
    body: {
      en: "{worker} is now assigned to {job}.",
      hi: "{worker} को अब {job} पर नियुक्त किया गया है।",
    },
  },
  JOB_STARTING: {
    title: { en: "Job starts soon", hi: "काम जल्द शुरू" },
    body: { en: "{job} starts on {date}.", hi: "{job} {date} को शुरू होगा।" },
  },
  CHECK_IN_SUCCESS: {
    title: { en: "Checked in", hi: "चेक इन हो गया" },
    body: {
      en: "GPS check-in recorded for {job} at {time}.",
      hi: "{job} के लिए {time} पर जीपीएस चेक-इन दर्ज हुआ।",
    },
  },
  CHECK_OUT_SUCCESS: {
    title: { en: "Checked out", hi: "चेक आउट हो गया" },
    body: {
      en: "{hours} verified for {job}. Awaiting employer approval.",
      hi: "{job} के लिए {hours} सत्यापित। नियोक्ता की स्वीकृति बाकी।",
    },
  },
  ATTENDANCE_FLAGGED: {
    title: { en: "Attendance flagged", hi: "उपस्थिति चिह्नित" },
    body: {
      en: "A risk check fired on {job} for {date}. An employer will review it.",
      hi: "{date} को {job} पर एक जोखिम जाँच सक्रिय हुई।",
    },
  },
  ATTENDANCE_APPROVED: {
    title: { en: "Hours approved", hi: "घंटे स्वीकृत" },
    body: {
      en: "{employer} approved {hours} for {job}. {amount} is payable.",
      hi: "{employer} ने {job} के लिए {hours} स्वीकृत किए। {amount} देय है।",
    },
  },
  ATTENDANCE_REJECTED: {
    title: { en: "Hours rejected", hi: "घंटे अस्वीकृत" },
    body: {
      en: "{employer} rejected attendance for {job} on {date}. You can raise a dispute.",
      hi: "{employer} ने {date} को {job} की उपस्थिति अस्वीकार कर दी।",
    },
  },
  PAYMENT_APPROVED: {
    title: { en: "Payment approved", hi: "भुगतान स्वीकृत" },
    body: { en: "{amount} approved for {job}.", hi: "{job} के लिए {amount} स्वीकृत।" },
  },
  PAYMENT_PAID: {
    title: { en: "Payment released", hi: "भुगतान जारी" },
    body: { en: "{amount} was paid for {job}.", hi: "{job} के लिए {amount} का भुगतान हुआ।" },
  },
  DISPUTE_CREATED: {
    title: { en: "Dispute raised", hi: "शिकायत दर्ज" },
    body: { en: "A dispute was raised: {reason}.", hi: "एक शिकायत दर्ज हुई: {reason}।" },
  },
  DISPUTE_RESOLVED: {
    title: { en: "Dispute resolved", hi: "शिकायत हल" },
    body: { en: "Your dispute was resolved: {reason}.", hi: "आपकी शिकायत हल हुई: {reason}।" },
  },
  KYC_VERIFIED: {
    title: { en: "Identity verified", hi: "पहचान सत्यापित" },
    body: {
      en: "Your identity document was verified. Your trust badge is active.",
      hi: "आपका पहचान दस्तावेज़ सत्यापित हो गया।",
    },
  },
  KYC_REJECTED: {
    title: { en: "Identity not verified", hi: "पहचान सत्यापित नहीं" },
    body: { en: "Your document was rejected: {reason}.", hi: "आपका दस्तावेज़ अस्वीकृत: {reason}।" },
  },
  SYSTEM: {
    title: { en: "STRIVER", hi: "स्ट्राइवर" },
    body: { en: "{message}", hi: "{message}" },
  },
};

function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => params[key] ?? `{${key}}`);
}

export function renderNotification(
  lang: Lang,
  type: NotificationType,
  paramsJson: string | null,
): { title: string; body: string } {
  const copy = COPY[type] ?? COPY.SYSTEM;
  let params: Record<string, string> = {};
  if (paramsJson) {
    try {
      params = JSON.parse(paramsJson) as Record<string, string>;
    } catch {
      params = {};
    }
  }
  return {
    title: copy.title[lang],
    body: interpolate(copy.body[lang], params),
  };
}

export async function notify(input: {
  userId: string;
  type: NotificationType;
  params?: Record<string, string>;
  linkUrl?: string;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      titleKey: `notification.${input.type}.title`,
      bodyKey: `notification.${input.type}.body`,
      params: input.params ? JSON.stringify(input.params) : null,
      linkUrl: input.linkUrl ?? null,
    },
  });
}
