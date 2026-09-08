import { distanceMeters, type LatLng } from "./geo";

/**
 * The geofence policy: one place that decides whether a GPS punch is at the
 * worksite, and what to do when it is not.
 *
 * Everything about the radius lives here rather than being repeated across the
 * schema default, the employer form and the validators - those three had
 * drifted into three separate literals.
 */

/** Applied to a new job when the employer does not choose otherwise. */
export const DEFAULT_GEOFENCE_RADIUS_M = 250;

/**
 * Bounds an employer may choose from. The floor is above consumer GPS error,
 * so a radius cannot be set so tight that honest workers are always rejected;
 * the ceiling keeps a "worksite" from covering a whole city.
 */
export const MIN_GEOFENCE_RADIUS_M = 50;
export const MAX_GEOFENCE_RADIUS_M = 2000;

/**
 * What happens when a punch lands outside the radius.
 *
 *   "enforce" - refuse the punch and tell the worker why.
 *   "flag"    - record it, mark it for review, let the employer decide.
 *
 * "enforce" is the default because attendance is the basis for payment and an
 * unverified punch should not silently become billable hours.
 *
 * The alternative is not merely a preference. A worker inside a steel-framed
 * shed, in an urban canyon, or on a site larger than its own radius can read
 * hundreds of metres off through no fault of their own, and refusing them costs
 * a day's pay for a phone's error. "flag" keeps the worker whole and moves the
 * judgement to a person. Set LYBOR_GEOFENCE_POLICY=flag to choose it.
 */
export type GeofencePolicy = "enforce" | "flag";

export function geofencePolicy(): GeofencePolicy {
  return process.env.LYBOR_GEOFENCE_POLICY === "flag" ? "flag" : "enforce";
}

/**
 * How much of the device's own reported inaccuracy to forgive, in metres.
 *
 * Zero by default, which is the strict reading: outside the radius is outside.
 * Raising it makes a punch acceptable when the radius falls inside the device's
 * error circle - fairer to workers on poor signal, but it must stay bounded,
 * because `accuracy` arrives from the client and an attacker would otherwise
 * claim a ten-kilometre error to place themselves anywhere.
 */
export const MAX_ACCURACY_GRACE_M = Number(process.env.LYBOR_GEOFENCE_ACCURACY_GRACE_M ?? 0);

/** Hard ceiling on the grace, whatever the environment asks for. */
const ACCURACY_GRACE_CEILING_M = 150;

export type GeofenceVerdict = {
  /** Server-computed, in metres. Never taken from the client. */
  distanceM: number;
  /** Strictly inside the configured radius, before any grace. */
  withinRadius: boolean;
  /** Whether the punch may proceed under the active policy. */
  allowed: boolean;
  /** Metres of device inaccuracy actually forgiven; 0 in the normal case. */
  graceAppliedM: number;
  radiusM: number;
  policy: GeofencePolicy;
};

/**
 * Decides a punch.
 *
 * The distance is always recomputed here from the worksite coordinates held in
 * the database and the coordinates supplied with the request. A distance sent
 * by the client is never read - the browser is the thing being checked, so it
 * cannot also be the thing doing the checking.
 */
export function evaluateGeofence(input: {
  worker: LatLng;
  site: LatLng;
  radiusM: number;
  /** The device's own accuracy estimate, if it offered one. Untrusted. */
  accuracyM?: number | null;
  policy?: GeofencePolicy;
}): GeofenceVerdict {
  const policy = input.policy ?? geofencePolicy();
  const radiusM = clampRadius(input.radiusM);
  const distanceM = distanceMeters(input.worker, input.site);
  const withinRadius = distanceM <= radiusM;

  // Bounded twice: by the configured grace and by a hard ceiling, so a hostile
  // accuracy value cannot widen the fence arbitrarily.
  const requestedGrace = Math.max(0, Math.min(MAX_ACCURACY_GRACE_M, ACCURACY_GRACE_CEILING_M));
  const deviceError = Math.max(0, input.accuracyM ?? 0);
  const graceAppliedM = withinRadius ? 0 : Math.min(requestedGrace, deviceError);

  const allowed =
    policy === "flag" ? true : distanceM <= radiusM + graceAppliedM;

  return { distanceM, withinRadius, allowed, graceAppliedM, radiusM, policy };
}

/** Keeps a stored or supplied radius inside the supported range. */
export function clampRadius(radiusM: number): number {
  if (!Number.isFinite(radiusM)) return DEFAULT_GEOFENCE_RADIUS_M;
  return Math.min(MAX_GEOFENCE_RADIUS_M, Math.max(MIN_GEOFENCE_RADIUS_M, Math.round(radiusM)));
}
