import Link from "next/link";
import { Leaf } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold text-primary">رواق</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link href="/#features">المزايا</Link>
          <Link href="/#workflow">كيف يعمل</Link>
          <Link href="/pricing">الأسعار</Link>
          <Link href="/request-demo">طلب عرض</Link>
        </nav>
        <div className="flex items-center gap-2">
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
      </div>
    </header>
  );
}
