/**
 * All money in LYBOR is an integer number of paise. Floating point rupees are
 * never stored or arithmetic'd - rounding happens once, at the very end of a
 * calculation, and is always documented in the wage breakdown.
 */

export const PAISE_PER_RUPEE = 100;

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

export function formatPaise(paise: number, opts?: { compact?: boolean }): string {
  const rupees = paiseToRupees(paise);
  if (opts?.compact && Math.abs(rupees) >= 100000) {
    return `₹${(rupees / 100000).toFixed(1)}L`;
  }
  if (opts?.compact && Math.abs(rupees) >= 1000) {
    return `₹${(rupees / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
