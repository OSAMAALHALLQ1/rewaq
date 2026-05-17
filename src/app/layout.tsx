import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";

const arabicSans = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "رواق | إدارة المطاعم والفروع",
  description:
    "منصة عربية لإدارة مخزون المطاعم، المشتريات، تكلفة الوصفات، التقارير، والنشر التسويقي.",
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
      className={`${arabicSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full text-foreground antialiased">{children}</body>
    </html>
  );
}
