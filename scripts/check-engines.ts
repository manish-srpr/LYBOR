/**
 * Invariant checks for the three pure domain engines.
 *
 * These are the parts of LYBOR where being wrong costs somebody money, so
 * they get asserted rather than eyeballed. Run with `npm run check:engines`.
 */
import {
  assessAttendanceRisk,
  renderRiskDetail,
  renderRiskTitle,
} from "../src/lib/risk";
import { LOCALES } from "../src/lib/i18n";
import {
  computeMatch,
  renderMatchFactorLabel,
  renderMatchFactorReason,
  type MatchJob,
  type MatchWorker,
} from "../src/lib/matching";
import { calculateWage } from "../src/lib/wages";
import { distanceMeters, offsetBy } from "../src/lib/geo";
import { rupeesToPaise } from "../src/lib/money";

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\nWage engine");
{
  const wageTypes = ["HOURLY", "DAILY", "SHIFT"] as const;
  const minutes = [0, 45, 120, 239, 240, 300, 480, 505, 600, 720, 1100];
  let sumsMatch = true;
  let netNeverNegative = true;
  let mismatch = "";

  for (const wageType of wageTypes) {
    for (const verifiedMinutes of minutes) {
      const b = calculateWage({
        wageType,
        rateAppliedPaise: rupeesToPaise(wageType === "HOURLY" ? 130 : 950),
        verifiedMinutes,
        expectedHoursPerDay: 8,
      });

      // Every line except the trailing net line must sum to gross.
      const components = b.lines
        .slice(0, -1)
        .reduce((sum, line) => sum + (line.amountPaise ?? 0), 0);
      if (components !== b.grossAmountPaise) {
        sumsMatch = false;
        mismatch = `${wageType} @ ${verifiedMinutes}m: lines=${components} gross=${b.grossAmountPaise}`;
      }
      if (b.netAmountPaise < 0) netNeverNegative = false;
      if (b.netAmountPaise !== b.grossAmountPaise - b.deductionsPaise) {
        sumsMatch = false;
        mismatch = `${wageType} @ ${verifiedMinutes}m: net does not equal gross minus deductions`;
      }
    }
  }
  check("breakdown lines sum to the gross amount", sumsMatch, mismatch);
  check("net is never negative", netNeverNegative);

  const noWork = calculateWage({
    wageType: "DAILY",
    rateAppliedPaise: rupeesToPaise(950),
    verifiedMinutes: 0,
    expectedHoursPerDay: 8,
  });
  check("zero verified minutes pays zero", noWork.netAmountPaise === 0);

  const overtime = calculateWage({
    wageType: "HOURLY",
    rateAppliedPaise: rupeesToPaise(100),
    verifiedMinutes: 600, // 10 h against an 8 h day
    expectedHoursPerDay: 8,
  });
  // 8 h at 100 plus 2 h at 150 = 1100
  check(
    "hourly overtime pays 1.5x past the expected day",
    overtime.grossAmountPaise === rupeesToPaise(1100),
    `got ${overtime.grossAmountPaise}`,
  );

  const fullDay = calculateWage({
    wageType: "DAILY",
    rateAppliedPaise: rupeesToPaise(950),
    verifiedMinutes: 480,
    expectedHoursPerDay: 8,
  });
  check("a full day bills one day", fullDay.billableUnits === 1);

  const halfDay = calculateWage({
    wageType: "DAILY",
    rateAppliedPaise: rupeesToPaise(950),
    verifiedMinutes: 300, // 62% of the day
    expectedHoursPerDay: 8,
  });
  check("a 62% day bills a half day", halfDay.billableUnits === 0.5);
}

console.log("\nRisk engine");
{
  const clean = assessAttendanceRisk({
    checkInDistanceM: 40,
    checkInWithinRadius: true,
    checkInAccuracyM: 12,
    checkInSource: "GPS",
    checkOutDistanceM: 45,
    checkOutWithinRadius: true,
    checkOutAccuracyM: 14,
    checkOutSource: "GPS",
    workingMinutes: 490,
    expectedHoursPerDay: 8,
    lateByMinutes: 4,
    earlyByMinutes: 0,
    radiusMeters: 250,
  });
  check("a clean shift raises no flags", clean.flags.length === 0);
  check("a clean shift verifies", clean.verification === "VERIFIED");
  check("a clean shift scores zero", clean.score === 0);

  const outside = assessAttendanceRisk({
    checkInDistanceM: 1400,
    checkInWithinRadius: false,
    checkInAccuracyM: 15,
    checkInSource: "GPS",
    checkOutDistanceM: 1400,
    checkOutWithinRadius: false,
    checkOutAccuracyM: 15,
    checkOutSource: "GPS",
    workingMinutes: 500,
    expectedHoursPerDay: 8,
    lateByMinutes: 2,
    earlyByMinutes: 0,
    radiusMeters: 250,
  });
  check(
    "an out-of-radius shift flags both punches",
    outside.flags.some((f) => f.code === "GPS_OUT_OF_RADIUS_IN") &&
      outside.flags.some((f) => f.code === "GPS_OUT_OF_RADIUS_OUT"),
  );
  check("an out-of-radius shift is high risk", outside.level === "HIGH");
  check("an out-of-radius shift is flagged for review", outside.verification === "FLAGGED");
  check(
    "every flag states its rule code",
    outside.flags.every((f) => f.code.length > 0),
  );
  check(
    "every flag renders a title and detail in all 13 locales",
    outside.flags.every((f) =>
      LOCALES.every(({ code }) => {
        const title = renderRiskTitle(f, code);
        const detail = renderRiskDetail(f, code);
        return (
          title.length > 0 &&
          detail.length > 0 &&
          !title.startsWith("risk.") &&
          !detail.startsWith("risk.") &&
          !detail.includes("{")
        );
      }),
    ),
  );
  check("the score is capped at 100", outside.score <= 100);
}

console.log("\nMatch engine");
{
  const site = { latitude: 12.9716, longitude: 77.5946 };
  const nearby = offsetBy(site, 1500, 45);

  const baseWorker: MatchWorker = {
    latitude: nearby.latitude,
    longitude: nearby.longitude,
    travelRadiusKm: 20,
    availability: "AVAILABLE",
    experienceYears: 8,
    reliabilityScore: 85,
    preferredWageMinPaise: rupeesToPaise(120),
    skills: [
      { skillId: "s1", nameEn: "Masonry", proficiency: "EXPERT" },
      { skillId: "s2", nameEn: "Painting", proficiency: "INTERMEDIATE" },
    ],
  };

  const job: MatchJob = {
    latitude: site.latitude,
    longitude: site.longitude,
    wageType: "DAILY",
    wageRatePaise: rupeesToPaise(1200),
    expectedHoursPerDay: 8,
    requiredSkills: [
      { skillId: "s1", nameEn: "Masonry", isMandatory: true },
      { skillId: "s2", nameEn: "Painting", isMandatory: false },
    ],
  };

  const strong = computeMatch(baseWorker, job);
  check("a well-suited worker scores strongly", strong.score >= 80, `got ${strong.score}`);
  check("the score stays within 0..100", strong.score >= 0 && strong.score <= 100);
  check(
    "every factor renders a label and reason in all 13 locales",
    strong.factors.every((f) =>
      LOCALES.every(({ code }) => {
        const label = renderMatchFactorLabel(f, code);
        const reason = renderMatchFactorReason(f, code);
        return (
          label.length > 0 &&
          reason.length > 0 &&
          !label.startsWith("match.") &&
          !reason.startsWith("match.") &&
          !reason.includes("{")
        );
      }),
    ),
  );
  check(
    "the weights sum to 1",
    Math.abs(strong.factors.reduce((s, f) => s + f.weight, 0) - 1) < 1e-9,
  );

  const unqualified = computeMatch(
    { ...baseWorker, skills: [{ skillId: "s9", nameEn: "Cooking", proficiency: "EXPERT" }] },
    job,
  );
  check(
    "a missing mandatory skill caps the score at 45",
    unqualified.score <= 45,
    `got ${unqualified.score}`,
  );

  const unavailable = computeMatch({ ...baseWorker, availability: "UNAVAILABLE" }, job);
  check("being unavailable lowers the score", unavailable.score < strong.score);

  const faraway = computeMatch(
    { ...baseWorker, ...offsetBy(site, 60000, 90) },
    job,
  );
  check("distance lowers the score", faraway.score < strong.score);
}

console.log("\nGeo");
{
  const a = { latitude: 12.9716, longitude: 77.5946 };
  check("distance to itself is zero", distanceMeters(a, a) === 0);
  const b = offsetBy(a, 1000, 0);
  const measured = distanceMeters(a, b);
  check(
    "a 1000 m offset measures about 1000 m",
    Math.abs(measured - 1000) < 20,
    `measured ${measured} m`,
  );
}

console.log(
  failures === 0
    ? "\nAll engine invariants hold.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
