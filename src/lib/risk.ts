import type { FraudSeverity } from "@prisma/client";
import { formatDistance } from "./geo";
import { formatMinutes } from "./money";
import { translate, type Locale, type MessageKey, type TranslateParams } from "./i18n";

/**
 * Explainable attendance risk scoring.
 *
 * Every flag is a named rule with a stated threshold and the observed value, so
 * an employer rejecting a day, or an admin reviewing a fraud alert, can see
 * exactly which rule fired and why. Nothing here silently withholds wages: the
 * engine only annotates, a human still approves or rejects.
 *
 * Flags carry a translation key plus the observed values as params, not
 * rendered prose. The engine has no idea what language anyone reads, and a
 * flag persisted months ago renders in whatever language its reader prefers
 * today. Scores and thresholds are untouched by any of this.
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
  /** Values observed by the rule, already formatted for display. */
  params?: Record<string, string | number>;
  /**
   * Legacy rendered prose. Rows written before localisation still carry these
   * and nothing else, so the renderers below fall back to them rather than
   * showing a raw key to somebody reviewing an old attendance record.
   */
  title?: string;
  titleHi?: string;
  detail?: string;
  detailHi?: string;
};

export type RiskAssessment = {
  /** 0..100. Higher is riskier. */
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  flags: RiskFlag[];
  /** VERIFIED when clean, FLAGGED when a human should look. */
  verification: "VERIFIED" | "FLAGGED";
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
      params: {
        distance: formatDistance(input.checkInDistanceM),
        radius: formatDistance(input.radiusMeters),
      },
    });
  }

  if (input.checkOutWithinRadius === false && input.checkOutDistanceM !== null) {
    flags.push({
      code: "GPS_OUT_OF_RADIUS_OUT",
      severity: "HIGH",
      points: 30,
      params: {
        distance: formatDistance(input.checkOutDistanceM),
        radius: formatDistance(input.radiusMeters),
      },
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
      params: {
        accuracy: Math.round(worstAccuracy),
        threshold: POOR_ACCURACY_METERS,
      },
    });
  }

  if (input.checkInSource === "DEMO" || input.checkOutSource === "DEMO") {
    flags.push({
      code: "DEMO_LOCATION_USED",
      severity: "MEDIUM",
      points: 15,
    });
  }

  if (input.workingMinutes === null) {
    flags.push({
      code: "MISSING_CHECK_OUT",
      severity: "MEDIUM",
      points: 20,
    });
  } else {
    if (input.workingMinutes < expectedMinutes * 0.5) {
      flags.push({
        code: "SHIFT_TOO_SHORT",
        severity: "MEDIUM",
        points: 18,
        params: {
          worked: formatMinutes(input.workingMinutes),
          expected: input.expectedHoursPerDay,
        },
      });
    }
    if (input.workingMinutes > MAX_PLAUSIBLE_MINUTES) {
      flags.push({
        code: "SHIFT_TOO_LONG",
        severity: "HIGH",
        points: 25,
        params: {
          worked: formatMinutes(input.workingMinutes),
          limit: MAX_PLAUSIBLE_MINUTES / 60,
        },
      });
    }
  }

  if (input.lateByMinutes !== null && input.lateByMinutes > LATE_GRACE_MINUTES) {
    flags.push({
      code: "LATE_CHECK_IN",
      severity: "LOW",
      points: 10,
      params: {
        late: formatMinutes(input.lateByMinutes),
        grace: LATE_GRACE_MINUTES,
      },
    });
  }

  if (input.earlyByMinutes !== null && input.earlyByMinutes > EARLY_GRACE_MINUTES) {
    flags.push({
      code: "EARLY_CHECK_OUT",
      severity: "LOW",
      points: 10,
      params: {
        early: formatMinutes(input.earlyByMinutes),
        grace: EARLY_GRACE_MINUTES,
      },
    });
  }

  const score = Math.min(100, flags.reduce((sum, f) => sum + f.points, 0));
  const level: RiskAssessment["level"] = score >= 50 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW";
  const verification: RiskAssessment["verification"] = score >= 20 ? "FLAGGED" : "VERIFIED";

  return { score, level, flags, verification };
}

// --- Rendering -------------------------------------------------------------
// The engine emits keys; these turn a flag into text in the reader's language,
// falling back to any legacy prose on rows written before localisation.

export function renderRiskTitle(flag: RiskFlag, locale: Locale): string {
  if (flag.code) {
    const key = `risk.${flag.code}.title` as MessageKey;
    const out = translate(locale, key);
    if (out !== key) return out;
  }
  return (locale === "hi" ? flag.titleHi : flag.title) ?? flag.title ?? flag.code;
}

export function renderRiskDetail(flag: RiskFlag, locale: Locale): string {
  if (flag.code) {
    const key = `risk.${flag.code}.detail` as MessageKey;
    const out = translate(locale, key, flag.params as TranslateParams);
    if (out !== key) return out;
  }
  return (locale === "hi" ? flag.detailHi : flag.detail) ?? flag.detail ?? "";
}

/** A one-line summary, built from the flag titles in the reader's language. */
export function renderRiskSummary(
  flags: RiskFlag[],
  locale: Locale,
): string {
  if (flags.length === 0) return translate(locale, "att.allChecksPassedBody");
  return flags.map((flag) => renderRiskTitle(flag, locale)).join("; ");
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
