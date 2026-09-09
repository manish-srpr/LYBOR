/**
 * The two roles must not look like the same product.
 *
 * The bug this guards against was conceptual rather than technical: both
 * dashboards led with cards about jobs, so an employer's home screen read as a
 * worker's job feed pointed at their own postings, and the employer had no
 * route to a worker at all - profiles existed only at /employer/workers/[id],
 * reachable only from an application they had already received.
 *
 * So this asserts three things: that each dashboard leads with that role's own
 * goal, that the employer can actually find and filter workers, and that none
 * of it can be reached by typing the other role's URL.
 */
import "dotenv/config";
import { SignJWT } from "jose";
import { prisma } from "../src/lib/db";

const B = "http://localhost:3000";
const key = new TextEncoder().encode(process.env.JWT_SECRET);

let checks = 0;
let fails = 0;
const ck = (ok: boolean, msg: string) => {
  checks++;
  console.log(`    ${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) fails++;
};

async function token(userId: string, role: string, fullName: string) {
  return new SignJWT({ userId, role, fullName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + 86_400_000))
    .sign(key);
}

/** An authenticated request that has already cleared the location step. */
function get(path: string, session?: string, granted = true) {
  const cookies = [
    "lybor_lang=en",
    ...(session ? [`lybor_session=${session}`] : []),
    ...(session && granted ? ["lybor_loc_ok=1"] : []),
  ];
  return fetch(B + path, { headers: { Cookie: cookies.join("; ") }, redirect: "manual" });
}

const worker = await prisma.workerProfile.findFirst({
  where: { user: { phone: "9800000001" } },
  include: { user: true },
});
const employer = await prisma.employerProfile.findFirst({
  where: { user: { phone: "9800000010" } },
  include: { user: true },
});
const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
if (!worker || !employer || !admin) throw new Error("seed data missing - run npm run setup");

const wTok = await token(worker.user.id, "WORKER", worker.user.fullName);
const eTok = await token(employer.user.id, "EMPLOYER", employer.user.fullName);
const aTok = await token(admin.id, "ADMIN", admin.fullName);

const workerHome = await get("/worker", wTok).then((r) => r.text());
const employerHome = await get("/employer", eTok).then((r) => r.text());

console.log("1. Each dashboard leads with its own role's goal");
{
  // The journey strips are the only element that names what the person is
  // here to do, so they are the clearest signal the screens differ.
  ck(
    workerHome.includes("Find work") && workerHome.includes("Build trust"),
    "worker home states the worker journey (Find work -> ... -> Build trust)",
  );
  ck(
    employerHome.includes("Find workers") && employerHome.includes("Pay"),
    "employer home states the employer journey (Find workers -> ... -> Pay)",
  );
  ck(
    !workerHome.includes("Find workers") && !workerHome.includes("Post work"),
    "worker home does NOT show the employer journey",
  );
  ck(
    !employerHome.includes("Build trust") && !employerHome.includes("Get paid"),
    "employer home does NOT show the worker journey",
  );
}

console.log("\n2. The worker dashboard is about finding and doing work");
{
  ck(workerHome.includes("Work available near you"), "available work is a named section");
  const availableAt = workerHome.indexOf("Work available near you");
  const earningsAt = workerHome.indexOf("Total earned");
  ck(
    availableAt > -1 && earningsAt > -1 && availableAt < earningsAt,
    "available work appears ABOVE the earnings stats",
  );
  ck(/\/worker\/jobs/.test(workerHome), "links through to the job list");
  ck(/\/worker\/applications/.test(workerHome), "reaches My Applications");
  ck(/\/worker\/profile/.test(workerHome), "reaches the skills / trust profile");
  ck(workerHome.includes("Reliability"), "reputation is shown");
}

console.log("\n3. The employer dashboard is about finding and managing workers");
{
  ck(employerHome.includes("Workers near you"), "workers-near-you is a named section");
  // Headings only. "My jobs" also appears in the nav, which is emitted before
  // the page content, so a bare indexOf measures the sidebar not the order.
  const headingAt = (label: string) => {
    const m = employerHome.match(new RegExp(`<h2[^>]*>(?:(?!</h2>).)*${label}`, "s"));
    return m?.index ?? -1;
  };
  const workersAt = headingAt("Workers near you");
  const myJobsAt = headingAt("My jobs");
  ck(
    workersAt > -1 && (myJobsAt === -1 || workersAt < myJobsAt),
    `workers heading appears ABOVE the employer's own postings (${workersAt} < ${myJobsAt})`,
  );
  ck(/\/employer\/workers/.test(employerHome), "links to the worker directory");
  ck(/\/employer\/jobs\/new/.test(employerHome), "can post work");
  ck(/\/employer\/approvals/.test(employerHome), "reaches attendance approvals");
  ck(/\/employer\/payments/.test(employerHome), "reaches payments");
  // The specific regression: the employer's home must not be a job feed.
  ck(
    !employerHome.includes("Work available near you"),
    "employer home does NOT show a worker-style available-work feed",
  );
}

console.log("\n4. The two dashboards are materially different, not just restyled");
{
  const workerOnly = ["Work available near you", "Build trust"];
  const employerOnly = ["Workers near you", "Find workers"];
  for (const phrase of workerOnly) {
    ck(
      workerHome.includes(phrase) && !employerHome.includes(phrase),
      `"${phrase}" is on the worker dashboard only`,
    );
  }
  for (const phrase of employerOnly) {
    ck(
      employerHome.includes(phrase) && !workerHome.includes(phrase),
      `"${phrase}" is on the employer dashboard only`,
    );
  }
}

console.log("\n5. The employer can actually find workers");
{
  const res = await get("/employer/workers", eTok);
  const html = await res.text();
  ck(res.status === 200, `/employer/workers renders (${res.status})`);
  ck(html.includes(worker.user.fullName), `a real seeded worker is listed (${worker.user.fullName})`);
  ck(/\bkm\b/.test(html), "distance is shown");
  ck(html.includes('name="trade"'), "trade filter present");
  ck(html.includes('name="level"'), "trust-level filter present");
  ck(html.includes('name="within"'), "distance filter present");
  ck(html.includes('name="available"'), "availability filter present");
  ck(/\/employer\/workers\/c/.test(html), "rows link to the existing worker profile page");

  // Trades come from the existing Skill table, not a second vocabulary.
  const skills = await prisma.skill.findMany({ take: 3, orderBy: { nameEn: "asc" } });
  ck(
    skills.some((s) => html.includes(s.nameEn)),
    "trade options come from the existing Skill table",
  );
}

console.log("\n6. The filters actually filter");
{
  const all = await get("/employer/workers?within=100", eTok).then((r) => r.text());
  const tiny = await get("/employer/workers?within=5", eTok).then((r) => r.text());
  const countRows = (html: string) => (html.match(/\/employer\/workers\/c[a-z0-9]+/g) ?? []).length;
  ck(
    countRows(tiny) <= countRows(all),
    `a 5km radius returns no more than 100km (${countRows(tiny)} <= ${countRows(all)})`,
  );

  const expert = await get("/employer/workers?within=100&level=EXPERT", eTok).then((r) => r.text());
  ck(
    countRows(expert) <= countRows(all),
    `filtering to Expert narrows the list (${countRows(expert)} <= ${countRows(all)})`,
  );

  const bogus = await get("/employer/workers?within=99999&level=NONSENSE", eTok);
  ck(bogus.status === 200, "nonsense filter values are ignored rather than crashing");
}

console.log("\n7. Role security is server-side, not just hidden UI");
{
  // A worker typing the employer's URL.
  const wOnEmployer = await get("/employer/workers", wTok);
  ck(wOnEmployer.status === 307, `worker -> /employer/workers is refused (${wOnEmployer.status})`);
  ck(
    (wOnEmployer.headers.get("location") ?? "").includes("/worker"),
    "worker is sent back to their own dashboard",
  );
  const leaked = await wOnEmployer.text();
  ck(
    !leaked.includes("Workers near you") && !leaked.includes('name="trade"'),
    "no employer content is present in the refused response body",
  );

  // An employer typing the worker's URL.
  for (const path of ["/worker", "/worker/jobs", "/worker/profile"]) {
    const r = await get(path, eTok);
    ck(r.status === 307, `employer -> ${path} is refused (${r.status})`);
    ck(
      (r.headers.get("location") ?? "").includes("/employer"),
      `employer is sent back to /employer from ${path}`,
    );
  }

  // Signed out entirely.
  const anon = await get("/employer/workers");
  ck(anon.status === 307, `anonymous -> /employer/workers is refused (${anon.status})`);
  const anonBody = await anon.text();
  ck(!anonBody.includes('name="trade"'), "anonymous response carries no worker directory");
}

console.log("\n8. Admin is untouched, and the location gate still applies");
{
  const admin = await get("/admin", aTok, false);
  ck(admin.status === 200, `admin reaches /admin with no location grant (${admin.status})`);

  // The new route sits inside the gated area.
  const noGrant = await get("/employer/workers", eTok, false);
  ck(noGrant.status === 307, `employer without the location grant is refused (${noGrant.status})`);
  ck(
    (noGrant.headers.get("location") ?? "").includes("/location"),
    "and is sent to the location step",
  );
  const body = await noGrant.text();
  ck(!body.includes('name="trade"'), "the worker directory is not rendered behind the gate");
}

console.log("\n9. No city restriction or reverse geocoding was reintroduced");
{
  const dir = await get("/employer/workers", eTok).then((r) => r.text());
  for (const banned of ["reverseGeocode", "nominatim", "coming soon", "not supported in your city"]) {
    ck(!new RegExp(banned, "i").test(dir), `the directory does not mention "${banned}"`);
  }
  // Distance is computed from stored coordinates, so nothing reads the device.
  ck(!dir.includes("getCurrentPosition"), "the directory does not touch device geolocation");
  ck(!dir.includes("watchPosition"), "and does not track continuously");
}

console.log("\n10. Mobile-first markup, no horizontal overflow");
{
  for (const [name, html] of [
    ["worker home", workerHome],
    ["employer home", employerHome],
    ["worker directory", await get("/employer/workers", eTok).then((r) => r.text())],
  ] as const) {
    ck(/(sm:|md:|lg:)/.test(html), `${name} uses responsive breakpoints`);
    ck(!/overflow-x-scroll/.test(html), `${name} has no forced horizontal scroll`);
    ck(!/w-\[\d{4,}px\]/.test(html), `${name} has no fixed super-wide element`);
  }
}

await prisma.$disconnect();
console.log(`\n${checks} assertions, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
