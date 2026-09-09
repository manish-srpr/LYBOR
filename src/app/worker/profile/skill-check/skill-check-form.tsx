"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import {
  submitSkillCheckAction,
  type AssessmentOutcome,
} from "@/server/actions/assessment";
import type { PublicQuestion } from "@/lib/skill-questions";
import { translatorFor, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The question paper.
 *
 * Answers are radio inputs named `answer:<questionId>`, so the whole
 * submission is an ordinary FormData post.
 *
 * It is driven by `useActionState` rather than an inline `action={(formData)
 * => ...}` closure, and that is not a style choice. A closure leaves the
 * rendered form with no action id, so a browser that submits it before
 * hydration - or with JavaScript off entirely - gets a 500 from the server. On
 * the handsets this is built for that is the common case, not the edge one.
 * `useActionState` also hands back the graded outcome, which is what the
 * review pass below renders.
 *
 * Question text is English with Hindi alongside, matching the rest of the
 * worker forms; the twelve-locale catalogue covers the interface, and trade
 * questions in twelve languages is a translation job for a person who knows
 * the trade, not something to machine-fill and present as authoritative.
 */
export function SkillCheckForm({
  lang,
  skillId,
  skillName,
  questions,
  passPercent,
  previous,
}: {
  lang: Lang;
  skillId: string;
  skillName: string;
  questions: PublicQuestion[];
  passPercent: number;
  previous: { scorePercent: number; passed: boolean } | null;
}) {
  const t = translatorFor(lang);
  const isHi = lang === "hi";
  const [outcome, formAction, pending] = useActionState<AssessmentOutcome | null, FormData>(
    submitSkillCheckAction,
    null,
  );

  const graded = outcome?.ok ? outcome : null;
  const reviewFor = (id: string) =>
    graded?.review?.find((entry) => entry.questionId === id) ?? null;

  return (
    <form className="space-y-4" action={formAction}>
      <input type="hidden" name="skillId" value={skillId} />

      {outcome && !outcome.ok ? (
        <Alert tone="destructive">{outcome.message}</Alert>
      ) : null}

      {graded ? (
        <Alert tone={graded.passed ? "success" : "warning"}>
          <span className="font-medium">
            {graded.passed ? t("assess.resultPassed") : t("assess.resultFailed")}
          </span>{" "}
          {t("assess.resultScore", {
            percent: graded.scorePercent ?? 0,
            correct: graded.correctCount ?? 0,
            total: graded.questionCount ?? 0,
          })}
        </Alert>
      ) : previous ? (
        <Alert tone={previous.passed ? "success" : "warning"}>
          {t("assess.previousResult", { percent: previous.scorePercent })}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm">{skillName}</CardTitle>
            <Badge variant="outline">
              {t("assess.passMark", { percent: passPercent })}
            </Badge>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("assess.notCertification")}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {questions.map((question, index) => {
            const review = reviewFor(question.id);
            const prompts = isHi ? question.optionsHi : question.options;
            return (
              <fieldset key={question.id} className="space-y-2">
                <legend className="text-sm font-medium">
                  <span className="text-[var(--muted-foreground)]">
                    {t("assess.questionNumber", {
                      index: index + 1,
                      total: questions.length,
                    })}
                  </span>
                  <br />
                  {isHi ? question.promptHi : question.prompt}
                </legend>

                <div className="space-y-1.5">
                  {prompts.map((option, optionIndex) => {
                    const isCorrect = review?.correctIndex === optionIndex;
                    const wasChosen = review?.chosenIndex === optionIndex;
                    return (
                      <label
                        key={option}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm",
                          // Before grading, plain. After, the right answer is
                          // marked whether or not it was picked - a worker who
                          // got it wrong should leave knowing the answer.
                          review
                            ? isCorrect
                              ? "border-[var(--success)] bg-[var(--success)]/10"
                              : wasChosen
                                ? "border-[var(--destructive)] bg-[var(--destructive)]/10"
                                : "border-[var(--border)]"
                            : "border-[var(--border)] bg-[var(--card)] has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary)]/10",
                        )}
                      >
                        <input
                          type="radio"
                          name={`answer:${question.id}`}
                          value={optionIndex}
                          required
                          disabled={Boolean(graded)}
                          className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                        />
                        <span className="min-w-0">{option}</span>
                        {review && isCorrect ? (
                          <CheckCircle2
                            className="ms-auto size-4 shrink-0 text-[var(--success)]"
                            aria-hidden
                          />
                        ) : review && wasChosen ? (
                          <CircleAlert
                            className="ms-auto size-4 shrink-0 text-[var(--destructive)]"
                            aria-hidden
                          />
                        ) : null}
                      </label>
                    );
                  })}
                </div>

                {review ? (
                  <p className="rounded-lg bg-[var(--muted)] p-2.5 text-xs text-[var(--muted-foreground)]">
                    {isHi ? review.whyHi : review.why}
                  </p>
                ) : null}
              </fieldset>
            );
          })}
        </CardContent>
      </Card>

      {graded ? (
        <div className="flex flex-wrap gap-2">
          <Link href="/worker/profile" className={buttonVariants({ size: "lg" })}>
            {t("assess.backToProfile")}
          </Link>
          {/*
            A retake is a fresh navigation rather than a client reset, so the
            server is the one that decides the paper is being sat again.
          */}
          <Link
            href={`/worker/profile/skill-check?skill=${skillId}`}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {t("assess.retake")}
          </Link>
        </div>
      ) : (
        <Button type="submit" size="lg" block disabled={pending}>
          {pending ? t("common.saving") : t("assess.submit")}
        </Button>
      )}
    </form>
  );
}
