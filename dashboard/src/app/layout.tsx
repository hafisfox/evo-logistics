import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Evo Logistics — Pricing Dashboard",
  description: "FCL Pricing Engine Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={jakarta.variable}>
      <body className="font-sans antialiased relative min-h-screen bg-slate-50/50 dark:bg-black overflow-x-hidden" suppressHydrationWarning>
        {/* Global Decorative Background Blob */}
        <div className="fixed top-0 left-0 right-0 h-[500px] w-[140%] -ml-[20%] bg-gradient-to-br from-primary/5 via-primary/2 to-transparent dark:from-primary/10 dark:via-primary/5 blur-3xl rounded-[100%] pointer-events-none -translate-y-1/2 opacity-60 z-[-1]" />

        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
