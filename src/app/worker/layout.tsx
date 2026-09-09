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
  { href: "/worker", labelKey: "nav.dashboard", icon: <LayoutDashboard /> },
  { href: "/worker/jobs", labelKey: "nav.jobs", icon: <Search /> },
  { href: "/worker/assignments", labelKey: "nav.assignmentsAttendance", icon: <HardHat /> },
  { href: "/worker/earnings", labelKey: "nav.earnings", icon: <Wallet /> },
  { href: "/worker/history", labelKey: "nav.history", icon: <History /> },
  { href: "/worker/applications", labelKey: "nav.applications", icon: <FileText /> },
  { href: "/worker/kyc", labelKey: "nav.kyc", icon: <ShieldCheck /> },
  { href: "/worker/disputes", labelKey: "nav.disputes", icon: <MessageSquareWarning /> },
  { href: "/worker/profile", labelKey: "nav.profile", icon: <User /> },
];

export default async function WorkerLayout({ children }: LayoutProps<"/worker">) {
  const session = await requireRole("WORKER");

  // Belt and braces behind src/proxy.ts, which is what actually stops the
  // dashboard being rendered - a redirect from here throws only after React
  // has already computed the page alongside the layout. Kept so the rule
  // still holds if the proxy matcher is ever narrowed.
  const store = await cookies();
  if (store.get(LOCATION_COOKIE)?.value !== LOCATION_GRANTED) {
    redirect(locationStepPath("/worker"));
  }
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
