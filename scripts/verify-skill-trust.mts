/**
 * The rule under test: a claim is never a credential.
 *
 * A worker can set their proficiency to EXPERT in a dropdown in ten seconds.
 * Every assertion here exists to prove that doing so moves nothing - the
 * ladder is driven only by a marked skill check, completed jobs, and the
 * ratings of the employers who paid for them.
 *
 * It also checks the parts a reviewer would reasonably distrust: that the
 * answer key never leaves the server, that the questions are real questions,
 * and that the copy never promises more than the evidence supports.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  TRUST_LEVELS,
  TRUST_LEVEL_META,
  TRUST_THRESHOLDS,
  deriveSkillTrust,
  headlineTrust,
  type SkillEvidence,
} from "../src/lib/skill-trust";
import {
  assessmentSkillCodes,
  gradeAssessment,
  hasAssessment,
  publicQuestionsFor,
  questionsFor,
} from "../src/lib/skill-questions";
import { CATALOGS_FOR_TEST, translate } from "../src/lib/i18n";
import { LOCALES } from "../src/lib/i18n/locales";

/**
 * The English catalog, read through the barrel rather than imported directly.
 * A default export reached from a .mts script arrives wrapped by ESM/CJS
 * interop - `import en from ".../messages/en"` yields `{ default: {...} }`,
 * so every `key in en` silently reports false and the assertions below would
 * pass vacuously while testing nothing.
 */
const en = CATALOGS_FOR_TEST.en as Record<string, string>;

let checks = 0;
let fails = 0;
const ck = (ok: boolean, msg: string) => {
  checks++;
  console.log(`    ${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) fails++;
};

/** A worker with nothing but a claim. Every case starts from here. */
function evidence(over: Partial<SkillEvidence> = {}): SkillEvidence {
  return {
    skillCode: "ELECTRICAL",
    skillName: "Electrical work",
    selfDeclaredProficiency: "INTERMEDIATE",
    selfDeclaredYears: 0,
    assessment: null,
    verifiedJobs: 0,
    ratings: [],
    ...over,
  };
}

const passed = (percent: number) => ({
  scorePercent: percent,
  passed: percent >= TRUST_THRESHOLDS.assessmentPassPercent,
  takenAt: new Date("2026-01-01"),
});

console.log("A self-declaration alone never earns a level");
{
  const claim = deriveSkillTrust(
    evidence({ selfDeclaredProficiency: "EXPERT", selfDeclaredYears: 20 }),
  );
  ck(claim.level === "SELF_DECLARED", "20 self-declared years and EXPERT stays SELF_DECLARED");
  ck(
    claim.selfDeclaredProficiency === "EXPERT",
    "the claim is still carried through for display, not discarded",
  );
  ck(claim.assessmentPercent === null, "no assessment is reported as none, not as zero");
  ck(claim.nextStep !== null, "an unproven worker is told what would change it");

  // The same worker, claiming nothing, with the same (absent) evidence.
  const modest = deriveSkillTrust(evidence({ selfDeclaredProficiency: "BEGINNER" }));
  ck(
    modest.level === claim.level,
    "claiming BEGINNER instead of EXPERT produces the identical level",
  );
}

console.log("\nEach rung requires the evidence it names");
{
  const skilled = deriveSkillTrust(evidence({ assessment: passed(80) }));
  ck(skilled.level === "SKILLED", "a passed check alone reaches SKILLED");

  const failedCheck = deriveSkillTrust(evidence({ assessment: passed(40) }));
  ck(failedCheck.level === "SELF_DECLARED", "a failed check does not reach SKILLED");
  ck(
    failedCheck.basis.english.includes("40%"),
    "the failing score is stated rather than hidden",
  );
  ck(
    failedCheck.basis.english.toLowerCase().includes("retaken"),
    "a failed check is explicitly retakeable",
  );

  const jobsOnly = deriveSkillTrust(evidence({ verifiedJobs: 9, ratings: [5, 5, 5] }));
  ck(
    jobsOnly.level === "SELF_DECLARED",
    "nine completed jobs without a check stay SELF_DECLARED - the ladder is a conjunction, not a total",
  );

  const verified = deriveSkillTrust(
    evidence({ assessment: passed(70), verifiedJobs: TRUST_THRESHOLDS.verifiedJobsRequired }),
  );
  ck(verified.level === "VERIFIED", "check plus the required completed jobs reaches VERIFIED");

  const oneShort = deriveSkillTrust(
    evidence({
      assessment: passed(70),
      verifiedJobs: TRUST_THRESHOLDS.verifiedJobsRequired - 1,
    }),
  );
  ck(oneShort.level === "SKILLED", "one job short of VERIFIED is still SKILLED");
}

console.log("\nEXPERT needs every condition, and one missing condition blocks it");
{
  const full = {
    assessment: passed(TRUST_THRESHOLDS.expertAssessmentPercent),
    verifiedJobs: TRUST_THRESHOLDS.expertJobsRequired,
    ratings: [5, 4, 5],
  };
  const expert = deriveSkillTrust(evidence(full));
  ck(expert.level === "EXPERT", "all conditions met reaches EXPERT");
  ck(expert.nextStep === null, "the top rung has no next step");

  ck(
    deriveSkillTrust(evidence({ ...full, ratings: [3, 3, 3] })).level === "VERIFIED",
    "a weak employer average blocks EXPERT and falls back to VERIFIED",
  );
  ck(
    deriveSkillTrust(evidence({ ...full, ratings: [5] })).level === "VERIFIED",
    `a single 5-star rating is not enough - ${TRUST_THRESHOLDS.minRatingsForExpert} raters are required`,
  );
  ck(
    deriveSkillTrust(evidence({ ...full, verifiedJobs: TRUST_THRESHOLDS.expertJobsRequired - 1 }))
      .level === "VERIFIED",
    "one job short of the EXPERT bar is VERIFIED",
  );
  ck(
    deriveSkillTrust(
      evidence({ ...full, assessment: passed(TRUST_THRESHOLDS.assessmentPassPercent) }),
    ).level === "VERIFIED",
    "a bare pass on the check is not an EXPERT-level score",
  );
  ck(
    deriveSkillTrust(evidence(full), 0.5).level === "VERIFIED",
    "abandoning half of their assignments blocks EXPERT",
  );
  ck(
    deriveSkillTrust(evidence(full), TRUST_THRESHOLDS.expertCompletionRate).level === "EXPERT",
    "a completion rate exactly on the bar still qualifies",
  );
}

console.log("\nThresholds are boundaries, not approximations");
{
  const pass = TRUST_THRESHOLDS.assessmentPassPercent;
  ck(
    deriveSkillTrust(evidence({ assessment: passed(pass) })).level === "SKILLED",
    `exactly ${pass}% passes`,
  );
  ck(
    deriveSkillTrust(evidence({ assessment: passed(pass - 1) })).level === "SELF_DECLARED",
    `${pass - 1}% does not`,
  );
}

console.log("\nThe basis never contradicts the numbers beside it");
{
  // This is a regression test for a real bug, found by printing the seeded
  // data rather than by reading the code. A worker with one completed job and
  // no skill check was shown "No completed jobs using this skill yet" directly
  // beside a panel reading "1 completed job using this skill". Both branches
  // that can say "no completed jobs" are now pinned.
  const claimsNoJobs = (text: string) =>
    /no completed jobs/i.test(text) || /not.*completed any/i.test(text);

  for (const jobs of [0, 1, 2, 4, 7]) {
    for (const assessment of [null, passed(40), passed(60), passed(90)]) {
      const skill = deriveSkillTrust(evidence({ verifiedJobs: jobs, assessment }));
      ck(
        !(jobs > 0 && claimsNoJobs(skill.basis.english)),
        `${jobs} jobs, check ${assessment?.scorePercent ?? "none"}: the basis does not deny work that exists`,
      );
      if (jobs > 0 && skill.level !== "SELF_DECLARED") {
        ck(
          skill.basis.english.includes(String(jobs)),
          `${jobs} jobs, check ${assessment?.scorePercent ?? "none"}: the basis states the job count`,
        );
      }
      // A next step that asks for zero more of anything is not a next step.
      if (skill.nextStep) {
        ck(
          !/\b0 (?:more )?verified job/.test(skill.nextStep.english),
          `${jobs} jobs, check ${assessment?.scorePercent ?? "none"}: the next step never asks for zero jobs`,
        );
      }
    }
  }

  const someJobs = deriveSkillTrust(evidence({ verifiedJobs: 1, assessment: passed(90) }));
  ck(
    someJobs.basis.key === "trust.basisSkilledSomeJobs",
    "a passed check with one job uses the variant that mentions the job",
  );
  const noCheck = deriveSkillTrust(evidence({ verifiedJobs: 3 }));
  ck(
    noCheck.basis.key === "trust.basisJobsNoCheck",
    "completed work with no check taken says so, rather than denying the work",
  );
}

console.log("\nThe headline is the strongest level, not the first skill");
{
  const skills = [
    deriveSkillTrust(evidence({ skillCode: "A", skillName: "A" })),
    deriveSkillTrust(
      evidence({ skillCode: "B", skillName: "B", assessment: passed(70), verifiedJobs: 3 }),
    ),
    deriveSkillTrust(evidence({ skillCode: "C", skillName: "C", assessment: passed(70) })),
  ];
  const head = headlineTrust(skills);
  ck(head?.skillCode === "B", "VERIFIED outranks SKILLED and SELF_DECLARED");
  ck(headlineTrust([]) === null, "a worker with no skills has no headline");

  const ordered = TRUST_LEVELS.map((level) => TRUST_LEVEL_META[level].order);
  ck(
    ordered.every((value, index) => index === 0 || value > ordered[index - 1]),
    "the display order matches the ladder order",
  );
}

console.log("\nThe answer key never reaches the browser");
{
  for (const code of assessmentSkillCodes()) {
    const publicQs = publicQuestionsFor(code);
    const serialised = JSON.stringify(publicQs);
    ck(
      !serialised.includes('"answer"') && !serialised.includes('"why"'),
      `${code}: the client payload carries no answer or explanation`,
    );
    ck(publicQs.length === questionsFor(code).length, `${code}: every question is still sent`);
  }

  // The check would prove nothing if the page could be marked in the browser.
  const form = readFileSync("src/app/worker/profile/skill-check/skill-check-form.tsx", "utf8");
  ck(
    !/\.answer\b/.test(form) && !form.includes("gradeAssessment"),
    "the client component neither reads an answer field nor grades",
  );
  const action = readFileSync("src/server/actions/assessment.ts", "utf8");
  ck(action.includes("gradeAssessment"), "grading happens in the server action");
  ck(
    action.includes("requireWorkerProfile"),
    "the worker is resolved from the session, not from the request body",
  );
  ck(
    !/formData\.get\("(scorePercent|passed|workerProfileId)"\)/.test(action),
    "the score, the pass flag and the worker id are never taken from the form",
  );
  ck(
    /const submissionSchema/.test(action) && action.includes("safeParse"),
    "the submission is validated rather than trusted",
  );

  // Every export of a "use server" file is a callable endpoint.
  const exported = [...action.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map(
    (m) => m[1],
  );
  ck(
    exported.length === 1 && exported[0] === "submitSkillCheckAction",
    `the action file exposes exactly one endpoint (found: ${exported.join(", ") || "none"})`,
  );
}

console.log("\nThe question bank is real, and marking it works");
{
  const codes = assessmentSkillCodes();
  ck(codes.length >= 4, `${codes.length} trades have a check`);
  ck(!hasAssessment("NOT_A_TRADE"), "an unknown skill has no check");
  ck(questionsFor("NOT_A_TRADE").length === 0, "an unknown skill yields no questions");

  for (const code of codes) {
    const qs = questionsFor(code);
    ck(qs.length >= 4, `${code}: ${qs.length} questions`);
    ck(
      new Set(qs.map((q) => q.id)).size === qs.length,
      `${code}: question ids are unique - answers are keyed by id`,
    );
    ck(
      qs.every((q) => q.options.length === q.optionsHi.length),
      `${code}: every option is translated, so no answer index shifts between languages`,
    );
    ck(
      qs.every((q) => q.answer >= 0 && q.answer < q.options.length),
      `${code}: every answer index is in range`,
    );
    ck(
      qs.every((q) => q.options.length >= 3),
      `${code}: at least three options, so guessing is not a coin flip`,
    );
    ck(
      qs.every((q) => new Set(q.options).size === q.options.length),
      `${code}: no duplicated options`,
    );
    ck(
      qs.every((q) => q.why.trim().length > 20),
      `${code}: every question explains its answer`,
    );

    // Marking: all right, all wrong, and one right.
    const allRight = Object.fromEntries(qs.map((q) => [q.id, q.answer]));
    ck(gradeAssessment(code, allRight).scorePercent === 100, `${code}: a perfect paper scores 100`);

    const allWrong = Object.fromEntries(
      qs.map((q) => [q.id, (q.answer + 1) % q.options.length]),
    );
    ck(gradeAssessment(code, allWrong).scorePercent === 0, `${code}: every answer wrong scores 0`);

    const partial = { [qs[0].id]: qs[0].answer };
    const marked = gradeAssessment(code, partial);
    ck(
      marked.correctCount === 1 && marked.questionCount === qs.length,
      `${code}: an unanswered question is marked wrong, not skipped`,
    );
    ck(
      gradeAssessment(code, {}).scorePercent === 0,
      `${code}: an empty submission scores 0 rather than dividing by zero`,
    );
  }
}

console.log("\nThe interface says what the evidence supports and no more");
{
  // If any of these keys is missing the panel renders a blank, so they are
  // asserted rather than assumed.
  const required = [
    "trust.levelSelfDeclared", "trust.levelSkilled", "trust.levelVerified", "trust.levelExpert",
    "trust.selfDeclaredHeading", "trust.verifiedHeading", "trust.disclaimer",
    "trust.basisExpert", "trust.basisVerified", "trust.basisSkilled", "trust.basisFailed",
    "trust.basisNone", "trust.basisSkilledSomeJobs", "trust.basisJobsNoCheck",
    "trust.nextExpertJobs", "trust.nextExpertRating",
    "trust.nextVerifiedJobs", "trust.nextSkilled",
    "assess.title", "assess.notCertification", "assess.resultPassed", "assess.resultFailed",
  ];
  for (const key of required) {
    ck(key in en, `the English catalog defines "${key}"`);
  }

  // Every sentence the ladder can return must have a key behind it.
  const sentences = [
    deriveSkillTrust(evidence()),
    deriveSkillTrust(evidence({ assessment: passed(40) })),
    deriveSkillTrust(evidence({ assessment: passed(80) })),
    deriveSkillTrust(evidence({ assessment: passed(70), verifiedJobs: 2 })),
    deriveSkillTrust(evidence({ assessment: passed(70), verifiedJobs: 1 })),
    deriveSkillTrust(evidence({ verifiedJobs: 3 })),
    deriveSkillTrust(evidence({ assessment: passed(70), verifiedJobs: 5, ratings: [5, 5, 5] })),
    deriveSkillTrust(
      evidence({ assessment: passed(90), verifiedJobs: 5, ratings: [5, 5, 5] }),
    ),
  ];
  for (const skill of sentences) {
    ck(skill.basis.key in en, `"${skill.basis.key}" is a real catalog key`);
    if (skill.nextStep) {
      ck(skill.nextStep.key in en, `"${skill.nextStep.key}" is a real catalog key`);
    }
  }

  // Placeholders must survive all thirteen translations, or a worker reads a
  // literal {percent} where their score should be.
  for (const { code } of LOCALES) {
    const rendered = translate(code, "trust.basisVerified", { percent: 80, jobs: 3 });
    ck(rendered.includes("80") && rendered.includes("3"), `${code}: basis numbers interpolate`);
    ck(!/\{(percent|jobs)\}/.test(rendered), `${code}: no leftover placeholder in the basis`);

    const catalog = CATALOGS_FOR_TEST[code] as Record<string, string | undefined>;
    for (const key of ["trust.disclaimer", "assess.notCertification"]) {
      ck(Boolean(catalog[key]), `${code}: "${key}" is translated, not falling back to English`);
    }
  }

  // The claim the user asked us never to make.
  const disclaimer = en["trust.disclaimer"].toLowerCase();
  ck(
    disclaimer.includes("not a guarantee"),
    "the disclaimer says the levels are not a guarantee about a person",
  );
  ck(
    disclaimer.includes("not a trade certificate"),
    "the disclaimer denies being a trade certificate",
  );
  ck(
    en["assess.notCertification"].toLowerCase().includes("not a certificate"),
    "the check itself is labelled as not a certificate",
  );

  for (const key of Object.keys(en)) {
    if (!key.startsWith("trust.") && !key.startsWith("assess.")) continue;
    const value = en[key].toLowerCase();
    for (const overclaim of ["guaranteed", "certified", "fully qualified", "licensed"]) {
      ck(!value.includes(overclaim), `"${key}" avoids the word "${overclaim}"`);
    }
  }
}

console.log("\nThe self-declared value is no longer presented as evidence");
{
  const employer = readFileSync("src/app/employer/workers/[id]/page.tsx", "utf8");
  ck(
    !/<Badge[^>]*>\{s\.proficiency\}/.test(employer),
    "the bare proficiency badge is gone from the employer's view",
  );
  ck(employer.includes("SkillTrustPanel"), "the employer sees the evidence panel instead");

  const panel = readFileSync("src/components/app/skill-trust-panel.tsx", "utf8");
  ck(
    panel.includes("trust.selfDeclaredHeading") && panel.includes("trust.verifiedHeading"),
    "the panel labels both columns, so the claim cannot be mistaken for the evidence",
  );
  ck(panel.includes("trust.disclaimer"), "the panel always carries the disclaimer");

  const worker = readFileSync("src/app/worker/profile/page.tsx", "utf8");
  ck(
    worker.includes("SkillTrustPanel"),
    "the worker sees the same panel, so both sides read the same story",
  );

  // The save used to overwrite every level with INTERMEDIATE.
  const save = readFileSync("src/server/actions/profile.ts", "utf8");
  ck(
    !/proficiency:\s*"INTERMEDIATE" as const/.test(save),
    "the profile save no longer hardcodes a proficiency for every skill",
  );
  ck(save.includes("skillLevel:"), "the level is read from the form, per skill");

  // Nothing derived may read the self-declared columns.
  //
  // Asserted by exhaustion rather than by reading the source. A regex over the
  // ladder's `if` and `const` lines was the first attempt and it was worthless:
  // the EXPERT condition spans several lines, so a single-line pattern never
  // saw it and the assertion passed while testing nothing. Running every
  // combination of the claim across the whole ladder cannot be fooled that way.
  const claims = ["BEGINNER", "INTERMEDIATE", "EXPERT"] as const;
  const shapes: Partial<SkillEvidence>[] = [
    {},
    { assessment: passed(40) },
    { assessment: passed(60) },
    { assessment: passed(80) },
    { verifiedJobs: 9, ratings: [5, 5, 5, 5] },
    { assessment: passed(70), verifiedJobs: 2 },
    { assessment: passed(80), verifiedJobs: 5, ratings: [5, 4, 5] },
  ];
  let claimSensitive = 0;
  for (const shape of shapes) {
    const levels = new Set<string>();
    for (const claim of claims) {
      for (const years of [0, 1, 40]) {
        levels.add(
          deriveSkillTrust(
            evidence({ ...shape, selfDeclaredProficiency: claim, selfDeclaredYears: years }),
          ).level,
        );
      }
    }
    if (levels.size !== 1) claimSensitive++;
  }
  ck(
    claimSensitive === 0,
    `across ${shapes.length} evidence shapes x ${claims.length} claims x 3 year values, the claim never moves the level`,
  );
}

console.log(`\n${checks} assertions, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
