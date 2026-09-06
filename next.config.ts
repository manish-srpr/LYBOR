import type { NextConfig } from "next";

/**
 * Extra origins allowed to invoke Server Actions.
 *
 * Next compares a Server Action request's Origin against the Host and rejects
 * mismatches as CSRF. That check fires when the app is reached through a
 * tunnel or proxy, where the public hostname is not the one the server binds
 * to - so login and every mutation would fail.
 *
 * This is read from the environment rather than hardcoded so the committed
 * config never permanently trusts a third-party domain. Set it only for the
 * process that actually sits behind a proxy, for example:
 *
 *   ALLOWED_ORIGINS="*.trycloudflare.com" npx next start
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedOrigins?.length
    ? { experimental: { serverActions: { allowedOrigins } } }
    : {}),
};

export default nextConfig;
