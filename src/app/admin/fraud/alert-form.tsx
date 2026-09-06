"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { reviewFraudAlertAction } from "@/server/actions/admin";
import type { ActionResult } from "@/server/actions/attendance";
import type { Lang } from "@/lib/i18n";

export function FraudAlertForm({ alertId, lang }: { alertId: string; lang: Lang }) {
  const isHi = lang === "hi";
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  if (result?.ok) return <Alert tone="success">{result.message}</Alert>;

  return (
    <form
      className="space-y-2"
      action={(formData) => {
        startTransition(async () => {
          setResult(await reviewFraudAlertAction(formData));
        });
      }}
    >
      {result ? <Alert tone="destructive">{result.message}</Alert> : null}
      <input type="hidden" name="alertId" value={alertId} />
      <Input
        name="notes"
        maxLength={500}
        placeholder={
          isHi ? "समीक्षा टिप्पणी (वैकल्पिक)" : "Review notes (optional)"
        }
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="decision"
          value="DISMISSED"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          {isHi ? "खारिज करें" : "Dismiss"}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="REVIEWING"
          size="sm"
          variant="secondary"
          disabled={pending}
        >
          {isHi ? "समीक्षा में" : "Mark reviewing"}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="CONFIRMED"
          size="sm"
          variant="destructive"
          disabled={pending}
        >
          {isHi ? "पुष्टि करें" : "Confirm"}
        </Button>
      </div>
    </form>
  );
}
