"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { loginAction, type FormState } from "@/server/actions/session";
import { translatorFor, type Lang } from "@/lib/i18n";

export function LoginForm({ lang }: { lang: Lang }) {
  const t = translatorFor(lang);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="destructive">{state.error}</Alert> : null}

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

      <Field label={t("auth.password")} htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? `${t("common.loading")}...` : t("auth.login")}
      </Button>
    </form>
  );
}
