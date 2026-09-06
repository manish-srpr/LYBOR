import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { prisma } from "@/lib/db";
import { renderNotification } from "@/lib/notifications";
import { markNotificationsReadAction } from "@/server/actions/admin";
import type { Lang } from "@/lib/i18n";

export async function NotificationsPanel({
  userId,
  lang,
}: {
  userId: string;
  lang: Lang;
}) {
  const isHi = lang === "hi";
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={isHi ? "सूचनाएँ" : "Notifications"}
        description={
          isHi
            ? "हर सूचना आपकी चुनी हुई भाषा में दिखती है।"
            : "Every notification renders in whichever language you have chosen."
        }
        action={
          unread > 0 ? (
            <form action={markNotificationsReadAction}>
              <button
                type="submit"
                className="text-sm font-medium text-[var(--primary)] underline"
              >
                {isHi ? "सभी पढ़े हुए चिह्नित करें" : "Mark all read"}
              </button>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState title={isHi ? "कोई सूचना नहीं" : "No notifications yet"} />
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const copy = renderNotification(
              lang,
              notification.type,
              notification.params,
            );
            const body = (
              <Card
                className={
                  notification.isRead ? "" : "border-[var(--primary)]/50 bg-[var(--primary)]/5"
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{copy.title}</p>
                      <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
                        {copy.body}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-[var(--muted-foreground)] tabular-nums">
                      {notification.createdAt.toISOString().slice(5, 10)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
            return notification.linkUrl ? (
              <Link key={notification.id} href={notification.linkUrl} className="block">
                {body}
              </Link>
            ) : (
              <div key={notification.id}>{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
