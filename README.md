# LYBOR

**Verified work. Transparent wages.**

A blue-collar workforce platform prototype. A worker finds a job, applies, gets
assigned, checks in with GPS, works, checks out with GPS, and the hours become
verified. The employer approves them, a wage is calculated line by line in the
open, payment status moves through an append-only ledger, and the finished job
becomes a permanent, portable work record.

Three roles: **WORKER**, **EMPLOYER**, **ADMIN**.

---

## Running it on your laptop

You need [Node.js](https://nodejs.org) 20.9 or newer. Nothing else - no
database server, no Docker, no accounts, no API keys.

```bash
git clone https://github.com/manish-sprp/lybor-blue-collar-workforce.git
cd lybor-blue-collar-workforce
npm install
npm run setup
npm run dev
```

Then open <http://localhost:3000>.

`npm run setup` checks your Node version, writes a `.env` with a freshly
generated `JWT_SECRET`, creates the SQLite database, and loads the demo data.
It is safe to re-run: it leaves anything that already exists alone. To rebuild
the demo data from scratch:

```bash
npm run setup -- --reseed
```

The first screen asks you to choose a language. Pick any of the thirteen; the
whole app follows it.

### If something goes wrong

**`npm install` fails.** It should not: nothing here compiles. The SQLite
driver is libSQL, whose native module ships N-API prebuilds - one binary works
across Node versions, so no C++ toolchain is ever needed. If install does fail,
it is worth reporting.

**`JWT_SECRET is missing or too short`.** Delete `.env` and re-run
`npm run setup`.

**The port is taken.** `npm run dev -- -p 3001`.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build && npm start` | Production build, then serve it |
| `npm run setup -- --reseed` | Rebuild the demo data |
| `npm run verify:all` | Typecheck, lint, and both invariant suites |
| `npm run db:studio` | Browse the database in Prisma Studio |

### Sharing a running instance

`next start` binds to localhost. To reach it from a phone on the same Wi-Fi,
bind to all interfaces:

```bash
npm run build
npx next start -H 0.0.0.0
```

To expose it publicly through a tunnel or reverse proxy, Next also has to be
told the public hostname is trusted, or every Server Action is rejected as
cross-origin and login silently fails:

```bash
ALLOWED_ORIGINS="*.trycloudflare.com" npx next start -H 0.0.0.0
cloudflared tunnel --url http://localhost:3000
```

See `next.config.ts` for how `ALLOWED_ORIGINS` is wired.

### Demo accounts

Password for every account: `lybor123`

| Role     | Phone        | Who                        |
| -------- | ------------ | -------------------------- |
| Worker   | `9800000001` | Ramesh Kumar (Hindi UI)    |
| Worker   | `9800000005` | Vijay Patil                |
| Employer | `9800000010` | BuildRight Constructions   |
| Employer | `9800000011` | SwiftStore Logistics       |
| Admin    | `9800000099` | Platform Admin             |

Other seeded workers: `9800000002` … `9800000006`. Employer `9800000012`.

### Scripts

| Command              | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Dev server (Turbopack)                          |
| `npm run build`      | Production build                                |
| `npm run typecheck`  | `tsc --noEmit`                                  |
| `npm run lint`       | ESLint                                          |
| `npm run db:migrate` | Apply migrations                                |
| `npm run db:seed`    | Reseed demo data (wipes and rebuilds)           |
| `npm run db:reset`   | Reset the database and reseed                   |
| `npm run db:studio`  | Prisma Studio                                   |

---

## The core flow

```
find job → apply → employer assigns → GPS check-in → work → GPS check-out
   → verified hours → employer approval → transparent wage → payment status
   → verified work history
```

Each arrow is a real state transition backed by a row, not a UI step:

| Step               | What is written                                                        |
| ------------------ | ---------------------------------------------------------------------- |
| Apply              | `JobApplication`, with the match score **frozen at apply time**         |
| Assign             | `JobAssignment`, with **wage terms frozen** onto it                     |
| Check in           | `Attendance` with distance, accuracy, geofence result, risk flags       |
| Check out          | `workingMinutes`, full risk assessment, `Payment` + `ACCRUAL` ledger    |
| Approve            | `Payment.APPROVED` + `APPROVAL` ledger entry (or `REVERSAL` on reject)  |
| Pay                | `Payment.PAID` + `PAYOUT` ledger entry                                  |
| Complete           | `WorkHistory` snapshot — immutable, survives edits to job or employer   |

---

## Design decisions worth knowing

**Money is integer paise.** Never a float, never rupees. Rounding happens once,
at the end of a calculation, and is always shown in the breakdown.

**Wage terms are frozen onto the assignment, not read from the job.** Editing a
job later cannot silently change what an already-assigned worker is owed.

**A geofence failure never blocks a check-in.** A worker who genuinely turned up
should not lose a day to a bad GPS fix. The punch is recorded, flagged with the
rule that fired, and a human decides.

**Nothing is a black box.** The match engine
([`src/lib/matching.ts`](src/lib/matching.ts)) and the risk engine
([`src/lib/risk.ts`](src/lib/risk.ts)) both return their score *and* every
factor, weight, threshold and observed value that produced it. The UI always
shows the reasoning next to the number.

**Money movement is append-only.** `PaymentLedgerEntry` records accruals,
approvals, payouts and reversals rather than mutating a balance. A real UPI or
escrow provider appends the same `PAYOUT` row; nothing above that line changes.

**A disputed payment is frozen, not reversed.** Nobody loses money while a human
is still deciding.

**Government ID numbers are never stored.** KYC keeps a display mask
(`********1234`) and a salted SHA-256 hash for duplicate detection. Neither can
be reversed.

**Reliability is derived, never an input to a money decision.** A low score
costs a worker ranking, never earned wages.

---

## The two AI/ML surfaces

Both are deliberately transparent weighted rubrics rather than opaque models.
For a worker deciding whether to spend a day of bus fare on a job, *why* matters
more than the last few points of accuracy.

### Explainable job–worker matching — `src/lib/matching.ts`

| Factor       | Weight | What it reads                                     |
| ------------ | ------ | ------------------------------------------------- |
| Skills       | 35%    | Held vs. required, weighted by proficiency        |
| Distance     | 20%    | Haversine distance vs. the travel radius          |
| Wage fit     | 15%    | Normalised hourly rate vs. the stated minimum     |
| Availability | 10%    | AVAILABLE / BUSY / UNAVAILABLE                    |
| Experience   | 10%    | Years, saturating at 5                            |
| Reliability  | 10%    | Derived score from verified attendance history    |

A missing **mandatory** skill caps the score at 45 — a hard cap, not a soft
penalty, so a high reliability score cannot float an unqualified worker to the
top of an employer's list.

Every factor carries its own English and Hindi sentence, rendered verbatim in
`MatchExplainer`.

### Explainable attendance risk — `src/lib/risk.ts`

Nine named rules, each with a stated threshold, an observed value and a point
weight:

`GPS_OUT_OF_RADIUS_IN` (40) · `GPS_OUT_OF_RADIUS_OUT` (30) ·
`SHIFT_TOO_LONG` (25) · `MISSING_CHECK_OUT` (20) · `SHIFT_TOO_SHORT` (18) ·
`DEMO_LOCATION_USED` (15) · `LATE_CHECK_IN` (10) · `EARLY_CHECK_OUT` (10) ·
`LOW_GPS_ACCURACY` (8)

Score ≥ 20 flags the day for human review; ≥ 50 is high risk. Flags at MEDIUM or
HIGH severity also open a `FraudAlert` in the admin queue. The engine only ever
annotates — a human still approves or rejects.

---

## Wage calculation — `src/lib/wages.ts`

| Wage type | Rule                                                                    |
| --------- | ----------------------------------------------------------------------- |
| HOURLY    | Regular hours at rate; hours past the expected day at **1.5×** overtime |
| DAILY     | ≥ 90% of the day → full day; ≥ 50% → half day; below → pro-rated        |
| SHIFT     | ≥ 50% of the shift → full shift; below → pro-rated                      |

The function returns a `WageBreakdown` whose `lines[]` explain each component.
Worker, employer and admin all render that identical object — nobody sees a
different number from anybody else.

---

## Bilingual UI

English and Hindi throughout, switched by a cookie-backed form in the header
that works with JavaScript disabled.

- UI strings: flat dotted keys in [`src/lib/i18n.ts`](src/lib/i18n.ts)
- Domain output (match reasons, risk flags, wage lines) carries paired
  `field` / `fieldHi` strings from the engine itself
- Notifications store an **i18n key plus params**, not a rendered sentence, so
  switching language re-renders a worker's whole history

---

## Mobile-first

The primary user is on a low-end Android phone, outdoors, in daylight.

- Bottom tab bar on phones, sidebar from `md` up
- 44px minimum touch targets (`Button` default height)
- Native `<select>` — the most reliable picker on low-end Android
- Language toggle, logout, apply and attendance-review all work as plain forms
- High-contrast OKLCH tokens with a dark-mode palette

---

## Project layout

```
prisma/
  schema.prisma          Postgres-portable schema (18 models)
  seed.ts                Demo data built through the real domain engines
src/
  app/
    (auth)/              login, register
    worker/              dashboard, jobs, applications, assignments,
                         attendance, earnings, history, KYC, disputes, profile
    employer/            dashboard, jobs, post job, applicants, approvals,
                         payments, disputes, KYC
    admin/               overview, KYC review, fraud alerts, disputes, users
  components/
    ui/                  Button, Card, Badge, form fields, Progress, Alert
    app/                 MatchExplainer, RiskFlagList, WageBreakdownTable,
                         GpsPunch, AppShell, StatusBadge, KycPanel
  lib/                   db, auth, i18n, geo, money, matching, risk, wages,
                         reliability, notifications
  server/actions/        session, jobs, attendance, payments, disputes, kyc,
                         admin, profile
```

Mutations are Server Actions. There are no API routes — the same functions that
validate with Zod also authorise via `requireRole` / `requireWorkerProfile`, so
authorisation cannot be bypassed by calling a route directly.

---

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) ·
Tailwind CSS v4 · shadcn-style components · Prisma 7 · SQLite · jose (JWT
sessions in an httpOnly cookie) · bcryptjs · Zod v4 · lucide-react

### Prisma 7 notes

Prisma 7 moved the connection URL out of `schema.prisma`. It now lives in
[`prisma.config.ts`](prisma.config.ts) for migrate/introspect, and the runtime
client uses a driver adapter (`@prisma/adapter-libsql`) in
[`src/lib/db.ts`](src/lib/db.ts).

### Switching to PostgreSQL

The schema is written to be Postgres-portable — no SQLite-specific native types,
money as integer paise, every enum mapping cleanly to a Postgres enum.

1. `datasource db { provider = "postgresql" }` in `prisma/schema.prisma`
2. Point `DATABASE_URL` at the Postgres instance
3. Swap the adapter in `src/lib/db.ts` for `@prisma/adapter-pg`
4. `npm run db:migrate`

No application code changes.

---

## Prototype boundaries

Deliberately out of scope, with the seam left in the right place:

- **Payments settle through a mock ledger.** A real rail appends the same
  `PAYOUT` entry.
- **KYC is human-reviewed**, not checked against a government API.
- **Location is trusted as far as the browser reports it.** Production needs
  mock-location detection and device attestation; the `DEMO_LOCATION_USED` flag
  exists so a simulated punch is always visible as one.
- **Notifications are in-app only.** The schema carries `SMS` / `WHATSAPP`
  channels and delivery status for when a real gateway is added.
- **Sessions are stateless JWTs** with no refresh or revocation list.
