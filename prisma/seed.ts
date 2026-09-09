import "dotenv/config";
import type {
  EmployerProfile,
  Job,
  JobSkill,
  Skill,
  User,
  WorkerProfile,
} from "@prisma/client";
// The one client, so the seed can never write to a different file than the app
// reads from. That drift is exactly what produced two databases before.
import { prisma } from "../src/lib/db";
import { hashSync } from "bcryptjs";
import { distanceMeters, offsetBy } from "../src/lib/geo";
import { assessAttendanceRisk, renderRiskDetail, renderRiskTitle } from "../src/lib/risk";
import { calculateWage } from "../src/lib/wages";
import { computeMatch, type MatchJob } from "../src/lib/matching";
import { rupeesToPaise } from "../src/lib/money";
import { TRUST_THRESHOLDS } from "../src/lib/skill-trust";

const PASSWORD_HASH = hashSync("lybor123", 10);

const BENGALURU = { latitude: 12.9716, longitude: 77.5946 };

/** Small deterministic offsets so demo workers are not all at one pin. */
function near(base: { latitude: number; longitude: number }, meters: number, bearing: number) {
  return offsetBy(base, meters, bearing);
}

function dateOnly(offsetDays: number): Date {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * A real instant that renders as the given IST wall-clock time.
 *
 * The app displays every punch in IST, so a 09:00 shift must be seeded as the
 * UTC instant behind 09:00 IST. Writing 09:00 UTC here would show up as a
 * 2:30 pm check-in against a 09:00 roster, which reads as a bug.
 */
function atIst(workDate: Date, hour: number, minute = 0): Date {
  const d = new Date(workDate);
  d.setUTCHours(hour, minute, 0, 0);
  return new Date(d.getTime() - IST_OFFSET_MINUTES * 60_000);
}

type SeededWorker = { user: User; profile: WorkerProfile };
type SeededEmployer = { user: User; profile: EmployerProfile };
type SeededJob = Job & { requiredSkills: (JobSkill & { skill: Skill })[] };

const SKILLS = [
  { code: "MASONRY", nameEn: "Masonry", nameHi: "राजमिस्त्री", category: "Construction" },
  { code: "CARPENTRY", nameEn: "Carpentry", nameHi: "बढ़ईगीरी", category: "Construction" },
  { code: "PLUMBING", nameEn: "Plumbing", nameHi: "नलसाजी", category: "Construction" },
  { code: "ELECTRICAL", nameEn: "Electrical", nameHi: "बिजली का काम", category: "Construction" },
  { code: "PAINTING", nameEn: "Painting", nameHi: "पुताई", category: "Construction" },
  { code: "WELDING", nameEn: "Welding", nameHi: "वेल्डिंग", category: "Manufacturing" },
  { code: "LOADING", nameEn: "Loading and unloading", nameHi: "लदान-उतराई", category: "Warehouse" },
  { code: "FORKLIFT", nameEn: "Forklift operation", nameHi: "फोर्कलिफ्ट चालन", category: "Warehouse" },
  { code: "PACKAGING", nameEn: "Packaging", nameHi: "पैकेजिंग", category: "Warehouse" },
  { code: "HOUSEKEEPING", nameEn: "Housekeeping", nameHi: "साफ-सफाई", category: "Housekeeping" },
  { code: "SECURITY", nameEn: "Security guarding", nameHi: "सुरक्षा गार्ड", category: "Security" },
  { code: "DRIVING", nameEn: "Driving", nameHi: "ड्राइविंग", category: "Delivery" },
  { code: "COOKING", nameEn: "Cooking", nameHi: "खाना बनाना", category: "Hospitality" },
  { code: "GARDENING", nameEn: "Gardening", nameHi: "बागवानी", category: "Housekeeping" },
];

async function reset() {
  // Order matters: children before parents, so foreign keys stay satisfied.
  await prisma.paymentLedgerEntry.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.fraudAlert.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.workHistory.deleteMany();
  await prisma.jobAssignment.deleteMany();
  await prisma.jobApplication.deleteMany();
  await prisma.jobSkill.deleteMany();
  await prisma.job.deleteMany();
  await prisma.skillAssessment.deleteMany();
  await prisma.workerSkill.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.kYCRecord.deleteMany();
  await prisma.workerProfile.deleteMany();
  await prisma.employerProfile.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("Resetting existing data...");
  await reset();

  console.log("Seeding skills...");
  await prisma.skill.createMany({ data: SKILLS });
  const skills = await prisma.skill.findMany();
  const skillByCode = new Map(skills.map((s) => [s.code, s]));
  const skillId = (code: string) => {
    const skill = skillByCode.get(code);
    if (!skill) throw new Error(`Unknown skill code ${code}`);
    return skill.id;
  };

  console.log("Seeding users...");
  await prisma.user.create({
    data: {
      phone: "9800000099",
      email: "admin@lybor.example",
      passwordHash: PASSWORD_HASH,
      role: "ADMIN",
      fullName: "Platform Admin",
    },
  });

  const workerSpecs = [
    {
      phone: "9800000001",
      fullName: "Ramesh Kumar",
      language: "hi" as const,
      city: "Bengaluru",
      offset: { meters: 2200, bearing: 30 },
      experienceYears: 8,
      travelRadiusKm: 20,
      minWage: 140,
      kyc: "VERIFIED" as const,
      skills: ["MASONRY", "CARPENTRY", "PAINTING"],
      // Masonry: a strong pass plus a real body of rated work, which is what
      // EXPERT costs. Carpentry: a bare pass and fewer jobs, so VERIFIED. His
      // self-declared PAINTING level has no check available at all, so it
      // stays a claim - three different answers on one profile.
      skillChecks: [
        { code: "MASONRY", percent: 100 },
        { code: "CARPENTRY", percent: 60 },
      ],
      bio: "Eight years on residential sites. Comfortable leading a small crew.",
    },
    {
      phone: "9800000002",
      fullName: "Sunita Devi",
      language: "hi" as const,
      city: "Bengaluru",
      offset: { meters: 4100, bearing: 120 },
      experienceYears: 4,
      travelRadiusKm: 12,
      minWage: 110,
      kyc: "VERIFIED" as const,
      skills: ["HOUSEKEEPING", "PACKAGING"],
      // Neither trade has a check yet - deliberately left as the case where
      // no assessment exists, which must read as unproven rather than broken.
      skillChecks: [],
      bio: "Reliable housekeeping and packing work. Prefers day shifts.",
    },
    {
      phone: "9800000003",
      fullName: "Imran Sheikh",
      language: "en" as const,
      city: "Bengaluru",
      offset: { meters: 7300, bearing: 210 },
      experienceYears: 6,
      travelRadiusKm: 25,
      minWage: 160,
      kyc: "PENDING" as const,
      skills: ["WELDING", "ELECTRICAL", "PLUMBING"],
      // A clear pass on electrical with no completed electrical jobs yet: the
      // SKILLED rung, which is the whole reason that rung exists. Plumbing was
      // attempted and failed, which the profile shows rather than hides.
      skillChecks: [
        { code: "ELECTRICAL", percent: 80 },
        { code: "PLUMBING", percent: 40 },
      ],
      bio: "Certified welder, also handles basic site wiring.",
    },
    {
      phone: "9800000004",
      fullName: "Lakshmi Narayan",
      language: "en" as const,
      city: "Bengaluru",
      offset: { meters: 12500, bearing: 300 },
      experienceYears: 2,
      travelRadiusKm: 10,
      minWage: 100,
      kyc: "NOT_SUBMITTED" as const,
      skills: ["LOADING", "PACKAGING"],
      skillChecks: [],
      bio: "Warehouse loader, quick learner, available at short notice.",
    },
    {
      phone: "9800000005",
      fullName: "Vijay Patil",
      language: "hi" as const,
      city: "Bengaluru",
      offset: { meters: 5600, bearing: 75 },
      experienceYears: 11,
      travelRadiusKm: 30,
      minWage: 175,
      kyc: "VERIFIED" as const,
      skills: ["FORKLIFT", "LOADING", "DRIVING"],
      skillChecks: [],
      bio: "Licensed forklift operator with warehouse and logistics experience.",
    },
    {
      phone: "9800000006",
      fullName: "Anita Sharma",
      language: "hi" as const,
      city: "Bengaluru",
      offset: { meters: 3200, bearing: 250 },
      experienceYears: 3,
      travelRadiusKm: 15,
      minWage: 120,
      kyc: "PENDING" as const,
      skills: ["COOKING", "HOUSEKEEPING"],
      skillChecks: [],
      bio: "Cooking and housekeeping for canteens and guest houses.",
    },
  ];

  const workers: SeededWorker[] = [];
  for (const spec of workerSpecs) {
    const coords = near(BENGALURU, spec.offset.meters, spec.offset.bearing);
    const user = await prisma.user.create({
      data: {
        phone: spec.phone,
        passwordHash: PASSWORD_HASH,
        role: "WORKER",
        fullName: spec.fullName,
        preferredLanguage: spec.language,
        workerProfile: {
          create: {
            bio: spec.bio,
            addressLine: `${spec.city} ward`,
            city: spec.city,
            state: "Karnataka",
            pincode: "560001",
            latitude: coords.latitude,
            longitude: coords.longitude,
            travelRadiusKm: spec.travelRadiusKm,
            experienceYears: spec.experienceYears,
            preferredWageType: "HOURLY",
            preferredWageMinPaise: rupeesToPaise(spec.minWage),
            kycStatus: spec.kyc,
            skills: {
              create: spec.skills.map((code, index) => ({
                skillId: skillId(code),
                proficiency:
                  index === 0 ? "EXPERT" : index === 1 ? "INTERMEDIATE" : "BEGINNER",
                yearsExperience: Math.max(1, spec.experienceYears - index * 2),
              })),
            },
          },
        },
      },
      include: { workerProfile: true },
    });

    // Skill-check results. The pass mark lives in one place - importing it
    // here rather than restating 60 keeps the seed honest if it ever moves.
    for (const check of spec.skillChecks) {
      const questionCount = 5;
      const correctCount = Math.round((check.percent / 100) * questionCount);
      await prisma.skillAssessment.create({
        data: {
          workerProfileId: user.workerProfile!.id,
          skillId: skillId(check.code),
          scorePercent: check.percent,
          correctCount,
          questionCount,
          passed: check.percent >= TRUST_THRESHOLDS.assessmentPassPercent,
        },
      });
    }

    if (spec.kyc !== "NOT_SUBMITTED") {
      await prisma.kYCRecord.create({
        data: {
          userId: user.id,
          docType: "AADHAAR",
          holderName: spec.fullName,
          docNumberMasked: `********${spec.phone.slice(-4)}`,
          docNumberHash: `seed-${spec.phone}`,
          status: spec.kyc,
          reviewedAt: spec.kyc === "VERIFIED" ? new Date() : null,
        },
      });
    }

    workers.push({ user, profile: user.workerProfile! });
  }

  const employerSpecs = [
    {
      phone: "9800000010",
      fullName: "Deepak Rao",
      companyName: "BuildRight Constructions",
      companyType: "Construction",
      offset: { meters: 1800, bearing: 45 },
      verified: true,
    },
    {
      phone: "9800000011",
      fullName: "Priya Menon",
      companyName: "SwiftStore Logistics",
      companyType: "Warehouse",
      offset: { meters: 9000, bearing: 160 },
      verified: true,
    },
    {
      phone: "9800000012",
      fullName: "Arjun Nair",
      companyName: "GreenLeaf Facilities",
      companyType: "Facility management",
      offset: { meters: 4800, bearing: 280 },
      verified: false,
    },
  ];

  const employers: SeededEmployer[] = [];
  for (const spec of employerSpecs) {
    const coords = near(BENGALURU, spec.offset.meters, spec.offset.bearing);
    const user = await prisma.user.create({
      data: {
        phone: spec.phone,
        passwordHash: PASSWORD_HASH,
        role: "EMPLOYER",
        fullName: spec.fullName,
        employerProfile: {
          create: {
            companyName: spec.companyName,
            companyType: spec.companyType,
            contactPerson: spec.fullName,
            addressLine: `${spec.companyName} site office`,
            city: "Bengaluru",
            state: "Karnataka",
            pincode: "560001",
            latitude: coords.latitude,
            longitude: coords.longitude,
            kycStatus: spec.verified ? "VERIFIED" : "PENDING",
            isVerified: spec.verified,
          },
        },
      },
      include: { employerProfile: true },
    });
    employers.push({ user, profile: user.employerProfile! });
  }

  console.log("Seeding jobs...");
  const jobSpecs = [
    {
      employer: 0,
      title: "Mason and helper for apartment block",
      address: "Site 4, Palm Meadows Layout, Whitefield",
      description:
        "Brickwork and plastering on a four-floor residential build. Tools provided. Tea and lunch on site.",
      category: "Construction",
      skills: ["MASONRY", "PAINTING"],
      wageType: "DAILY" as const,
      rate: 950,
      radius: 200,
      offset: { meters: 2000, bearing: 40 },
      startOffset: -6,
      endOffset: 8,
      workersRequired: 2,
      shiftStart: "09:00",
      shiftEnd: "18:00",
    },
    {
      employer: 1,
      title: "Warehouse loading crew, night shift",
      address: "Gate 2, SwiftStore Hub, Bommasandra",
      description:
        "Loading and unloading of parcels for a distribution hub. Forklift certification is a plus.",
      category: "Warehouse",
      skills: ["LOADING", "FORKLIFT"],
      wageType: "SHIFT" as const,
      rate: 800,
      radius: 300,
      offset: { meters: 9100, bearing: 158 },
      startOffset: -3,
      endOffset: 10,
      workersRequired: 3,
      shiftStart: "20:00",
      shiftEnd: "04:00",
    },
    {
      employer: 2,
      title: "Housekeeping staff for tech campus",
      address: "Block C, Prestige Tech Park, Marathahalli",
      description:
        "Daily cleaning across two office blocks. Uniform and safety gear provided.",
      category: "Housekeeping",
      skills: ["HOUSEKEEPING"],
      wageType: "HOURLY" as const,
      rate: 130,
      radius: 250,
      offset: { meters: 4700, bearing: 278 },
      startOffset: 1,
      endOffset: 20,
      workersRequired: 4,
      shiftStart: "07:00",
      shiftEnd: "15:00",
    },
    {
      employer: 0,
      title: "Site electrician for wiring phase",
      address: "Tower B basement, MG Road commercial fit-out",
      description:
        "Conduit laying and wiring for a commercial fit-out. Must read basic layout drawings.",
      category: "Construction",
      skills: ["ELECTRICAL"],
      wageType: "DAILY" as const,
      rate: 1400,
      radius: 150,
      offset: { meters: 1700, bearing: 48 },
      startOffset: 2,
      endOffset: 12,
      workersRequired: 1,
      shiftStart: "09:00",
      shiftEnd: "17:00",
    },
    {
      employer: 1,
      title: "Packing associates for festive season",
      address: "Aisle 7, SwiftStore Hub, Bommasandra",
      description:
        "Boxing and labelling outbound orders. Standing work, six day week.",
      category: "Warehouse",
      skills: ["PACKAGING"],
      wageType: "HOURLY" as const,
      rate: 115,
      radius: 300,
      offset: { meters: 8800, bearing: 165 },
      startOffset: 0,
      endOffset: 25,
      workersRequired: 5,
      shiftStart: "10:00",
      shiftEnd: "19:00",
    },
    {
      employer: 0,
      title: "Plastering and painting crew, Whitefield site",
      address: "Block A, Whitefield residential phase 2",
      description:
        "Internal plastering and two-coat painting for a completed block. Scaffolding, tools and materials provided. Crew lead pay for experienced masons.",
      category: "Construction",
      skills: ["MASONRY", "PAINTING"],
      wageType: "DAILY" as const,
      rate: 1300,
      radius: 200,
      offset: { meters: 2400, bearing: 35 },
      startOffset: 2,
      endOffset: 16,
      workersRequired: 3,
      shiftStart: "09:00",
      shiftEnd: "18:00",
    },
    {
      employer: 2,
      title: "Canteen cook for corporate kitchen",
      address: "Ground floor canteen, Embassy Business Park",
      description:
        "South Indian breakfast and lunch for around 120 people. One helper provided.",
      category: "Hospitality",
      skills: ["COOKING"],
      wageType: "DAILY" as const,
      rate: 1100,
      radius: 200,
      offset: { meters: 4900, bearing: 285 },
      startOffset: 3,
      endOffset: 30,
      workersRequired: 1,
      shiftStart: "06:00",
      shiftEnd: "15:00",
    },
  ];

  const jobs: SeededJob[] = [];
  for (const spec of jobSpecs) {
    const employer = employers[spec.employer];
    const coords = near(BENGALURU, spec.offset.meters, spec.offset.bearing);
    const job = await prisma.job.create({
      data: {
        employerProfileId: employer.profile.id,
        title: spec.title,
        description: spec.description,
        category: spec.category,
        addressLine: spec.address,
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        latitude: coords.latitude,
        longitude: coords.longitude,
        checkInRadiusMeters: spec.radius,
        wageType: spec.wageType,
        wageRatePaise: rupeesToPaise(spec.rate),
        startDate: dateOnly(spec.startOffset),
        endDate: dateOnly(spec.endOffset),
        shiftStart: spec.shiftStart,
        shiftEnd: spec.shiftEnd,
        expectedHoursPerDay: 8,
        workersRequired: spec.workersRequired,
        status: "OPEN",
        requiredSkills: {
          create: spec.skills.map((code, index) => ({
            skillId: skillId(code),
            isMandatory: index === 0,
          })),
        },
      },
      include: { requiredSkills: { include: { skill: true } } },
    });
    jobs.push(job);
    await prisma.employerProfile.update({
      where: { id: employer.profile.id },
      data: { totalJobsPosted: { increment: 1 } },
    });
  }

  console.log("Seeding applications...");
  async function apply(jobIndex: number, workerIndex: number, note: string) {
    const job = jobs[jobIndex];
    const worker = workers[workerIndex];
    const workerSkills = await prisma.workerSkill.findMany({
      where: { workerProfileId: worker.profile.id },
      include: { skill: true },
    });
    const matchJob: MatchJob = {
      latitude: job.latitude,
      longitude: job.longitude,
      wageType: job.wageType,
      wageRatePaise: job.wageRatePaise,
      expectedHoursPerDay: job.expectedHoursPerDay,
      requiredSkills: job.requiredSkills.map((s) => ({
        skillId: s.skillId,
        nameEn: s.skill.nameEn,
        isMandatory: s.isMandatory,
      })),
    };
    const match = computeMatch(
      {
        latitude: worker.profile.latitude,
        longitude: worker.profile.longitude,
        travelRadiusKm: worker.profile.travelRadiusKm,
        availability: worker.profile.availability,
        experienceYears: worker.profile.experienceYears,
        reliabilityScore: worker.profile.reliabilityScore,
        preferredWageMinPaise: worker.profile.preferredWageMinPaise,
        skills: workerSkills.map((s) => ({
          skillId: s.skillId,
          nameEn: s.skill.nameEn,
          proficiency: s.proficiency,
        })),
      },
      matchJob,
    );
    return prisma.jobApplication.create({
      data: {
        jobId: job.id,
        workerProfileId: worker.profile.id,
        coverNote: note,
        matchScore: match.score,
        matchFactors: JSON.stringify(match.factors),
      },
    });
  }

  const app0 = await apply(0, 0, "I have done plastering on similar apartment builds.");
  await apply(0, 5, "Available from Monday, can start immediately.");
  const app1 = await apply(1, 4, "Certified forklift operator, night shifts are fine.");
  await apply(1, 3, "I can join the loading crew from tomorrow.");
  await apply(2, 1, "I have three years of office housekeeping experience.");
  await apply(3, 2, "Welding and site wiring both, licence available.");
  await apply(4, 3, "Looking for steady packing work this season.");

  console.log("Seeding assignments and attendance...");

  /** Turns an accepted application into a full worked history. */
  async function assignAndWork(
    applicationId: string,
    jobIndex: number,
    workerIndex: number,
    days: { offset: number; outsideRadius?: boolean; short?: boolean; approve?: boolean }[],
  ) {
    const job = jobs[jobIndex];
    const worker = workers[workerIndex];
    const employer = employers[jobSpecs[jobIndex].employer];

    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    const assignment = await prisma.jobAssignment.create({
      data: {
        jobId: job.id,
        workerProfileId: worker.profile.id,
        applicationId,
        status: "ACTIVE",
        agreedWageType: job.wageType,
        agreedWageRatePaise: job.wageRatePaise,
        expectedHoursPerDay: job.expectedHoursPerDay,
        startDate: job.startDate,
        endDate: job.endDate,
      },
    });

    await prisma.job.update({
      where: { id: job.id },
      data: { workersAssigned: { increment: 1 } },
    });
    await prisma.workerProfile.update({
      where: { id: worker.profile.id },
      data: { availability: "BUSY" },
    });
    await prisma.employerProfile.update({
      where: { id: employer.profile.id },
      data: { totalWorkersHired: { increment: 1 } },
    });

    for (const day of days) {
      const workDate = dateOnly(day.offset);
      const site = { latitude: job.latitude, longitude: job.longitude };
      const punch = day.outsideRadius
        ? offsetBy(site, job.checkInRadiusMeters * 5, 90)
        : offsetBy(site, 30, 15);
      const distance = distanceMeters(punch, site);
      const withinRadius = distance <= job.checkInRadiusMeters;

      const checkIn = atIst(workDate, 9, day.short ? 55 : 5);
      const workedMinutes = day.short ? 190 : 505;
      const checkOut = new Date(checkIn.getTime() + workedMinutes * 60_000);

      const risk = assessAttendanceRisk({
        checkInDistanceM: distance,
        checkInWithinRadius: withinRadius,
        checkInAccuracyM: 15,
        checkInSource: "GPS",
        checkOutDistanceM: distance,
        checkOutWithinRadius: withinRadius,
        checkOutAccuracyM: 18,
        checkOutSource: "GPS",
        workingMinutes: workedMinutes,
        expectedHoursPerDay: job.expectedHoursPerDay,
        lateByMinutes: day.short ? 55 : 5,
        earlyByMinutes: day.short ? 260 : 0,
        radiusMeters: job.checkInRadiusMeters,
      });

      const breakdown = calculateWage({
        wageType: job.wageType,
        rateAppliedPaise: job.wageRatePaise,
        verifiedMinutes: workedMinutes,
        expectedHoursPerDay: job.expectedHoursPerDay,
      });

      const approved = day.approve !== false;

      const attendance = await prisma.attendance.create({
        data: {
          assignmentId: assignment.id,
          workDate,
          checkInTime: checkIn,
          checkInLatitude: punch.latitude,
          checkInLongitude: punch.longitude,
          checkInAccuracyM: 15,
          checkInDistanceM: distance,
          checkInWithinRadius: withinRadius,
          checkInSource: "GPS",
          checkOutTime: checkOut,
          checkOutLatitude: punch.latitude,
          checkOutLongitude: punch.longitude,
          checkOutAccuracyM: 18,
          checkOutDistanceM: distance,
          checkOutWithinRadius: withinRadius,
          checkOutSource: "GPS",
          workingMinutes: workedMinutes,
          verificationStatus: approved ? "VERIFIED" : risk.verification,
          riskScore: risk.score,
          riskFlags: JSON.stringify(risk.flags),
          approvalStatus: approved ? "APPROVED" : "PENDING",
          approvedAt: approved ? new Date() : null,
          approvedByUserId: approved ? employer.user.id : null,
        },
      });

      const payment = await prisma.payment.create({
        data: {
          assignmentId: assignment.id,
          attendanceId: attendance.id,
          wageType: breakdown.wageType,
          rateAppliedPaise: breakdown.rateAppliedPaise,
          verifiedMinutes: breakdown.verifiedMinutes,
          billableUnits: breakdown.billableUnits,
          unitLabel: breakdown.unitLabel,
          grossAmountPaise: breakdown.grossAmountPaise,
          deductionsPaise: breakdown.deductionsPaise,
          netAmountPaise: breakdown.netAmountPaise,
          calculationBreakdown: JSON.stringify(breakdown),
          status: approved ? (day.offset < -1 ? "PAID" : "APPROVED") : "PENDING",
          approvedAt: approved ? new Date() : null,
          paidAt: approved && day.offset < -1 ? new Date() : null,
          paymentMethod: approved && day.offset < -1 ? "LEDGER_MOCK" : null,
          paymentReference:
            approved && day.offset < -1
              ? `MOCK-${attendance.id.slice(-6).toUpperCase()}`
              : null,
        },
      });

      await prisma.paymentLedgerEntry.create({
        data: {
          paymentId: payment.id,
          entryType: "ACCRUAL",
          amountPaise: breakdown.netAmountPaise,
          fromParty: "EMPLOYER",
          toParty: "ESCROW",
          metadata: JSON.stringify({ reason: "Hours verified at check-out." }),
        },
      });
      if (approved) {
        await prisma.paymentLedgerEntry.create({
          data: {
            paymentId: payment.id,
            entryType: "APPROVAL",
            amountPaise: breakdown.netAmountPaise,
            fromParty: "ESCROW",
            toParty: "ESCROW",
            metadata: JSON.stringify({ reason: "Employer approved the hours." }),
          },
        });
      }
      if (payment.status === "PAID") {
        await prisma.paymentLedgerEntry.create({
          data: {
            paymentId: payment.id,
            entryType: "PAYOUT",
            amountPaise: breakdown.netAmountPaise,
            fromParty: "ESCROW",
            toParty: "WORKER",
            provider: "MOCK_LEDGER",
            providerRef: payment.paymentReference,
            status: "SETTLED",
            metadata: JSON.stringify({ reason: "Wage released to the worker." }),
          },
        });
        await prisma.workerProfile.update({
          where: { id: worker.profile.id },
          data: {
            totalEarningsPaise: { increment: breakdown.netAmountPaise },
            totalMinutesWorked: { increment: workedMinutes },
          },
        });
        await prisma.employerProfile.update({
          where: { id: employer.profile.id },
          data: { totalPaidPaise: { increment: breakdown.netAmountPaise } },
        });
      }

      // Material risk flags become an admin fraud case, exactly as the live
      // check-out path does.
      for (const flag of risk.flags.filter((f) => f.severity !== "LOW")) {
        await prisma.fraudAlert.create({
          data: {
            ruleCode: flag.code,
            severity: flag.severity,
            workerProfileId: worker.profile.id,
            attendanceId: attendance.id,
            jobId: job.id,
            title: renderRiskTitle(flag, "en"),
            description: renderRiskDetail(flag, "en"),
            evidence: JSON.stringify({ attendanceId: attendance.id, rule: flag.code }),
          },
        });
      }
    }

    return assignment;
  }

  const assignment0 = await assignAndWork(app0.id, 0, 0, [
    { offset: -7 },
    { offset: -6 },
    { offset: -5 },
    { offset: -4 },
    { offset: -3 },
    // One out-of-radius day and one short day, both left pending: these are the
    // two the employer reviews live during a demo.
    { offset: -2, outsideRadius: true, approve: false },
    { offset: -1, short: true, approve: false },
  ]);

  await assignAndWork(app1.id, 1, 4, [
    { offset: -2 },
    { offset: -1 },
  ]);

  // Approved but not yet released, so the employer demo has a payment to pay.
  const readyToPay = await prisma.payment.findFirst({
    where: {
      assignmentId: assignment0.id,
      status: "PAID",
      attendance: { approvalStatus: "APPROVED" },
    },
    orderBy: { createdAt: "desc" },
  });
  if (readyToPay) {
    await prisma.payment.update({
      where: { id: readyToPay.id },
      data: {
        status: "APPROVED",
        paidAt: null,
        paymentMethod: null,
        paymentReference: null,
      },
    });
    await prisma.paymentLedgerEntry.deleteMany({
      where: { paymentId: readyToPay.id, entryType: "PAYOUT" },
    });
    await prisma.workerProfile.update({
      where: { id: workers[0].profile.id },
      data: {
        totalEarningsPaise: { decrement: readyToPay.netAmountPaise },
        totalMinutesWorked: { decrement: readyToPay.verifiedMinutes },
      },
    });
    await prisma.employerProfile.update({
      where: { id: employers[0].profile.id },
      data: { totalPaidPaise: { decrement: readyToPay.netAmountPaise } },
    });
  }

  console.log("Seeding disputes...");
  const rejectedDay = await prisma.attendance.findFirst({
    where: { assignmentId: assignment0.id, approvalStatus: "PENDING" },
    include: { payment: true },
  });
  if (rejectedDay) {
    await prisma.dispute.create({
      data: {
        raisedByUserId: workers[0].user.id,
        raisedByRole: "WORKER",
        jobId: jobs[0].id,
        assignmentId: assignment0.id,
        attendanceId: rejectedDay.id,
        paymentId: rejectedDay.payment?.id ?? null,
        category: "ATTENDANCE",
        reason: "GPS showed me outside the site although I was working",
        description:
          "The site gate is at the far corner of the plot and my phone kept losing signal. I worked the full day with the same crew.",
        evidenceNotes: "The supervisor Deepak was present and can confirm.",
        status: "OPEN",
      },
    });
    if (rejectedDay.payment) {
      await prisma.payment.update({
        where: { id: rejectedDay.payment.id },
        data: { status: "DISPUTED" },
      });
    }
  }

  console.log("Seeding a completed job and verified work history...");
  const historyJob = await prisma.job.create({
    data: {
      employerProfileId: employers[1].profile.id,
      title: "Inventory count support",
      description: "Two week stock count across three aisles.",
      category: "Warehouse",
      addressLine: "SwiftStore hub, aisle block C",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      latitude: BENGALURU.latitude,
      longitude: BENGALURU.longitude,
      checkInRadiusMeters: 250,
      wageType: "DAILY",
      wageRatePaise: rupeesToPaise(850),
      startDate: dateOnly(-40),
      endDate: dateOnly(-26),
      shiftStart: "09:00",
      shiftEnd: "18:00",
      expectedHoursPerDay: 8,
      workersRequired: 1,
      workersAssigned: 1,
      status: "COMPLETED",
    },
  });

  const historyAssignment = await prisma.jobAssignment.create({
    data: {
      jobId: historyJob.id,
      workerProfileId: workers[3].profile.id,
      status: "COMPLETED",
      agreedWageType: "DAILY",
      agreedWageRatePaise: rupeesToPaise(850),
      expectedHoursPerDay: 8,
      startDate: historyJob.startDate,
      endDate: historyJob.endDate,
      completedAt: dateOnly(-26),
    },
  });

  await prisma.workHistory.create({
    data: {
      workerProfileId: workers[3].profile.id,
      jobId: historyJob.id,
      assignmentId: historyAssignment.id,
      employerProfileId: employers[1].profile.id,
      jobTitle: historyJob.title,
      category: historyJob.category,
      employerName: employers[1].profile.companyName,
      skillsUsed: JSON.stringify(["Loading and unloading", "Packaging"]),
      startDate: historyJob.startDate,
      endDate: historyJob.endDate,
      totalVerifiedMinutes: 10 * 505,
      totalDaysWorked: 10,
      totalEarningsPaise: rupeesToPaise(8500),
      employerRating: 5,
      employerReview: "Punctual and accurate. Would hire again.",
      completionStatus: "COMPLETED",
    },
  });

  await prisma.workerProfile.update({
    where: { id: workers[3].profile.id },
    data: {
      totalJobsCompleted: 1,
      averageRating: 5,
      totalMinutesWorked: { increment: 10 * 505 },
      totalEarningsPaise: { increment: rupeesToPaise(8500) },
      availability: "AVAILABLE",
    },
  });

  // ---------------------------------------------------------------------
  // Trade work history, so the trust ladder has something to stand on.
  //
  // Without this every worker sits at SKILLED at best, and a judge opening the
  // app would see a four-level system demonstrating one level. Each entry
  // records the skill it used in `skillsUsed` by English name, which is how
  // src/lib/skill-evidence.ts counts verified jobs per skill.
  // ---------------------------------------------------------------------
  console.log("Seeding trade work history...");
  const tradeHistory = [
    // Masonry x5 with strong ratings: enough for EXPERT.
    { worker: 0, skill: "Masonry", title: "Boundary wall, Phase 2", days: 12, rating: 5, review: "Straight courses, no rework needed." },
    { worker: 0, skill: "Masonry", title: "Brickwork for two duplexes", days: 18, rating: 4, review: "Good work, occasionally needed chasing on cleanup." },
    { worker: 0, skill: "Masonry", title: "Plinth and column casing", days: 9, rating: 5, review: "Led a crew of three without supervision." },
    { worker: 0, skill: "Masonry", title: "Compound wall repair", days: 6, rating: 5, review: "Matched the existing bond exactly." },
    { worker: 0, skill: "Masonry", title: "Retaining wall, hill plot", days: 14, rating: 4, review: "Solid job on difficult ground." },
    // Carpentry x2: enough for VERIFIED, not for EXPERT.
    { worker: 0, skill: "Carpentry", title: "Door frames, eight units", days: 7, rating: 4, review: "Frames true and square." },
    { worker: 0, skill: "Carpentry", title: "Shuttering for first floor slab", days: 5, rating: 4, review: "Careful with levels." },
  ];

  let historyDayOffset = 300;
  for (const entry of tradeHistory) {
    const worker = workers[entry.worker];
    const employer = employers[0];
    historyDayOffset -= entry.days + 5;

    const start = dateOnly(-historyDayOffset - entry.days);
    const end = dateOnly(-historyDayOffset);
    const dailyPaise = rupeesToPaise(900);

    const job = await prisma.job.create({
      data: {
        employerProfileId: employer.profile.id,
        title: entry.title,
        description: `${entry.skill} work, completed and signed off.`,
        category: "Construction",
        addressLine: "Bengaluru site",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        latitude: BENGALURU.latitude,
        longitude: BENGALURU.longitude,
        checkInRadiusMeters: 250,
        wageType: "DAILY",
        wageRatePaise: dailyPaise,
        startDate: start,
        endDate: end,
        shiftStart: "09:00",
        shiftEnd: "18:00",
        expectedHoursPerDay: 8,
        workersRequired: 1,
        workersAssigned: 1,
        status: "COMPLETED",
      },
    });

    const assignment = await prisma.jobAssignment.create({
      data: {
        jobId: job.id,
        workerProfileId: worker.profile.id,
        status: "COMPLETED",
        agreedWageType: "DAILY",
        agreedWageRatePaise: dailyPaise,
        expectedHoursPerDay: 8,
        startDate: start,
        endDate: end,
        completedAt: end,
      },
    });

    await prisma.workHistory.create({
      data: {
        workerProfileId: worker.profile.id,
        jobId: job.id,
        assignmentId: assignment.id,
        employerProfileId: employer.profile.id,
        jobTitle: entry.title,
        category: "Construction",
        employerName: employer.profile.companyName,
        skillsUsed: JSON.stringify([entry.skill]),
        startDate: start,
        endDate: end,
        totalVerifiedMinutes: entry.days * 480,
        totalDaysWorked: entry.days,
        totalEarningsPaise: dailyPaise * entry.days,
        employerRating: entry.rating,
        employerReview: entry.review,
        completionStatus: "COMPLETED",
      },
    });

    await prisma.workerProfile.update({
      where: { id: worker.profile.id },
      data: {
        totalJobsCompleted: { increment: 1 },
        totalMinutesWorked: { increment: entry.days * 480 },
        totalEarningsPaise: { increment: dailyPaise * entry.days },
      },
    });
  }

  // Recomputed from the entries just written rather than hardcoded, so the
  // headline rating cannot drift from the reviews underneath it.
  for (const index of new Set(tradeHistory.map((e) => e.worker))) {
    const rated = await prisma.workHistory.findMany({
      where: { workerProfileId: workers[index].profile.id, employerRating: { not: null } },
      select: { employerRating: true },
    });
    const sum = rated.reduce((total, row) => total + (row.employerRating ?? 0), 0);
    await prisma.workerProfile.update({
      where: { id: workers[index].profile.id },
      data: { averageRating: rated.length === 0 ? 0 : sum / rated.length },
    });
  }

  console.log("Recomputing reliability scores...");
  const allWorkers = await prisma.workerProfile.findMany({ select: { id: true } });
  for (const worker of allWorkers) {
    const attendances = await prisma.attendance.findMany({
      where: { assignment: { workerProfileId: worker.id } },
      select: {
        approvalStatus: true,
        verificationStatus: true,
        workingMinutes: true,
      },
    });
    const completedJobs = await prisma.workHistory.count({
      where: { workerProfileId: worker.id, completionStatus: "COMPLETED" },
    });
    let score = 50;
    if (attendances.length > 0) {
      const withCheckOut = attendances.filter((a) => a.workingMinutes !== null).length;
      const approved = attendances.filter((a) => a.approvalStatus === "APPROVED").length;
      const clean = attendances.filter((a) => a.verificationStatus === "VERIFIED").length;
      score = Math.round(
        ((withCheckOut / attendances.length) * 0.3 +
          (approved / attendances.length) * 0.35 +
          (clean / attendances.length) * 0.25 +
          Math.min(1, completedJobs / 5) * 0.1) *
          100,
      );
    }
    await prisma.workerProfile.update({
      where: { id: worker.id },
      data: { reliabilityScore: score, reliabilityUpdatedAt: new Date() },
    });
  }

  console.log("Seeding notifications...");
  await prisma.notification.createMany({
    data: [
      {
        userId: workers[0].user.id,
        type: "ATTENDANCE_REJECTED",
        titleKey: "notification.ATTENDANCE_REJECTED.title",
        bodyKey: "notification.ATTENDANCE_REJECTED.body",
        params: JSON.stringify({
          job: jobs[0].title,
          employer: employers[0].profile.companyName,
          date: dateOnly(-2).toISOString().slice(0, 10),
        }),
        linkUrl: "/worker/earnings",
      },
      {
        userId: workers[0].user.id,
        type: "PAYMENT_PAID",
        titleKey: "notification.PAYMENT_PAID.title",
        bodyKey: "notification.PAYMENT_PAID.body",
        params: JSON.stringify({ amount: "₹950", job: jobs[0].title }),
        linkUrl: "/worker/earnings",
        isRead: true,
      },
      {
        userId: employers[0].user.id,
        type: "ATTENDANCE_FLAGGED",
        titleKey: "notification.ATTENDANCE_FLAGGED.title",
        bodyKey: "notification.ATTENDANCE_FLAGGED.body",
        params: JSON.stringify({
          job: jobs[0].title,
          date: dateOnly(-2).toISOString().slice(0, 10),
        }),
        linkUrl: "/employer/approvals",
      },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    skills: await prisma.skill.count(),
    jobs: await prisma.job.count(),
    applications: await prisma.jobApplication.count(),
    assignments: await prisma.jobAssignment.count(),
    attendance: await prisma.attendance.count(),
    payments: await prisma.payment.count(),
    ledgerEntries: await prisma.paymentLedgerEntry.count(),
    fraudAlerts: await prisma.fraudAlert.count(),
    disputes: await prisma.dispute.count(),
    workHistory: await prisma.workHistory.count(),
  };
  console.log("Seed complete:", counts);
  console.log("Sign in with 9800000001 (worker), 9800000010 (employer), 9800000099 (admin).");
  console.log("Password for every demo account: lybor123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
