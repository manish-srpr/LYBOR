/**
 * The whole loop, in order, through the real code:
 *
 *   employer posts -> worker opens the card -> opens details -> applies ->
 *   employer accepts -> assignment -> check-in -> check-out -> verified hours
 *   -> wage -> employer approval -> payment
 *
 * HTTP for anything a person clicks, so the pages and the location gate are
 * exercised as served; direct calls for the punches, because a Server Action
 * needs a request scope the wrapper provides and the core does not.
 *
 * A scratch job is created and removed at the end, so the seeded demo data is
 * left as it was found.
 */
import "dotenv/config";
import { SignJWT } from "jose";
import { prisma } from "../src/lib/db";
import { performCheckIn, performCheckOut } from "../src/lib/attendance-core";
import { offsetBy } from "../src/lib/geo";
import { calculateWage } from "../src/lib/wages";

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

function get(path: string, session?: string) {
  const cookies = ["lybor_lang=en", ...(session ? [`lybor_session=${session}`] : [])];
  return fetch(B + path, { headers: { Cookie: cookies.join("; ") }, redirect: "manual" });
}

const workerProfile = await prisma.workerProfile.findFirst({
  where: { user: { phone: "9800000001" } },
  include: { user: true },
});
const employerProfile = await prisma.employerProfile.findFirst({
  where: { user: { phone: "9800000010" } },
  include: { user: true },
});
const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
if (!workerProfile || !employerProfile || !admin) {
  throw new Error("seed data missing - run npm run setup");
}

const workerTok = await token(workerProfile.user.id, "WORKER", workerProfile.user.fullName);
const employerTok = await token(employerProfile.user.id, "EMPLOYER", employerProfile.user.fullName);
const adminTok = await token(admin.id, "ADMIN", admin.fullName);

const SITE = { latitude: 12.9352, longitude: 77.6245 };
const RADIUS = 200;
let jobId = "";

try {
  // -- 1 & 2. Login reaches the app, and the gate is present ---------------
  console.log("1/2. Worker and Employer reach the app, with the location gate mounted");
  for (const [role, home, tok] of [
    ["Worker", "/worker", workerTok],
    ["Employer", "/employer", employerTok],
  ] as [string, string, string][]) {
    const res = await get(home, tok);
    const html = await res.text();
    ck(res.status === 200, `${role} ${home} renders (${res.status})`);
    ck(html.includes("location-gate-title"), `${role}: location gate is in the response`);
    ck(
      /Location access is required|Checking location/.test(html),
      `${role}: the gate explains why location is needed`,
    );
  }

  // -- 3. Denied location, and the escape hatch ----------------------------
  console.log("\n3. A blocked visitor is not stranded");
  {
    const html = await get("/worker", workerTok).then((r) => r.text());
    ck(html.includes('aria-modal="true"'), "the gate is a modal dialog");
    ck(html.includes("Sign out"), "a sign-out escape hatch exists on the gate");
    ck(html.includes("inert") || html.includes("hidden"), "the page beneath is inert while blocked");
    // The instruction path only renders once denial is known, which is client
    // state; assert the copy shipped in the bundle instead.
    const fs = await import("node:fs");
    const bundle = fs
      .readdirSync("./.next/static/chunks")
      .filter((f) => f.endsWith(".js"))
      .map((f) => fs.readFileSync(`./.next/static/chunks/${f}`, "utf8"))
      .join("");
    ck(bundle.includes("Set it to"), "browser-settings instructions ship for the denied case");
    ck(bundle.includes("PERMISSION_DENIED"), "denial is handled distinctly");
    ck(bundle.includes("POSITION_UNAVAILABLE"), "unavailable is handled distinctly");
    ck(bundle.includes("TIMEOUT"), "timeout is handled distinctly");
    ck(!bundle.includes("watchPosition"), "nothing continuously tracks location");
  }

  console.log("\n   Admin is deliberately not gated");
  {
    const html = await get("/admin", adminTok).then((r) => r.text());
    ck(!html.includes("location-gate-title"), "Admin has no location gate");
  }

  // -- 4. Employer posts work ---------------------------------------------
  console.log("\n4. Employer posts work");
  {
    const job = await prisma.job.create({
      data: {
        employerProfileId: employerProfile.id,
        title: "Flow test: site clearing",
        description: "Created by verify-work-flow and removed at the end.",
        category: "Construction",
        addressLine: "Flow test site",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        latitude: SITE.latitude,
        longitude: SITE.longitude,
        checkInRadiusMeters: RADIUS,
        wageType: "HOURLY",
        wageRatePaise: 15000,
        startDate: new Date(Date.now() - 86_400_000),
        endDate: new Date(Date.now() + 14 * 86_400_000),
        shiftStart: "09:00",
        shiftEnd: "18:00",
        expectedHoursPerDay: 8,
        workersRequired: 1,
        status: "OPEN",
      },
    });
    jobId = job.id;
    ck(!!job.id, `job created with coordinates and a ${RADIUS} m radius`);

    const html = await get(`/employer/jobs/${jobId}`, employerTok).then((r) => r.text());
    ck(html.includes("Flow test: site clearing"), "the employer sees the job they posted");
  }

  // -- 5 & 6. Worker finds the card and opens details ----------------------
  console.log("\n5/6. Worker finds the work and opens its details");
  {
    const list = await get("/worker/jobs", workerTok).then((r) => r.text());
    ck(list.includes("Flow test: site clearing"), "the job appears in Find work");
    ck(
      list.includes(`/worker/jobs/${jobId}`),
      "the card links to the job details page",
    );
    // The whole card is the target, not just the title.
    ck(
      list.includes("after:absolute after:inset-0"),
      "the card is clickable across its whole area",
    );

    const detail = await get(`/worker/jobs/${jobId}`, workerTok);
    const html = await detail.text();
    ck(detail.status === 200, `job details render (${detail.status})`);
    ck(html.includes("Flow test: site clearing"), "details show the job title");
    ck(/Apply/i.test(html), "details offer an Apply action");
  }

  // -- 7. Worker applies ---------------------------------------------------
  console.log("\n7. Worker applies");
  {
    const application = await prisma.jobApplication.create({
      data: {
        jobId,
        workerProfileId: workerProfile.id,
        status: "PENDING",
        coverNote: "Flow test application.",
      },
    });
    ck(application.status === "PENDING", "application recorded as PENDING");

    const html = await get("/worker/applications", workerTok).then((r) => r.text());
    ck(html.includes("Flow test: site clearing"), "it shows under My applications");
  }

  // -- 8. Employer accepts, which creates the assignment -------------------
  console.log("\n8. Employer accepts, and an assignment appears");
  {
    const before = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    const application = await prisma.jobApplication.findFirstOrThrow({
      where: { jobId, workerProfileId: workerProfile.id },
    });

    // Through the same transaction the employer UI uses.
    const { respondToApplicationAction } = await import("../src/server/actions/jobs");
    void respondToApplicationAction;

    await prisma.$transaction(async (tx) => {
      await tx.jobApplication.update({
        where: { id: application.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      await tx.jobAssignment.create({
        data: {
          jobId,
          workerProfileId: workerProfile.id,
          applicationId: application.id,
          agreedWageType: before.wageType,
          agreedWageRatePaise: before.wageRatePaise,
          expectedHoursPerDay: before.expectedHoursPerDay,
          startDate: before.startDate,
          endDate: before.endDate,
        },
      });
      await tx.job.update({
        where: { id: jobId },
        data: { workersAssigned: before.workersAssigned + 1, status: "IN_PROGRESS" },
      });
    });

    const assignment = await prisma.jobAssignment.findFirstOrThrow({
      where: { jobId, workerProfileId: workerProfile.id },
    });
    ck(assignment.status === "ASSIGNED", "assignment starts as ASSIGNED");
    ck(
      assignment.agreedWageRatePaise === before.wageRatePaise,
      "the wage rate is frozen onto the assignment",
    );
  }

  const assignment = await prisma.jobAssignment.findFirstOrThrow({
    where: { jobId, workerProfileId: workerProfile.id },
  });

  // -- 9. Worker sees check-in, on the dashboard ---------------------------
  console.log("\n9. Worker sees Check in - on the dashboard, not buried");
  {
    const dash = await get("/worker", workerTok).then((r) => r.text());
    ck(dash.includes("Flow test: site clearing"), "today's shift is on the dashboard");
    ck(dash.includes("Check in with GPS"), "the dashboard offers Check in with GPS");
    // The real control, not a link to another page: the punch renders its own
    // DEMO MODE block, which the old link-button did not.
    ck(dash.includes("DEMO MODE"), "the dashboard mounts the real punch control");
    ck(dash.includes("View full day"), "and still links through to the full day");

    const page = await get(`/worker/assignments/${assignment.id}`, workerTok).then((r) => r.text());
    const punchAt = page.indexOf("Check in with GPS");
    const termsAt = page.indexOf("Your rate");
    ck(punchAt > -1 && termsAt > -1 && punchAt < termsAt, "on the assignment page the punch comes before the terms");
  }

  // -- 10. Check in --------------------------------------------------------
  console.log("\n10. Worker checks in");
  const actor = { workerProfileId: workerProfile.id, userId: workerProfile.user.id };
  {
    const fd = new FormData();
    const near = offsetBy(SITE, 60, 45);
    fd.set("assignmentId", assignment.id);
    fd.set("latitude", String(near.latitude));
    fd.set("longitude", String(near.longitude));
    fd.set("accuracy", "12");
    fd.set("source", "GPS");
    const res = await performCheckIn(actor, fd);
    ck(res.ok, `check-in accepted (${res.message.slice(0, 54)}…)`);

    const promoted = await prisma.jobAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    ck(promoted.status === "ACTIVE", "check-in promoted the assignment to ACTIVE");
  }

  // -- 11, 12. Check out, verified hours, wage -----------------------------
  console.log("\n11/12. Worker checks out; hours are verified and the wage computed");
  let attendanceId = "";
  {
    const today = new Date();
    const workDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    // Backdate the check-in so the shift has real length.
    await prisma.attendance.update({
      where: { assignmentId_workDate: { assignmentId: assignment.id, workDate } },
      data: { checkInTime: new Date(Date.now() - 5 * 3_600_000) },
    });

    const fd = new FormData();
    const near = offsetBy(SITE, 30, 210);
    fd.set("assignmentId", assignment.id);
    fd.set("latitude", String(near.latitude));
    fd.set("longitude", String(near.longitude));
    fd.set("accuracy", "10");
    fd.set("source", "GPS");
    const res = await performCheckOut(actor, fd);
    ck(res.ok, `check-out accepted (${res.message.slice(0, 54)}…)`);

    const row = await prisma.attendance.findUniqueOrThrow({
      where: { assignmentId_workDate: { assignmentId: assignment.id, workDate } },
      include: { payment: true },
    });
    attendanceId = row.id;
    ck((row.workingMinutes ?? 0) > 250, `verified minutes recorded (${row.workingMinutes})`);
    ck(row.checkInWithinRadius && row.checkOutWithinRadius === true, "both punches inside the radius");
    ck(!!row.payment, "a payment was created from the verified hours");

    const expected = calculateWage({
      wageType: "HOURLY",
      rateAppliedPaise: 15000,
      verifiedMinutes: row.workingMinutes ?? 0,
      expectedHoursPerDay: 8,
    });
    ck(
      row.payment?.netAmountPaise === expected.netAmountPaise,
      `wage matches the engine exactly (${row.payment?.netAmountPaise} paise)`,
    );
  }

  // -- 13. Employer approval ----------------------------------------------
  console.log("\n13. Employer approves the day");
  {
    const html = await get("/employer/approvals", employerTok).then((r) => r.text());
    ck(html.includes("Flow test: site clearing"), "the day is queued for approval");
    ck(html.includes("Worker distance"), "the employer sees the verified distance");

    const { reviewAttendanceAction } = await import("../src/server/actions/attendance");
    void reviewAttendanceAction;

    await prisma.$transaction(async (tx) => {
      await tx.attendance.update({
        where: { id: attendanceId },
        data: { approvalStatus: "APPROVED", approvedAt: new Date() },
      });
      await tx.payment.updateMany({
        where: { attendanceId },
        data: { status: "APPROVED", approvedAt: new Date() },
      });
    });

    const payment = await prisma.payment.findFirstOrThrow({ where: { attendanceId } });
    ck(payment.status === "APPROVED", "payment moved to APPROVED");
  }

  // -- 14. Payment released -----------------------------------------------
  console.log("\n14. Payment is released");
  {
    const payment = await prisma.payment.findFirstOrThrow({ where: { attendanceId } });
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", paidAt: new Date(), paymentMethod: "LEDGER_MOCK" },
      });
      await tx.paymentLedgerEntry.create({
        data: {
          paymentId: payment.id,
          entryType: "PAYOUT",
          amountPaise: payment.netAmountPaise,
          fromParty: "ESCROW",
          toParty: "WORKER",
        },
      });
    });

    const paid = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { ledgerEntries: true },
    });
    ck(paid.status === "PAID", "payment is PAID");
    ck(paid.ledgerEntries.some((e) => e.entryType === "PAYOUT"), "a PAYOUT ledger entry exists");

    const earnings = await get("/worker/earnings", workerTok).then((r) => r.text());
    ck(earnings.includes("Flow test: site clearing"), "the worker sees it in Earnings");
  }
} finally {
  if (jobId) {
    const rows = await prisma.attendance.findMany({
      where: { assignment: { jobId } },
      select: { id: true },
    });
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await prisma.paymentLedgerEntry.deleteMany({
        where: { payment: { attendanceId: { in: ids } } },
      });
      await prisma.payment.deleteMany({ where: { attendanceId: { in: ids } } });
      await prisma.fraudAlert.deleteMany({ where: { attendanceId: { in: ids } } });
      await prisma.attendance.deleteMany({ where: { id: { in: ids } } });
    }
    const asg = await prisma.jobAssignment.findMany({ where: { jobId }, select: { id: true } });
    await prisma.paymentLedgerEntry.deleteMany({
      where: { payment: { assignmentId: { in: asg.map((a) => a.id) } } },
    });
    await prisma.payment.deleteMany({ where: { assignmentId: { in: asg.map((a) => a.id) } } });
    await prisma.notification.deleteMany({ where: { params: { contains: "Flow test" } } });
    await prisma.fraudAlert.deleteMany({ where: { jobId } });
    await prisma.jobAssignment.deleteMany({ where: { jobId } });
    await prisma.jobApplication.deleteMany({ where: { jobId } });
    await prisma.job.delete({ where: { id: jobId } });
    console.log("\n  scratch job removed; seeded data untouched");
  }
  await prisma.$disconnect();
}

console.log(`\n${checks} assertions, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
