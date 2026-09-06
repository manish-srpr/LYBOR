"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { reviewKycAction } from "@/server/actions/kyc";
import type { ActionResult } from "@/server/actions/attendance";
import type { Lang } from "@/lib/i18n";

export function KycReviewForm({ recordId, lang }: { recordId: string; lang: Lang }) {
  const isHi = lang === "hi";
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [rejecting, setRejecting] = useState(false);

  function submit(formData: FormData) {
    startTransition(async () => {
      setResult(await reviewKycAction(formData));
    });
  }

  if (result?.ok) return <Alert tone="success">{result.message}</Alert>;

  return (
    <div className="space-y-2">
      {result ? <Alert tone="destructive">{result.message}</Alert> : null}

      {!rejecting ? (
        <div className="flex flex-wrap gap-2">
          <form action={submit}>
            <input type="hidden" name="recordId" value={recordId} />
            <input type="hidden" name="decision" value="VERIFIED" />
            <Button type="submit" size="sm" variant="success" disabled={pending}>
              {isHi ? "सत्यापित करें" : "Verify"}
            </Button>
          </form>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRejecting(true)}
            disabled={pending}
          >
            {isHi ? "अस्वीकार करें" : "Reject"}
          </Button>
        </div>
      ) : (
        <form action={submit} className="space-y-2">
          <input type="hidden" name="recordId" value={recordId} />
          <input type="hidden" name="decision" value="REJECTED" />
          <Input
            name="reason"
            required
            maxLength={300}
            placeholder={isHi ? "कारण (आवश्यक)" : "Reason (required)"}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="destructive" disabled={pending}>
              {isHi ? "पुष्टि करें" : "Confirm"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRejecting(false)}
            >
              {isHi ? "रद्द करें" : "Cancel"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
