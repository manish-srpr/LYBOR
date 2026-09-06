import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  tone = "primary",
}: {
  /** 0..100 */
  value: number;
  className?: string;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const toneVar = {
    primary: "var(--primary)",
    success: "var(--success)",
    warning: "var(--warning)",
    destructive: "var(--destructive)",
  }[tone];
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${clamped}%`, background: toneVar }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-[var(--muted-foreground)]">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning";
}) {
  const valueTone =
    tone === "success"
      ? "text-[var(--success)]"
      : tone === "warning"
        ? "text-[var(--warning)]"
        : "text-[var(--foreground)]";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", valueTone)}>{value}</p>
      {hint ? (
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function Alert({
  tone = "default",
  title,
  children,
}: {
  tone?: "default" | "success" | "warning" | "destructive";
  title?: string;
  children: React.ReactNode;
}) {
  const toneClass = {
    default: "border-[var(--border)] bg-[var(--muted)]",
    success: "border-[var(--success)]/40 bg-[var(--success)]/10",
    warning: "border-[var(--warning)]/50 bg-[var(--warning)]/10",
    destructive: "border-[var(--destructive)]/40 bg-[var(--destructive)]/10",
  }[tone];
  return (
    <div className={cn("rounded-lg border p-3 text-sm", toneClass)}>
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={cn(title && "mt-1", "text-[var(--muted-foreground)]")}>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function DataRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
