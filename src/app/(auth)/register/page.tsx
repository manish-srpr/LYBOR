import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";
import { dashboardPathFor, getSession } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect(dashboardPathFor(session.role));

  const { lang, t } = await getTranslator();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.register")}</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{t("app.tagline")}</p>
      </div>

      <RegisterForm lang={lang} />

      <p className="text-sm text-[var(--muted-foreground)]">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-medium text-[var(--primary)] underline">
          {t("auth.login")}
        </Link>
      </p>
    </div>
  );
}
