import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 moved connection URLs out of schema.prisma. Migrate/introspect read
// the URL from here; the runtime client uses a driver adapter (see src/lib/db.ts).
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    // Falls back rather than throwing, so `prisma generate` on a fresh clone
    // (postinstall, before .env is copied) still succeeds.
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
});
