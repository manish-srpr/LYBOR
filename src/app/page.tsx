import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { LanguageToggle } from "@/components/app/language-toggle";
import { dashboardPathFor, getSession } from "@/lib/auth";
import { getTranslator, hasChosenLocale } from "@/lib/lang";

/**
 * The authentication gateway.
 *
 * The only screen an unauthenticated visitor sees. It carries no product
 * surface - no feature cards, no workflow tour, no dashboard preview - so the
 * single decision on offer is create an account or sign in. Everything the
 * platform does lives behind a role layout that calls `requireRole` on the
 * server.
 *
 * The language selector sits above the fold and before authentication on
 * purpose: a worker who reads only Punjabi has to be able to switch before
 * reaching the sign-in form, or the form itself is unreadable to them.
 */
export default async function Home() {
  const session = await getSession();
  if (session) redirect(dashboardPathFor(session.role));

  // Language comes before everything else for a first-time visitor. Checked
  // after the session redirect so a signed-in user is never bounced here.
  if (!(await hasChosenLocale())) redirect("/language?next=%2F");

  const { lang, t } = await getTranslator();

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
            {t("app.descriptor")}
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
          {t("app.gatewayPrompt")}
        </p>
      </main>

      <footer className="px-5 pb-6">
        <p className="mx-auto max-w-sm text-center text-xs text-[var(--muted-foreground)]">
          {t("app.prototypeNotice")}
        </p>
      </footer>
    </div>
  );
}
