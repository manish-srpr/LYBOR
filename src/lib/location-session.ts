/**
 * Records that this browser session has granted location permission.
 *
 * The flag is a session cookie - no max-age - so it dies with the browser and
 * permission is re-established next time. That matches how the browser itself
 * treats a permission prompt, and it keeps the app from assuming consent that
 * a shared handset's next user never gave.
 *
 * Deliberately not httpOnly: the value is written by the client once the
 * browser has actually granted permission, the same way the locale preference
 * is. That is sound here because this is an availability gate, not an
 * authorisation one. Nothing behind it depends on the flag being truthful - a
 * person who forged it would reach a dashboard they are already authenticated
 * for, and every attendance decision is still made server-side in
 * attendance-core.ts from coordinates checked against the job site.
 */
export const LOCATION_COOKIE = "lybor_loc_ok";
export const LOCATION_GRANTED = "1";

/** Where to send someone who has not yet granted location for this session. */
export function locationStepPath(next: string): string {
  return `/location?next=${encodeURIComponent(next)}`;
}

/**
 * Only same-origin absolute paths are honoured, so `?next=` cannot bounce
 * somebody off the site straight after they authenticate.
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  // A second location step would loop.
  if (value.startsWith("/location")) return fallback;
  return value;
}
