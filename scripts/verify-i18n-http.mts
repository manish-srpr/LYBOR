/**
 * End-to-end localisation verification against the running server.
 *
 * Covers every case in the brief: the gateway, register, login, all three
 * authenticated dashboards, locale persistence across a refresh AND across
 * sign-in, RTL for Urdu, and the absence of raw keys or unresolved
 * placeholders anywhere in the rendered HTML.
 */
import "dotenv/config";
import { SignJWT } from "jose";
import { prisma } from "../src/lib/db";
import { LOCALES, type Locale } from "../src/lib/i18n/locales";
import { translate, type MessageKey } from "../src/lib/i18n";

const B = "http://localhost:3000";
const key = new TextEncoder().encode(process.env.JWT_SECRET);

const tok: Record<string, string> = {};
for (const phone of ["9800000001", "9800000010", "9800000099"]) {
  const u = await prisma.user.findUnique({ where: { phone } });
  if (!u) throw new Error(`seed user ${phone} missing`);
  tok[u.role] = await new SignJWT({ userId: u.id, role: u.role, fullName: u.fullName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + 86400000))
    .sign(key);
}
await prisma.$disconnect();

let fails = 0;
let checks = 0;
const ck = (ok: boolean, msg: string) => {
  checks++;
  if (!ok) {
    fails++;
    console.log(`    FAIL  ${msg}`);
  }
};

function get(
  pathname: string,
  { locale, session }: { locale?: string; session?: string } = {},
) {
  const cookies = [];
  if (locale) cookies.push(`lybor_lang=${locale}`);
  if (session) cookies.push(`lybor_session=${session}`);
  // The role layouts now require a location grant for the session before
  // they will render, so an authenticated request must carry it too.
  if (session) cookies.push("lybor_loc_ok=1");
  return fetch(B + pathname, {
    headers: cookies.length ? { Cookie: cookies.join("; ") } : {},
    redirect: "manual",
  });
}

function bodyOf(html: string) {
  const b = html.indexOf("<body");
  let s = b >= 0 ? html.slice(b) : html;
  s = s.replace(/<script[\s\S]*?<\/script>/g, " ");
  return s;
}

/** A raw key leaking into the UI, or an uninterpolated placeholder. */
function leaks(html: string) {
  const body = bodyOf(html);
  const rawKeys = body.match(
    /\b(?:app|nav|auth|common|error|notFound|validation|job|att|wage|pay|kyc|dispute|history|reliability|match|dash|profile|notif|risk)\.[a-zA-Z]{3,}\b/g,
  );
  // `att.rule` renders the word "rule"; a code like GPS_OUT_OF_RADIUS_IN is
  // shown on purpose. Only dotted catalog keys are a leak.
  const placeholders = body.match(/\{(?:name|count|job|employer|worker|amount|hours|date|time|reason|message|score|radius|distance|units|rate|total|met|password|digest)\}/g);
  return { rawKeys: rawKeys ?? [], placeholders: placeholders ?? [] };
}

console.log("=== CASE 1-2: gateway renders in each locale, no leaks ===");
for (const { code, native, dir } of LOCALES) {
  const res = await get("/", { locale: code });
  const html = await res.text();
  ck(res.status === 200, `${code}: gateway 200`);

  // The tagline is the locale's own, not English (except for English).
  const tagline = translate(code, "app.tagline");
  ck(html.includes(tagline), `${code}: shows its own tagline`);
  if (code !== "en") {
    ck(
      !bodyOf(html).includes("Verified work. Transparent wages."),
      `${code}: does NOT fall back to the English tagline`,
    );
  }

  ck(html.includes(`lang="${code}"`), `${code}: html lang attribute`);
  ck(html.includes(`dir="${dir}"`), `${code}: html dir="${dir}"`);
  ck(html.includes(native), `${code}: selector lists its native name ${native}`);

  const { rawKeys, placeholders } = leaks(html);
  ck(rawKeys.length === 0, `${code}: no raw catalog keys (${rawKeys.slice(0, 3)})`);
  ck(placeholders.length === 0, `${code}: no unresolved placeholders (${placeholders.slice(0, 3)})`);

  // Every language must be reachable from every language's gateway.
  for (const other of LOCALES) {
    ck(html.includes(other.native), `${code}: offers ${other.code}`);
  }
}

console.log("=== CASE 3-4: register and login localise ===");
for (const { code } of LOCALES) {
  const AUTH_ROUTES: [string, MessageKey][] = [
    ["/register", "auth.register"],
    ["/login", "auth.login"],
  ];
  for (const [route, tkey] of AUTH_ROUTES) {
    const res = await get(route, { locale: code });
    const html = await res.text();
    ck(res.status === 200, `${code} ${route}: 200`);
    ck(html.includes(translate(code, tkey)), `${code} ${route}: localised heading`);
    const { rawKeys, placeholders } = leaks(html);
    ck(rawKeys.length === 0, `${code} ${route}: no raw keys`);
    ck(placeholders.length === 0, `${code} ${route}: no placeholders`);
  }
}

console.log("=== CASE 5-8: authenticated dashboards inherit the locale ===");
const AREAS: [string, string, MessageKey][] = [
  ["WORKER", "/worker", "dash.workerIntro"],
  ["EMPLOYER", "/employer", "dash.employerIntro"],
  ["ADMIN", "/admin", "dash.adminIntro"],
];
for (const { code } of LOCALES) {
  for (const [role, route, tkey] of AREAS) {
    const res = await get(route, { locale: code, session: tok[role] });
    const html = await res.text();
    ck(res.status === 200, `${code} ${route}: 200`);
    const meta = LOCALES.find((l) => l.code === code);
    ck(html.includes(`dir="${meta ? meta.dir : "ltr"}"`), `${code} ${route}: dir`);
    ck(html.includes(translate(code, tkey)), `${code} ${route}: localised intro`);
    ck(html.includes(translate(code, "nav.dashboard")), `${code} ${route}: localised nav`);
    const { rawKeys, placeholders } = leaks(html);
    ck(rawKeys.length === 0, `${code} ${route}: no raw keys (${rawKeys.slice(0, 3)})`);
    ck(placeholders.length === 0, `${code} ${route}: no placeholders (${placeholders.slice(0, 3)})`);
  }
}

console.log("=== engine output localises on authenticated pages ===");
for (const code of ["pa", "ur", "ta", "bn", "hi"] as Locale[]) {
  const html = await get("/worker", { locale: code, session: tok.WORKER }).then((r) => r.text());
  ck(
    html.includes(translate(code, "reliability.title")),
    `${code}: reliability panel title localised`,
  );
  ck(
    html.includes(translate(code, "match.title")),
    `${code}: match explainer title localised`,
  );
  // A reliability detail sentence comes from the engine via a key + params.
  ck(
    html.includes(translate(code, "reliability.cleanGps")),
    `${code}: engine-supplied reliability factor localised`,
  );
}

console.log("=== CASE: persistence across refresh and across sign-in ===");
{
  // Setting the language is a server action; assert the cookie it writes.
  const page = await get("/login", { locale: "en" }).then((r) => r.text());
  const actionId = page.match(/\$ACTION_ID_([0-9a-f]+)/)?.[1];
  const form = new FormData();
  form.set(`$ACTION_ID_${actionId}`, "");
  form.set("lang", "ta");
  const res = await fetch(`${B}/login`, {
    method: "POST",
    headers: { Origin: B },
    body: form,
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  ck(/lybor_lang=ta/.test(setCookie), "selecting Tamil writes lybor_lang=ta");
  ck(/Max-Age=31536000|max-age=31536000/i.test(setCookie), "cookie lasts a year (survives browser restart)");

  // Refresh: same cookie, still Tamil.
  const again = await get("/", { locale: "ta" }).then((r) => r.text());
  ck(again.includes(translate("ta", "app.tagline")), "after refresh, still Tamil");

  // Sign-in must not reset it: the demo worker's DB preference is Hindi/English.
  const dash = await get("/worker", { locale: "ta", session: tok.WORKER }).then((r) => r.text());
  ck(
    dash.includes(translate("ta", "dash.workerIntro")),
    "after sign-in, dashboard is STILL Tamil (not reset from the DB enum)",
  );
}

console.log("=== CASE: Urdu RTL specifics ===");
{
  const html = await get("/worker", { locale: "ur", session: tok.WORKER }).then((r) => r.text());
  ck(html.includes('dir="rtl"'), "Urdu sets dir=rtl");
  ck(html.includes('lang="ur"'), "Urdu sets lang=ur");
  const body = bodyOf(html);
  // Physical-direction utilities would not mirror; logical ones do.
  const physical = body.match(/class="[^"]*\b(?:ml-\d|mr-\d|pl-\d|pr-\d|text-left|text-right)\b/g);
  ck(!physical, `no physical direction classes in RTL output (${(physical ?? []).slice(0, 2)})`);
  const gateway = await get("/", { locale: "ur" }).then((r) => r.text());
  ck(gateway.includes('dir="rtl"'), "Urdu gateway is RTL too");
}

console.log("=== CASE: unsupported / hostile locale cookie is not a choice ===");
for (const bad of ["xx", "../etc", "", "en-US-x-hack"]) {
  // A cookie holding something unsupported is treated as "never chose", so the
  // visitor is routed to the language screen rather than silently served a
  // language they did not pick. Asserted here, and from the other direction in
  // verify-language-flow.mts TEST D.
  const res = await get("/", { locale: bad });
  ck(
    res.status === 307 && (res.headers.get("location") ?? "").startsWith("/language"),
    `locale cookie ${JSON.stringify(bad)} routes to the language screen`,
  );
  // And the screen itself still renders, in English, rather than erroring.
  const screen = await get("/language", { locale: bad });
  const html = await screen.text();
  ck(screen.status === 200, `language screen renders with cookie ${JSON.stringify(bad)}`);
  ck(html.includes('lang="en"'), `cookie ${JSON.stringify(bad)} falls back to English`);
}

console.log("=== CASE: Accept-Language negotiation for a first-time visitor ===");
{
  const res = await fetch(`${B}/`, {
    headers: { "Accept-Language": "ta-IN,ta;q=0.9,en;q=0.5" },
  });
  const html = await res.text();
  ck(html.includes('lang="ta"'), "a Tamil phone with no cookie lands in Tamil");
}

console.log(`\n${checks} assertions, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
