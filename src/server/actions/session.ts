"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, dashboardPathFor, destroySession, getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { LANG_COOKIE, isSupportedLocale, normaliseLang } from "@/lib/i18n";

export type FormState = { error?: string; ok?: boolean };

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/u, "Enter a 10 digit Indian mobile number.");

const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const user = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
  // Same message for "no such user" and "wrong password" so the form cannot be
  // used to enumerate which phone numbers are registered.
  if (!user || !user.isActive) {
    return { error: "Phone number or password is incorrect." };
  }
  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return { error: "Phone number or password is incorrect." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession({ userId: user.id, role: user.role, fullName: user.fullName });

  // Signing in must not change the language the visitor picked on the gateway.
  // Their choice covers all thirteen locales; `preferredLanguage` is a
  // two-value enum, so overwriting from it would silently reset a Punjabi or
  // Tamil speaker to English at the exact moment they authenticate. The column
  // is only used to seed a locale when no choice has been made yet.
  const store = await cookies();
  if (!isSupportedLocale(store.get(LANG_COOKIE)?.value)) {
    store.set(LANG_COOKIE, user.preferredLanguage, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  redirect(dashboardPathFor(user.role));
}

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  phone: phoneSchema,
  password: z.string().min(6, "Password must be at least 6 characters."),
  role: z.enum(["WORKER", "EMPLOYER"]),
  city: z.string().trim().min(2, "Enter your city."),
  companyName: z.string().trim().optional(),
  language: z.enum(["en", "hi"]).default("en"),
});

// Demo geography so a brand-new account still lands near the seeded jobs and
// the matching engine has something meaningful to reason about.
const CITY_COORDS: Record<string, { lat: number; lng: number; state: string; pincode: string }> = {
  bengaluru: { lat: 12.9716, lng: 77.5946, state: "Karnataka", pincode: "560001" },
  bangalore: { lat: 12.9716, lng: 77.5946, state: "Karnataka", pincode: "560001" },
  mumbai: { lat: 19.076, lng: 72.8777, state: "Maharashtra", pincode: "400001" },
  delhi: { lat: 28.6139, lng: 77.209, state: "Delhi", pincode: "110001" },
  pune: { lat: 18.5204, lng: 73.8567, state: "Maharashtra", pincode: "411001" },
  hyderabad: { lat: 17.385, lng: 78.4867, state: "Telangana", pincode: "500001" },
  chennai: { lat: 13.0827, lng: 80.2707, state: "Tamil Nadu", pincode: "600001" },
};

function coordsFor(city: string) {
  return (
    CITY_COORDS[city.trim().toLowerCase()] ?? {
      lat: 12.9716,
      lng: 77.5946,
      state: "Karnataka",
      pincode: "560001",
    }
  );
}

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    role: formData.get("role"),
    city: formData.get("city"),
    companyName: formData.get("companyName") ?? undefined,
    language: formData.get("language") ?? "en",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
  if (existing) {
    return { error: "That phone number is already registered. Sign in instead." };
  }

  const geo = coordsFor(data.city);
  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      phone: data.phone,
      passwordHash,
      role: data.role,
      fullName: data.fullName,
      preferredLanguage: data.language,
      ...(data.role === "WORKER"
        ? {
            workerProfile: {
              create: {
                addressLine: `${data.city}`,
                city: data.city,
                state: geo.state,
                pincode: geo.pincode,
                latitude: geo.lat,
                longitude: geo.lng,
              },
            },
          }
        : {
            employerProfile: {
              create: {
                companyName: data.companyName?.trim() || data.fullName,
                companyType: "Other",
                contactPerson: data.fullName,
                addressLine: `${data.city}`,
                city: data.city,
                state: geo.state,
                pincode: geo.pincode,
                latitude: geo.lat,
                longitude: geo.lng,
              },
            },
          }),
    },
  });

  await createSession({ userId: user.id, role: user.role, fullName: user.fullName });

  // Same rule as sign-in: an existing choice wins over the enum default.
  const store = await cookies();
  if (!isSupportedLocale(store.get(LANG_COOKIE)?.value)) {
    store.set(LANG_COOKIE, data.language, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }

  redirect(dashboardPathFor(user.role));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/**
 * Switching language sets a cookie and re-renders. It deliberately does not
 * redirect, touch the session, or clear form state - changing language mid-form
 * should not cost somebody the details they already typed.
 *
 * The cookie is the source of truth because it is the only store that holds all
 * thirteen locales and survives a browser restart. For signed-in users whose
 * choice the `Language` enum can represent, it is mirrored to the database too,
 * so en/hi carry across devices. The other eleven stay cookie-only rather than
 * forcing a schema migration; see the report.
 */
export async function setLanguageAction(formData: FormData): Promise<void> {
  const lang = normaliseLang(String(formData.get("lang") ?? "en"));
  const store = await cookies();
  store.set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  if (lang === "en" || lang === "hi") {
    const session = await getSession();
    if (session) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { preferredLanguage: lang },
      });
    }
  }

  revalidatePath("/", "layout");
}
