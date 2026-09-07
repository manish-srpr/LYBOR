import Link from "next/link";
import { LanguageToggle } from "@/components/app/language-toggle";
import { getTranslator } from "@/lib/lang";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
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
          <div className="ml-auto">
            <LanguageToggle lang={lang} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
