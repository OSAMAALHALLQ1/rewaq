"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Menu, Printer, RefreshCw } from "lucide-react";

const statusItems = [
  { label: "النظام يعمل طبيعيًا", icon: CheckCircle2, className: "text-emerald-600" },
  { label: "12 جهاز POS متصل", icon: RefreshCw, className: "text-[#068FFF]" },
  { label: "1 طابعة تحتاج مراجعة", icon: Printer, className: "text-amber-600" },
  { label: "آخر مزامنة: قبل 34ث", icon: Clock3, className: "text-slate-500" },
];

export function SystemStatusMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="grid h-10 w-10 place-items-center rounded-xl text-[#4E4FEB] transition hover:bg-[#F1F6F9] hover:text-[#068FFF]"
        aria-label="حالة النظام"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-2xl border border-[#D7E3EA] bg-[#F1F6F9] p-2 shadow-lg">
          {statusItems.map(({ label, icon: Icon, className }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#000000]">
              <Icon className={`h-4 w-4 shrink-0 ${className}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
