import { Languages } from "lucide-react";
import { setLanguageAction } from "@/server/actions/session";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * A form, not a client component: switching language works with JavaScript
 * disabled and on a flaky connection, which is the reality for many workers.
 */
export function LanguageToggle({ lang }: { lang: Lang }) {
  const next: Lang = lang === "en" ? "hi" : "en";
  return (
    <form action={setLanguageAction}>
      <input type="hidden" name="lang" value={next} />
      <button
        type="submit"
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-xs font-medium",
          "hover:bg-[var(--muted)]",
        )}
        aria-label={next === "hi" ? "Switch to Hindi" : "अंग्रेज़ी में बदलें"}
      >
        <Languages className="size-3.5" aria-hidden />
        {next === "hi" ? "हिन्दी" : "English"}
      </button>
    </form>
  );
}
