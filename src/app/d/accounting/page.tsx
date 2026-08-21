"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpenCheck, FileText, Landmark, Loader2, LogOut, ReceiptText, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const links = [
  { href: "/dashboard/accounting", label: "المحاسبة العامة", description: "الحسابات والملخص المالي", icon: Landmark },
  { href: "/dashboard/accounting/ledger", label: "القيود ودفتر الأستاذ", description: "عرض القيود المالية المسموحة", icon: BookOpenCheck },
  { href: "/dashboard/customer-invoices", label: "فواتير العملاء", description: "فواتير المبيعات والتحصيل", icon: ReceiptText },
  { href: "/dashboard/invoices", label: "فواتير الموردين", description: "المشتريات والذمم الدائنة", icon: FileText },
  { href: "/dashboard/reports", label: "التقارير المالية", description: "الأرباح والميزانية والتدفقات", icon: Scale },
] as const;

export default function AccountingDevicePage() {
  const [ready, setReady] = useState(false);
  const [employeeName, setEmployeeName] = useState("");

  useEffect(() => {
    void fetch("/api/auth/department-session", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success || !data.allowedModules?.includes("accounting")) {
          window.location.replace("/d/gate?next=/d/accounting");
          return;
        }
        setEmployeeName(data.employeeName ?? "المحاسب");
        setReady(true);
      })
      .catch(() => window.location.replace("/d/gate?next=/d/accounting"));
  }, []);

  if (!ready) return <main className="grid min-h-screen place-items-center bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></main>;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 py-5">
          <div><h1 className="text-2xl font-black">واجهة المحاسب</h1><p className="mt-1 text-sm text-slate-400">مرحباً {employeeName} — تظهر لك الشاشات المالية التي يسمح بها دورك فقط.</p></div>
          <Button variant="outline" onClick={async () => { await fetch("/api/auth/department-session", { method: "DELETE" }); window.location.href = "/login"; }} className="border-white/15 bg-transparent"><LogOut className="h-4 w-4" /> خروج</Button>
        </header>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {links.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href}><Card className="h-full border-white/10 bg-slate-900 text-slate-100 transition hover:-translate-y-0.5 hover:border-blue-400/50"><CardContent className="space-y-3 p-5"><Icon className="h-7 w-7 text-blue-400" /><h2 className="font-black">{label}</h2><p className="text-sm text-slate-400">{description}</p></CardContent></Card></Link>)}
        </div>
      </div>
    </main>
  );
}
