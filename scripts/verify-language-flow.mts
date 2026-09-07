/**
 * First-launch language flow, tested against the running server.
 *
 * Covers tests A-L from the brief: a new visitor is routed to the language
 * screen, selecting a language carries into the auth screens and all three
 * dashboards, the screen does not reappear for a returning visitor, switching
 * works from the login header, Urdu flips to RTL, and - the bug that started
 * this - no language option is rendered with text that matches its own
 * background.
 */
import "dotenv/config";
import path from "node:path";
import { SignJWT } from "jose";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { LOCALES, resolveNextPath, type Locale } from "../src/lib/i18n/locales";
import { translate, type MessageKey } from "../src/lib/i18n";

const B = "http://localhost:3000";
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") }),
});
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

let checks = 0;
let fails = 0;
const ck = (ok: boolean, msg: string) => {
  checks++;
  if (!ok) {
    fails++;
    console.log(`    FAIL  ${msg}`);
  }
};

function get(
  pathname: string,
  { locale, session, acceptLanguage }: { locale?: string; session?: string; acceptLanguage?: string } = {},
) {
  const cookies: string[] = [];
  if (locale) cookies.push(`lybor_lang=${locale}`);
  if (session) cookies.push(`lybor_session=${session}`);
  const headers: Record<string, string> = {};
  if (cookies.length) headers.Cookie = cookies.join("; ");
  if (acceptLanguage) headers["Accept-Language"] = acceptLanguage;
  return fetch(B + pathname, { headers, redirect: "manual" });
}

console.log("TEST A — a new visitor with no preference lands on the language screen");
{
  for (const route of ["/", "/login", "/register"]) {
    const res = await get(route);
    ck(res.status === 307, `${route} redirects (got ${res.status})`);
    const loc = res.headers.get("location") ?? "";
    ck(loc.startsWith("/language"), `${route} -> ${loc} points at /language`);
  }

  const page = await get("/language").then((r) => r.text());
  // Every language visible, in its own script, without interacting.
  for (const l of LOCALES) {
    ck(page.includes(l.native), `language screen shows ${l.code} as ${l.native}`);
    ck(page.includes(l.english), `language screen shows the English name for ${l.code}`);
  }
  // And no product surface leaked onto it.
  for (const banned of [
    "FIND WORK", "VERIFY WORK", "GET PAID", "BUILD TRUST",
    "GPS", "Reliability", "KYC", "attendance", "Explainable",
  ]) {
    ck(!page.includes(banned), `language screen does not mention "${banned}"`);
  }
  ck(!page.includes("<select"), "language screen uses no native <select>");
  ck(page.includes('role="radiogroup"'), "language screen is a radio group");
}

console.log("TEST K — every option states its own colours (the original bug)");
{
  const page = await get("/language").then((r) => r.text());
  // The selected card and the unselected cards must each set a background AND
  // a foreground. If either is inherited the old white-on-white bug returns.
  const cards = page
    .split('role="radio"')
    .slice(1)
    .map((chunk) => chunk.slice(0, chunk.indexOf("</button>")));
  ck(cards.length === LOCALES.length, `found ${cards.length} option cards (want ${LOCALES.length})`);
  for (const card of cards) {
    const cls = card.match(/class="([^"]*)"/)?.[1] ?? "";
    ck(/bg-\[var\(--(?:primary|card)\)\]/.test(cls), "option sets an explicit background");
    ck(
      /text-\[var\(--(?:primary-foreground|card-foreground)\)\]/.test(cls),
      "option sets an explicit foreground",
    );
    // The killer: text colour must never be the same token as its background.
    ck(
      !/bg-\[var\(--card\)\][^"]*text-\[var\(--card\)\]/.test(cls),
      "option foreground differs from its background",
    );
  }
  ck(
    page.includes("focus-visible:ring-2"),
    "options have a visible keyboard focus ring",
  );
  // Header selector on the auth screens: also no native select.
  const login = await get("/login", { locale: "hi" }).then((r) => r.text());
  ck(!login.includes("<select"), "login header selector uses no native <select>");
  ck(login.includes('aria-haspopup="menu"'), "login header selector is a real menu button");
}

console.log("TEST B/E/F — selecting a language carries into the auth screens");
for (const code of ["hi", "pa", "ur", "ta"] as Locale[]) {
  for (const [route, tkey] of [
    ["/", "app.gatewayPrompt"],
    ["/login", "auth.login"],
    ["/register", "auth.register"],
  ] as [string, MessageKey][]) {
    const res = await get(route, { locale: code });
    const html = await res.text();
    ck(res.status === 200, `${code} ${route}: 200 (no redirect once chosen)`);
    ck(html.includes(translate(code, tkey)), `${code} ${route}: rendered in ${code}`);
  }
}

console.log("TEST C — a returning visitor never sees the language screen again");
for (const code of LOCALES.map((l) => l.code)) {
  const res = await get("/", { locale: code });
  ck(res.status === 200, `${code}: gateway renders directly, no redirect`);
}

console.log("TEST D — an unsupported/blank cookie is not a choice");
for (const bad of ["", "xx", "zz-ZZ"]) {
  const res = await get("/", { locale: bad });
  ck(res.status === 307, `cookie ${JSON.stringify(bad)} still routes to the language screen`);
}

console.log("TEST G/H/I — the language follows into all three dashboards");
for (const code of ["pa", "ur", "ta", "bn"] as Locale[]) {
  for (const [role, route, tkey] of [
    ["WORKER", "/worker", "dash.workerIntro"],
    ["EMPLOYER", "/employer", "dash.employerIntro"],
    ["ADMIN", "/admin", "dash.adminIntro"],
  ] as [string, string, MessageKey][]) {
    const res = await get(route, { locale: code, session: tok[role] });
    const html = await res.text();
    ck(res.status === 200, `${code} ${route}: 200`);
    ck(html.includes(translate(code, tkey)), `${code} ${route}: still ${code} after auth`);
  }
}

console.log("TEST J — Urdu RTL through the whole flow");
{
  for (const [route, opts] of [
    ["/language", {}],
    ["/", { locale: "ur" }],
    ["/login", { locale: "ur" }],
    ["/register", { locale: "ur" }],
    ["/worker", { locale: "ur", session: tok.WORKER }],
  ] as [string, Record<string, string>][]) {
    const html = await get(route, opts).then((r) => r.text());
    if (route === "/language") {
      // Not yet chosen, so the document is LTR but Urdu's own card is RTL.
      ck(html.includes('dir="rtl"'), `${route}: the Urdu option itself is RTL`);
    } else {
      ck(html.includes('dir="rtl"'), `${route}: document is RTL in Urdu`);
      ck(html.includes('lang="ur"'), `${route}: document lang is ur`);
    }
  }
  // Switching back restores LTR.
  const back = await get("/login", { locale: "ta" }).then((r) => r.text());
  ck(back.includes('dir="ltr"'), "switching Urdu -> Tamil restores LTR");
  // The header menu panel only exists once opened, which is client state, so
  // assert the logical-edge class shipped in the bundle rather than in the
  // closed-menu HTML.
  const chunks = await import("node:fs").then((fs) =>
    fs
      .readdirSync("./.next/static/chunks")
      .filter((f) => f.endsWith(".js"))
      .map((f) => fs.readFileSync(`./.next/static/chunks/${f}`, "utf8"))
      .join(""),
  );
  ck(chunks.includes("end-0"), "header menu uses a logical edge (end-0) in the bundle");
  ck(!/\bright-0\b/.test(chunks), "header menu does not use a physical right edge");
}

console.log("TEST — Accept-Language pre-selects but does not count as a choice");
{
  const res = await get("/", { acceptLanguage: "ta-IN,ta;q=0.9" });
  ck(res.status === 307, "a Tamil handset with no cookie still sees the language screen");
  const screen = await get("/language", { acceptLanguage: "ta-IN,ta;q=0.9" }).then((r) => r.text());
  // Pre-selection shows as the Tamil heading being the active one.
  ck(
    screen.includes(translate("ta", "app.chooseLanguage")),
    "the language screen opens with Tamil pre-selected",
  );
}

console.log("TEST — open redirect via ?next= is refused");
{
  // Asserted on the sanitiser itself: the raw query string always appears in
  // Next's router payload, so scanning the HTML cannot distinguish "reflected
  // into the page" from "present in the URL".
  for (const bad of [
    "https://evil.example.com",
    "//evil.example.com",
    "http://evil.example.com",
    "/\\evil.example.com",
    "javascript:alert(1)",
    "",
    undefined,
    42,
  ]) {
    ck(resolveNextPath(bad) === "/", `resolveNextPath(${JSON.stringify(bad)}) falls back to /`);
  }
  for (const good of ["/", "/login", "/worker/jobs", "/register?x=1"]) {
    ck(resolveNextPath(good) === good, `resolveNextPath(${good}) is preserved`);
  }
  // And end to end: the screen still renders with a hostile next.
  const res = await get("/language?next=https%3A%2F%2Fevil.example.com");
  ck(res.status === 200, "the language screen still renders with a hostile ?next=");
}

console.log("TEST L — no fixed widths that would overflow a narrow phone");
{
  const page = await get("/language").then((r) => r.text());
  const body = page.slice(page.indexOf("<main"), page.indexOf("</main>"));
  ck(!/w-\[\d{3,}px\]|min-w-\[\d{3,}px\]/.test(body), "no fixed pixel widths on the grid");
  ck(/grid-cols-1/.test(body), "grid starts at one column on the narrowest screens");
  ck(/min-h-14/.test(body), "options have a 56px minimum touch target");
}

console.log(`\n${checks} assertions, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
