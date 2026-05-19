"use client";

import { useState } from "react";
import Link from "next/link";
import { Leaf, Menu, X } from "lucide-react";

export function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <span className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-lg bg-primary text-white">
            <Leaf className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <span className="text-lg sm:text-xl font-bold text-primary">رواق</span>
        </Link>
        
        {/* Desktop Nav */}
        <nav className="hidden items-center gap-4 lg:gap-6 text-sm font-medium text-slate-600 lg:flex">
          <Link href="/#features">المزايا</Link>
          <Link href="/#workflow">كيف يعمل</Link>
          <Link href="/pricing">الأسعار</Link>
          <Link href="/request-demo">طلب عرض</Link>
        </nav>
        
        {/* Desktop Actions */}
        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-primary">
            دخول
          </Link>
          <Link
            href="/register"
            className="focus-ring inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-teal-800"
          >
            ابدأ الآن
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className="flex lg:hidden items-center justify-center h-10 w-10 text-slate-600"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="القائمة"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-white p-4">
          <nav className="flex flex-col gap-4 text-sm font-medium text-slate-600">
            <Link href="/#features" onClick={() => setIsMobileMenuOpen(false)} className="block py-2">المزايا</Link>
            <Link href="/#workflow" onClick={() => setIsMobileMenuOpen(false)} className="block py-2">كيف يعمل</Link>
            <Link href="/pricing" onClick={() => setIsMobileMenuOpen(false)} className="block py-2">الأسعار</Link>
            <Link href="/request-demo" onClick={() => setIsMobileMenuOpen(false)} className="block py-2">طلب عرض</Link>
            <div className="h-px bg-border my-2" />
            <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="block py-2">دخول</Link>
            <Link
              href="/register"
              onClick={() => setIsMobileMenuOpen(false)}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm"
            >
              ابدأ الآن
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
