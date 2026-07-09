"use client";

import { useState } from "react";
import Link from "next/link";
import { Leaf, Menu, X } from "lucide-react";

export function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-3 z-50 px-3 sm:px-4 lg:px-6">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full border border-border/80 bg-white/90 px-3 shadow-soft backdrop-blur sm:h-16 sm:px-4">
        <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-white sm:h-10 sm:w-10">
            <Leaf className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <span className="text-lg font-extrabold text-primary sm:text-xl">رواق</span>
        </Link>

        <nav className="hidden items-center gap-4 text-sm font-bold text-muted-foreground lg:flex lg:gap-6">
          <Link href="/#features" className="transition hover:text-primary">المزايا</Link>
          <Link href="/#workflow" className="transition hover:text-primary">كيف يعمل</Link>
          <Link href="/pricing" className="transition hover:text-primary">الأسعار</Link>
          <Link href="/request-demo" className="transition hover:text-primary">طلب عرض</Link>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-primary">
            دخول
          </Link>
          <Link
            href="/register"
            className="focus-ring inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/15 transition hover:bg-blue-800"
          >
            ابدأ الآن
          </Link>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary lg:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="القائمة"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="mx-auto mt-2 max-w-7xl rounded-3xl border border-border bg-white p-4 shadow-lift md:hidden">
          <nav className="flex flex-col gap-2 text-sm font-bold text-muted-foreground">
            <Link href="/#features" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full px-4 py-2 hover:bg-muted hover:text-primary">المزايا</Link>
            <Link href="/#workflow" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full px-4 py-2 hover:bg-muted hover:text-primary">كيف يعمل</Link>
            <Link href="/pricing" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full px-4 py-2 hover:bg-muted hover:text-primary">الأسعار</Link>
            <Link href="/request-demo" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full px-4 py-2 hover:bg-muted hover:text-primary">طلب عرض</Link>
            <div className="my-2 h-px bg-border" />
            <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full px-4 py-2 hover:bg-muted hover:text-primary">دخول</Link>
            <Link
              href="/register"
              onClick={() => setIsMobileMenuOpen(false)}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm"
            >
              ابدأ الآن
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}