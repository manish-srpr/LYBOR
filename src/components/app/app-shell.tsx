import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import type { Role } from "@prisma/client";
import { LanguageToggle } from "./language-toggle";
import { NavLink } from "./nav-link";
import { logoutAction } from "@/server/actions/session";
import { translatorFor, type Lang, type TranslationKey } from "@/lib/i18n";

export type NavItem = {
  href: string;
  labelKey: TranslationKey;
  icon: React.ReactNode;
};

/**
 * Mobile-first chrome: a compact top bar plus a thumb-reachable bottom tab bar
 * on phones, promoted to a sidebar from `md` up. Everything below the header
 * scrolls; the tab bar never does.
 */
export function AppShell({
  role,
  lang,
  userName,
  unreadCount,
  nav,
  children,
}: {
  role: Role;
  lang: Lang;
  userName: string;
  unreadCount: number;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const t = translatorFor(lang);
  const home = role === "WORKER" ? "/worker" : role === "EMPLOYER" ? "/employer" : "/admin";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <Link href={home} className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--primary)] text-sm text-[var(--primary-foreground)]">
              S
            </span>
            <span className="hidden sm:inline">{t("app.name")}</span>
          </Link>

          <span className="ml-auto hidden text-sm text-[var(--muted-foreground)] sm:inline">
            {userName}
          </span>

          <Link
            href={`${home}/notifications`}
            className="relative grid size-9 place-items-center rounded-full border border-[var(--border)] hover:bg-[var(--muted)]"
            aria-label={t("nav.notifications")}
          >
            <Bell className="size-4" aria-hidden />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-semibold text-[var(--destructive-foreground)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Link>

          <LanguageToggle lang={lang} />

          <form action={logoutAction}>
            <button
              type="submit"
              className="grid size-9 place-items-center rounded-full border border-[var(--border)] hover:bg-[var(--muted)]"
              aria-label={t("nav.logout")}
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-4 md:py-6">
        <nav className="hidden w-52 shrink-0 md:block">
          <ul className="sticky top-20 space-y-1">
            {nav.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} icon={item.icon} label={t(item.labelKey)} />
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      {/*
        Every section stays reachable on a phone. Slicing to five tabs left the
        later nav items with no route in on mobile, so the strip scrolls
        horizontally instead and each tab keeps a full-width tap target.
      */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur md:hidden"
        aria-label={t("nav.dashboard")}
      >
        <ul className="flex snap-x overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {nav.map((item) => (
            <li key={item.href} className="min-w-[4.5rem] flex-1 snap-start">
              <NavLink
                href={item.href}
                icon={item.icon}
                label={t(item.labelKey)}
                variant="tab"
              />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
