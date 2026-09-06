import type { Proficiency, WageType } from "@prisma/client";
import { distanceKm } from "./geo";
import { formatPaise } from "./money";

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
  label: string;
  labelHi: string;
  /** 0..1 before weighting. */
  score: number;
  weight: number;
  /** Plain-language justification, shown verbatim in the UI. */
  reason: string;
  reasonHi: string;
};

export type MatchResult = {
  /** 0..100, rounded. */
  score: number;
  factors: MatchFactor[];
  verdict: "STRONG" | "GOOD" | "FAIR" | "WEAK";
  summary: string;
  summaryHi: string;
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
    label: "Skills match",
    labelHi: "कौशल मिलान",
    score: skillScore,
    weight: MATCH_WEIGHTS.skills,
    reason:
      required.length === 0
        ? "This job lists no specific skill requirement."
        : mandatoryMissing.length > 0
          ? `Missing required skill: ${mandatoryMissing.map((s) => s.nameEn).join(", ")}.`
          : `Has ${matchedNames.length} of ${required.length} listed skills${
              missingNames.length ? `; missing ${missingNames.join(", ")}` : ""
            }.`,
    reasonHi:
      required.length === 0
        ? "इस काम के लिए कोई विशेष कौशल आवश्यक नहीं है।"
        : mandatoryMissing.length > 0
          ? `आवश्यक कौशल नहीं है: ${mandatoryMissing.map((s) => s.nameEn).join(", ")}।`
          : `${required.length} में से ${matchedNames.length} कौशल मौजूद हैं।`,
  });

  // --- Distance -----------------------------------------------------------
  const km = distanceKm(worker, job);
  const radius = worker.travelRadiusKm || 15;
  // Full marks inside a third of the radius, tapering to zero at 1.5x radius.
  const distanceScore = clamp01(1 - Math.max(0, km - radius / 3) / (radius * 1.5));
  factors.push({
    key: "distance",
    label: "Distance",
    labelHi: "दूरी",
    score: distanceScore,
    weight: MATCH_WEIGHTS.distance,
    reason:
      km <= radius
        ? `${km} km away, inside the ${radius} km travel radius.`
        : `${km} km away, beyond the ${radius} km travel radius.`,
    reasonHi:
      km <= radius
        ? `${km} किमी दूर, ${radius} किमी की सीमा के भीतर।`
        : `${km} किमी दूर, ${radius} किमी की सीमा से बाहर।`,
  });

  // --- Wage ---------------------------------------------------------------
  const jobHourly = perHourPaise(job);
  let wageScore = 0.75;
  let wageReason = "No wage preference set, so pay is treated as acceptable.";
  let wageReasonHi = "कोई वेतन प्राथमिकता निर्धारित नहीं है।";
  if (worker.preferredWageMinPaise && worker.preferredWageMinPaise > 0) {
    const ratio = jobHourly / worker.preferredWageMinPaise;
    wageScore = clamp01((ratio - 0.6) / 0.6);
    wageReason =
      ratio >= 1
        ? `Pays ${formatPaise(jobHourly)}/h, at or above the ${formatPaise(worker.preferredWageMinPaise)}/h minimum.`
        : `Pays ${formatPaise(jobHourly)}/h, below the ${formatPaise(worker.preferredWageMinPaise)}/h minimum.`;
    wageReasonHi =
      ratio >= 1
        ? `${formatPaise(jobHourly)}/घंटा, अपेक्षित न्यूनतम से अधिक।`
        : `${formatPaise(jobHourly)}/घंटा, अपेक्षित न्यूनतम से कम।`;
  }
  factors.push({
    key: "wage",
    label: "Wage fit",
    labelHi: "वेतन उपयुक्तता",
    score: wageScore,
    weight: MATCH_WEIGHTS.wage,
    reason: wageReason,
    reasonHi: wageReasonHi,
  });

  // --- Availability -------------------------------------------------------
  const availabilityScore =
    worker.availability === "AVAILABLE" ? 1 : worker.availability === "BUSY" ? 0.35 : 0;
  factors.push({
    key: "availability",
    label: "Availability",
    labelHi: "उपलब्धता",
    score: availabilityScore,
    weight: MATCH_WEIGHTS.availability,
    reason:
      worker.availability === "AVAILABLE"
        ? "Marked available for work."
        : worker.availability === "BUSY"
          ? "Currently on another assignment."
          : "Marked unavailable.",
    reasonHi:
      worker.availability === "AVAILABLE"
        ? "काम के लिए उपलब्ध।"
        : worker.availability === "BUSY"
          ? "फिलहाल दूसरे काम पर।"
          : "उपलब्ध नहीं।",
  });

  // --- Experience ---------------------------------------------------------
  const experienceScore = clamp01(worker.experienceYears / 5);
  factors.push({
    key: "experience",
    label: "Experience",
    labelHi: "अनुभव",
    score: experienceScore,
    weight: MATCH_WEIGHTS.experience,
    reason: `${worker.experienceYears} ${
      worker.experienceYears === 1 ? "year" : "years"
    } of recorded experience.`,
    reasonHi: `${worker.experienceYears} वर्ष का अनुभव।`,
  });

  // --- Reliability --------------------------------------------------------
  const reliabilityScore = clamp01(worker.reliabilityScore / 100);
  factors.push({
    key: "reliability",
    label: "Reliability",
    labelHi: "विश्वसनीयता",
    score: reliabilityScore,
    weight: MATCH_WEIGHTS.reliability,
    reason:
      worker.reliabilityScore > 0
        ? `Reliability score ${Math.round(worker.reliabilityScore)}/100 from verified attendance history.`
        : "No verified history yet, so reliability is unproven.",
    reasonHi:
      worker.reliabilityScore > 0
        ? `सत्यापित उपस्थिति के आधार पर विश्वसनीयता ${Math.round(worker.reliabilityScore)}/100।`
        : "अभी तक कोई सत्यापित इतिहास नहीं है।",
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

  const ranked = [...factors].sort((a, b) => b.score * b.weight - a.score * a.weight);
  const top = ranked[0];
  const worst = ranked[ranked.length - 1];

  return {
    score,
    factors,
    verdict,
    distanceKm: km,
    summary: `${score}% match. Strongest factor: ${top.label.toLowerCase()}. Weakest: ${worst.label.toLowerCase()}.`,
    summaryHi: `${score}% मिलान। सबसे मजबूत: ${top.labelHi}। सबसे कमजोर: ${worst.labelHi}।`,
  };
}

export function parseFactors(json: string | null): MatchFactor[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as MatchFactor[];
  } catch {
    return [];
  }
}
