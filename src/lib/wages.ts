import type { WageType } from "@prisma/client";
import { formatMinutes, formatPaise } from "./money";
import { translate, type Locale, type MessageKey, type TranslateParams } from "./i18n";

export type WageBreakdownLine = {
  /** Catalog key for the line label. */
  labelKey?: MessageKey;
  /** Catalog key for the explanatory detail, plus its values. */
  detailKey?: MessageKey;
  params?: Record<string, string | number>;
  amountPaise?: number;
  /** Legacy rendered prose on payments written before localisation. */
  label?: string;
  labelHi?: string;
  detail?: string;
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
  /** Catalog key for the plain-language sentence above the table. */
  summaryKey?: MessageKey;
  summaryParams?: Record<string, string | number>;
  /** Legacy rendered summary. */
  summary?: string;
  summaryHi?: string;
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
 * Every branch appends a line carrying a translation key and the values that
 * drove it, so the same object that produced the number also explains it - in
 * whatever language the reader prefers, including for payments calculated
 * before that language was supported. Worker, employer and admin all read this
 * identical breakdown; transparency here is the product.
 *
 * The arithmetic is untouched by localisation: money stays integer paise and
 * rounding still happens exactly once, at the end of each branch.
 */
export function calculateWage(input: WageInput): WageBreakdown {
  const { wageType, rateAppliedPaise, verifiedMinutes } = input;
  const expectedHoursPerDay = input.expectedHoursPerDay || 8;
  const expectedMinutes = Math.round(expectedHoursPerDay * 60);

  const lines: WageBreakdownLine[] = [
    {
      labelKey: "wage.verifiedTime",
      detailKey: "wage.detailVerifiedWindow",
      params: { worked: formatMinutes(verifiedMinutes) },
    },
  ];

  let billableUnits = 0;
  let unitLabel: WageBreakdown["unitLabel"] = "hours";
  let grossAmountPaise = 0;
  let summaryKey: MessageKey = "wage.summaryHourly";
  let summaryParams: Record<string, string | number> = {};

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
      labelKey: "wage.lineRegularHours",
      detailKey: "wage.detailHoursAtRate",
      params: { units: round2(normalHours), rate: formatPaise(rateAppliedPaise) },
      amountPaise: normalPaise,
    });
    if (overtimeHours > 0) {
      lines.push({
        labelKey: "wage.lineOvertime",
        detailKey: "wage.detailOvertimeAtRate",
        params: {
          units: round2(overtimeHours),
          rate: formatPaise(rateAppliedPaise),
          multiplier: OVERTIME_MULTIPLIER,
        },
        amountPaise: overtimePaise,
      });
    }
    summaryKey = "wage.summaryHourly";
    summaryParams = {
      rate: formatPaise(rateAppliedPaise),
      units: round2(rawHours),
    };
  } else if (wageType === "DAILY") {
    unitLabel = "days";
    const dayFraction = verifiedMinutes / expectedMinutes;
    const detailParams = {
      worked: formatMinutes(verifiedMinutes),
      expected: expectedHoursPerDay,
    };

    if (dayFraction >= 0.9) {
      billableUnits = 1;
      lines.push({
        labelKey: "wage.lineFullDay",
        detailKey: "wage.detailDayFraction",
        params: detailParams,
        amountPaise: rateAppliedPaise,
      });
    } else if (dayFraction >= HALF_DAY_THRESHOLD) {
      billableUnits = 0.5;
      lines.push({
        labelKey: "wage.lineHalfDay",
        detailKey: "wage.detailDayFraction",
        params: detailParams,
        amountPaise: Math.round(rateAppliedPaise * 0.5),
      });
    } else {
      billableUnits = round2(dayFraction);
      lines.push({
        labelKey: "wage.lineProratedDay",
        detailKey: "wage.detailDayFraction",
        params: detailParams,
        // Billed off the rounded unit, not the raw fraction, so this line and
        // the gross below are the same number by construction. Using
        // dayFraction here makes the breakdown disagree with the total it is
        // supposed to explain.
        amountPaise: Math.round(rateAppliedPaise * billableUnits),
      });
    }
    grossAmountPaise = Math.round(rateAppliedPaise * billableUnits);
    summaryKey = "wage.summaryDaily";
    summaryParams = { rate: formatPaise(rateAppliedPaise), units: billableUnits };
  } else {
    unitLabel = "shifts";
    // A shift is all-or-nothing above the half-shift mark; below it, the shift
    // is treated as incomplete and pro-rated so nobody is paid for a no-show.
    const shiftFraction = verifiedMinutes / expectedMinutes;
    billableUnits = shiftFraction >= HALF_DAY_THRESHOLD ? 1 : round2(shiftFraction);
    grossAmountPaise = Math.round(rateAppliedPaise * billableUnits);
    lines.push({
      labelKey:
        billableUnits === 1 ? "wage.lineShiftCompleted" : "wage.linePartialShift",
      detailKey: "wage.detailShiftFraction",
      params: {
        worked: formatMinutes(verifiedMinutes),
        expected: expectedHoursPerDay,
        rate: formatPaise(rateAppliedPaise),
      },
      amountPaise: grossAmountPaise,
    });
    summaryKey = "wage.summaryShift";
    summaryParams = { rate: formatPaise(rateAppliedPaise), units: billableUnits };
  }

  // The prototype takes no platform cut. The field exists so that a real
  // deduction (advance recovery, TDS) has an audited place to live.
  const deductionsPaise = 0;
  const netAmountPaise = grossAmountPaise - deductionsPaise;

  lines.push({
    labelKey: "wage.net",
    detailKey: "wage.detailNetPayable",
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
    summaryKey,
    summaryParams,
  };
}

// --- Rendering -------------------------------------------------------------

export function renderWageLineLabel(line: WageBreakdownLine, locale: Locale): string {
  if (line.labelKey) return translate(locale, line.labelKey);
  return (locale === "hi" ? line.labelHi : line.label) ?? line.label ?? "";
}

export function renderWageLineDetail(line: WageBreakdownLine, locale: Locale): string {
  if (line.detailKey) {
    return translate(locale, line.detailKey, line.params as TranslateParams);
  }
  return line.detail ?? "";
}

export function renderWageSummary(breakdown: WageBreakdown, locale: Locale): string {
  if (breakdown.summaryKey) {
    return translate(
      locale,
      breakdown.summaryKey,
      breakdown.summaryParams as TranslateParams,
    );
  }
  return (locale === "hi" ? breakdown.summaryHi : breakdown.summary) ?? breakdown.summary ?? "";
}

export function parseBreakdown(json: string | null): WageBreakdown | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as WageBreakdown;
  } catch {
    return null;
  }
}
