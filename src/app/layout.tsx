import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getLang } from "@/lib/lang";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Kept to the value proposition. This description is served on the
// unauthenticated route and is what a link preview or search result shows, so
// it stays behind the same boundary as the gateway itself and does not
// enumerate the product surface.
export const metadata: Metadata = {
  title: "LYBOR - Verified work, transparent wages",
  description:
    "LYBOR is a blue-collar workforce trust platform. Create an account or sign in to continue.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
