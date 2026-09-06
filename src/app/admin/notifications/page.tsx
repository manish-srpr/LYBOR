import { NotificationsPanel } from "@/components/app/notifications-panel";
import { requireSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";

export default async function NotificationsPage() {
  const session = await requireSession();
  const lang = await getLang();
  return <NotificationsPanel userId={session.userId} lang={lang} />;
}
