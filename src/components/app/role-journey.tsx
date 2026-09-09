import { Briefcase, HardHat } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { translatorFor } from "@/lib/i18n";

/**
 * The one-line answer to "whose screen is this?".
 *
 * The two dashboards had drifted into looking like the same product: both led
 * with cards about jobs, so an employer's home screen read as a worker's job
 * feed pointed at their own postings. This strip states the role's goal in its
 * own words and colour before any data, so the two are distinguishable at a
 * glance even by someone who cannot read the rest quickly.
 *
 * Not decoration - it is the only element on either dashboard that names what
 * the person is here to do.
 */
export function RoleJourney({ role, lang }: { role: "WORKER" | "EMPLOYER"; lang: Lang }) {
  const t = translatorFor(lang);
  const isWorker = role === "WORKER";
  const steps = t(isWorker ? "wrk.journey" : "emp.journey").split("→");

  return (
    <div
      className={
        isWorker
          ? "rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/5 px-4 py-3"
          : "rounded-xl border border-[var(--accent-foreground)]/20 bg-[var(--accent)] px-4 py-3"
      }
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={
            isWorker
              ? "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary)]"
              : "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--foreground)]/10 text-[var(--foreground)]"
          }
        >
          {isWorker ? <HardHat className="size-4" /> : <Briefcase className="size-4" />}
        </span>
        {/* Wraps rather than scrolls: five short steps must not create a
            horizontal scrollbar on a 320px screen. */}
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span aria-hidden className="text-[var(--muted-foreground)]">
                  →
                </span>
              ) : null}
              <span>{step.trim()}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
