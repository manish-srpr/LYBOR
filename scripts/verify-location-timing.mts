/**
 * The location step must always come back with something to do.
 *
 * The bug this guards against was not a slow timeout - it was no timeout at
 * all. `getCurrentPosition`'s own `timeout` option bounds acquiring a fix once
 * permission exists; it does not run while the browser waits for the person to
 * answer the permission prompt. Dismiss that prompt instead of blocking it and
 * Chrome calls neither callback, so the screen sat on "Checking location"
 * indefinitely.
 *
 * A headless HTTP suite cannot drive a browser permission prompt, so this
 * asserts the properties that make an unbounded wait impossible, by reading
 * the shipped source and bundle: that a watchdog exists, that it is cleared on
 * every path, that the options are sane, and that the screen never starts in a
 * busy state.
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";

let checks = 0;
let fails = 0;
const ck = (ok: boolean, msg: string) => {
  checks++;
  console.log(`    ${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) fails++;
};

const src = readFileSync("src/components/app/location-request.tsx", "utf8");
const bundle = readdirSync("./.next/static/chunks")
  .filter((f) => f.endsWith(".js"))
  .map((f) => readFileSync(`./.next/static/chunks/${f}`, "utf8"))
  .join("");

console.log("The wait is bounded by something other than the browser");
{
  ck(/const WATCHDOG_MS\s*=\s*(\d+)/.test(src), "a watchdog constant exists");
  const watchdogMs = Number(src.match(/const WATCHDOG_MS\s*=\s*(\d+)/)?.[1] ?? 0);
  ck(watchdogMs > 0 && watchdogMs <= 15000, `watchdog is ${watchdogMs}ms - bounded and not punishing`);

  ck(src.includes("setTimeout(() => finish("), "the watchdog resolves the step when it fires");
  ck(
    (src.match(/clearTimeout/g) ?? []).length >= 3,
    "the timer is cleared on settle, on re-request and on unmount",
  );
  ck(src.includes("settled.current"), "a settled guard stops two outcomes racing");
}

console.log("\nThe geolocation options are tuned for a login check, not survey accuracy");
{
  const posTimeout = Number(src.match(/const POSITION_TIMEOUT_MS\s*=\s*(\d+)/)?.[1] ?? 0);
  const maxAge = Number(src.match(/const POSITION_MAX_AGE_MS\s*=\s*([\d_]+)/)?.[1]?.replace(/_/g, "") ?? 0);
  const watchdogMs = Number(src.match(/const WATCHDOG_MS\s*=\s*(\d+)/)?.[1] ?? 0);

  ck(posTimeout > 0 && posTimeout <= 10000, `position timeout is ${posTimeout}ms`);
  ck(
    posTimeout < watchdogMs,
    `position timeout (${posTimeout}ms) fires before the watchdog (${watchdogMs}ms), so a real GPS timeout reports as one`,
  );
  ck(maxAge > 0, `a cached fix up to ${maxAge / 1000}s old is accepted, which returns instantly`);
  ck(
    /enableHighAccuracy:\s*false/.test(src),
    "high accuracy is off for login - a coarse fix is enough and far faster",
  );
}

console.log("\nThe screen never starts busy, and never traps the person");
{
  ck(
    /useState<StepState>\(\{\s*kind:\s*"idle"\s*\}\)/.test(src),
    "initial state is idle, so no spinner appears before anything is asked",
  );
  ck(src.includes("logoutAction"), "a way back to sign in is always present");
  ck(/case "timeout":/.test(src), "the timeout state has its own message");
  ck(
    src.includes("closing the prompt leaves it unanswered"),
    "the timeout copy names the dismissed-prompt cause, which is the real one",
  );
}

console.log("\nStill exactly one reading, and no continuous tracking");
{
  // Count calls, not prose. The doc comment names both APIs - once to say the
  // position is read a single time, once to say watchPosition is not used -
  // and a plain substring count reads those as usages.
  const code = src
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join("\n");

  ck(
    (code.match(/geolocation\.getCurrentPosition/g) ?? []).length === 1,
    "getCurrentPosition is called from exactly one place",
  );
  ck(!/geolocation\.watchPosition/.test(code), "the step does not call watchPosition");
  ck(!bundle.includes("watchPosition"), "no client chunk anywhere uses watchPosition");
}

console.log("\nNo geographic restriction was reintroduced");
{
  const loginPath = [
    "src/components/app/location-request.tsx",
    "src/app/location/page.tsx",
    "src/lib/location-session.ts",
    "src/proxy.ts",
  ]
    .map((f) => readFileSync(f, "utf8"))
    .join("");

  for (const banned of [
    "Delhi", "Mumbai", "Pune", "Bengaluru", "Hyderabad", "Chennai",
    "geocod", "nominatim", "reverseGeocode", "detectCity", "coming soon",
  ]) {
    ck(
      !new RegExp(banned, "i").test(loginPath),
      `the login path does not mention "${banned}"`,
    );
  }
  ck(
    src.includes("any valid fix is accepted"),
    "the code states that any valid location is accepted",
  );
}

console.log("\nThe worksite attendance check is untouched and still stricter");
{
  const punch = readFileSync("src/components/app/gps-punch.tsx", "utf8");
  ck(
    /enableHighAccuracy:\s*true/.test(punch),
    "check-in still asks for high accuracy - login and attendance are separate systems",
  );
  ck(punch.includes("getCurrentPosition"), "the punch still reads a fresh position");
  ck(!punch.includes("LOCATION_COOKIE"), "the punch does not rely on the login grant");

  const core = readFileSync("src/lib/attendance-core.ts", "utf8");
  ck(core.includes("evaluateGeofence"), "the server still recomputes the geofence for attendance");
}

console.log(`\n${checks} assertions, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
