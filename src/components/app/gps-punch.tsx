"use client";

import { useState, useTransition } from "react";
import { FlaskConical, LogIn, LogOut, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { checkInAction, checkOutAction, type ActionResult } from "@/server/actions/attendance";
import { distanceMeters, formatDistance, offsetBy } from "@/lib/geo";
import type { Lang } from "@/lib/i18n";

type Mode = "IN" | "OUT";

/**
 * Turns a GeolocationPositionError into something a worker can act on.
 *
 * The three codes are the whole of the spec, but they are not
 * interchangeable: PERMISSION_DENIED is a settings problem,
 * POSITION_UNAVAILABLE usually means no sky, and TIMEOUT often just needs
 * another few seconds. The default branch exists because the object arrives
 * from the browser and older engines have been known to omit `code`.
 */
function geolocationMessage(error: GeolocationPositionError, isHi: boolean): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return isHi
        ? "स्थान की अनुमति नहीं मिली। ब्राउज़र सेटिंग में स्थान चालू करें, या नीचे डेमो विकल्प उपयोग करें।"
        : "Location permission was denied. Turn location on for this site in your browser settings, or use a demo option below.";
    case error.POSITION_UNAVAILABLE:
      return isHi
        ? "स्थान उपलब्ध नहीं है। खुले आसमान के नीचे जाएँ और दोबारा कोशिश करें।"
        : "Your location is not available right now. Step outside or near a window, then try again.";
    case error.TIMEOUT:
      return isHi
        ? "स्थान मिलने में बहुत समय लगा। एक पल रुककर दोबारा कोशिश करें।"
        : "Finding your location took too long. Wait a moment and try again.";
    default:
      return isHi
        ? "स्थान नहीं मिल सका। दोबारा कोशिश करें।"
        : "Could not read your location. Try again.";
  }
}

/**
 * The GPS punch control.
 *
 * Location is read in the browser and posted to the server, which recomputes
 * the distance itself - the client value is never trusted as the source of
 * truth. The demo controls exist because a reviewer on a desktop with location
 * denied still needs to exercise both the in-radius and out-of-radius paths,
 * and they are labelled DEMO MODE because a simulated punch must never be
 * mistaken for a real GPS verification.
 */
export function GpsPunch({
  assignmentId,
  mode,
  site,
  radiusMeters,
  lang,
}: {
  assignmentId: string;
  mode: Mode;
  site: { latitude: number; longitude: number };
  radiusMeters: number;
  lang: Lang;
}) {
  const isHi = lang === "hi";
  const [pending, startTransition] = useTransition();
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function submit(coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    source: "GPS" | "DEMO";
  }) {
    const formData = new FormData();
    formData.set("assignmentId", assignmentId);
    formData.set("latitude", String(coords.latitude));
    formData.set("longitude", String(coords.longitude));
    if (coords.accuracy !== undefined) {
      formData.set("accuracy", String(Math.round(coords.accuracy)));
    }
    formData.set("source", coords.source);

    startTransition(async () => {
      const action = mode === "IN" ? checkInAction : checkOutAction;
      setResult(await action(formData));
    });
  }

  function useDeviceLocation() {
    setResult(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setResult({
        ok: false,
        message: isHi
          ? "इस ब्राउज़र में जीपीएस उपलब्ध नहीं है। नीचे डेमो विकल्प उपयोग करें।"
          : "This browser cannot read GPS. Use a demo option below.",
      });
      return;
    }
    setReading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setReading(false);
        const { latitude, longitude, accuracy } = position.coords;
        setPreview(
          `${formatDistance(distanceMeters({ latitude, longitude }, site))} ${
            isHi ? "कार्यस्थल से" : "from the worksite"
          }`,
        );
        submit({ latitude, longitude, accuracy, source: "GPS" });
      },
      (error) => {
        setReading(false);
        // Each failure gets its own message, because each has a different
        // remedy. Collapsing them into "could not read your location" leaves a
        // worker with no idea whether to change a setting, step outside, or
        // simply wait - and the fix for a denied permission is nothing like
        // the fix for a slow satellite lock.
        setResult({ ok: false, message: geolocationMessage(error, isHi) });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  const busy = pending || reading;
  const Icon = mode === "IN" ? LogIn : LogOut;

  return (
    <div className="space-y-3">
      {result ? (
        <Alert tone={result.ok ? "success" : "destructive"}>{result.message}</Alert>
      ) : null}

      {preview && !result ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <MapPin className="size-3.5" aria-hidden />
          {preview}
        </p>
      ) : null}

      <Button size="lg" block onClick={useDeviceLocation} disabled={busy}>
        <Icon aria-hidden />
        {busy
          ? isHi
            ? "स्थान पढ़ा जा रहा है…"
            : "Reading your location…"
          : mode === "IN"
            ? isHi
              ? "जीपीएस से चेक इन करें"
              : "Check in with GPS"
            : isHi
              ? "जीपीएस से चेक आउट करें"
              : "Check out with GPS"}
      </Button>

      <p className="text-center text-xs text-[var(--muted-foreground)]">
        {isHi
          ? `आपका स्थान दर्ज होगा और ${radiusMeters} मीटर की सीमा से मिलाया जाएगा।`
          : `Your location is recorded and checked against the ${radiusMeters} m worksite radius.`}
      </p>

      <details className="overflow-hidden rounded-xl border border-dashed border-[var(--warning)]/60 bg-[var(--warning)]/5">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-xs font-medium">
          <FlaskConical className="size-3.5 text-[var(--warning)]" aria-hidden />
          <Badge variant="warning">{isHi ? "डेमो मोड" : "DEMO MODE"}</Badge>
          <span className="text-[var(--muted-foreground)]">
            {isHi ? "स्थान सिमुलेट करें" : "Simulate a location"}
          </span>
        </summary>

        <div className="space-y-2 border-t border-[var(--warning)]/40 p-3">
          <p className="text-xs text-[var(--muted-foreground)]">
            {isHi
              ? "ये बटन असली जीपीएस नहीं हैं। इनसे किया गया चेक-इन जोखिम जाँच में DEMO_LOCATION_USED के रूप में दर्ज होता है। सीमा के बाहर वाला बटन अस्वीकार होगा — जियोफेंस डेमो पर भी लागू होता है।"
              : "These buttons are not real GPS, and a punch made with them is recorded as DEMO_LOCATION_USED in the risk checks. The out-of-radius one is refused: the geofence applies to demo punches too, so this cannot be used to bypass it."}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                submit({
                  latitude: site.latitude,
                  longitude: site.longitude,
                  accuracy: 12,
                  source: "DEMO",
                })
              }
            >
              {isHi ? "कार्यस्थल पर" : "At the worksite"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                const far = offsetBy(site, radiusMeters * 4 + 500, 60);
                submit({ ...far, accuracy: 18, source: "DEMO" });
              }}
            >
              {isHi ? "सीमा से बाहर" : "Outside the radius"}
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}
