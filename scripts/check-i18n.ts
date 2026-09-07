/**
 * Localisation guard rails.
 *
 * Catalogs are hand-authored text in twelve scripts, which makes them easy to
 * damage invisibly: a lost byte becomes U+FFFD, a stray zero-width character
 * breaks Indic shaping, and a mistyped key silently falls back to English
 * forever. This script fails the build on all three rather than letting a
 * worker be the one who finds out.
 */
import en, { type MessageKey } from "../src/lib/i18n/messages/en";
import { CATALOGS_FOR_TEST, LOCALES, coverage, translate, translatePlural } from "../src/lib/i18n";
import type { Locale } from "../src/lib/i18n";

let failures = 0;
let checks = 0;

function ok(condition: boolean, label: string, detail?: string) {
  checks++;
  if (!condition) {
    failures++;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** The Unicode block each locale's text is expected to live in. */
const EXPECTED_BLOCK: Record<Exclude<Locale, "en">, [number, number, string]> = {
  hi: [0x0900, 0x097f, "Devanagari"],
  mr: [0x0900, 0x097f, "Devanagari"],
  pa: [0x0a00, 0x0a7f, "Gurmukhi"],
  gu: [0x0a80, 0x0aff, "Gujarati"],
  bn: [0x0980, 0x09ff, "Bengali"],
  as: [0x0980, 0x09ff, "Bengali"],
  or: [0x0b00, 0x0b7f, "Odia"],
  ta: [0x0b80, 0x0bff, "Tamil"],
  te: [0x0c00, 0x0c7f, "Telugu"],
  kn: [0x0c80, 0x0cff, "Kannada"],
  ml: [0x0d00, 0x0d7f, "Malayalam"],
  ur: [0x0600, 0x06ff, "Arabic"],
};

const REPLACEMENT = "�";
/** ZWNJ and ZWJ are legitimate in Indic shaping; nothing else invisible is. */
const ALLOWED_INVISIBLE = new Set(["‌", "‍"]);

function invisibleOffenders(text: string): string[] {
  return [...text].filter((ch) => {
    if (ALLOWED_INVISIBLE.has(ch)) return false;
    const code = ch.codePointAt(0)!;
    // C0/C1 controls, plus the bidi and format characters.
    return (
      (code <= 0x001f && ch !== "\n") ||
      (code >= 0x007f && code <= 0x009f) ||
      (code >= 0x200e && code <= 0x200f) ||
      (code >= 0x202a && code <= 0x202e) ||
      code === 0xfeff
    );
  });
}

const enKeys = Object.keys(en) as MessageKey[];

console.log("=== catalog integrity ===");
console.log("loc  script      strings  in-script  missing  status");

for (const { code } of LOCALES) {
  const catalog = CATALOGS_FOR_TEST[code] as Record<string, string | undefined>;
  const values = Object.values(catalog).filter((v): v is string => Boolean(v));

  const damaged = values.filter((v) => v.includes(REPLACEMENT));
  const invisible = values.filter((v) => invisibleOffenders(v).length > 0);

  let inScript = 0;
  let scriptName = "Latin";
  if (code !== "en") {
    const [lo, hi, name] = EXPECTED_BLOCK[code as Exclude<Locale, "en">];
    scriptName = name;
    inScript = values.filter((v) => [...v].some((ch) => {
      const c = ch.codePointAt(0)!;
      return c >= lo && c <= hi;
    })).length;
  } else {
    inScript = values.length;
  }

  const cov = coverage()[code];
  const missing = cov.total - cov.done;
  const problems: string[] = [];
  if (damaged.length) problems.push(`${damaged.length} U+FFFD`);
  if (invisible.length) problems.push(`${invisible.length} invisible ctrl`);

  console.log(
    `${code.padEnd(5)}${scriptName.padEnd(12)}${String(values.length).padStart(7)}` +
      `${String(inScript).padStart(11)}${String(missing).padStart(9)}  ` +
      (problems.length ? problems.join(" / ") : "clean"),
  );

  ok(damaged.length === 0, `${code}: no replacement characters`, damaged[0]);
  ok(invisible.length === 0, `${code}: no stray invisible characters`, invisible[0]);

  // A non-English catalog whose strings are mostly Latin means the wrong
  // script was pasted in - the exact bug the Punjabi requirement guards against.
  if (code !== "en" && values.length > 20) {
    ok(
      inScript / values.length > 0.8,
      `${code}: text is actually in ${scriptName}`,
      `${inScript}/${values.length} strings contain ${scriptName}`,
    );
  }

  // Keys that do not exist in English are dead weight: nothing reads them.
  const strays = Object.keys(catalog).filter((k) => !(k in en) && !k.endsWith("_one") && !k.endsWith("_other"));
  ok(strays.length === 0, `${code}: no keys absent from the English catalog`, strays.join(", "));
}

console.log("\n=== interpolation and plurals ===");
for (const { code } of LOCALES) {
  // Placeholders must survive translation, or the UI shows a literal {name}.
  const greeting = translate(code, "dash.greeting", { name: "Ramesh" });
  ok(greeting.includes("Ramesh"), `${code}: {name} interpolated`, greeting);
  ok(!greeting.includes("{name}"), `${code}: no leftover placeholder`, greeting);

  const one = translatePlural(code, "job.applicantCount", 1);
  const many = translatePlural(code, "job.applicantCount", 5);
  ok(one.includes("1"), `${code}: singular carries the count`, one);
  ok(many.includes("5"), `${code}: plural carries the count`, many);
  ok(!one.includes("{count}"), `${code}: singular has no leftover placeholder`, one);
}

console.log("\n=== fallback safety ===");
for (const { code } of LOCALES) {
  for (const key of enKeys) {
    const out = translate(code, key);
    ok(typeof out === "string" && out.length > 0, `${code}: "${key}" resolves to text`);
    ok(!out.includes("undefined"), `${code}: "${key}" is not "undefined"`, out);
  }
}

console.log("\n=== coverage ===");
const cov = coverage();
for (const { code, native } of LOCALES) {
  const c = cov[code];
  const bar = "#".repeat(Math.round(c.pct / 5)).padEnd(20, ".");
  console.log(`  ${code.padEnd(3)} ${native.padEnd(12)} ${bar} ${String(c.pct).padStart(3)}%  (${c.done}/${c.total})`);
}

console.log(`\n${checks} assertions, ${failures} failed`);
if (failures > 0) process.exit(1);
console.log("All localisation invariants hold.");
