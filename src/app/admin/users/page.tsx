import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";
import { formatMinutes, formatPaise } from "@/lib/money";
import { setUserActiveFormAction } from "@/server/actions/admin";

export default async function AdminUsersPage(props: PageProps<"/admin/users">) {
  await requireRole("ADMIN");
  const { lang, t } = await getTranslator();
  const searchParams = await props.searchParams;
  const isHi = lang === "hi";
  const roleFilter = String(searchParams.role ?? "");

  const users = await prisma.user.findMany({
    where:
      roleFilter === "WORKER" || roleFilter === "EMPLOYER" || roleFilter === "ADMIN"
        ? { role: roleFilter }
        : {},
    include: { workerProfile: true, employerProfile: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.users")}
        description={
          isHi
            ? "खाते सक्रिय या निष्क्रिय करें। निष्क्रिय खाता साइन इन नहीं कर सकता।"
            : "Activate or deactivate accounts. A deactivated account cannot sign in."
        }
      />

      <div className="flex flex-wrap gap-2">
        {["", "WORKER", "EMPLOYER", "ADMIN"].map((role) => (
          <a
            key={role || "all"}
            href={role ? `/admin/users?role=${role}` : "/admin/users"}
            className={
              roleFilter === role
                ? "rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]"
                : "rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
            }
          >
            {role
              ? isHi
                ? { WORKER: "श्रमिक", EMPLOYER: "नियोक्ता", ADMIN: "प्रशासक" }[role]
                : { WORKER: "Workers", EMPLOYER: "Employers", ADMIN: "Admins" }[role]
              : isHi
                ? "सभी"
                : "All"}
          </a>
        ))}
      </div>

      {users.length === 0 ? (
        <EmptyState title={isHi ? "कोई उपयोगकर्ता नहीं" : "No users found"} />
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const kycStatus =
              user.workerProfile?.kycStatus ?? user.employerProfile?.kycStatus ?? null;
            return (
              <Card key={user.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">
                        {user.fullName}
                        {user.employerProfile
                          ? ` · ${user.employerProfile.companyName}`
                          : ""}
                      </CardTitle>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {user.phone} · {user.role} ·{" "}
                        {user.createdAt.toISOString().slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {kycStatus ? <StatusBadge status={kycStatus} lang={lang} /> : null}
                      <Badge variant={user.isActive ? "success" : "destructive"}>
                        {user.isActive
                          ? isHi
                            ? "सक्रिय"
                            : "Active"
                          : isHi
                            ? "निष्क्रिय"
                            : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {user.workerProfile ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {user.workerProfile.city} ·{" "}
                      {isHi ? "विश्वसनीयता" : "reliability"}{" "}
                      {Math.round(user.workerProfile.reliabilityScore)}/100 ·{" "}
                      {user.workerProfile.totalJobsCompleted}{" "}
                      {isHi ? "काम" : "jobs"} ·{" "}
                      {formatMinutes(user.workerProfile.totalMinutesWorked)} ·{" "}
                      {formatPaise(user.workerProfile.totalEarningsPaise)}
                    </p>
                  ) : null}
                  {user.employerProfile ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {user.employerProfile.city} ·{" "}
                      {user.employerProfile.totalJobsPosted}{" "}
                      {isHi ? "काम पोस्ट" : "jobs posted"} ·{" "}
                      {formatPaise(user.employerProfile.totalPaidPaise)}{" "}
                      {isHi ? "भुगतान" : "paid"}
                    </p>
                  ) : null}

                  <form action={setUserActiveFormAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={user.isActive ? "no" : "yes"}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant={user.isActive ? "outline" : "success"}
                    >
                      {user.isActive
                        ? isHi
                          ? "निष्क्रिय करें"
                          : "Deactivate"
                        : isHi
                          ? "सक्रिय करें"
                          : "Activate"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
