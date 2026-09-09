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
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import {
  LOCATION_COOKIE,
  LOCATION_GRANTED,
  locationStepPath,
} from "@/lib/location-session";

const NAV: NavItem[] = [
  { href: "/employer", labelKey: "nav.dashboard", icon: <LayoutDashboard /> },
  { href: "/employer/jobs", labelKey: "nav.myJobs", icon: <BriefcaseBusiness /> },
  { href: "/employer/approvals", labelKey: "nav.attendanceApprovals", icon: <CircleCheckBig /> },
  { href: "/employer/payments", labelKey: "nav.payments", icon: <Wallet /> },
  { href: "/employer/jobs/new", labelKey: "nav.postJob", icon: <PlusCircle /> },
  { href: "/employer/disputes", labelKey: "nav.disputes", icon: <MessageSquareWarning /> },
  { href: "/employer/kyc", labelKey: "nav.kyc", icon: <ShieldCheck /> },
];

export default async function EmployerLayout({ children }: LayoutProps<"/employer">) {
  const session = await requireRole("EMPLOYER");

  // Belt and braces behind src/proxy.ts, which is what actually stops the
  // dashboard being rendered - a redirect from here throws only after React
  // has already computed the page alongside the layout. Kept so the rule
  // still holds if the proxy matcher is ever narrowed.
  const store = await cookies();
  if (store.get(LOCATION_COOKIE)?.value !== LOCATION_GRANTED) {
    redirect(locationStepPath("/employer"));
  }
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
