"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { submitKycAction } from "@/server/actions/kyc";
import type { ActionResult } from "@/server/actions/attendance";
import type { Lang } from "@/lib/i18n";

const DOC_TYPES = [
  { value: "AADHAAR", en: "Aadhaar", hi: "आधार" },
  { value: "PAN", en: "PAN", hi: "पैन" },
  { value: "DRIVING_LICENSE", en: "Driving licence", hi: "ड्राइविंग लाइसेंस" },
  { value: "VOTER_ID", en: "Voter ID", hi: "मतदाता पहचान पत्र" },
  { value: "LABOUR_CARD", en: "Labour card", hi: "श्रमिक कार्ड" },
];

export function KycForm({ lang, defaultName }: { lang: Lang; defaultName: string }) {
  const isHi = lang === "hi";
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        startTransition(async () => {
          const next = await submitKycAction(formData);
          setResult(next);
        });
      }}
    >
      {result ? (
        <Alert tone={result.ok ? "success" : "destructive"}>{result.message}</Alert>
      ) : null}

      <Field label={isHi ? "दस्तावेज़ प्रकार" : "Document type"} htmlFor="docType">
        <Select id="docType" name="docType" defaultValue="AADHAAR" required>
          {DOC_TYPES.map((doc) => (
            <option key={doc.value} value={doc.value}>
              {isHi ? doc.hi : doc.en}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={isHi ? "दस्तावेज़ पर नाम" : "Name on document"} htmlFor="holderName">
        <Input id="holderName" name="holderName" defaultValue={defaultName} required />
      </Field>

      <Field
        label={isHi ? "दस्तावेज़ संख्या" : "Document number"}
        htmlFor="docNumber"
        hint={
          isHi
            ? "पूरी संख्या कभी संग्रहित नहीं होती - केवल अंतिम चार अंक दिखते हैं।"
            : "The full number is never stored. Only the last four digits are ever shown."
        }
      >
        <Input id="docNumber" name="docNumber" autoComplete="off" required />
      </Field>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending
          ? isHi
            ? "भेजा जा रहा है..."
            : "Submitting..."
          : isHi
            ? "दस्तावेज़ जमा करें"
            : "Submit document"}
      </Button>
    </form>
  );
}
