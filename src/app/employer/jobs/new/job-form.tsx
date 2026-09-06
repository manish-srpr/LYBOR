"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { createJobAction } from "@/server/actions/jobs";
import type { FormState } from "@/server/actions/session";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type SkillChoice = { id: string; nameEn: string; nameHi: string };

const CATEGORIES = [
  { value: "Construction", en: "Construction", hi: "निर्माण" },
  { value: "Warehouse", en: "Warehouse", hi: "गोदाम" },
  { value: "Housekeeping", en: "Housekeeping", hi: "साफ-सफाई" },
  { value: "Delivery", en: "Delivery", hi: "डिलीवरी" },
  { value: "Manufacturing", en: "Manufacturing", hi: "विनिर्माण" },
  { value: "Hospitality", en: "Hospitality", hi: "आतिथ्य" },
  { value: "Security", en: "Security", hi: "सुरक्षा" },
];

function isoToday(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function JobForm({
  lang,
  skills,
  employerSite,
}: {
  lang: Lang;
  skills: SkillChoice[];
  employerSite: {
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
    latitude: number;
    longitude: number;
  };
}) {
  const isHi = lang === "hi";
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createJobAction,
    {},
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert tone="destructive">{state.error}</Alert> : null}

      <Field label={isHi ? "काम का शीर्षक" : "Job title"} htmlFor="title">
        <Input
          id="title"
          name="title"
          placeholder={isHi ? "जैसे: राजमिस्त्री सहायक" : "e.g. Mason helper"}
          required
        />
      </Field>

      <Field label={isHi ? "काम का विवरण" : "Description"} htmlFor="description">
        <Textarea id="description" name="description" required />
      </Field>

      <Field label={isHi ? "श्रेणी" : "Category"} htmlFor="category">
        <Select id="category" name="category" defaultValue="Construction">
          {CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {isHi ? category.hi : category.en}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          {isHi ? "आवश्यक कौशल" : "Required skills"}
        </legend>
        <p className="text-xs text-[var(--muted-foreground)]">
          {isHi
            ? "यही कौशल मिलान स्कोर तय करते हैं।"
            : "These drive the match score shown to workers."}
        </p>
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => {
            const active = selected.has(skill.id);
            return (
              <label
                key={skill.id}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-sm",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border-[var(--border)] bg-[var(--card)]",
                )}
              >
                <input
                  type="checkbox"
                  name="skillIds"
                  value={skill.id}
                  checked={active}
                  onChange={() => toggle(skill.id)}
                  className="sr-only"
                />
                {isHi ? skill.nameHi : skill.nameEn}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={isHi ? "वेतन प्रकार" : "Wage type"} htmlFor="wageType">
          <Select id="wageType" name="wageType" defaultValue="DAILY">
            <option value="HOURLY">{isHi ? "प्रति घंटा" : "Hourly"}</option>
            <option value="DAILY">{isHi ? "प्रति दिन" : "Daily"}</option>
            <option value="SHIFT">{isHi ? "प्रति शिफ्ट" : "Per shift"}</option>
          </Select>
        </Field>

        <Field label={isHi ? "दर (₹)" : "Rate (₹)"} htmlFor="wageRateRupees">
          <Input
            id="wageRateRupees"
            name="wageRateRupees"
            type="number"
            min={1}
            step={1}
            defaultValue={700}
            required
          />
        </Field>

        <Field label={isHi ? "शुरू तारीख" : "Start date"} htmlFor="startDate">
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={isoToday()}
            required
          />
        </Field>

        <Field label={isHi ? "अंतिम तारीख" : "End date"} htmlFor="endDate">
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={isoToday(6)}
            required
          />
        </Field>

        <Field label={isHi ? "शिफ्ट शुरू" : "Shift start"} htmlFor="shiftStart">
          <Input id="shiftStart" name="shiftStart" type="time" defaultValue="09:00" required />
        </Field>

        <Field label={isHi ? "शिफ्ट समाप्त" : "Shift end"} htmlFor="shiftEnd">
          <Input id="shiftEnd" name="shiftEnd" type="time" defaultValue="18:00" required />
        </Field>

        <Field
          label={isHi ? "प्रतिदिन अपेक्षित घंटे" : "Expected hours per day"}
          htmlFor="expectedHoursPerDay"
        >
          <Input
            id="expectedHoursPerDay"
            name="expectedHoursPerDay"
            type="number"
            min={1}
            max={16}
            step={0.5}
            defaultValue={8}
            required
          />
        </Field>

        <Field label={isHi ? "कितने श्रमिक" : "Workers required"} htmlFor="workersRequired">
          <Input
            id="workersRequired"
            name="workersRequired"
            type="number"
            min={1}
            max={50}
            defaultValue={1}
            required
          />
        </Field>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">
          {isHi ? "कार्यस्थल" : "Job site"}
        </legend>
        <p className="text-xs text-[var(--muted-foreground)]">
          {isHi
            ? "जीपीएस चेक-इन इसी बिंदु और सीमा के विरुद्ध जाँचा जाता है।"
            : "GPS check-in is measured against this point and radius."}
        </p>

        <Field label={isHi ? "पता" : "Address"} htmlFor="addressLine">
          <Input
            id="addressLine"
            name="addressLine"
            defaultValue={employerSite.addressLine}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={isHi ? "शहर" : "City"} htmlFor="city">
            <Input id="city" name="city" defaultValue={employerSite.city} required />
          </Field>
          <Field label={isHi ? "राज्य" : "State"} htmlFor="state">
            <Input id="state" name="state" defaultValue={employerSite.state} required />
          </Field>
          <Field label={isHi ? "पिनकोड" : "Pincode"} htmlFor="pincode">
            <Input
              id="pincode"
              name="pincode"
              inputMode="numeric"
              maxLength={6}
              defaultValue={employerSite.pincode}
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={isHi ? "अक्षांश" : "Latitude"} htmlFor="latitude">
            <Input
              id="latitude"
              name="latitude"
              type="number"
              step="any"
              defaultValue={employerSite.latitude}
              required
            />
          </Field>
          <Field label={isHi ? "देशांतर" : "Longitude"} htmlFor="longitude">
            <Input
              id="longitude"
              name="longitude"
              type="number"
              step="any"
              defaultValue={employerSite.longitude}
              required
            />
          </Field>
          <Field
            label={isHi ? "चेक-इन सीमा (मीटर)" : "Check-in radius (m)"}
            htmlFor="checkInRadiusMeters"
          >
            <Input
              id="checkInRadiusMeters"
              name="checkInRadiusMeters"
              type="number"
              min={50}
              max={2000}
              step={10}
              defaultValue={250}
              required
            />
          </Field>
        </div>
      </fieldset>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending
          ? isHi
            ? "पोस्ट किया जा रहा है..."
            : "Posting..."
          : isHi
            ? "काम पोस्ट करें"
            : "Post the job"}
      </Button>
    </form>
  );
}
