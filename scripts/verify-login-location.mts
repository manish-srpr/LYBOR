/**
 * Location permission must be asked for after login, and never before.
 *
 * The ordering is the whole point, so it is tested from both directions: that
 * nothing public or pre-credential touches geolocation, and that a verified
 * session cannot reach a dashboard until the location step is done.
 *
 * Logins go through the real sign-in Server Action over HTTP, replaying the
 * form exactly as a browser without JavaScript would, so the redirect being
 * asserted is the one a person actually gets.
 */
import "dotenv/config";
import { SignJWT } from "jose";
import { prisma } from "../src/lib/db";
import { safeNextPath } from "../src/lib/location-session";

const B = "http://localhost:3000";
const key = new TextEncoder().encode(process.env.JWT_SECRET);

let checks = 0;
let fails = 0;
const ck = (ok: boolean, msg: string) => {
  checks++;
  console.log(`    ${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) fails++;
};

/** Every client chunk, to prove where geolocation code does and does not ship. */
const bundle = await (async () => {
  const fs = await import("node:fs");
  return fs
    .readdirSync("./.next/static/chunks")
    .filter((f) => f.endsWith(".js"))
    .map((f) => fs.readFileSync(`./.next/static/chunks/${f}`, "utf8"))
    .join("");
})();

function decode(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Signs in the no-JavaScript way, so the action's own redirect is observed. */
async function signIn(phone: string, password: string) {
  const page = await fetch(`${B}/login`, {
    headers: { Cookie: "lybor_lang=en" },
  }).then((r) => r.text());

  const form = (page.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) =>
    f.includes('name="phone"'),
  );
  if (!form) throw new Error("login form not found");

  const body = new FormData();
  for (const match of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = match[0].match(/name="([^"]*)"/)?.[1];
    const value = match[0].match(/value="([^"]*)"/)?.[1] ?? "";
    if (name) body.set(decode(name), decode(value));
  }
  body.set("phone", phone);
  body.set("password", password);

  const res = await fetch(`${B}/login`, {
    method: "POST",
    headers: { Origin: B, Cookie: "lybor_lang=en" },
    body,
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  return {
    status: res.status,
    location: res.headers.get("location"),
    session: setCookie.match(/lybor_session=([^;]+)/)?.[1] ?? null,
    html: await res.text().catch(() => ""),
  };
}

async function tokenFor(phone: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { phone } });
  return {
    role: u.role,
    token: await new SignJWT({ userId: u.id, role: u.role, fullName: u.fullName })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(new Date(Date.now() + 86_400_000))
      .sign(key),
  };
}

// -- 1, 2. Nothing public asks for location --------------------------------
console.log("1/2. No location is requested before credentials are submitted");
for (const path of ["/", "/login", "/register", "/language"]) {
  const html = await fetch(`${B}${path}`, {
    headers: { Cookie: "lybor_lang=en" },
  }).then((r) => r.text());
  ck(!html.includes("getCurrentPosition"), `${path}: no getCurrentPosition in the markup`);
  ck(!html.includes("LocationRequest"), `${path}: the location step is not mounted`);
}
ck(
  !bundle.includes("watchPosition"),
  "nothing anywhere in the client bundle tracks location continuously",
);

// -- 3. A failed login never asks -----------------------------------------
console.log("\n3. Wrong credentials: rejected, and no location step");
{
  const bad = await signIn("9800000001", "definitely-not-the-password");
  ck(bad.session === null, "no session is issued");
  ck(
    !(bad.location ?? "").startsWith("/location"),
    `no redirect to the location step (location=${bad.location ?? "none"})`,
  );
  ck(/incorrect/i.test(bad.html), "the existing login error is shown");
}

// -- 4, 5. A successful login goes to the location step first --------------
console.log("\n4/5. Correct credentials: session issued, then the location step");
for (const [who, phone, home] of [
  ["Worker", "9800000001", "/worker"],
  ["Employer", "9800000010", "/employer"],
] as [string, string, string][]) {
  const ok = await signIn(phone, "lybor123");
  ck(ok.session !== null, `${who}: session issued`);
  ck(
    (ok.location ?? "").startsWith("/location"),
    `${who}: redirected to ${ok.location ?? "none"} - not straight to the dashboard`,
  );
  ck(
    decodeURIComponent(ok.location ?? "").includes(home),
    `${who}: the step knows to continue to ${home}`,
  );

  // And the step itself renders, asking for permission.
  const step = await fetch(`${B}${ok.location}`, {
    headers: { Cookie: `lybor_lang=en; lybor_session=${ok.session}` },
  });
  const html = await step.text();
  ck(step.status === 200, `${who}: the location step renders (${step.status})`);
  ck(/Allow location|Checking location/.test(html), `${who}: it asks for location`);
  ck(html.includes("not tracked continuously"), `${who}: it states there is no tracking`);
}

// -- 6-11. Granted: straight through to the right dashboard ---------------
console.log("\n6-11. With the grant, each role reaches its own dashboard");
for (const [who, phone, home, needle] of [
  ["Worker", "9800000001", "/worker", "Ramesh Kumar"],
  ["Employer", "9800000010", "/employer", "BuildRight Constructions"],
] as [string, string, string, string][]) {
  const { token } = await tokenFor(phone);
  const res = await fetch(`${B}${home}`, {
    headers: { Cookie: `lybor_lang=en; lybor_session=${token}; lybor_loc_ok=1` },
    redirect: "manual",
  });
  const html = await res.text();
  ck(res.status === 200, `${who} ${home} renders with the grant (${res.status})`);
  ck(html.includes(needle), `${who}: their own dashboard content is present`);
}

// -- 12, 13, 14. Without the grant, no dashboard --------------------------
console.log("\n12-14. Without the grant - denied, unavailable or timed out - no dashboard");
for (const [who, phone, home] of [
  ["Worker", "9800000001", "/worker"],
  ["Employer", "9800000010", "/employer"],
] as [string, string, string][]) {
  const { token } = await tokenFor(phone);

  for (const [label, cookie] of [
    ["no grant at all", `lybor_lang=en; lybor_session=${token}`],
    ["a forged/garbage grant", `lybor_lang=en; lybor_session=${token}; lybor_loc_ok=maybe`],
  ] as [string, string][]) {
    const res = await fetch(`${B}${home}`, { headers: { Cookie: cookie }, redirect: "manual" });
    ck(
      res.status === 307 && (res.headers.get("location") ?? "").startsWith("/location"),
      `${who}, ${label}: redirected to the location step`,
    );
    const body = await res.text();
    // Not a byte count: the question is whether dashboard content reaches
    // the client at all. A layout-level redirect leaked it; the proxy does
    // not, because it runs before the page is rendered.
    const leaked = ["Ramesh Kumar", "BuildRight Constructions", "Total earned"].filter((n) =>
      body.includes(n),
    );
    ck(
      leaked.length === 0,
      `${who}, ${label}: no dashboard content in the response${leaked.length ? " - leaked " + leaked.join(", ") : ""}`,
    );
  }

  // Deep links are covered too, not just the dashboard root.
  // Real sub-routes for each role; /worker has earnings, not payments.
  const deepRoutes = home === "/worker"
    ? ["/worker/jobs", "/worker/earnings", "/worker/assignments"]
    : ["/employer/jobs", "/employer/payments", "/employer/approvals"];
  for (const deep of deepRoutes) {
    const res = await fetch(`${B}${deep}`, {
      headers: { Cookie: `lybor_lang=en; lybor_session=${token}` },
      redirect: "manual",
    });
    ck(
      res.status === 307 && (res.headers.get("location") ?? "").startsWith("/location"),
      `${who}: ${deep} also requires the grant`,
    );
  }
}

console.log("\n   All four browser failure modes are handled, with a way out");
for (const needle of [
  "PERMISSION_DENIED",
  "POSITION_UNAVAILABLE",
  "TIMEOUT",
  "cannot provide location",
  "Set it to",
  "Back to sign in",
]) {
  ck(bundle.includes(needle), `the step ships handling for: ${needle}`);
}

// -- Admin is untouched ---------------------------------------------------
console.log("\n   Admin login is unchanged");
{
  const admin = await signIn("9800000099", "lybor123");
  ck(admin.session !== null, "Admin signs in");
  ck(
    admin.location === "/admin",
    `Admin goes straight to /admin, skipping the location step (got ${admin.location})`,
  );

  const { token } = await tokenFor("9800000099");
  const res = await fetch(`${B}/admin`, {
    headers: { Cookie: `lybor_lang=en; lybor_session=${token}` },
    redirect: "manual",
  });
  ck(res.status === 200, `Admin reaches /admin with no location grant (${res.status})`);
}

// -- The step cannot be reached without a session -------------------------
console.log("\n   The location step itself is behind authentication");
{
  const res = await fetch(`${B}/location`, {
    headers: { Cookie: "lybor_lang=en" },
    redirect: "manual",
  });
  ck(
    res.status === 307 && (res.headers.get("location") ?? "").includes("/login"),
    `an unauthenticated visit to /location is sent to sign in (${res.status})`,
  );
}

console.log("\n   ?next= cannot be used to redirect off-site");
for (const bad of ["https://evil.example.com", "//evil.example.com", "/location", "\\\\evil"]) {
  ck(safeNextPath(bad, "/worker") === "/worker", `safeNextPath rejects ${JSON.stringify(bad)}`);
}
for (const good of ["/worker", "/employer/payments"]) {
  ck(safeNextPath(good, "/") === good, `safeNextPath keeps ${good}`);
}

await prisma.$disconnect();
console.log(`\n${checks} assertions, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
