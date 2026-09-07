import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

/**
 * Resolves a relative `file:` URL to an absolute path, against the repo root.
 *
 * This has to agree with the Prisma CLI or the app and the migrations end up
 * on different files. `prisma.config.ts` sits at the root, so the CLI reads
 * `file:./dev.db` as `<root>/dev.db` - and this used to prepend `prisma/`,
 * which quietly produced a second database: migrations and the seed wrote one
 * file while the running app read another, and the two drifted apart.
 */
function resolveSqliteUrl(url: string): string {
  if (!url.startsWith("file:")) return url;
  const target = url.slice("file:".length);
  if (target === ":memory:") return url;
  const absolute = path.isAbsolute(target)
    ? target
    : path.resolve(process.cwd(), target);
  return `file:${absolute}`;
}

/**
 * libSQL rather than better-sqlite3, for one reason that matters more than any
 * technical difference between them: it installs without a C++ toolchain.
 *
 * better-sqlite3 ships prebuilt binaries per Node ABI, so a Node release with
 * no matching prebuild falls back to compiling from source - which on Windows
 * means a Visual Studio install, and on a fresh clone means `npm install`
 * simply fails. libSQL's native module is built with N-API, whose ABI is
 * stable across Node versions, so one prebuild covers every supported Node and
 * nothing is ever compiled on the user's machine.
 *
 * Both speak plain SQLite files; `prisma/dev.db` is unchanged and the Prisma
 * CLI is unaffected, because migrations use their own engine rather than this
 * adapter. Swapping to PostgreSQL still means swapping this adapter and the
 * datasource provider, and nothing else.
 */
const adapter = new PrismaLibSql({
  url: resolveSqliteUrl(process.env.DATABASE_URL ?? "file:./dev.db"),
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
