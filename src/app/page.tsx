import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { LanguageToggle } from "@/components/app/language-toggle";
import { dashboardPathFor, getSession } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";

/**
 * The authentication gateway.
 *
 * This is the only screen an unauthenticated visitor sees. It deliberately
 * carries no product surface - no feature cards, no workflow tour, no
 * dashboard preview - so the single decision on offer is create an account or
 * sign in. Everything the platform actually does lives behind a role layout
 * that calls `requireRole` on the server.
 *
 * The language toggle is the one control that stays. A worker who reads Hindi
 * has to be able to switch before reaching the sign-in form, or the form
 * itself is unreadable to them.
 */
export default async function Home() {
  const session = await getSession();
  if (session) redirect(dashboardPathFor(session.role));

  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex justify-end px-4 py-3">
        <LanguageToggle lang={lang} />
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 pb-10">
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden
            className="grid size-14 place-items-center rounded-2xl bg-[var(--primary)] text-xl font-semibold text-[var(--primary-foreground)]"
          >
            L
          </span>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight">
            {t("app.name")}
          </h1>

          <p className="mt-2 text-base text-[var(--muted-foreground)]">
            {t("app.tagline")}
          </p>

          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {isHi
              ? "ब्लू-कॉलर वर्कफ़ोर्स ट्रस्ट प्लेटफ़ॉर्म"
              : "Blue-collar workforce trust platform"}
          </p>
        </div>

        <div className="mt-9 flex flex-col gap-3">
          <Link href="/register" className={buttonVariants({ size: "lg", block: true })}>
            {t("auth.register")}
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ size: "lg", block: true, variant: "outline" })}
          >
            {t("auth.login")}
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          {isHi
            ? "जारी रखने के लिए खाता बनाएँ या साइन इन करें।"
            : "Create an account or sign in to continue."}
        </p>
      </main>

      <footer className="px-5 pb-6">
        <p className="mx-auto max-w-sm text-center text-xs text-[var(--muted-foreground)]">
          {isHi
            ? "LYBOR प्रोटोटाइप — डेमो डेटा पर चल रहा है। यह एक प्रदर्शन बिल्ड है, वास्तविक भुगतान सेवा नहीं।"
            : "LYBOR prototype — running on seeded demo data. This is a demonstration build, not a live payments service."}
        </p>
      </footer>
    </div>
  );
}
