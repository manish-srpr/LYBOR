import {
  BriefcaseBusiness,
  CircleCheckBig,
  LayoutDashboard,
  MessageSquareWarning,
  PlusCircle,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/app/app-shell";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getLang } from "@/lib/lang";

const NAV: NavItem[] = [
  { href: "/employer", labelKey: "nav.dashboard", icon: <LayoutDashboard /> },
  { href: "/employer/jobs", labelKey: "nav.myJobs", icon: <BriefcaseBusiness /> },
  { href: "/employer/approvals", labelKey: "nav.approvals", icon: <CircleCheckBig /> },
  { href: "/employer/payments", labelKey: "nav.payments", icon: <Wallet /> },
  { href: "/employer/jobs/new", labelKey: "nav.postJob", icon: <PlusCircle /> },
  { href: "/employer/disputes", labelKey: "nav.disputes", icon: <MessageSquareWarning /> },
  { href: "/employer/kyc", labelKey: "nav.kyc", icon: <ShieldCheck /> },
];

export default async function EmployerLayout({ children }: LayoutProps<"/employer">) {
  const session = await requireRole("EMPLOYER");
  const lang = await getLang();
  const unreadCount = await prisma.notification.count({
    where: { userId: session.userId, isRead: false },
  });

  return (
    <AppShell
      role="EMPLOYER"
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
