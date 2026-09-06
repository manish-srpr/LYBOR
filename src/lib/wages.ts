import type { WageType } from "@prisma/client";
import { formatMinutes, formatPaise } from "./money";

export type WageBreakdownLine = {
  label: string;
  labelHi: string;
  detail: string;
  amountPaise?: number;
};

export type WageBreakdown = {
  wageType: WageType;
  rateAppliedPaise: number;
  verifiedMinutes: number;
  billableUnits: number;
  unitLabel: "hours" | "days" | "shifts";
  grossAmountPaise: number;
  deductionsPaise: number;
  netAmountPaise: number;
  lines: WageBreakdownLine[];
  /** Plain-language sentence shown to the worker above the table. */
  summary: string;
  summaryHi: string;
};

export type WageInput = {
  wageType: WageType;
  rateAppliedPaise: number;
  verifiedMinutes: number;
  expectedHoursPerDay: number;
};

/** A shift shorter than this fraction of the expected day is pro-rated. */
const HALF_DAY_THRESHOLD = 0.5;
/** Overtime kicks in past the expected day and is paid at 1.5x, hourly only. */
const OVERTIME_MULTIPLIER = 1.5;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The single source of truth for "what is this worker owed?".
 *
 * Every branch appends a human-readable line to `lines`, so the same object
 * that produced the number also explains it. Worker, employer and admin all
 * read this identical breakdown - transparency here is the product.
 */
export function calculateWage(input: WageInput): WageBreakdown {
  const { wageType, rateAppliedPaise, verifiedMinutes } = input;
  const expectedHoursPerDay = input.expectedHoursPerDay || 8;
  const expectedMinutes = Math.round(expectedHoursPerDay * 60);

  const lines: WageBreakdownLine[] = [
    {
      label: "Verified working time",
      labelHi: "सत्यापित कार्य समय",
      detail: `${formatMinutes(verifiedMinutes)} between GPS check-in and check-out`,
    },
  ];

  let billableUnits = 0;
  let unitLabel: WageBreakdown["unitLabel"] = "hours";
  let grossAmountPaise = 0;
  let summary = "";
  let summaryHi = "";

  if (wageType === "HOURLY") {
    unitLabel = "hours";
    const rawHours = verifiedMinutes / 60;
    const normalHours = Math.min(rawHours, expectedHoursPerDay);
    const overtimeHours = Math.max(0, rawHours - expectedHoursPerDay);

    const normalPaise = Math.round(normalHours * rateAppliedPaise);
    const overtimePaise = Math.round(
      overtimeHours * rateAppliedPaise * OVERTIME_MULTIPLIER,
    );

    billableUnits = round2(rawHours);
    grossAmountPaise = normalPaise + overtimePaise;

    lines.push({
      label: "Regular hours",
      labelHi: "सामान्य घंटे",
      detail: `${round2(normalHours)} h x ${formatPaise(rateAppliedPaise)}/h`,
      amountPaise: normalPaise,
    });
    if (overtimeHours > 0) {
      lines.push({
        label: "Overtime",
        labelHi: "ओवरटाइम",
        detail: `${round2(overtimeHours)} h x ${formatPaise(rateAppliedPaise)}/h x ${OVERTIME_MULTIPLIER}`,
        amountPaise: overtimePaise,
      });
    }
    summary = `Paid hourly at ${formatPaise(rateAppliedPaise)} per hour for ${round2(rawHours)} verified hours.`;
    summaryHi = `${round2(rawHours)} सत्यापित घंटों के लिए ${formatPaise(rateAppliedPaise)} प्रति घंटा।`;
  } else if (wageType === "DAILY") {
    unitLabel = "days";
    const dayFraction = verifiedMinutes / expectedMinutes;

    if (dayFraction >= 0.9) {
      billableUnits = 1;
      lines.push({
        label: "Full day",
        labelHi: "पूरा दिन",
        detail: `Worked ${formatMinutes(verifiedMinutes)} of an expected ${expectedHoursPerDay} h day`,
        amountPaise: rateAppliedPaise,
      });
    } else if (dayFraction >= HALF_DAY_THRESHOLD) {
      billableUnits = 0.5;
      lines.push({
        label: "Half day",
        labelHi: "आधा दिन",
        detail: `Worked ${formatMinutes(verifiedMinutes)}, at least half of the expected ${expectedHoursPerDay} h day`,
        amountPaise: Math.round(rateAppliedPaise * 0.5),
      });
    } else {
      // Billable units are rounded first and the amount derived from them, so
      // the line in the breakdown always equals the total below it.
      billableUnits = round2(dayFraction);
      lines.push({
        label: "Pro-rated day",
        labelHi: "आनुपातिक दिन",
        detail: `Worked ${formatMinutes(verifiedMinutes)} of an expected ${expectedHoursPerDay} h day`,
        amountPaise: Math.round(rateAppliedPaise * billableUnits),
      });
    }
    grossAmountPaise = Math.round(rateAppliedPaise * billableUnits);
    summary = `Paid daily at ${formatPaise(rateAppliedPaise)} per day; ${billableUnits} day billed.`;
    summaryHi = `${formatPaise(rateAppliedPaise)} प्रति दिन की दर से ${billableUnits} दिन।`;
  } else {
    unitLabel = "shifts";
    // A shift is all-or-nothing above the half-shift mark; below it, the shift
    // is treated as incomplete and pro-rated so nobody is paid for a no-show.
    const shiftFraction = verifiedMinutes / expectedMinutes;
    billableUnits = shiftFraction >= HALF_DAY_THRESHOLD ? 1 : round2(shiftFraction);
    grossAmountPaise = Math.round(rateAppliedPaise * billableUnits);
    lines.push({
      label: billableUnits === 1 ? "Shift completed" : "Partial shift",
      labelHi: billableUnits === 1 ? "शिफ्ट पूरी" : "आंशिक शिफ्ट",
      detail: `${formatMinutes(verifiedMinutes)} of a ${expectedHoursPerDay} h shift x ${formatPaise(rateAppliedPaise)}/shift`,
      amountPaise: grossAmountPaise,
    });
    summary = `Paid per shift at ${formatPaise(rateAppliedPaise)}; ${billableUnits} shift billed.`;
    summaryHi = `${formatPaise(rateAppliedPaise)} प्रति शिफ्ट की दर से ${billableUnits} शिफ्ट।`;
  }

  // The prototype takes no platform cut. The field exists so that a real
  // deduction (advance recovery, TDS) has an audited place to live.
  const deductionsPaise = 0;
  const netAmountPaise = grossAmountPaise - deductionsPaise;

  lines.push({
    label: "Net payable to worker",
    labelHi: "श्रमिक को देय राशि",
    detail: "Gross minus deductions. No platform fee is charged.",
    amountPaise: netAmountPaise,
  });

  return {
    wageType,
    rateAppliedPaise,
    verifiedMinutes,
    billableUnits,
    unitLabel,
    grossAmountPaise,
    deductionsPaise,
    netAmountPaise,
    lines,
    summary,
    summaryHi,
  };
}

export function parseBreakdown(json: string | null): WageBreakdown | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as WageBreakdown;
  } catch {
    return null;
  }
}
