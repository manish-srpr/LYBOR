import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getLocale } from "@/lib/lang";
import { directionOf, intlLocale, translate } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Metadata follows the visitor's locale, and stays at the value proposition:
 * this description is served on the unauthenticated route and is what a link
 * preview shows, so it sits behind the same boundary as the gateway and does
 * not enumerate the product surface.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: `${translate(locale, "app.name")} — ${translate(locale, "app.tagline")}`,
    description: `${translate(locale, "app.descriptor")}. ${translate(
      locale,
      "app.gatewayPrompt",
    )}`,
    other: { "content-language": intlLocale(locale) },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dir = directionOf(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
