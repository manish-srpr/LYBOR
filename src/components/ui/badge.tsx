import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
        primary: "bg-[var(--primary)] text-[var(--primary-foreground)]",
        success: "bg-[var(--success)] text-[var(--success-foreground)]",
        warning: "bg-[var(--warning)] text-[var(--warning-foreground)]",
        destructive: "bg-[var(--destructive)] text-[var(--destructive-foreground)]",
        outline: "border border-[var(--border)] text-[var(--muted-foreground)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
