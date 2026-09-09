"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, RotateCw, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/session";
import type { Lang } from "@/lib/i18n";

/**
 * Requires location permission before a worker or employer may use the app.
 *
 * Three properties worth stating, because each was a deliberate choice:
 *
 *  - It lives inside the authenticated layouts, so the prompt can only ever
 *    appear after credentials have been verified. Nothing asks for location on
 *    the login screen.
 *  - It reads the position exactly once, with getCurrentPosition. There is no
 *    watchPosition anywhere in the app, so nobody is followed around.
 *  - A granted permission is remembered for the browser session, and the
 *    Permissions API is consulted first where it exists, so a worker is not
 *    re-prompted on every navigation.
 *
 * What it is NOT: a security boundary. The page underneath is server-rendered
 * before this component runs, so its markup exists in the response whatever
 * the browser decides about location. This gate governs what a person can see
 * and touch, which is what was asked for; it is not a substitute for the
 * server-side checks in attendance-core.ts, which are what actually keep an
 * unverified punch out of the database.
 */

type GateState =
  | { kind: "checking" }
  | { kind: "granted" }
  | { kind: "prompt" }
  | { kind: "denied" }
  | { kind: "unavailable" }
  | { kind: "timeout" }
  | { kind: "unsupported" };

/** Remembered per browser session so navigation does not re-prompt. */
const SESSION_KEY = "lybor_location_ok";

function readSessionGrant(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    // Private mode and blocked site-data both throw here rather than return.
    return false;
  }
}

function rememberGrant(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Not fatal: the worst case is one extra prompt per navigation.
  }
}

export function LocationGate({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  const isHi = lang === "hi";
  const [state, setState] = useState<GateState>({ kind: "checking" });
  const asked = useRef(false);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ kind: "unsupported" });
      return;
    }
    setState({ kind: "checking" });
    navigator.geolocation.getCurrentPosition(
      () => {
        // The coordinates themselves are deliberately discarded. This step
        // establishes permission; the actual position is read again, freshly,
        // at the moment of a check-in.
        rememberGrant();
        setState({ kind: "granted" });
      },
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
  }, []);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    let cancelled = false;

    // Resolved in an async pass rather than synchronously in the effect body.
    // A synchronous setState here would make React re-render mid-effect, which
    // the compiler rightly flags as a cascading render.
    async function resolve(): Promise<GateState | "request"> {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        return { kind: "unsupported" };
      }
      if (readSessionGrant()) return { kind: "granted" };

      // Where the Permissions API exists, use it to avoid prompting somebody
      // who has already said yes - and to show our own explanation first,
      // rather than a bare browser dialog, to somebody who has not.
      const permissions = navigator.permissions;
      if (permissions?.query) {
        try {
          const status = await permissions.query({ name: "geolocation" as PermissionName });
          if (status.state === "granted") return "request";
          if (status.state === "denied") return { kind: "denied" };
        } catch {
          // Firefox has historically rejected a geolocation query; fall
          // through to asking the person directly.
        }
      }
      return { kind: "prompt" };
    }

    void resolve().then((outcome) => {
      if (cancelled) return;
      if (outcome === "request") request();
      else setState(outcome);
    });

    return () => {
      cancelled = true;
    };
  }, [request]);

  const blocked = state.kind !== "granted";

  return (
    <>
      {/*
        The page stays mounted while blocked, but `inert` removes it from the
        tab order, from pointer events and from the accessibility tree, so the
        overlay is not something a keyboard user can simply tab behind.
      */}
      <div hidden={blocked} inert={blocked || undefined}>
        {children}
      </div>
      {blocked ? <Blocker state={state} isHi={isHi} onRetry={request} /> : null}
    </>
  );
}

function Blocker({
  state,
  isHi,
  onRetry,
}: {
  state: GateState;
  isHi: boolean;
  onRetry: () => void;
}) {
  const copy = messageFor(state, isHi);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-gate-title"
      className="fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center bg-[var(--background)] px-5 py-10"
    >
      <div className="w-full max-w-sm text-center">
        <span
          aria-hidden
          className={`mx-auto grid size-14 place-items-center rounded-2xl ${
            copy.tone === "error"
              ? "bg-[var(--destructive)]/10 text-[var(--destructive)]"
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

        <h1 id="location-gate-title" className="mt-5 text-xl font-semibold tracking-tight">
          {copy.title}
        </h1>
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

        {state.kind !== "checking" ? (
          <Button size="lg" block className="mt-6" onClick={onRetry}>
            <RotateCw aria-hidden />
            {copy.action}
          </Button>
        ) : (
          <p className="mt-6 text-sm text-[var(--muted-foreground)]">
            {isHi ? "स्थान की जाँच हो रही है…" : "Checking location…"}
          </p>
        )}

        {/*
          An escape hatch is essential. Without it, somebody who cannot grant
          permission - a locked-down work phone, a desktop with no location
          service - is trapped on this screen with no way even to sign out.
        */}
        <form action={logoutAction} className="mt-3">
          <Button type="submit" variant="ghost" size="sm" block>
            {isHi ? "साइन आउट करें" : "Sign out"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function messageFor(
  state: GateState,
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
    case "prompt":
      return {
        tone: "info",
        title: isHi ? "स्थान की अनुमति ज़रूरी है" : "Location access is required",
        body: isHi
          ? "LYBOR उपस्थिति को कार्यस्थल से मिलाकर सत्यापित करता है। जारी रखने के लिए स्थान की अनुमति दें। हम आपको लगातार ट्रैक नहीं करते — स्थान केवल चेक-इन और चेक-आउट के समय पढ़ा जाता है।"
          : "LYBOR verifies attendance against the worksite, so it needs location access to continue. You are not tracked continuously — your position is read only when you check in or out.",
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
              "“स्थान” या “Location” खोजें।",
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
          : "Your device could not determine a position. Step outside or near a window, and check that location services are switched on for the device itself.",
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
          ? "LYBOR को स्थान की ज़रूरत है, जो यह ब्राउज़र नहीं देता। कृपया किसी आधुनिक मोबाइल ब्राउज़र में खोलें। ध्यान दें कि स्थान के लिए HTTPS या localhost आवश्यक है।"
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
