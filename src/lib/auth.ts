import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

const COOKIE_NAME = "lybor_session";

/**
 * Where to send a request whose session cannot be honoured. A Route Handler,
 * not /login, because only a handler can actually delete the cookie - see
 * src/app/auth/clear/route.ts for why redirecting to /login instead loops.
 */
const STALE_SESSION_PATH = "/auth/clear";
const SESSION_DAYS = 7;

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET is missing or too short. Copy .env.example to .env before starting the app.",
    );
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  role: Role;
  fullName: string;
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 10);
}

export async function verifyPassword(plain: string, digest: string): Promise<boolean> {
  return compare(plain, digest);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Returns the decoded session, or null when signed out or the token is stale. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.userId !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return {
      userId: payload.userId,
      role: payload.role as Role,
      fullName: String(payload.fullName ?? ""),
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");

  // A structurally valid token is not enough. If the row it names is gone -
  // the database was rebuilt, the account was deleted - the session has to be
  // torn down rather than trusted, or the guards below bounce the browser
  // between /login and the dashboard forever. One lookup on a primary key.
  const stillExists = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, isActive: true },
  });
  if (!stillExists || !stillExists.isActive) redirect(STALE_SESSION_PATH);

  return session;
}

export async function requireRole<R extends Role>(role: R): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== role) redirect(dashboardPathFor(session.role));
  return session;
}

export function dashboardPathFor(role: Role): string {
  switch (role) {
    case "WORKER":
      return "/worker";
    case "EMPLOYER":
      return "/employer";
    case "ADMIN":
      return "/admin";
  }
}

/** The signed-in worker profile, or a redirect if the profile is missing. */
export async function requireWorkerProfile() {
  const session = await requireRole("WORKER");
  const profile = await prisma.workerProfile.findUnique({
    where: { userId: session.userId },
    include: { user: true },
  });
  if (!profile) redirect(STALE_SESSION_PATH);
  return { session, profile };
}

export async function requireEmployerProfile() {
  const session = await requireRole("EMPLOYER");
  const profile = await prisma.employerProfile.findUnique({
    where: { userId: session.userId },
    include: { user: true },
  });
  if (!profile) redirect(STALE_SESSION_PATH);
  return { session, profile };
}
