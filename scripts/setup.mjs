#!/usr/bin/env node
/**
 * One-command setup for a fresh clone.
 *
 * Safe to re-run: it creates what is missing and leaves what already exists
 * alone, so `npm run setup` doubles as the "my database got weird" button.
 *
 * Deliberately plain Node with no dependencies - it runs before anything is
 * guaranteed to be installed, and its whole job is to be the one step that
 * cannot itself need setting up.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIN_NODE_MAJOR = 20;
const MIN_NODE_MINOR = 9;

let step = 0;
const say = (msg) => console.log(`\n[${++step}] ${msg}`);
const ok = (msg) => console.log(`    ${msg}`);

function die(title, lines) {
  console.error(`\n  ${title}\n`);
  for (const line of lines) console.error(`    ${line}`);
  console.error("");
  process.exit(1);
}

// On Windows the launcher is npx.cmd. Naming it directly avoids `shell: true`,
// which Node warns about because arguments are concatenated rather than
// escaped - a real hazard, even if nothing here takes user input.
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

function run(args) {
  execFileSync(NPX, args, { cwd: root, stdio: "inherit" });
}

// --- 1. Node version -------------------------------------------------------
// Checked first and by hand: Next 16 fails on Node 18 with an error that never
// mentions Node, which is a miserable first five minutes for a newcomer.
say("Checking Node.js");
{
  const [major, minor] = process.versions.node.split(".").map(Number);
  const tooOld =
    major < MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor < MIN_NODE_MINOR);
  if (tooOld) {
    die(`Node ${process.versions.node} is too old for Next.js 16.`, [
      `LYBOR needs Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} or newer; an LTS release is ideal.`,
      "Install one from https://nodejs.org and run this again.",
    ]);
  }
  ok(`Node ${process.versions.node} - fine.`);
}

// --- 2. Environment file ---------------------------------------------------
say("Setting up .env");
{
  const envPath = path.join(root, ".env");
  const examplePath = path.join(root, ".env.example");

  if (existsSync(envPath)) {
    ok(".env already exists - leaving it alone.");
  } else {
    if (!existsSync(examplePath)) {
      die(".env.example is missing.", [
        "It should be committed alongside this script. Try re-cloning the repository.",
      ]);
    }
    // A real random secret rather than the committed placeholder, so nobody
    // ends up running with a signing key that is public in the repo.
    const secret = randomBytes(32).toString("hex");
    const contents = readFileSync(examplePath, "utf8").replace(
      /^JWT_SECRET=.*$/m,
      `JWT_SECRET="${secret}"`,
    );
    writeFileSync(envPath, contents);
    ok(".env created, with a freshly generated JWT_SECRET.");
  }
}

// --- 3. Database -----------------------------------------------------------
say("Creating the database");
{
  // `migrate deploy` applies the committed migrations without prompting, which
  // is what a scripted setup needs; `migrate dev` can stop to ask questions.
  run(["prisma", "migrate", "deploy"]);
  ok("Schema applied to dev.db.");
}

// --- 4. Demo data ----------------------------------------------------------
say("Loading demo data");
{
  // Root, not prisma/ - this must agree with resolveSqliteUrl in src/lib/db.ts
  // and with where prisma.config.ts puts it, or the check below never matches.
  const dbPath = path.join(root, "dev.db");
  const reseed = process.argv.includes("--reseed");
  let alreadySeeded = false;

  if (existsSync(dbPath) && !reseed) {
    // Cheap check that avoids booting Prisma: the seed writes Users, so the
    // demo phone number appearing in the file means it has already run.
    try {
      alreadySeeded = readFileSync(dbPath).includes("9800000001");
    } catch {
      alreadySeeded = false;
    }
  }

  if (alreadySeeded) {
    ok("Demo data already present - skipping.");
    ok("Run `npm run setup -- --reseed` to rebuild it from scratch.");
  } else {
    run(["tsx", "prisma/seed.ts"]);
  }
}

console.log(`
  LYBOR is ready.

    npm run dev        then open http://localhost:3000

  You will be asked to choose a language first. After that, sign in with any of
  these - the password for every demo account is: lybor123

    Worker     9800000001
    Employer   9800000010
    Admin      9800000099
`);
