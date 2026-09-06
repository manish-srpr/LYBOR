import type { FraudSeverity } from "@prisma/client";
import { formatDistance } from "./geo";
import { formatMinutes } from "./money";

/**
 * Explainable attendance risk scoring.
 *
 * Every flag is a named rule with a stated threshold and the observed value, so
 * an employer rejecting a day, or an admin reviewing a fraud alert, can see
 * exactly which rule fired and why. Nothing here silently withholds wages: the
 * engine only annotates, a human still approves or rejects.
 */

export type RiskFlagCode =
  | "GPS_OUT_OF_RADIUS_IN"
  | "GPS_OUT_OF_RADIUS_OUT"
  | "LOW_GPS_ACCURACY"
  | "SHIFT_TOO_SHORT"
  | "SHIFT_TOO_LONG"
  | "LATE_CHECK_IN"
  | "EARLY_CHECK_OUT"
  | "DEMO_LOCATION_USED"
  | "MISSING_CHECK_OUT";

export type RiskFlag = {
  code: RiskFlagCode;
  severity: FraudSeverity;
  /** Points added to the 0..100 risk score. */
  points: number;
  title: string;
  titleHi: string;
  /** Observed value vs. the rule threshold, in plain language. */
  detail: string;
  detailHi: string;
};

export type RiskAssessment = {
  /** 0..100. Higher is riskier. */
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  flags: RiskFlag[];
  /** VERIFIED when clean, FLAGGED when a human should look. */
  verification: "VERIFIED" | "FLAGGED";
  summary: string;
  summaryHi: string;
};

export type AttendanceRiskInput = {
  checkInDistanceM: number;
  checkInWithinRadius: boolean;
  checkInAccuracyM: number | null;
  checkInSource: "GPS" | "DEMO";
  checkOutDistanceM: number | null;
  checkOutWithinRadius: boolean | null;
  checkOutAccuracyM: number | null;
  checkOutSource: "GPS" | "DEMO" | null;
  workingMinutes: number | null;
  expectedHoursPerDay: number;
  /** Minutes after the rostered shift start that check-in happened. */
  lateByMinutes: number | null;
  /** Minutes before the rostered shift end that check-out happened. */
  earlyByMinutes: number | null;
  radiusMeters: number;
};

const LATE_GRACE_MINUTES = 20;
const EARLY_GRACE_MINUTES = 20;
const POOR_ACCURACY_METERS = 120;
const MAX_PLAUSIBLE_MINUTES = 16 * 60;

export function assessAttendanceRisk(input: AttendanceRiskInput): RiskAssessment {
  const flags: RiskFlag[] = [];
  const expectedMinutes = Math.round((input.expectedHoursPerDay || 8) * 60);

  if (!input.checkInWithinRadius) {
    flags.push({
      code: "GPS_OUT_OF_RADIUS_IN",
      severity: "HIGH",
      points: 40,
      title: "Check-in outside the job site",
      titleHi: "चेक-इन कार्यस्थल के बाहर",
      detail: `Check-in was ${formatDistance(input.checkInDistanceM)} from the site, outside the ${formatDistance(input.radiusMeters)} geofence.`,
      detailHi: `चेक-इन कार्यस्थल से ${formatDistance(input.checkInDistanceM)} दूर था, जो ${formatDistance(input.radiusMeters)} की सीमा से बाहर है।`,
    });
  }

  if (input.checkOutWithinRadius === false && input.checkOutDistanceM !== null) {
    flags.push({
      code: "GPS_OUT_OF_RADIUS_OUT",
      severity: "HIGH",
      points: 30,
      title: "Check-out outside the job site",
      titleHi: "चेक-आउट कार्यस्थल के बाहर",
      detail: `Check-out was ${formatDistance(input.checkOutDistanceM)} from the site, outside the ${formatDistance(input.radiusMeters)} geofence.`,
      detailHi: `चेक-आउट कार्यस्थल से ${formatDistance(input.checkOutDistanceM)} दूर था, जो ${formatDistance(input.radiusMeters)} की सीमा से बाहर है।`,
    });
  }

  const worstAccuracy = Math.max(
    input.checkInAccuracyM ?? 0,
    input.checkOutAccuracyM ?? 0,
  );
  if (worstAccuracy > POOR_ACCURACY_METERS) {
    flags.push({
      code: "LOW_GPS_ACCURACY",
      severity: "LOW",
      points: 8,
      title: "Low GPS accuracy",
      titleHi: "जीपीएस सटीकता कम",
      detail: `Device reported +/- ${Math.round(worstAccuracy)} m, above the ${POOR_ACCURACY_METERS} m threshold. Distance checks are less certain.`,
      detailHi: `डिवाइस ने +/- ${Math.round(worstAccuracy)} मीटर बताया, जो ${POOR_ACCURACY_METERS} मीटर की सीमा से अधिक है।`,
    });
  }

  if (input.checkInSource === "DEMO" || input.checkOutSource === "DEMO") {
    flags.push({
      code: "DEMO_LOCATION_USED",
      severity: "MEDIUM",
      points: 15,
      title: "Simulated location used",
      titleHi: "नकली स्थान का उपयोग",
      detail:
        "Location was entered through the demo control rather than the device GPS. Acceptable in a prototype, never in production.",
      detailHi:
        "स्थान डिवाइस जीपीएस के बजाय डेमो नियंत्रण से दर्ज किया गया था।",
    });
  }

  if (input.workingMinutes === null) {
    flags.push({
      code: "MISSING_CHECK_OUT",
      severity: "MEDIUM",
      points: 20,
      title: "No check-out recorded",
      titleHi: "चेक-आउट दर्ज नहीं",
      detail:
        "The shift was opened but never closed, so verified hours cannot be computed yet.",
      detailHi: "शिफ्ट शुरू हुई लेकिन बंद नहीं हुई, इसलिए घंटे गिने नहीं जा सकते।",
    });
  } else {
    if (input.workingMinutes < expectedMinutes * 0.5) {
      flags.push({
        code: "SHIFT_TOO_SHORT",
        severity: "MEDIUM",
        points: 18,
        title: "Shift much shorter than expected",
        titleHi: "शिफ्ट अपेक्षा से बहुत छोटी",
        detail: `Worked ${formatMinutes(input.workingMinutes)} against an expected ${input.expectedHoursPerDay} h, under the 50% mark.`,
        detailHi: `अपेक्षित ${input.expectedHoursPerDay} घंटे के मुकाबले ${formatMinutes(input.workingMinutes)} काम हुआ।`,
      });
    }
    if (input.workingMinutes > MAX_PLAUSIBLE_MINUTES) {
      flags.push({
        code: "SHIFT_TOO_LONG",
        severity: "HIGH",
        points: 25,
        title: "Implausibly long shift",
        titleHi: "असंभव रूप से लंबी शिफ्ट",
        detail: `Recorded ${formatMinutes(input.workingMinutes)}, beyond the ${MAX_PLAUSIBLE_MINUTES / 60} h plausibility limit. Likely a forgotten check-out.`,
        detailHi: `${formatMinutes(input.workingMinutes)} दर्ज हुआ, जो ${MAX_PLAUSIBLE_MINUTES / 60} घंटे की सीमा से अधिक है।`,
      });
    }
  }

  if (input.lateByMinutes !== null && input.lateByMinutes > LATE_GRACE_MINUTES) {
    flags.push({
      code: "LATE_CHECK_IN",
      severity: "LOW",
      points: 10,
      title: "Late check-in",
      titleHi: "देर से चेक-इन",
      detail: `Checked in ${formatMinutes(input.lateByMinutes)} after the rostered start, past the ${LATE_GRACE_MINUTES} minute grace period.`,
      detailHi: `निर्धारित समय से ${formatMinutes(input.lateByMinutes)} देर से चेक-इन किया।`,
    });
  }

  if (input.earlyByMinutes !== null && input.earlyByMinutes > EARLY_GRACE_MINUTES) {
    flags.push({
      code: "EARLY_CHECK_OUT",
      severity: "LOW",
      points: 10,
      title: "Early check-out",
      titleHi: "जल्दी चेक-आउट",
      detail: `Checked out ${formatMinutes(input.earlyByMinutes)} before the rostered end, past the ${EARLY_GRACE_MINUTES} minute grace period.`,
      detailHi: `निर्धारित समय से ${formatMinutes(input.earlyByMinutes)} पहले चेक-आउट किया।`,
    });
  }

  const score = Math.min(100, flags.reduce((sum, f) => sum + f.points, 0));
  const level: RiskAssessment["level"] = score >= 50 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW";
  const verification: RiskAssessment["verification"] = score >= 20 ? "FLAGGED" : "VERIFIED";

  return {
    score,
    level,
    flags,
    verification,
    summary:
      flags.length === 0
        ? "All attendance checks passed. GPS was inside the job site and hours look normal."
        : `${flags.length} check(s) need attention: ${flags.map((f) => f.title).join("; ")}.`,
    summaryHi:
      flags.length === 0
        ? "सभी उपस्थिति जांच पास हुईं। जीपीएस कार्यस्थल के भीतर था।"
        : `${flags.length} जांच पर ध्यान चाहिए: ${flags.map((f) => f.titleHi).join("; ")}।`,
  };
}

export function parseRiskFlags(json: string | null): RiskFlag[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as RiskFlag[];
  } catch {
    return [];
  }
}

/** Highest severity present, used to colour badges and rank admin queues. */
export function worstSeverity(flags: RiskFlag[]): FraudSeverity | null {
  if (flags.some((f) => f.severity === "HIGH")) return "HIGH";
  if (flags.some((f) => f.severity === "MEDIUM")) return "MEDIUM";
  if (flags.length > 0) return "LOW";
  return null;
}
