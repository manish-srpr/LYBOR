"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { markPaymentPaidAction } from "@/server/actions/payments";
import type { ActionResult } from "@/server/actions/attendance";
import type { Lang } from "@/lib/i18n";

export function PayForm({ paymentId, lang }: { paymentId: string; lang: Lang }) {
  const isHi = lang === "hi";
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  if (result?.ok) return <Alert tone="success">{result.message}</Alert>;

  return (
    <form
      className="space-y-2"
      action={(formData) => {
        startTransition(async () => {
          setResult(await markPaymentPaidAction(formData));
        });
      }}
    >
      {result ? <Alert tone="destructive">{result.message}</Alert> : null}
      <input type="hidden" name="paymentId" value={paymentId} />

      <div className="flex flex-wrap gap-2">
        <Select name="method" defaultValue="LEDGER_MOCK" className="h-9 w-auto text-sm">
          <option value="LEDGER_MOCK">
            {isHi ? "मॉक बही (डेमो)" : "Mock ledger (demo)"}
          </option>
          <option value="UPI">UPI</option>
          <option value="BANK_TRANSFER">
            {isHi ? "बैंक ट्रांसफर" : "Bank transfer"}
          </option>
          <option value="CASH">{isHi ? "नकद" : "Cash"}</option>
        </Select>
        <Button type="submit" size="sm" variant="success" disabled={pending}>
          {pending
            ? isHi
              ? "जारी किया जा रहा है..."
              : "Releasing..."
            : isHi
              ? "भुगतान जारी करें"
              : "Release payment"}
        </Button>
      </div>
    </form>
  );
}
