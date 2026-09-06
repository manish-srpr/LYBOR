import {
  BriefcaseBusiness,
  CalendarCheck,
  LayoutDashboard,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/app/app-shell";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getLang } from "@/lib/lang";

const NAV: NavItem[] = [
  { href: "/admin", labelKey: "nav.overview", icon: <LayoutDashboard /> },
  { href: "/admin/users", labelKey: "nav.users", icon: <Users /> },
  { href: "/admin/jobs", labelKey: "nav.allJobs", icon: <BriefcaseBusiness /> },
  { href: "/admin/attendance", labelKey: "nav.attendance", icon: <CalendarCheck /> },
  { href: "/admin/payments", labelKey: "nav.payments", icon: <Wallet /> },
  { href: "/admin/fraud", labelKey: "nav.fraud", icon: <ShieldAlert /> },
  { href: "/admin/disputes", labelKey: "nav.disputes", icon: <MessageSquareWarning /> },
  { href: "/admin/kyc", labelKey: "nav.kyc", icon: <ShieldCheck /> },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireRole("ADMIN");
  const lang = await getLang();
  const unreadCount = await prisma.notification.count({
    where: { userId: session.userId, isRead: false },
  });

  return (
    <AppShell
      role="ADMIN"
      lang={lang}
      userName={session.fullName}
      unreadCount={unreadCount}
      nav={NAV}
    >
      {children}
    </AppShell>
  );
}

export const dynamic = "force-dynamic";
