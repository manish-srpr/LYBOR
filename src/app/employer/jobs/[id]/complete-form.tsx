"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { completeAssignmentAction } from "@/server/actions/payments";
import type { ActionResult } from "@/server/actions/attendance";
import type { Lang } from "@/lib/i18n";

/**
 * Closing an assignment is irreversible - it mints the worker's permanent
 * verified work record - so it is gated behind every pending day being
 * reviewed first.
 */
export function CompleteAssignmentForm({
  assignmentId,
  lang,
  blocked,
}: {
  assignmentId: string;
  lang: Lang;
  blocked: boolean;
}) {
  const isHi = lang === "hi";
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <details className="rounded-lg border border-[var(--border)] p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {isHi ? "नियुक्ति पूरी करें और रेटिंग दें" : "Complete assignment and rate"}
      </summary>

      <form
        className="mt-3 space-y-3"
        action={(formData) => {
          startTransition(async () => {
            setResult(await completeAssignmentAction(formData));
          });
        }}
      >
        {result ? (
          <Alert tone={result.ok ? "success" : "destructive"}>{result.message}</Alert>
        ) : null}

        <input type="hidden" name="assignmentId" value={assignmentId} />

        <Field label={isHi ? "रेटिंग" : "Rating"} htmlFor={`rating-${assignmentId}`}>
          <Select id={`rating-${assignmentId}`} name="rating" defaultValue="5">
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} / 5
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={isHi ? "समीक्षा (वैकल्पिक)" : "Review (optional)"}
          htmlFor={`review-${assignmentId}`}
        >
          <Textarea id={`review-${assignmentId}`} name="review" maxLength={500} />
        </Field>

        <Button type="submit" size="sm" block disabled={pending || blocked}>
          {blocked
            ? isHi
              ? "पहले लंबित उपस्थिति की समीक्षा करें"
              : "Review pending attendance first"
            : pending
              ? isHi
                ? "बंद किया जा रहा है..."
                : "Closing..."
              : isHi
                ? "नियुक्ति बंद करें"
                : "Close assignment"}
        </Button>

        <p className="text-xs text-[var(--muted-foreground)]">
          {isHi
            ? "यह श्रमिक के स्थायी सत्यापित इतिहास में दर्ज हो जाएगा।"
            : "This becomes a permanent entry in the worker verified history."}
        </p>
      </form>
    </details>
  );
}
