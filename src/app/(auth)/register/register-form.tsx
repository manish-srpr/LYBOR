"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { registerAction, type FormState } from "@/server/actions/session";
import { translatorFor, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function RegisterForm({ lang }: { lang: Lang }) {
  const t = translatorFor(lang);
  const [role, setRole] = useState<"WORKER" | "EMPLOYER">("WORKER");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="destructive">{state.error}</Alert> : null}

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{t("auth.role")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["WORKER", "EMPLOYER"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "flex h-12 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium",
                role === value
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] bg-[var(--card)]",
              )}
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="sr-only"
              />
              {value === "WORKER" ? t("auth.roleWorker") : t("auth.roleEmployer")}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label={t("auth.fullName")} htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>

      {role === "EMPLOYER" ? (
        <Field label={lang === "hi" ? "कंपनी का नाम" : "Company name"} htmlFor="companyName">
          <Input id="companyName" name="companyName" autoComplete="organization" />
        </Field>
      ) : null}

      <Field label={t("auth.phone")} htmlFor="phone">
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={10}
          placeholder="9876543210"
          required
        />
      </Field>

      <Field
        label={t("auth.city")}
        htmlFor="city"
        hint={
          lang === "hi"
            ? "आपके शहर से पास के काम खोजे जाते हैं।"
            : "Used to find work near you."
        }
      >
        <Select id="city" name="city" defaultValue="Bengaluru" required>
          {["Bengaluru", "Mumbai", "Delhi", "Pune", "Hyderabad", "Chennai"].map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t("auth.password")} htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </Field>

      <Field label={t("app.language")} htmlFor="language">
        <Select id="language" name="language" defaultValue={lang}>
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
        </Select>
      </Field>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? `${t("common.loading")}...` : t("auth.register")}
      </Button>
    </form>
  );
}
