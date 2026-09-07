"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleAlert, Minus, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/misc";
import {
  renderMatchFactorLabel,
  renderMatchFactorReason,
  type MatchFactor,
} from "@/lib/matching";
import { translatorFor, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function toneFor(score: number) {
  if (score >= 80) return "success" as const;
  if (score >= 65) return "primary" as const;
  if (score >= 45) return "warning" as const;
  return "destructive" as const;
}

const TONE_TEXT = {
  success: "text-[var(--success)]",
  primary: "text-[var(--primary)]",
  warning: "text-[var(--warning)]",
  destructive: "text-[var(--destructive)]",
} as const;

const TONE_RING = {
  success: "var(--success)",
  primary: "var(--primary)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
} as const;

/** A factor reads as met / partial / unmet, so the list scans in one glance. */
function verdictOf(score: number): "met" | "partial" | "unmet" {
  if (score >= 0.75) return "met";
  if (score >= 0.4) return "partial";
  return "unmet";
}

const VERDICT_ICON = {
  met: Check,
  partial: Minus,
  unmet: CircleAlert,
};

const VERDICT_CLASS = {
  met: "text-[var(--success)]",
  partial: "text-[var(--warning)]",
  unmet: "text-[var(--destructive)]",
};

/**
 * The match score is never shown as a bare number.
 *
 * The six factors are always visible as a pass/partial/fail checklist - that is
 * what makes the recommendation auditable at a glance. Expanding adds the
 * weight, the exact sub-score and the full sentence behind each one.
 */
export function MatchExplainer({
  score,
  factors,
  lang,
  summary,
}: {
  score: number;
  factors: MatchFactor[];
  lang: Lang;
  summary?: string;
}) {
  const [open, setOpen] = useState(false);
  const tone = toneFor(score);
  const t = translatorFor(lang);
  const met = factors.filter((f) => verdictOf(f.score) === "met").length;

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
      aria-label={t("match.title")}
    >
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--muted)]/50 p-3">
        {/* Score dial: the number and its severity readable without colour alone. */}
        <div
          className="relative grid size-14 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(${TONE_RING[tone]} ${score * 3.6}deg, var(--muted) 0deg)`,
          }}
        >
          <span className="grid size-11 place-items-center rounded-full bg-[var(--card)]">
            <span className={cn("text-sm font-bold tabular-nums", TONE_TEXT[tone])}>
              {score}%
            </span>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-3.5 text-[var(--primary)]" aria-hidden />
            {t("match.title")}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {t("match.factorsMet", { met, total: factors.length })}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {factors.map((factor) => {
          const verdict = verdictOf(factor.score);
          const Icon = VERDICT_ICON[verdict];
          return (
            <li key={factor.key} className="px-3 py-2">
              <div className="flex items-start gap-2">
                <Icon
                  className={cn("mt-0.5 size-4 shrink-0", VERDICT_CLASS[verdict])}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {renderMatchFactorLabel(factor, lang)}
                    </span>
                    {open ? (
                      <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                        {Math.round(factor.score * 100)}%
                        <span className="ms-1 opacity-70">
                          × {Math.round(factor.weight * 100)}%
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "text-xs text-[var(--muted-foreground)]",
                      !open && "line-clamp-1",
                    )}
                  >
                    {renderMatchFactorReason(factor, lang)}
                  </p>
                  {open ? (
                    <Progress
                      value={factor.score * 100}
                      tone={toneFor(factor.score * 100)}
                      className="mt-1.5 h-1.5"
                    />
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1.5 border-t border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--primary)] hover:bg-[var(--muted)]"
      >
        {open ? t("match.showLess") : t("match.howCalculated")}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <p className="border-t border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2 text-xs text-[var(--muted-foreground)]">
          {t("match.methodology")}
          {summary ? ` ${summary}` : ""}
        </p>
      ) : null}
    </section>
  );
}
