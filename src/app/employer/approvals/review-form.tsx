"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { reviewAttendanceAction } from "@/server/actions/attendance";
import type { ActionResult } from "@/server/actions/attendance";
import type { Lang } from "@/lib/i18n";

/**
 * Approving pays the worker; rejecting withholds a day of their wages. The
 * rejection path therefore demands a written reason, which is shown back to the
 * worker verbatim and becomes the basis for any dispute.
 */
export function ReviewForm({
  attendanceId,
  lang,
}: {
  attendanceId: string;
  lang: Lang;
}) {
  const isHi = lang === "hi";
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [rejecting, setRejecting] = useState(false);

  function submit(formData: FormData) {
    startTransition(async () => {
      setResult(await reviewAttendanceAction(formData));
    });
  }

  if (result?.ok) return <Alert tone="success">{result.message}</Alert>;

  return (
    <div className="space-y-3">
      {result ? <Alert tone="destructive">{result.message}</Alert> : null}

      {!rejecting ? (
        <div className="flex flex-wrap gap-2">
          <form action={submit}>
            <input type="hidden" name="attendanceId" value={attendanceId} />
            <input type="hidden" name="decision" value="APPROVE" />
            <Button type="submit" size="sm" variant="success" disabled={pending}>
              {isHi ? "घंटे स्वीकृत करें" : "Approve hours"}
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
          <input type="hidden" name="attendanceId" value={attendanceId} />
          <input type="hidden" name="decision" value="REJECT" />
          <Input
            name="reason"
            required
            maxLength={300}
            placeholder={
              isHi
                ? "श्रमिक को कारण बताएँ (आवश्यक)"
                : "Tell the worker why (required)"
            }
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="destructive" disabled={pending}>
              {isHi ? "अस्वीकार की पुष्टि करें" : "Confirm rejection"}
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
