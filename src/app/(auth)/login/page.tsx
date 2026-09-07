import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardPathFor, getSession } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";

const DEMO_ACCOUNTS = [
  { role: "Worker", phone: "9800000001", name: "Ramesh Kumar" },
  { role: "Employer", phone: "9800000010", name: "BuildRight Constructions" },
  { role: "Admin", phone: "9800000099", name: "Platform Admin" },
];

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(dashboardPathFor(session.role));

  const { lang, t } = await getTranslator();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.login")}</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{t("app.tagline")}</p>
      </div>

      <LoginForm lang={lang} />

      <p className="text-sm text-[var(--muted-foreground)]">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-medium text-[var(--primary)] underline">
          {t("auth.register")}
        </Link>
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("auth.demoAccounts")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {DEMO_ACCOUNTS.map((account) => (
            <div key={account.phone} className="flex items-baseline justify-between gap-3">
              <span className="text-[var(--muted-foreground)]">
                {account.role} · {account.name}
              </span>
              <span className="font-mono text-xs tabular-nums">{account.phone}</span>
            </div>
          ))}
          <p className="pt-2 text-xs text-[var(--muted-foreground)]">
            {lang === "hi"
              ? "सभी डेमो खातों का पासवर्ड: lybor123"
              : "Password for every demo account: lybor123"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
