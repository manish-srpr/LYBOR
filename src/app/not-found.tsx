import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-[var(--muted)]">
        <Compass className="size-6 text-[var(--muted-foreground)]" aria-hidden />
      </span>
      <div>
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          That link does not point anywhere in STRIVER. It may have been a job or
          assignment that has since closed.
        </p>
      </div>
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        Back to STRIVER
      </Link>
    </div>
  );
}
