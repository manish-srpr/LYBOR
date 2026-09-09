import { redirect } from "next/navigation";
import { LocationRequest } from "@/components/app/location-request";
import { dashboardPathFor, getSession } from "@/lib/auth";
import { getLocale } from "@/lib/lang";
import { safeNextPath } from "@/lib/location-session";

/**
 * The post-login location step.
 *
 * Reachable only with a session: a visitor who lands here without one is sent
 * to sign in, which is what keeps the geolocation prompt strictly behind
 * credential verification. Admin is excluded and never routed here.
 */
export default async function LocationPage(props: PageProps<"/location">) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Admin does not punch attendance and is deliberately not gated on location.
  if (session.role === "ADMIN") redirect(dashboardPathFor("ADMIN"));

  const searchParams = await props.searchParams;
  const lang = await getLocale();
  const next = safeNextPath(searchParams.next, dashboardPathFor(session.role));

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <LocationRequest lang={lang} next={next} />
    </div>
  );
}

export const dynamic = "force-dynamic";
