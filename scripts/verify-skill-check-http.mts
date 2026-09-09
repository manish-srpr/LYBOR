/**
 * The skill check and the trust panel, as a browser actually receives them.
 *
 * The offline suite proves the ladder computes correctly. This one proves the
 * thing the offline suite cannot: that the answer key is genuinely absent from
 * the bytes sent to the handset, that the panel an employer receives really
 * does carry both columns, and that submitting the paper through the real
 * Server Action moves the level.
 *
 * The paper is submitted the no-JavaScript way, replaying the form exactly as
 * a cheap Android browser would, because that is the path most of these
 * workers are on.
 *
 * Requires the app to be running on :3000 against the seeded database.
 */
import "dotenv/config";
import { SignJWT } from "jose";
import { prisma } from "../src/lib/db";
import { LOCATION_COOKIE, LOCATION_GRANTED } from "../src/lib/location-session";
import { questionsFor } from "../src/lib/skill-questions";

const B = "http://localhost:3000";
const key = new TextEncoder().encode(process.env.JWT_SECRET);

let checks = 0;
let fails = 0;
const ck = (ok: boolean, msg: string) => {
  checks++;
  console.log(`    ${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) fails++;
};

function decode(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
}

async function cookieFor(phone: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
  const token = await new SignJWT({
    userId: user.id,
    role: user.role,
    fullName: user.fullName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + 86_400_000))
    .sign(key);
  // The location grant is included because the proxy blocks the app without
  // it - that gate is verified by its own suite, not re-litigated here.
  return `lybor_session=${token}; lybor_lang=en; ${LOCATION_COOKIE}=${LOCATION_GRANTED}`;
}

const workerCookie = await cookieFor("9800000001");
const imranCookie = await cookieFor("9800000003");
const employerCookie = await cookieFor("9800000010");

const get = (path: string, cookie: string) =>
  fetch(`${B}${path}`, { headers: { Cookie: cookie } }).then(async (r) => ({
    status: r.status,
    html: await r.text(),
  }));

console.log("The skill-check page serves questions and withholds the answers");
{
  // Requested by id rather than trusting the default. The page selects the
  // alphabetically first checkable skill, which for this worker is Carpentry,
  // so asserting masonry content on the default page tested the wrong paper.
  const masonrySkill = await prisma.skill.findUniqueOrThrow({ where: { code: "MASONRY" } });
  const page = await get(
    `/worker/profile/skill-check?skill=${masonrySkill.id}`,
    workerCookie,
  );
  ck(page.status === 200, `the page renders (${page.status})`);

  const masonry = questionsFor("MASONRY");
  ck(
    page.html.includes(masonry[0].prompt),
    "the first masonry question is present in the markup",
  );
  ck(
    masonry.every((q) => q.options.every((option) => page.html.includes(option))),
    "every option of every question is rendered",
  );

  // The point of the whole design: the marking scheme is not in the response.
  for (const question of masonry) {
    ck(
      !page.html.includes(question.why),
      `${question.id}: the explanation is withheld until after marking`,
    );
  }
  ck(
    !/"answer"\s*:/.test(page.html),
    "no serialised answer field appears anywhere in the response",
  );
  ck(
    !page.html.includes("correctIndex"),
    "the review shape is absent before anything has been submitted",
  );

  // Radios must be named per question or the answers collide on submit.
  const names = [...page.html.matchAll(/name="answer:([a-z0-9]+)"/g)].map((m) => m[1]);
  ck(
    new Set(names).size === masonry.length,
    `one radio group per question (${new Set(names).size} of ${masonry.length})`,
  );

  ck(page.html.includes("not a certificate"), "the page says it is not a certificate");
}

console.log("\nSubmitting the paper without JavaScript moves the level");
{
  const skill = await prisma.skill.findUniqueOrThrow({ where: { code: "PLUMBING" } });
  const worker = await prisma.workerProfile.findFirstOrThrow({
    where: { user: { phone: "9800000003" } },
  });

  const before = await prisma.skillAssessment.findUnique({
    where: { workerProfileId_skillId: { workerProfileId: worker.id, skillId: skill.id } },
  });
  ck(before?.passed === false, `Imran starts with a failed plumbing check (${before?.scorePercent}%)`);

  const page = await get(`/worker/profile/skill-check?skill=${skill.id}`, imranCookie);
  const form = (page.html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) =>
    f.includes('name="skillId"'),
  );
  ck(Boolean(form), "the submission form is present");

  if (form) {
    const body = new FormData();
    for (const match of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = match[0].match(/name="([^"]*)"/)?.[1];
      const value = match[0].match(/value="([^"]*)"/)?.[1] ?? "";
      if (name) body.set(decode(name), decode(value));
    }
    // Answer every question correctly, using the key that only the server has.
    for (const question of questionsFor("PLUMBING")) {
      body.set(`answer:${question.id}`, String(question.answer));
    }

    const res = await fetch(`${B}/worker/profile/skill-check?skill=${skill.id}`, {
      method: "POST",
      headers: { Origin: B, Cookie: imranCookie },
      body,
      redirect: "manual",
    });
    ck(res.status < 400, `the action accepts the submission (${res.status})`);

    // The response to a no-JavaScript submit is the re-rendered page, so the
    // review pass has to arrive in it. A worker who got a question wrong
    // should leave knowing the answer, not just knowing they lost a mark.
    const graded = await res.text();
    const plumbing = questionsFor("PLUMBING");
    ck(
      plumbing.every((q) => graded.includes(q.why)),
      "every explanation is revealed once the paper has been marked",
    );
    ck(graded.includes("Passed."), "the outcome is stated on the returned page");
    ck(
      graded.includes("100%"),
      "the score is shown on the returned page",
    );

    const after = await prisma.skillAssessment.findUnique({
      where: { workerProfileId_skillId: { workerProfileId: worker.id, skillId: skill.id } },
    });
    ck(after?.scorePercent === 100, `a perfect paper is recorded as 100% (got ${after?.scorePercent})`);
    ck(after?.passed === true, "the stored row is marked passed");
    ck(
      after?.questionCount === questionsFor("PLUMBING").length,
      "the question count is recorded from the bank, not from the form",
    );
    ck(
      (after?.takenAt.getTime() ?? 0) > (before?.takenAt.getTime() ?? 0),
      "a retake replaces the earlier result rather than adding a second row",
    );

    const rows = await prisma.skillAssessment.count({
      where: { workerProfileId: worker.id, skillId: skill.id },
    });
    ck(rows === 1, "still exactly one current result per worker per skill");

    // Put the seeded state back, so re-running the suite is idempotent and the
    // demo keeps its "sat the check and failed" example.
    await prisma.skillAssessment.update({
      where: { workerProfileId_skillId: { workerProfileId: worker.id, skillId: skill.id } },
      data: {
        scorePercent: before?.scorePercent ?? 40,
        correctCount: before?.correctCount ?? 2,
        questionCount: before?.questionCount ?? 5,
        passed: false,
        takenAt: before?.takenAt ?? new Date(),
      },
    });
  }
}

console.log("\nA forged score is ignored; the server marks the paper itself");
{
  const skill = await prisma.skill.findUniqueOrThrow({ where: { code: "PLUMBING" } });
  const worker = await prisma.workerProfile.findFirstOrThrow({
    where: { user: { phone: "9800000003" } },
  });
  const before = await prisma.skillAssessment.findUniqueOrThrow({
    where: { workerProfileId_skillId: { workerProfileId: worker.id, skillId: skill.id } },
  });

  const page = await get(`/worker/profile/skill-check?skill=${skill.id}`, imranCookie);
  const form = (page.html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) =>
    f.includes('name="skillId"'),
  );

  if (form) {
    const body = new FormData();
    for (const match of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = match[0].match(/name="([^"]*)"/)?.[1];
      const value = match[0].match(/value="([^"]*)"/)?.[1] ?? "";
      if (name) body.set(decode(name), decode(value));
    }
    const questions = questionsFor("PLUMBING");
    // Every answer deliberately wrong...
    for (const question of questions) {
      body.set(`answer:${question.id}`, String((question.answer + 1) % question.options.length));
    }
    // ...alongside a claimed perfect score and a pass flag.
    body.set("scorePercent", "100");
    body.set("passed", "true");
    body.set("correctCount", "5");
    body.set("workerProfileId", "some-other-worker");

    await fetch(`${B}/worker/profile/skill-check?skill=${skill.id}`, {
      method: "POST",
      headers: { Origin: B, Cookie: imranCookie },
      body,
      redirect: "manual",
    });

    const after = await prisma.skillAssessment.findUniqueOrThrow({
      where: { workerProfileId_skillId: { workerProfileId: worker.id, skillId: skill.id } },
    });
    ck(after.scorePercent === 0, `the forged 100% is ignored; marked 0% (got ${after.scorePercent})`);
    ck(after.passed === false, "the forged pass flag is ignored");
    ck(
      after.workerProfileId === worker.id,
      "the result lands on the session's worker, not the id in the body",
    );

    await prisma.skillAssessment.update({
      where: { workerProfileId_skillId: { workerProfileId: worker.id, skillId: skill.id } },
      data: {
        scorePercent: before.scorePercent,
        correctCount: before.correctCount,
        questionCount: before.questionCount,
        passed: before.passed,
        takenAt: before.takenAt,
      },
    });
  }
}

console.log("\nBoth sides receive the claim and the evidence, side by side");
{
  const worker = await get("/worker/profile", workerCookie);
  ck(worker.status === 200, `the worker's own profile renders (${worker.status})`);
  ck(worker.html.includes("Self-declared"), "the worker's page labels the claim as self-declared");
  ck(worker.html.includes("Verified evidence"), "and shows the evidence column");
  ck(worker.html.includes("To move up"), "the worker is told how to move up");
  ck(worker.html.includes("not a guarantee about a person"), "the disclaimer reaches the worker");

  const profile = await prisma.workerProfile.findFirstOrThrow({
    where: { user: { phone: "9800000001" } },
  });
  const employer = await get(`/employer/workers/${profile.id}`, employerCookie);
  ck(employer.status === 200, `the employer's view renders (${employer.status})`);
  ck(employer.html.includes("Self-declared"), "the employer sees the claim labelled");
  ck(employer.html.includes("Verified evidence"), "the employer sees the evidence column");
  ck(
    employer.html.includes("not a guarantee about a person"),
    "the disclaimer reaches the employer too",
  );
  ck(
    !employer.html.includes("To move up"),
    "the employer is not shown coaching notes about somebody else",
  );

  // The seeded ladder, as rendered. If these three drift the demo stops making
  // its own argument.
  ck(employer.html.includes("Expert"), "Ramesh's masonry shows as Expert");
  ck(employer.html.includes("Skill check 100%"), "the masonry check score is shown");
  ck(
    employer.html.includes("5 completed jobs using this skill"),
    "the masonry job count is shown",
  );
  const rows = employer.html.split("<li class=\"space-y-3 p-4\">").slice(1);
  const paintingRow = rows.find((row) => row.includes(">Painting<"));
  ck(Boolean(paintingRow), "the painting row is present in the panel");
  ck(
    Boolean(paintingRow?.includes("Skill check not taken")),
    "painting, which has no check, says so rather than showing a blank",
  );
  ck(
    Boolean(paintingRow?.includes("0 completed jobs using this skill")),
    "and states zero verified jobs rather than omitting the line",
  );
  const masonryRow = rows.find((row) => row.includes(">Masonry<"));
  ck(
    Boolean(masonryRow?.includes("Skill check 100%")),
    "the masonry row carries its own score, not a neighbour's",
  );

  // The bug this whole task existed to fix.
  ck(
    !/>INTERMEDIATE</.test(employer.html) && !/>BEGINNER</.test(employer.html),
    "no raw enum value is printed to the employer as a badge",
  );
}

console.log("\nA worker cannot sit a check for a skill they have not claimed");
{
  const unclaimed = await prisma.skill.findUniqueOrThrow({ where: { code: "ELECTRICAL" } });
  const page = await get("/worker/profile/skill-check", workerCookie);
  const form = (page.html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) =>
    f.includes('name="skillId"'),
  );
  ck(
    Boolean(form) && !form!.includes(unclaimed.id),
    "the form is not offered for a skill missing from the profile",
  );

  const worker = await prisma.workerProfile.findFirstOrThrow({
    where: { user: { phone: "9800000001" } },
  });
  const before = await prisma.skillAssessment.count({
    where: { workerProfileId: worker.id, skillId: unclaimed.id },
  });

  if (form) {
    const body = new FormData();
    for (const match of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = match[0].match(/name="([^"]*)"/)?.[1];
      const value = match[0].match(/value="([^"]*)"/)?.[1] ?? "";
      if (name) body.set(decode(name), decode(value));
    }
    // Swap in the id of a skill this worker never added.
    body.set("skillId", unclaimed.id);
    for (const question of questionsFor("ELECTRICAL")) {
      body.set(`answer:${question.id}`, String(question.answer));
    }

    await fetch(`${B}/worker/profile/skill-check`, {
      method: "POST",
      headers: { Origin: B, Cookie: workerCookie },
      body,
      redirect: "manual",
    });

    const after = await prisma.skillAssessment.count({
      where: { workerProfileId: worker.id, skillId: unclaimed.id },
    });
    ck(
      after === before,
      "no result is written for an unclaimed skill, even with a perfect paper",
    );
  }
}

console.log("\nThe self-declared level is the worker's to set, and saving keeps it");
{
  // The bug: the save wrote INTERMEDIATE for every skill on every submit, so a
  // worker who called themselves a beginner became intermediate the moment
  // they edited their bio - and the employer read that word as a credential.
  const worker = await prisma.workerProfile.findFirstOrThrow({
    where: { user: { phone: "9800000001" } },
    include: { skills: { include: { skill: true } } },
  });
  const beforeLevels = new Map(worker.skills.map((row) => [row.skill.code, row.proficiency]));
  const beforeChecks = await prisma.skillAssessment.findMany({
    where: { workerProfileId: worker.id },
  });

  const page = await get("/worker/profile", workerCookie);
  const form = (page.html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) =>
    f.includes('name="experienceYears"'),
  );
  ck(Boolean(form), "the profile form is present");
  ck(
    Boolean(form?.includes('name="skillLevel:')),
    "the form carries a self-declared level field per skill",
  );

  if (form) {
    const body = new FormData();
    for (const match of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = match[0].match(/name="([^"]*)"/)?.[1];
      const value = match[0].match(/value="([^"]*)"/)?.[1] ?? "";
      if (name) body.set(decode(name), decode(value));
    }
    // Replay the values a browser would send for the visible controls.
    body.set("bio", worker.bio ?? "");
    body.set("experienceYears", String(worker.experienceYears));
    body.set("travelRadiusKm", String(worker.travelRadiusKm));
    body.set("availability", worker.availability);
    body.set("language", "hi");
    for (const row of worker.skills) body.append("skillIds", row.skillId);

    // Declare masonry as BEGINNER - the opposite of the old hardcoded value,
    // so a level that survives cannot be the default by coincidence.
    const masonry = worker.skills.find((row) => row.skill.code === "MASONRY")!;
    body.set(`skillLevel:${masonry.skillId}`, "BEGINNER");

    const res = await fetch(`${B}/worker/profile`, {
      method: "POST",
      headers: { Origin: B, Cookie: workerCookie },
      body,
      redirect: "manual",
    });
    ck(res.status < 400, `the profile save is accepted without JavaScript (${res.status})`);

    const after = await prisma.workerProfile.findUniqueOrThrow({
      where: { id: worker.id },
      include: { skills: { include: { skill: true } } },
    });
    const afterLevels = new Map(after.skills.map((row) => [row.skill.code, row.proficiency]));

    ck(
      afterLevels.get("MASONRY") === "BEGINNER",
      `the declared level is saved (got ${afterLevels.get("MASONRY")})`,
    );
    ck(
      afterLevels.get("PAINTING") === beforeLevels.get("PAINTING"),
      `a level the form did not change is preserved (${beforeLevels.get("PAINTING")} -> ${afterLevels.get("PAINTING")})`,
    );
    ck(
      after.skills.length === worker.skills.length,
      "no skill is lost by the wholesale replace",
    );

    // The important one: re-saving the profile must not destroy earned results.
    const afterChecks = await prisma.skillAssessment.findMany({
      where: { workerProfileId: worker.id },
    });
    ck(
      afterChecks.length === beforeChecks.length,
      `sat skill checks survive a profile save (${beforeChecks.length} -> ${afterChecks.length})`,
    );
    ck(
      afterChecks.every(
        (row) => beforeChecks.find((b) => b.skillId === row.skillId)?.scorePercent === row.scorePercent,
      ),
      "and their scores are untouched",
    );

    // Restore the seeded claim, so the demo keeps its self-declared Expert.
    for (const row of after.skills) {
      const original = beforeLevels.get(row.skill.code);
      if (original && original !== row.proficiency) {
        await prisma.workerSkill.update({
          where: { id: row.id },
          data: { proficiency: original },
        });
      }
    }
    await prisma.user.update({
      where: { id: worker.userId },
      data: { preferredLanguage: "hi" },
    });
  }
}

console.log(`\n${checks} assertions, ${fails} failed`);
await prisma.$disconnect();
process.exit(fails === 0 ? 0 : 1);
