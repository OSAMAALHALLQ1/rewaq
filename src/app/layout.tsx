import type { Metadata } from "next";
import { Baloo_Bhaijaan_2, Geist_Mono } from "next/font/google";
import "./globals.css";

const arabicSans = Baloo_Bhaijaan_2({
  variable: "--font-baloo-bhaijaan",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "رواق | إدارة المخزن",
  description:
    "منصة عربية لإدارة المخزن، الموردين، فواتير التوريد، التحويلات الداخلية، طلبيات الأقسام، وتقارير المخزن.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${arabicSans.variable} ${geistMono.variable} h-full`}
    >
      <body suppressHydrationWarning className="min-h-full text-foreground antialiased">{children}</body>
    </html>
  );
}
