"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { resolveDisputeAction } from "@/server/actions/disputes";
import type { ActionResult } from "@/server/actions/attendance";
import type { Lang } from "@/lib/i18n";

export function ResolveDisputeForm({
  disputeId,
  lang,
  hasFrozenPayment,
}: {
  disputeId: string;
  lang: Lang;
  hasFrozenPayment: boolean;
}) {
  const isHi = lang === "hi";
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  if (result?.ok) return <Alert tone="success">{result.message}</Alert>;

  return (
    <form
      className="space-y-3"
      action={(formData) => {
        startTransition(async () => {
          setResult(await resolveDisputeAction(formData));
        });
      }}
    >
      {result ? <Alert tone="destructive">{result.message}</Alert> : null}
      <input type="hidden" name="disputeId" value={disputeId} />

      <Field label={isHi ? "निर्णय" : "Decision"} htmlFor={`decision-${disputeId}`}>
        <Select id={`decision-${disputeId}`} name="decision" defaultValue="RESOLVED">
          <option value="RESOLVED">
            {isHi ? "हल हो गया (शिकायत सही)" : "Resolved in favour of the complainant"}
          </option>
          <option value="REJECTED">
            {isHi ? "अस्वीकृत (शिकायत निराधार)" : "Rejected, no change warranted"}
          </option>
          <option value="UNDER_REVIEW">
            {isHi ? "समीक्षा जारी" : "Keep under review"}
          </option>
        </Select>
      </Field>

      <Field
        label={isHi ? "स्पष्टीकरण" : "Explanation shown to both sides"}
        htmlFor={`resolution-${disputeId}`}
      >
        <Textarea id={`resolution-${disputeId}`} name="resolution" maxLength={800} required />
      </Field>

      {hasFrozenPayment ? (
        <Field
          label={isHi ? "रुका हुआ भुगतान" : "The frozen payment"}
          htmlFor={`release-${disputeId}`}
        >
          <Select
            id={`release-${disputeId}`}
            name="releasePayment"
            defaultValue="no"
          >
            <option value="no">
              {isHi
                ? "लंबित पर लौटाएँ (नियोक्ता फिर से स्वीकृत करे)"
                : "Return to pending, employer re-approves"}
            </option>
            <option value="yes">
              {isHi
                ? "स्वीकृत पर लौटाएँ (भुगतान के लिए तैयार)"
                : "Return to approved, ready to pay"}
            </option>
          </Select>
        </Field>
      ) : null}

      <Button type="submit" size="sm" block disabled={pending}>
        {pending
          ? isHi
            ? "सहेजा जा रहा है..."
            : "Saving..."
          : isHi
            ? "निर्णय दर्ज करें"
            : "Record the decision"}
      </Button>
    </form>
  );
}
