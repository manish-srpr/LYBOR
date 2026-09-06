export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in metres. Accurate enough for a job-site geofence. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

export function distanceKm(a: LatLng, b: LatLng): number {
  return Math.round((distanceMeters(a, b) / 1000) * 10) / 10;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Deterministic jitter used by the demo "simulate GPS" control so that a
 * reviewer without location permissions can still exercise both the happy path
 * and the out-of-radius path.
 */
export function offsetBy(point: LatLng, meters: number, bearingDeg = 45): LatLng {
  const bearing = toRadians(bearingDeg);
  const dLat = (meters * Math.cos(bearing)) / EARTH_RADIUS_M;
  const dLng =
    (meters * Math.sin(bearing)) /
    (EARTH_RADIUS_M * Math.cos(toRadians(point.latitude)));
  return {
    latitude: point.latitude + (dLat * 180) / Math.PI,
    longitude: point.longitude + (dLng * 180) / Math.PI,
  };
}
