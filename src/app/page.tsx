import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  Banknote,
  MapPin,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LanguageToggle } from "@/components/app/language-toggle";
import { dashboardPathFor, getSession } from "@/lib/auth";
import { getTranslator } from "@/lib/lang";

/** The product promise, in the four words the whole platform is built around. */
const PILLARS = [
  {
    icon: Search,
    en: { title: "FIND WORK", body: "Ranked, explained job matches near you." },
    hi: { title: "काम खोजें", body: "आपके पास के काम, कारण सहित।" },
  },
  {
    icon: MapPin,
    en: { title: "VERIFY WORK", body: "GPS check-in and check-out at the worksite." },
    hi: { title: "काम सत्यापित करें", body: "कार्यस्थल पर जीपीएस चेक-इन और चेक-आउट।" },
  },
  {
    icon: Banknote,
    en: { title: "GET PAID", body: "Wages calculated in the open, tracked to payout." },
    hi: { title: "भुगतान पाएँ", body: "पारदर्शी गणना, भुगतान तक ट्रैक।" },
  },
  {
    icon: ShieldCheck,
    en: { title: "BUILD TRUST", body: "Every finished job becomes verified history." },
    hi: { title: "भरोसा बनाएँ", body: "हर पूरा काम सत्यापित इतिहास बनता है।" },
  },
];

const FEATURES = [
  {
    icon: MapPin,
    en: { title: "GPS-verified attendance", body: "Check in and out inside a worksite geofence. Distance and accuracy are recorded on every punch." },
    hi: { title: "जीपीएस सत्यापित उपस्थिति", body: "कार्यस्थल की सीमा के भीतर चेक-इन और चेक-आउट। हर बार दूरी दर्ज होती है।" },
  },
  {
    icon: Banknote,
    en: { title: "Transparent wage calculation", body: "Every rupee is shown as a line-by-line breakdown that the worker and employer both see." },
    hi: { title: "पारदर्शी मजदूरी गणना", body: "हर रुपये का विवरण, जो श्रमिक और नियोक्ता दोनों देखते हैं।" },
  },
  {
    icon: Sparkles,
    en: { title: "Explainable matching", body: "Job recommendations always show the six factors behind the score, never a bare number." },
    hi: { title: "व्याख्या-योग्य मिलान", body: "हर सिफ़ारिश के पीछे के छह कारक हमेशा दिखते हैं।" },
  },
  {
    icon: ShieldAlert,
    en: { title: "Explainable risk flags", body: "Attendance anomalies name the rule that fired and the value that triggered it." },
    hi: { title: "व्याख्या-योग्य जोखिम संकेत", body: "हर संकेत उस नियम का नाम बताता है जो सक्रिय हुआ।" },
  },
  {
    icon: ScrollText,
    en: { title: "Verified work history", body: "Completed jobs become a portable, tamper-evident record a worker can carry anywhere." },
    hi: { title: "सत्यापित कार्य इतिहास", body: "पूरे किए गए काम एक पोर्टेबल रिकॉर्ड बन जाते हैं।" },
  },
  {
    icon: BadgeCheck,
    en: { title: "KYC and trust", body: "Identity documents are stored masked and hashed, never in the clear." },
    hi: { title: "केवाईसी और भरोसा", body: "पहचान दस्तावेज़ मास्क और हैश के रूप में संग्रहित होते हैं।" },
  },
];

export default async function Home() {
  const session = await getSession();
  if (session) redirect(dashboardPathFor(session.role));

  const { lang, t } = await getTranslator();
  const isHi = lang === "hi";

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--primary)] text-sm text-[var(--primary-foreground)]">
              S
            </span>
            {t("app.name")}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle lang={lang} />
            <Link
              href="/login"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              {t("auth.login")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <section className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--primary)]">
            {isHi ? "ब्लू-कॉलर वर्कफ़ोर्स ट्रस्ट प्लेटफ़ॉर्म" : "Blue-collar workforce trust platform"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {isHi
              ? "श्रमिकों के लिए भरोसेमंद काम, नियोक्ताओं के लिए सत्यापित श्रम।"
              : "Dependable work for workers. Verified labour for employers."}
          </h1>
          <p className="mt-3 text-base text-[var(--muted-foreground)]">
            {isHi
              ? "स्ट्राइवर हर शिफ्ट को जीपीएस से सत्यापित करता है, हर रुपये की गणना दिखाता है, और हर पूरे किए गए काम को सत्यापित इतिहास में बदल देता है।"
              : "STRIVER verifies every shift with GPS, shows the arithmetic behind every rupee, and turns every completed job into a work record a worker can carry with them."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" className={buttonVariants({ size: "lg" })}>
              {t("auth.register")}
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              {t("auth.login")}
            </Link>
          </div>
        </section>

        {/* The core promise, in four steps. */}
        <section className="mt-12">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar, index) => {
              const Icon = pillar.icon;
              const copy = isHi ? pillar.hi : pillar.en;
              return (
                <li
                  key={pillar.en.title}
                  className="relative rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--primary)]/10">
                      <Icon className="size-4 text-[var(--primary)]" aria-hidden />
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-[var(--muted-foreground)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2 className="mt-3 text-sm font-bold tracking-wide">{copy.title}</h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{copy.body}</p>
                  {index < PILLARS.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute -right-2.5 top-1/2 hidden size-5 -translate-y-1/2 place-items-center rounded-full border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted-foreground)] lg:grid"
                    >
                      →
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            const copy = isHi ? feature.hi : feature.en;
            return (
              <div
                key={feature.en.title}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <Icon className="size-5 text-[var(--primary)]" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold">{copy.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{copy.body}</p>
              </div>
            );
          })}
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-6">
        <p className="mx-auto max-w-5xl px-4 text-xs text-[var(--muted-foreground)]">
          {isHi
            ? "स्ट्राइवर प्रोटोटाइप — डेमो डेटा के साथ।"
            : "STRIVER prototype — running on seeded demo data."}
        </p>
      </footer>
    </div>
  );
}
