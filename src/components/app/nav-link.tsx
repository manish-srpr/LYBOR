"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  label,
  icon,
  variant = "sidebar",
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  variant?: "sidebar" | "tab";
}) {
  const pathname = usePathname();
  // Exact match for section roots so /worker does not stay lit on /worker/jobs.
  const segments = href.split("/").filter(Boolean);
  const active =
    segments.length <= 1
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "tab") {
    return (
      <Link
        href={href}
        className={cn(
          "flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium",
          active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
        )}
        aria-current={active ? "page" : undefined}
      >
        <span className="[&_svg]:size-5">{icon}</span>
        <span className="max-w-full truncate">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium [&_svg]:size-4",
        active
          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
      )}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {label}
    </Link>
  );
}
