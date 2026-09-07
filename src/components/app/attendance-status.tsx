import { StatusBadge } from "./status-badge";
import { translatorFor, type Lang } from "@/lib/i18n";

/**
 * Three separate decisions ride on every attendance day: did GPS verify it, did
 * the employer approve it, and has the money moved. Three bare badges in a row
 * are unreadable, so each one is labelled with the question it answers.
 */
export function AttendanceStatusStrip({
  verification,
  approval,
  payment,
  lang,
}: {
  verification: string;
  approval: string;
  payment?: string | null;
  lang: Lang;
}) {
  const t = translatorFor(lang);

  const items = [
    {
      label: t("att.gpsCheck"),
      status: verification,
    },
    {
      label: t("att.employerDecision"),
      status: approval,
    },
    ...(payment
      ? [{ label: t("att.paymentState"), status: payment }]
      : []),
  ];

  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <dt className="text-xs text-[var(--muted-foreground)]">{item.label}</dt>
          <dd>
            <StatusBadge status={item.status} lang={lang} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
