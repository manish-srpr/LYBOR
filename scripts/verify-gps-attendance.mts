/**
 * GPS attendance: geofence, abuse resistance, and the wage that follows.
 *
 * These run against the real server actions and the real database, not mocks,
 * because the things worth testing here are exactly the ones a mock would
 * paper over: that the server recomputes the distance rather than believing
 * the client, that an assignment belonging to somebody else is refused, and
 * that a refused punch leaves no row behind to become billable hours.
 *
 * Everything is done inside a scratch job and torn down afterwards, so the
 * seeded demo data is left exactly as it was found.
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
// The core, not the Server Action wrapper: the wrapper reads cookies, which
// do not exist outside a request. The wrapper adds only session resolution
// and cache invalidation, both covered by the HTTP suites.
import { performCheckIn, performCheckOut } from "../src/lib/attendance-core";
import { distanceMeters, offsetBy } from "../src/lib/geo";
import {
  DEFAULT_GEOFENCE_RADIUS_M,
  MAX_GEOFENCE_RADIUS_M,
  MIN_GEOFENCE_RADIUS_M,
  clampRadius,
  evaluateGeofence,
} from "../src/lib/geofence";
import { calculateWage } from "../src/lib/wages";

let checks = 0;
let fails = 0;
const ck = (ok: boolean, msg: string) => {
  checks++;
  console.log(`    ${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) fails++;
};

// ---------------------------------------------------------------------------
// 1. Pure distance maths - no database needed.
// ---------------------------------------------------------------------------
console.log("Distance calculation");
{
  const site = { latitude: 12.9716, longitude: 77.5946 };
  ck(distanceMeters(site, site) === 0, "the same point is 0 m from itself");

  for (const metres of [10, 100, 250, 1000, 5000]) {
    const moved = offsetBy(site, metres, 37);
    const measured = distanceMeters(site, moved);
    // Haversine on a sphere against our own projection: 2% is ample.
    const ok = Math.abs(measured - metres) <= Math.max(2, metres * 0.02);
    ck(ok, `a ${metres} m offset measures ${measured} m`);
  }

  // Symmetry, and a known real-world leg as a sanity anchor.
  const a = { latitude: 12.9716, longitude: 77.5946 };
  const b = { latitude: 13.0827, longitude: 80.2707 };
  ck(distanceMeters(a, b) === distanceMeters(b, a), "distance is symmetric");
  const km = distanceMeters(a, b) / 1000;
  ck(km > 280 && km < 300, `Bengaluru to Chennai measures ${Math.round(km)} km`);
}

console.log("\nRadius configuration is bounded");
{
  ck(clampRadius(10) === MIN_GEOFENCE_RADIUS_M, "a too-small radius is raised to the floor");
  ck(clampRadius(99999) === MAX_GEOFENCE_RADIUS_M, "a too-large radius is capped");
  ck(clampRadius(Number.NaN) === DEFAULT_GEOFENCE_RADIUS_M, "a nonsense radius falls back to the default");
  ck(clampRadius(300) === 300, "a sensible radius is left alone");
}

console.log("\nGeofence verdicts");
{
  const site = { latitude: 12.9716, longitude: 77.5946 };
  const inside = offsetBy(site, 100, 90);
  const outside = offsetBy(site, 900, 90);

  const near = evaluateGeofence({ worker: inside, site, radiusM: 250, policy: "enforce" });
  ck(near.withinRadius && near.allowed, "100 m inside a 250 m fence is allowed");

  const far = evaluateGeofence({ worker: outside, site, radiusM: 250, policy: "enforce" });
  ck(!far.withinRadius && !far.allowed, "900 m outside a 250 m fence is refused under enforce");

  const flagged = evaluateGeofence({ worker: outside, site, radiusM: 250, policy: "flag" });
  ck(!flagged.withinRadius && flagged.allowed, "the same punch is allowed-but-flagged under flag");

  // A hostile accuracy claim must not widen the fence.
  const liar = evaluateGeofence({
    worker: outside,
    site,
    radiusM: 250,
    accuracyM: 10_000_000,
    policy: "enforce",
  });
  ck(!liar.allowed, "a 10,000 km accuracy claim does not buy entry");
  ck(liar.graceAppliedM <= 150, `accuracy grace stays bounded (${liar.graceAppliedM} m)`);
}

// ---------------------------------------------------------------------------
// 2. The server actions, against real rows.
// ---------------------------------------------------------------------------
const RADIUS = 200;
const SITE = { latitude: 12.9611, longitude: 77.6387 };

const worker = await prisma.workerProfile.findFirst({
  where: { user: { phone: "9800000001" } },
  include: { user: true },
});
const other = await prisma.workerProfile.findFirst({
  where: { user: { phone: "9800000002" } },
  include: { user: true },
});
const employer = await prisma.employerProfile.findFirst({ include: { user: true } });
if (!worker || !other || !employer) throw new Error("seed data missing - run npm run setup");

const job = await prisma.job.create({
  data: {
    employerProfileId: employer.id,
    title: "GPS test site (temporary)",
    description: "Created by verify-gps-attendance and deleted at the end.",
    category: "Construction",
    addressLine: "Test site",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    latitude: SITE.latitude,
    longitude: SITE.longitude,
    checkInRadiusMeters: RADIUS,
    wageType: "HOURLY",
    wageRatePaise: 12000,
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 86_400_000),
    shiftStart: "09:00",
    shiftEnd: "18:00",
    expectedHoursPerDay: 8,
    workersRequired: 2,
    status: "OPEN",
  },
});

const assignment = await prisma.jobAssignment.create({
  data: {
    jobId: job.id,
    workerProfileId: worker.id,
    status: "ACTIVE",
    agreedWageType: "HOURLY",
    agreedWageRatePaise: 12000,
    expectedHoursPerDay: 8,
    startDate: job.startDate,
    endDate: job.endDate,
  },
});

/** The action reads its inputs from FormData, so drive it the same way. */
function punch(assignmentId: string, at: { latitude: number; longitude: number }, accuracy = 15) {
  const fd = new FormData();
  fd.set("assignmentId", assignmentId);
  fd.set("latitude", String(at.latitude));
  fd.set("longitude", String(at.longitude));
  fd.set("accuracy", String(accuracy));
  fd.set("source", "GPS");
  return fd;
}

const actor = { workerProfileId: worker.id, userId: worker.user.id };

const checkInAction = (fd: FormData) => performCheckIn(actor, fd);
const checkOutAction = (fd: FormData) => performCheckOut(actor, fd);

const todayUtc = new Date();
const workDate = new Date(
  Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate()),
);

try {
  console.log("\nWorker outside the geofence is refused");
  {
    const far = offsetBy(SITE, RADIUS * 5, 20);
    const res = await checkInAction(punch(assignment.id, far));
    ck(!res.ok, `check-in refused (${res.message.slice(0, 62)}…)`);
    ck(/outside/i.test(res.message), "the message says they are outside the area");

    const rows = await prisma.attendance.count({ where: { assignmentId: assignment.id } });
    ck(rows === 0, "no attendance row was written for the refused punch");
  }

  console.log("\nCheck-in without an assignment is refused");
  {
    const res = await checkInAction(punch("clnonexistentassignment000", SITE));
    ck(!res.ok, `refused (${res.message})`);
  }

  console.log("\nCheck-in on another worker's assignment is refused");
  {
    const theirs = await prisma.jobAssignment.create({
      data: {
        jobId: job.id,
        workerProfileId: other.id,
        status: "ACTIVE",
        agreedWageType: "HOURLY",
        agreedWageRatePaise: 12000,
        expectedHoursPerDay: 8,
        startDate: job.startDate,
        endDate: job.endDate,
      },
    });
    // The action authenticates as worker 9800000001, so this assignment is
    // somebody else's even though the coordinates are perfect.
    const res = await checkInAction(punch(theirs.id, SITE));
    ck(!res.ok, `refused (${res.message})`);
    ck(/not yours/i.test(res.message), "the message says the assignment is not theirs");
    await prisma.jobAssignment.delete({ where: { id: theirs.id } });
  }

  console.log("\nCheck-out before any check-in is refused");
  {
    const res = await checkOutAction(punch(assignment.id, SITE));
    ck(!res.ok, `refused (${res.message})`);
    ck(/check in/i.test(res.message), "the message tells them to check in first");
  }

  console.log("\nWorker inside the geofence may check in");
  {
    const near = offsetBy(SITE, Math.round(RADIUS / 3), 200);
    const res = await checkInAction(punch(assignment.id, near));
    ck(res.ok, `check-in accepted (${res.message.slice(0, 58)}…)`);

    const row = await prisma.attendance.findUnique({
      where: { assignmentId_workDate: { assignmentId: assignment.id, workDate } },
    });
    ck(!!row, "an attendance row now exists");
    ck(row?.checkInWithinRadius === true, "it is recorded as within the radius");
    ck(
      typeof row?.checkInDistanceM === "number" && row.checkInDistanceM <= RADIUS,
      `the stored distance is server-computed (${row?.checkInDistanceM} m)`,
    );
    ck(row?.checkInLatitude !== null && row?.checkInLongitude !== null, "coordinates were stored");
    ck(row?.checkOutTime === null, "check-out is still open");
  }

  console.log("\nDuplicate check-in is refused");
  {
    const res = await checkInAction(punch(assignment.id, SITE));
    ck(!res.ok, `refused (${res.message})`);
    ck(/already checked in/i.test(res.message), "the message says they already checked in");
    const rows = await prisma.attendance.count({ where: { assignmentId: assignment.id } });
    ck(rows === 1, "still exactly one attendance row");
  }

  console.log("\nA client-supplied distance is ignored");
  {
    // The action's schema has no distance field at all, so a forged one cannot
    // be read. Prove it by sending one alongside far-away coordinates: if it
    // were trusted the punch would pass, and it must not.
    const far = offsetBy(SITE, RADIUS * 8, 300);
    const fd = punch(assignment.id, far);
    fd.set("distance", "0");
    fd.set("distanceM", "0");
    fd.set("checkOutDistanceM", "0");
    fd.set("withinRadius", "true");
    const res = await checkOutAction(fd);
    ck(!res.ok, "a forged distance of 0 m does not let a far-away check-out through");
    ck(/outside/i.test(res.message), "it is refused on the server's own measurement");
  }

  console.log("\nCheck-out inside the geofence succeeds, and wages follow");
  {
    // Backdate the check-in so the shift has measurable length.
    await prisma.attendance.update({
      where: { assignmentId_workDate: { assignmentId: assignment.id, workDate } },
      data: { checkInTime: new Date(Date.now() - 4 * 3_600_000) },
    });

    const near = offsetBy(SITE, 40, 120);
    const res = await checkOutAction(punch(assignment.id, near));
    ck(res.ok, `check-out accepted (${res.message.slice(0, 58)}…)`);

    const row = await prisma.attendance.findUnique({
      where: { assignmentId_workDate: { assignmentId: assignment.id, workDate } },
      include: { payment: true },
    });
    ck(row?.checkOutTime !== null, "check-out time was stored");
    ck(row?.checkOutWithinRadius === true, "check-out is recorded as within the radius");
    ck(typeof row?.checkOutDistanceM === "number", `check-out distance stored (${row?.checkOutDistanceM} m)`);
    ck((row?.workingMinutes ?? 0) > 200, `verified minutes computed (${row?.workingMinutes})`);

    // The wage engine must still produce the same answer it always did.
    ck(!!row?.payment, "a payment was created from the verified hours");
    const minutes = row?.workingMinutes ?? 0;
    const expected = calculateWage({
      wageType: "HOURLY",
      rateAppliedPaise: 12000,
      verifiedMinutes: minutes,
      expectedHoursPerDay: 8,
    });
    ck(
      row?.payment?.netAmountPaise === expected.netAmountPaise,
      `payment ${row?.payment?.netAmountPaise} matches the wage engine's ${expected.netAmountPaise}`,
    );
    ck(row?.payment?.verifiedMinutes === minutes, "the payment bills exactly the verified minutes");
  }

  console.log("\nDuplicate check-out is refused");
  {
    const res = await checkOutAction(punch(assignment.id, SITE));
    ck(!res.ok, `refused (${res.message})`);
    ck(/already checked out/i.test(res.message), "the message says they already checked out");
  }

  console.log("\nMalformed coordinates are refused by validation");
  {
    for (const [lat, lng, label] of [
      ["91", "77", "latitude above 90"],
      ["12", "181", "longitude above 180"],
      ["not-a-number", "77", "non-numeric latitude"],
      ["", "", "empty coordinates"],
    ] as [string, string, string][]) {
      const fd = new FormData();
      fd.set("assignmentId", assignment.id);
      fd.set("latitude", lat);
      fd.set("longitude", lng);
      fd.set("source", "GPS");
      const res = await checkInAction(fd);
      ck(!res.ok, `${label} refused`);
    }
  }
} finally {
  // Tear down in dependency order so the seeded data is untouched.
  const rows = await prisma.attendance.findMany({
    where: { assignmentId: assignment.id },
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
  await prisma.payment.deleteMany({ where: { assignmentId: assignment.id } });
  await prisma.notification.deleteMany({ where: { params: { contains: job.title } } });
  await prisma.fraudAlert.deleteMany({ where: { jobId: job.id } });
  await prisma.jobAssignment.deleteMany({ where: { jobId: job.id } });
  await prisma.jobApplication.deleteMany({ where: { jobId: job.id } });
  await prisma.job.delete({ where: { id: job.id } });
  await prisma.$disconnect();
  console.log("\n  scratch job and attendance removed; seeded data untouched");
}

console.log(`\n${checks} assertions, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
