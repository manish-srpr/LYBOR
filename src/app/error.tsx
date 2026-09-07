"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The app-wide error boundary. It never shows a stack trace to a worker; the
 * digest is enough for an operator to find the real error in the server logs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("LYBOR route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-[var(--destructive)]/10">
        <TriangleAlert className="size-6 text-[var(--destructive)]" aria-hidden />
      </span>
      <div>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          This screen could not load. Your work, hours and payments are unaffected.
        </p>
      </div>
      <Button onClick={reset} size="lg">
        <RotateCw aria-hidden />
        Try again
      </Button>
      {error.digest ? (
        <p className="font-mono text-xs text-[var(--muted-foreground)]">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
