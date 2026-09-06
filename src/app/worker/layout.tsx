import {
  FileText,
  HardHat,
  History,
  LayoutDashboard,
  MessageSquareWarning,
  Search,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/app/app-shell";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getLang } from "@/lib/lang";

const NAV: NavItem[] = [
  { href: "/worker", labelKey: "nav.dashboard", icon: <LayoutDashboard /> },
  { href: "/worker/jobs", labelKey: "nav.jobs", icon: <Search /> },
  { href: "/worker/assignments", labelKey: "nav.assignments", icon: <HardHat /> },
  { href: "/worker/earnings", labelKey: "nav.earnings", icon: <Wallet /> },
  { href: "/worker/history", labelKey: "nav.history", icon: <History /> },
  { href: "/worker/applications", labelKey: "nav.applications", icon: <FileText /> },
  { href: "/worker/kyc", labelKey: "nav.kyc", icon: <ShieldCheck /> },
  { href: "/worker/disputes", labelKey: "nav.disputes", icon: <MessageSquareWarning /> },
  { href: "/worker/profile", labelKey: "nav.profile", icon: <User /> },
];

export default async function WorkerLayout({ children }: LayoutProps<"/worker">) {
  const session = await requireRole("WORKER");
  const lang = await getLang();
  const unreadCount = await prisma.notification.count({
    where: { userId: session.userId, isRead: false },
  });

  return (
    <AppShell
      role="WORKER"
      lang={lang}
      userName={session.fullName}
      unreadCount={unreadCount}
      nav={NAV}
    >
      {children}
    </AppShell>
  );
}

// Every screen reads session-scoped data, so nothing here is safe to
// prerender at build time.
export const dynamic = "force-dynamic";
