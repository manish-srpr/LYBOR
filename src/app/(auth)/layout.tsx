import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageToggle } from "@/components/app/language-toggle";
import { getSession } from "@/lib/auth";
import { getTranslator, hasChosenLocale } from "@/lib/lang";

/**
 * Shell for sign-in and registration.
 *
 * A first-time visitor who lands straight on /login - from a shared link, a
 * bookmark, or the browser restoring a tab - still gets the language screen
 * first, then comes back here. Without this the redirect on the gateway would
 * be a front door with the side windows left open.
 */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session && !(await hasChosenLocale())) {
    redirect("/language?next=%2Flogin");
  }

  const { lang, t } = await getTranslator();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--primary)] text-sm text-[var(--primary-foreground)]">
              L
            </span>
            {t("app.name")}
          </Link>
          <div className="ms-auto">
            <LanguageToggle lang={lang} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
