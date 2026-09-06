"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { updateWorkerProfileAction } from "@/server/actions/profile";
import type { ActionResult } from "@/server/actions/attendance";
import { paiseToRupees } from "@/lib/money";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type SkillOption = { id: string; nameEn: string; nameHi: string; category: string };

export function ProfileForm({
  lang,
  skills,
  selectedSkillIds,
  profile,
}: {
  lang: Lang;
  skills: SkillOption[];
  selectedSkillIds: string[];
  profile: {
    bio: string | null;
    experienceYears: number;
    travelRadiusKm: number;
    availability: "AVAILABLE" | "BUSY" | "UNAVAILABLE";
    preferredWageType: "HOURLY" | "DAILY" | "SHIFT" | null;
    preferredWageMinPaise: number | null;
    language: Lang;
  };
}) {
  const isHi = lang === "hi";
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedSkillIds));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form
      className="space-y-5"
      action={(formData) => {
        startTransition(async () => {
          setResult(await updateWorkerProfileAction(formData));
        });
      }}
    >
      {result ? (
        <Alert tone={result.ok ? "success" : "destructive"}>{result.message}</Alert>
      ) : null}

      <Field label={isHi ? "अपने बारे में" : "About you"} htmlFor="bio">
        <Textarea
          id="bio"
          name="bio"
          maxLength={400}
          defaultValue={profile.bio ?? ""}
          placeholder={
            isHi
              ? "नियोक्ता को अपने अनुभव के बारे में बताएँ"
              : "Tell employers about your experience"
          }
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          {isHi ? "आपके कौशल" : "Your skills"}
        </legend>
        <p className="text-xs text-[var(--muted-foreground)]">
          {isHi
            ? "कौशल मिलान स्कोर का सबसे बड़ा हिस्सा (35%) है।"
            : "Skills are the single biggest part of the match score (35%)."}
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
        <Field label={isHi ? "अनुभव (वर्ष)" : "Experience (years)"} htmlFor="experienceYears">
          <Input
            id="experienceYears"
            name="experienceYears"
            type="number"
            min={0}
            max={50}
            defaultValue={profile.experienceYears}
            required
          />
        </Field>

        <Field
          label={isHi ? "यात्रा सीमा (किमी)" : "Travel radius (km)"}
          htmlFor="travelRadiusKm"
          hint={isHi ? "मिलान स्कोर का 20%।" : "20% of the match score."}
        >
          <Input
            id="travelRadiusKm"
            name="travelRadiusKm"
            type="number"
            min={1}
            max={100}
            step={1}
            defaultValue={profile.travelRadiusKm}
            required
          />
        </Field>

        <Field label={isHi ? "उपलब्धता" : "Availability"} htmlFor="availability">
          <Select
            id="availability"
            name="availability"
            defaultValue={profile.availability}
          >
            <option value="AVAILABLE">{isHi ? "उपलब्ध" : "Available"}</option>
            <option value="BUSY">{isHi ? "व्यस्त" : "Busy"}</option>
            <option value="UNAVAILABLE">{isHi ? "अनुपलब्ध" : "Unavailable"}</option>
          </Select>
        </Field>

        <Field label={isHi ? "भाषा" : "Language"} htmlFor="language">
          <Select id="language" name="language" defaultValue={profile.language}>
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </Select>
        </Field>

        <Field
          label={isHi ? "पसंदीदा वेतन प्रकार" : "Preferred wage type"}
          htmlFor="preferredWageType"
        >
          <Select
            id="preferredWageType"
            name="preferredWageType"
            defaultValue={profile.preferredWageType ?? ""}
          >
            <option value="">{isHi ? "कोई प्राथमिकता नहीं" : "No preference"}</option>
            <option value="HOURLY">{isHi ? "प्रति घंटा" : "Hourly"}</option>
            <option value="DAILY">{isHi ? "प्रति दिन" : "Daily"}</option>
            <option value="SHIFT">{isHi ? "प्रति शिफ्ट" : "Per shift"}</option>
          </Select>
        </Field>

        <Field
          label={isHi ? "न्यूनतम प्रति घंटा (₹)" : "Minimum per hour (₹)"}
          htmlFor="preferredWageMinRupees"
          hint={isHi ? "मिलान स्कोर का 15%।" : "15% of the match score."}
        >
          <Input
            id="preferredWageMinRupees"
            name="preferredWageMinRupees"
            type="number"
            min={0}
            step={1}
            defaultValue={
              profile.preferredWageMinPaise
                ? paiseToRupees(profile.preferredWageMinPaise)
                : ""
            }
          />
        </Field>
      </div>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? (isHi ? "सहेजा जा रहा है..." : "Saving...") : isHi ? "सहेजें" : "Save profile"}
      </Button>
    </form>
  );
}
