"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { createDisputeAction } from "@/server/actions/disputes";
import type { ActionResult } from "@/server/actions/attendance";
import type { Lang } from "@/lib/i18n";

const CATEGORIES = [
  { value: "WAGE", en: "Wage amount", hi: "मजदूरी की राशि" },
  { value: "HOURS", en: "Hours recorded", hi: "दर्ज घंटे" },
  { value: "ATTENDANCE", en: "Attendance decision", hi: "उपस्थिति का निर्णय" },
  { value: "PAYMENT_DELAY", en: "Payment delay", hi: "भुगतान में देरी" },
  { value: "SAFETY", en: "Safety at the site", hi: "कार्यस्थल पर सुरक्षा" },
  { value: "BEHAVIOUR", en: "Behaviour", hi: "व्यवहार" },
  { value: "OTHER", en: "Something else", hi: "अन्य" },
];

export function DisputeForm({
  lang,
  context,
}: {
  lang: Lang;
  context?: {
    jobId?: string;
    assignmentId?: string;
    attendanceId?: string;
    paymentId?: string;
  };
}) {
  const isHi = lang === "hi";
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        startTransition(async () => {
          const next = await createDisputeAction(formData);
          setResult(next);
        });
      }}
    >
      {result ? (
        <Alert tone={result.ok ? "success" : "destructive"}>{result.message}</Alert>
      ) : null}

      {context?.jobId ? <input type="hidden" name="jobId" value={context.jobId} /> : null}
      {context?.assignmentId ? (
        <input type="hidden" name="assignmentId" value={context.assignmentId} />
      ) : null}
      {context?.attendanceId ? (
        <input type="hidden" name="attendanceId" value={context.attendanceId} />
      ) : null}
      {context?.paymentId ? (
        <input type="hidden" name="paymentId" value={context.paymentId} />
      ) : null}

      <Field label={isHi ? "मामला किस बारे में है?" : "What is the issue about?"} htmlFor="category">
        <Select id="category" name="category" defaultValue="WAGE" required>
          {CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {isHi ? category.hi : category.en}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={isHi ? "संक्षिप्त कारण" : "Short reason"} htmlFor="reason">
        <Input
          id="reason"
          name="reason"
          maxLength={120}
          placeholder={
            isHi ? "जैसे: घंटे कम गिने गए" : "e.g. Hours were counted short"
          }
          required
        />
      </Field>

      <Field label={isHi ? "क्या हुआ?" : "What happened?"} htmlFor="description">
        <Textarea id="description" name="description" maxLength={1000} required />
      </Field>

      <Field
        label={isHi ? "सबूत या नोट (वैकल्पिक)" : "Evidence or notes (optional)"}
        htmlFor="evidenceNotes"
      >
        <Textarea id="evidenceNotes" name="evidenceNotes" maxLength={1000} />
      </Field>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending
          ? isHi
            ? "भेजा जा रहा है..."
            : "Submitting..."
          : isHi
            ? "शिकायत दर्ज करें"
            : "Raise dispute"}
      </Button>

      <p className="text-xs text-[var(--muted-foreground)]">
        {isHi
          ? "विवादित भुगतान समीक्षा तक रोक दिया जाता है, वापस नहीं लिया जाता।"
          : "A disputed payment is frozen while it is reviewed, never reversed."}
      </p>
    </form>
  );
}
