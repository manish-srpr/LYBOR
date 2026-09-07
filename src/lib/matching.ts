import type { Proficiency, WageType } from "@prisma/client";
import { distanceKm } from "./geo";
import { formatPaise } from "./money";
import {
  translate,
  type Locale,
  type MessageKey,
  type TranslateParams,
} from "./i18n";

/**
 * Explainable job <-> worker matching.
 *
 * Deliberately a transparent weighted rubric rather than an opaque model: for a
 * worker deciding whether to spend a day of bus fare on a job, "why" matters
 * more than the last few points of accuracy. Every factor returns its own
 * score, weight and a sentence a non-technical user can read.
 */

export type MatchFactorKey =
  | "skills"
  | "distance"
  | "wage"
  | "availability"
  | "experience"
  | "reliability";

export type MatchFactor = {
  key: MatchFactorKey;
  /** 0..1 before weighting. */
  score: number;
  weight: number;
  /** Catalog key for the justification, plus the values behind it. */
  reasonKey?: MessageKey;
  reasonParams?: Record<string, string | number>;
  /**
   * Legacy rendered prose. Applications submitted before localisation carry
   * these and no keys, so the renderers fall back to them rather than showing
   * an employer a raw key on an old application.
   */
  label?: string;
  labelHi?: string;
  reason?: string;
  reasonHi?: string;
};

export type MatchResult = {
  /** 0..100, rounded. */
  score: number;
  factors: MatchFactor[];
  verdict: "STRONG" | "GOOD" | "FAIR" | "WEAK";
  distanceKm: number;
};

export const MATCH_WEIGHTS = {
  skills: 0.35,
  distance: 0.2,
  wage: 0.15,
  availability: 0.1,
  experience: 0.1,
  reliability: 0.1,
} as const;

/** Highest score a worker missing a mandatory skill can reach. */
export const MANDATORY_SKILL_CEILING = 45;

const PROFICIENCY_VALUE: Record<Proficiency, number> = {
  BEGINNER: 0.6,
  INTERMEDIATE: 0.85,
  EXPERT: 1,
};

export type MatchWorker = {
  latitude: number;
  longitude: number;
  travelRadiusKm: number;
  availability: "AVAILABLE" | "BUSY" | "UNAVAILABLE";
  experienceYears: number;
  reliabilityScore: number;
  preferredWageMinPaise: number | null;
  skills: { skillId: string; nameEn: string; proficiency: Proficiency }[];
};

export type MatchJob = {
  latitude: number;
  longitude: number;
  wageType: WageType;
  wageRatePaise: number;
  expectedHoursPerDay: number;
  requiredSkills: { skillId: string; nameEn: string; isMandatory: boolean }[];
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Normalises any wage type to a comparable per-hour figure. */
export function perHourPaise(job: {
  wageType: WageType;
  wageRatePaise: number;
  expectedHoursPerDay: number;
}): number {
  const hours = job.expectedHoursPerDay || 8;
  if (job.wageType === "HOURLY") return job.wageRatePaise;
  return Math.round(job.wageRatePaise / hours);
}

export function computeMatch(worker: MatchWorker, job: MatchJob): MatchResult {
  const factors: MatchFactor[] = [];

  // --- Skills -------------------------------------------------------------
  const workerSkillIds = new Set(worker.skills.map((s) => s.skillId));
  const required = job.requiredSkills;
  const mandatory = required.filter((s) => s.isMandatory);
  const matchedNames: string[] = [];
  const missingNames: string[] = [];

  let skillScore = 1;
  if (required.length > 0) {
    let earned = 0;
    let possible = 0;
    for (const req of required) {
      const weight = req.isMandatory ? 2 : 1;
      possible += weight;
      const held = worker.skills.find((s) => s.skillId === req.skillId);
      if (held) {
        earned += weight * PROFICIENCY_VALUE[held.proficiency];
        matchedNames.push(req.nameEn);
      } else {
        missingNames.push(req.nameEn);
      }
    }
    skillScore = possible === 0 ? 1 : clamp01(earned / possible);
  }

  const mandatoryMissing = mandatory.filter((s) => !workerSkillIds.has(s.skillId));
  factors.push({
    key: "skills",
    score: skillScore,
    weight: MATCH_WEIGHTS.skills,
    ...(required.length === 0
      ? { reasonKey: "match.reasonNoSkillsRequired" as MessageKey }
      : mandatoryMissing.length > 0
        ? {
            reasonKey: "match.reasonMissingSkill" as MessageKey,
            reasonParams: {
              skills: mandatoryMissing.map((s) => s.nameEn).join(", "),
            },
          }
        : {
            reasonKey: "match.reasonSkillsHeld" as MessageKey,
            reasonParams: { matched: matchedNames.length, total: required.length },
          }),
  });

  // --- Distance -----------------------------------------------------------
  const km = distanceKm(worker, job);
  const radius = worker.travelRadiusKm || 15;
  // Full marks inside a third of the radius, tapering to zero at 1.5x radius.
  const distanceScore = clamp01(1 - Math.max(0, km - radius / 3) / (radius * 1.5));
  factors.push({
    key: "distance",
    score: distanceScore,
    weight: MATCH_WEIGHTS.distance,
    reasonKey: (km <= radius
      ? "match.reasonDistanceInside"
      : "match.reasonDistanceOutside") as MessageKey,
    reasonParams: { km, radius },
  });

  // --- Wage ---------------------------------------------------------------
  const jobHourly = perHourPaise(job);
  let wageScore = 0.75;
  let wageReasonKey: MessageKey = "match.reasonNoWagePreference";
  let wageReasonParams: Record<string, string | number> | undefined;
  if (worker.preferredWageMinPaise && worker.preferredWageMinPaise > 0) {
    const ratio = jobHourly / worker.preferredWageMinPaise;
    wageScore = clamp01((ratio - 0.6) / 0.6);
    wageReasonKey = (ratio >= 1
      ? "match.reasonWageAtOrAbove"
      : "match.reasonWageBelow") as MessageKey;
    wageReasonParams = {
      hourly: formatPaise(jobHourly),
      minimum: formatPaise(worker.preferredWageMinPaise),
    };
  }
  factors.push({
    key: "wage",
    score: wageScore,
    weight: MATCH_WEIGHTS.wage,
    reasonKey: wageReasonKey,
    reasonParams: wageReasonParams,
  });

  // --- Availability -------------------------------------------------------
  const availabilityScore =
    worker.availability === "AVAILABLE" ? 1 : worker.availability === "BUSY" ? 0.35 : 0;
  factors.push({
    key: "availability",
    score: availabilityScore,
    weight: MATCH_WEIGHTS.availability,
    reasonKey: (worker.availability === "AVAILABLE"
      ? "match.reasonAvailable"
      : worker.availability === "BUSY"
        ? "match.reasonBusy"
        : "match.reasonUnavailable") as MessageKey,
  });

  // --- Experience ---------------------------------------------------------
  const experienceScore = clamp01(worker.experienceYears / 5);
  factors.push({
    key: "experience",
    score: experienceScore,
    weight: MATCH_WEIGHTS.experience,
    reasonKey: "match.reasonExperience",
    reasonParams: { years: worker.experienceYears },
  });

  // --- Reliability --------------------------------------------------------
  const reliabilityScore = clamp01(worker.reliabilityScore / 100);
  factors.push({
    key: "reliability",
    score: reliabilityScore,
    weight: MATCH_WEIGHTS.reliability,
    ...(worker.reliabilityScore > 0
      ? {
          reasonKey: "match.reasonReliabilityScore" as MessageKey,
          reasonParams: { score: Math.round(worker.reliabilityScore) },
        }
      : { reasonKey: "match.reasonNoHistory" as MessageKey }),
  });

  let total = factors.reduce((sum, f) => sum + f.score * f.weight, 0) * 100;
  // A missing mandatory skill is a hard ceiling, not a soft penalty - otherwise
  // a high reliability score could float an unqualified worker to the top.
  // The remaining score is compressed into the band rather than clamped flat,
  // so capped jobs still rank against each other instead of all tying at 45.
  if (mandatoryMissing.length > 0) total = (total / 100) * MANDATORY_SKILL_CEILING;

  const score = Math.round(total);
  const verdict: MatchResult["verdict"] =
    score >= 80 ? "STRONG" : score >= 65 ? "GOOD" : score >= 45 ? "FAIR" : "WEAK";

  return {
    score,
    factors,
    verdict,
    distanceKm: km,
  };
}

const FACTOR_LABEL_KEY: Record<MatchFactorKey, MessageKey> = {
  skills: "match.factorSkills",
  distance: "match.factorDistance",
  wage: "match.factorWage",
  availability: "match.factorAvailability",
  experience: "match.factorExperience",
  reliability: "match.factorReliability",
};

export function renderMatchFactorLabel(factor: MatchFactor, locale: Locale): string {
  const key = FACTOR_LABEL_KEY[factor.key];
  if (key) return translate(locale, key);
  return (locale === "hi" ? factor.labelHi : factor.label) ?? factor.label ?? factor.key;
}

export function renderMatchFactorReason(factor: MatchFactor, locale: Locale): string {
  if (factor.reasonKey) {
    return translate(locale, factor.reasonKey, factor.reasonParams as TranslateParams);
  }
  return (locale === "hi" ? factor.reasonHi : factor.reason) ?? factor.reason ?? "";
}

/** The strongest and weakest contributors, named in the reader's language. */
export function renderMatchSummary(result: MatchResult, locale: Locale): string {
  const ranked = [...result.factors].sort(
    (a, b) => b.score * b.weight - a.score * a.weight,
  );
  const top = ranked[0];
  const worst = ranked[ranked.length - 1];
  if (!top || !worst) return "";
  return `${renderMatchFactorLabel(top, locale)} / ${renderMatchFactorLabel(worst, locale)}`;
}

export function parseFactors(json: string | null): MatchFactor[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as MatchFactor[];
  } catch {
    return [];
  }
}
