/**
 * A session naming a user who no longer exists must terminate, not loop.
 *
 * This reproduces the bug that made the app appear to hang: rebuilding the
 * database left a browser holding a cookie whose JWT still verified - same
 * signing secret - but whose user id was gone. /login saw a structurally
 * valid session and redirected to the dashboard; the dashboard could not find
 * the user and redirected back to /login; forever. To a browser that is not an
 * error, it is a page that never finishes loading.
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

async function tokenFor(userId: string, role: string, fullName = "Ghost") {
  return new SignJWT({ userId, role, fullName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + 86_400_000))
    .sign(key);
}

/** Follows redirects by hand so a loop shows up as a hop count, not a hang. */
async function trace(path: string, cookie: string, limit = 12) {
  const hops: string[] = [];
  let url = B + path;
  let jar = cookie;

  for (let i = 0; i < limit; i++) {
    const res = await fetch(url, { headers: { Cookie: jar }, redirect: "manual" });
    hops.push(`${res.status} ${new URL(url).pathname}`);

    // Honour Set-Cookie, which is the whole point: the clear route deletes the
    // session, and without carrying that forward the loop would never break.
    const setCookie = res.headers.get("set-cookie") ?? "";
    if (/lybor_session=;|lybor_session=\s*;|Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(setCookie)) {
      jar = "";
    }

    const location = res.headers.get("location");
    if (!location) return { hops, looped: false, finalStatus: res.status };
    url = new URL(location, url).toString();
  }
  return { hops, looped: true, finalStatus: 0 };
}

console.log("A stale session must not loop between /login and the dashboard");
{
  // A well-formed token for a user id that was never in this database.
  const ghost = await tokenFor("clzzzzzzzzzzzzzzzzzzzzzzz", "WORKER");

  for (const path of ["/worker", "/login", "/", "/employer", "/admin"]) {
    const { hops, looped, finalStatus } = await trace(path, `lybor_session=${ghost}`);
    ck(!looped, `${path} terminates (${hops.length} hop(s): ${hops.join(" -> ")})`);
    if (!looped) {
      ck(finalStatus === 200, `${path} ends on a rendered page, not another redirect`);
    }
  }
}

console.log("\nThe clear route actually deletes the cookie");
{
  const ghost = await tokenFor("clzzzzzzzzzzzzzzzzzzzzzzz", "WORKER");
  const res = await fetch(`${B}/auth/clear`, {
    headers: { Cookie: `lybor_session=${ghost}` },
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  ck(res.status >= 300 && res.status < 400, `/auth/clear redirects (${res.status})`);
  ck(
    (res.headers.get("location") ?? "").includes("/login"),
    "/auth/clear sends the visitor to /login",
  );
  ck(/lybor_session=/.test(setCookie), "/auth/clear writes the session cookie away");
  ck(
    /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(setCookie),
    "the cookie is expired, not just overwritten",
  );
  ck(
    (res.headers.get("cache-control") ?? "").includes("no-store"),
    "the clear redirect is not cacheable",
  );
}

console.log("\nA deactivated user is also signed out rather than served");
{
  const worker = await prisma.user.findUnique({ where: { phone: "9800000001" } });
  if (!worker) throw new Error("seed user 9800000001 missing");

  await prisma.user.update({ where: { id: worker.id }, data: { isActive: false } });
  try {
    const token = await tokenFor(worker.id, "WORKER", worker.fullName);
    const { hops, looped } = await trace("/worker", `lybor_session=${token}`);
    ck(!looped, `deactivated worker terminates (${hops.join(" -> ")})`);
  } finally {
    // Always restore, so this suite leaves the demo data as it found it.
    await prisma.user.update({ where: { id: worker.id }, data: { isActive: true } });
  }
}

console.log("\nA real session still works, and costs no extra redirect");
{
  const worker = await prisma.user.findUnique({ where: { phone: "9800000001" } });
  if (!worker) throw new Error("seed user missing");
  const token = await tokenFor(worker.id, "WORKER", worker.fullName);
  const res = await fetch(`${B}/worker`, {
    headers: { Cookie: `lybor_session=${token}; lybor_lang=en` },
    redirect: "manual",
  });
  ck(res.status === 200, `a valid worker session renders /worker directly (${res.status})`);
}

await prisma.$disconnect();
console.log(`\n${checks} assertions, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
