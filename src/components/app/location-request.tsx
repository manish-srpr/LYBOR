"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, RotateCw, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/session";
import { LOCATION_COOKIE, LOCATION_GRANTED } from "@/lib/location-session";
import type { Lang } from "@/lib/i18n";

/**
 * The location step, shown once immediately after credentials are accepted.
 *
 * It is a route of its own rather than an overlay on the dashboard, and that
 * placement is the point:
 *
 *  - Nothing on the login page, or anywhere public, touches geolocation. The
 *    prompt cannot appear until the sign-in action has already verified a
 *    password and issued a session, because this screen is where that action
 *    sends people.
 *  - Wrong credentials never reach it, so a failed login never asks for
 *    location.
 *  - The dashboard is not rendered behind it. Previously this was an overlay,
 *    which meant the dashboard's markup was in the response whatever the
 *    browser decided; here the role layouts redirect before rendering.
 *
 * The position is read exactly once, with getCurrentPosition, and the
 * coordinates are then discarded - this step establishes permission, and the
 * actual position is read again, freshly, at each check-in. Nothing in the app
 * calls watchPosition.
 */

type StepState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "granted" }
  | { kind: "denied" }
  | { kind: "unavailable" }
  | { kind: "timeout" }
  | { kind: "unsupported" };

export function LocationRequest({ lang, next }: { lang: Lang; next: string }) {
  const isHi = lang === "hi";
  const router = useRouter();
  const [state, setState] = useState<StepState>({ kind: "checking" });
  const started = useRef(false);

  const proceed = useCallback(() => {
    // Written from the client because the browser is the only party that knows
    // the permission was granted. A session cookie, so it expires with the
    // browser rather than outliving the person's consent.
    document.cookie = `${LOCATION_COOKIE}=${LOCATION_GRANTED}; path=/; samesite=lax`;
    setState({ kind: "granted" });
    router.replace(next);
    router.refresh();
  }, [next, router]);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ kind: "unsupported" });
      return;
    }
    setState({ kind: "checking" });
    navigator.geolocation.getCurrentPosition(
      () => proceed(),
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setState({ kind: "denied" });
            break;
          case error.POSITION_UNAVAILABLE:
            setState({ kind: "unavailable" });
            break;
          case error.TIMEOUT:
            setState({ kind: "timeout" });
            break;
          default:
            setState({ kind: "unavailable" });
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  }, [proceed]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;

    // Resolved asynchronously rather than with a synchronous setState in the
    // effect body, which would force a cascading render.
    async function decide(): Promise<StepState | "request"> {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        return { kind: "unsupported" };
      }
      const permissions = navigator.permissions;
      if (permissions?.query) {
        try {
          const status = await permissions.query({ name: "geolocation" as PermissionName });
          // Already granted for this origin: confirm silently and move on
          // rather than making somebody tap through a screen they have
          // already answered.
          if (status.state === "granted") return "request";
          if (status.state === "denied") return { kind: "denied" };
        } catch {
          // Some engines reject a geolocation query outright; ask directly.
        }
      }
      return { kind: "idle" };
    }

    void decide().then((outcome) => {
      if (cancelled) return;
      if (outcome === "request") request();
      else setState(outcome);
    });

    return () => {
      cancelled = true;
    };
  }, [request]);

  const copy = messageFor(state, isHi);
  const busy = state.kind === "checking" || state.kind === "granted";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
      <div className="text-center">
        <span
          aria-hidden
          className={`mx-auto grid size-14 place-items-center rounded-2xl ${
            copy.tone === "error"
              ? "bg-[var(--destructive)]/10 text-[var(--destructive)]"
              : copy.tone === "warn"
                ? "bg-[var(--warning)]/10 text-[var(--warning)]"
                : "bg-[var(--primary)]/10 text-[var(--primary)]"
          }`}
        >
          {copy.tone === "error" ? (
            <ShieldAlert className="size-6" />
          ) : copy.tone === "warn" ? (
            <TriangleAlert className="size-6" />
          ) : (
            <MapPin className="size-6" />
          )}
        </span>

        <h1 className="mt-5 text-xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">{copy.body}</p>

        {copy.steps ? (
          <ol className="mt-4 space-y-1.5 text-start text-sm text-[var(--muted-foreground)]">
            {copy.steps.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="shrink-0 font-medium text-[var(--foreground)]">
                  {index + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        ) : null}

        <Button size="lg" block className="mt-6" onClick={request} disabled={busy}>
          {busy ? null : <RotateCw aria-hidden />}
          {busy
            ? isHi
              ? "स्थान की जाँच हो रही है…"
              : "Checking location…"
            : copy.action}
        </Button>

        {/*
          Without a way out, somebody on a locked-down work phone or a desktop
          with no location service is stranded on this screen - unable to
          continue and unable even to sign out.
        */}
        <form action={logoutAction} className="mt-3">
          <Button type="submit" variant="ghost" size="sm" block>
            {isHi ? "साइन आउट करें" : "Back to sign in"}
          </Button>
        </form>

        <p className="mt-6 text-xs text-[var(--muted-foreground)]">
          {isHi
            ? "हम आपको लगातार ट्रैक नहीं करते। स्थान केवल अभी एक बार, और फिर चेक-इन व चेक-आउट के समय पढ़ा जाता है।"
            : "You are not tracked continuously. Your position is read once now, and then only when you check in or out."}
        </p>
      </div>
    </main>
  );
}

function messageFor(
  state: StepState,
  isHi: boolean,
): {
  title: string;
  body: string;
  action: string;
  tone: "info" | "warn" | "error";
  steps?: string[];
} {
  const retry = isHi ? "दोबारा कोशिश करें" : "Try again";

  switch (state.kind) {
    case "idle":
      return {
        tone: "info",
        title: isHi ? "स्थान की अनुमति दें" : "Allow location to continue",
        body: isHi
          ? "आप साइन इन हो चुके हैं। LYBOR उपस्थिति को कार्यस्थल से मिलाकर सत्यापित करता है, इसलिए आगे बढ़ने के लिए स्थान की अनुमति ज़रूरी है।"
          : "You are signed in. LYBOR verifies attendance against the worksite, so it needs location access before you continue.",
        action: isHi ? "स्थान की अनुमति दें" : "Allow location",
      };
    case "denied":
      return {
        tone: "error",
        title: isHi ? "स्थान की अनुमति नहीं मिली" : "Location permission was blocked",
        body: isHi
          ? "अनुमति के बिना LYBOR उपस्थिति सत्यापित नहीं कर सकता। ब्राउज़र सेटिंग में इसे चालू करें:"
          : "Without permission LYBOR cannot verify attendance. Turn it on in your browser, then try again:",
        action: retry,
        steps: isHi
          ? [
              "पते की पट्टी में ताले (या ⓘ) के निशान पर टैप करें।",
              "सूची में “स्थान” या “Location” खोजें।",
              "उसे “अनुमति दें” पर सेट करें।",
              "नीचे “दोबारा कोशिश करें” दबाएँ।",
            ]
          : [
              "Tap the lock (or ⓘ) icon in the address bar.",
              "Find “Location” in the list.",
              "Set it to “Allow”.",
              "Press “Try again” below.",
            ],
      };
    case "unavailable":
      return {
        tone: "warn",
        title: isHi ? "स्थान उपलब्ध नहीं है" : "Your location is not available",
        body: isHi
          ? "आपका डिवाइस अभी स्थान नहीं बता पा रहा है। खुले आसमान के नीचे या खिड़की के पास जाएँ, और देखें कि डिवाइस की स्थान सेवा चालू है।"
          : "Your device could not determine a position. Step outside or near a window, and check that location services are on for the device itself.",
        action: retry,
      };
    case "timeout":
      return {
        tone: "warn",
        title: isHi ? "स्थान मिलने में देर हुई" : "Finding your location took too long",
        body: isHi
          ? "जीपीएस को समय लग रहा है। एक पल रुककर दोबारा कोशिश करें।"
          : "The GPS fix is taking a while. Wait a moment, then try again.",
        action: retry,
      };
    case "unsupported":
      return {
        tone: "error",
        title: isHi ? "यह ब्राउज़र स्थान नहीं दे सकता" : "This browser cannot provide location",
        body: isHi
          ? "LYBOR को स्थान की ज़रूरत है, जो यह ब्राउज़र नहीं देता। किसी आधुनिक मोबाइल ब्राउज़र में खोलें। ध्यान दें कि स्थान के लिए HTTPS या localhost आवश्यक है।"
          : "LYBOR needs location, which this browser does not offer. Open it in a current mobile browser. Note that browsers only provide location over HTTPS or on localhost.",
        action: retry,
      };
    default:
      return {
        tone: "info",
        title: isHi ? "स्थान की जाँच" : "Checking location",
        body: isHi ? "एक पल…" : "One moment…",
        action: retry,
      };
  }
}
