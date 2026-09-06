import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

/**
 * A relative `file:` URL is resolved against the project root, matching where
 * the Prisma 7 CLI puts the file when it runs migrations. One DATABASE_URL
 * then works for both migrate and runtime.
 */
function resolveSqliteUrl(url: string): string {
  if (!url.startsWith("file:")) return url;
  const target = url.slice("file:".length);
  if (path.isAbsolute(target) || target === ":memory:") return target;
  // turbopackIgnore keeps this dynamic path out of the build trace; the file
  // is a local dev database, never a bundled asset.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), target);
}

const adapter = new PrismaBetterSqlite3({
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
