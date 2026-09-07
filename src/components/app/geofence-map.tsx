import { MapPin, Navigation, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "@/lib/geo";
import type { Lang } from "@/lib/i18n";

/**
 * A to-scale schematic of the geofence check, not a map.
 *
 * It draws exactly two facts the verification actually used - the allowed
 * radius and the measured distance - so a reviewer can see the decision rather
 * than read it. It is deliberately not a tile map: rendering a real map would
 * imply a precision the prototype does not have, and would leak the worker's
 * position to a third-party tile server.
 */
export function GeofenceMap({
  distanceM,
  radiusM,
  withinRadius,
  accuracyM,
  label,
  lang,
}: {
  distanceM: number;
  radiusM: number;
  withinRadius: boolean;
  accuracyM?: number | null;
  label: string;
  lang: Lang;
}) {
  const isHi = lang === "hi";

  // The frame scales to whichever is larger so both circles always fit.
  const extent = Math.max(radiusM * 1.6, distanceM * 1.25, 1);
  const toPx = (metres: number) => (metres / extent) * 60;

  const radiusPx = toPx(radiusM);
  const distancePx = Math.min(toPx(distanceM), 68);
  // A fixed bearing: the direction is not measured, only the distance is.
  const angle = (-38 * Math.PI) / 180;
  const workerX = 80 + distancePx * Math.cos(angle);
  const workerY = 80 + distancePx * Math.sin(angle);

  const tone = withinRadius ? "var(--success)" : "var(--destructive)";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3 sm:flex-row sm:items-center">
      <svg
        viewBox="0 0 160 160"
        className="mx-auto size-36 shrink-0"
        role="img"
        aria-label={
          isHi
            ? `कार्यस्थल से ${formatDistance(distanceM)} दूर, अनुमत सीमा ${formatDistance(radiusM)}`
            : `${formatDistance(distanceM)} from the worksite, allowed radius ${formatDistance(radiusM)}`
        }
      >
        <defs>
          <pattern id="lybor-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0V16" fill="none" stroke="var(--border)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="160" height="160" fill="url(#lybor-grid)" rx="10" />

        {/* Allowed radius */}
        <circle
          cx="80"
          cy="80"
          r={radiusPx}
          fill="var(--success)"
          fillOpacity="0.12"
          stroke="var(--success)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />

        {/* Measured distance, worksite to worker */}
        <line
          x1="80"
          y1="80"
          x2={workerX}
          y2={workerY}
          stroke={tone}
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />

        {/* Worksite */}
        <circle cx="80" cy="80" r="5" fill="var(--primary)" />
        <circle cx="80" cy="80" r="9" fill="none" stroke="var(--primary)" strokeWidth="1.5" />

        {/* Worker */}
        <circle cx={workerX} cy={workerY} r="5" fill={tone} />
        <circle cx={workerX} cy={workerY} r="9" fill={tone} fillOpacity="0.25" />
      </svg>

      <dl className="min-w-0 flex-1 space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
            <MapPin className="size-3.5 text-[var(--primary)]" aria-hidden />
            {isHi ? "कार्यस्थल" : "Worksite"}
          </dt>
          <dd className="truncate text-right font-medium">{label}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
            <Navigation className="size-3.5" style={{ color: tone }} aria-hidden />
            {isHi ? "श्रमिक की दूरी" : "Worker distance"}
          </dt>
          <dd className="font-semibold tabular-nums" style={{ color: tone }}>
            {formatDistance(distanceM)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[var(--muted-foreground)]">
            {isHi ? "अनुमत सीमा" : "Allowed radius"}
          </dt>
          <dd className="font-medium tabular-nums">{formatDistance(radiusM)}</dd>
        </div>
        {accuracyM ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--muted-foreground)]">
              {isHi ? "जीपीएस सटीकता" : "GPS accuracy"}
            </dt>
            <dd className="font-medium tabular-nums">± {Math.round(accuracyM)} m</dd>
          </div>
        ) : null}
        <div className="pt-1">
          <Badge variant={withinRadius ? "success" : "destructive"}>
            {withinRadius ? (
              <ShieldCheck className="size-3" aria-hidden />
            ) : (
              <TriangleAlert className="size-3" aria-hidden />
            )}
            {withinRadius
              ? isHi
                ? "कार्यस्थल के भीतर"
                : "Inside the worksite"
              : isHi
                ? "कार्यस्थल के बाहर"
                : "Outside the worksite"}
          </Badge>
        </div>
      </dl>
    </div>
  );
}
