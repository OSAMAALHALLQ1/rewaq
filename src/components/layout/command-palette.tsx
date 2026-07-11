"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  CornerDownLeft,
  FileText,
  LayoutGrid,
  Loader2,
  MonitorSmartphone,
  PackagePlus,
  ReceiptText,
  Scale,
  Search,
  SearchX,
  Store,
  UtensilsCrossed,
  Warehouse,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COMMAND_PALETTE_EVENT } from "@/components/layout/global-hotkeys";
import type { SearchResultGroup, SearchResultItem } from "@/app/api/search/route";

type PaletteCommand = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: LucideIcon;
  /** كلمات إضافية للمطابقة (عربي/إنجليزي) */
  keywords: string;
};

const COMMANDS: PaletteCommand[] = [
  {
    id: "new-supplier-invoice",
    label: "فاتورة توريد جديدة",
    hint: "المشتريات",
    href: "/dashboard/invoices?new=1",
    icon: FileText,
    keywords: "فاتورة شراء مشتريات مورد supplier invoice purchase new",
  },
  {
    id: "new-purchase-order",
    label: "طلب شراء جديد",
    hint: "المشتريات",
    href: "/dashboard/purchase-orders?new=1",
    icon: ClipboardCheck,
    keywords: "طلب شراء purchase order new",
  },
  {
    id: "quick-sale",
    label: "بيع سريع — فاتورة عميل",
    hint: "المبيعات",
    href: "/dashboard/customer-invoices/new",
    icon: ReceiptText,
    keywords: "بيع فاتورة عميل مبيعات sale customer invoice",
  },
  {
    id: "new-stock-count",
    label: "جرد مخزون جديد",
    hint: "المخزون",
    href: "/dashboard/stock-counts?new=1",
    icon: ClipboardList,
    keywords: "جرد مخزون عد stock count inventory",
  },
  {
    id: "new-journal-entry",
    label: "سند قيد جديد",
    hint: "المحاسبة",
    href: "/dashboard/accounting/ledger/new",
    icon: Scale,
    keywords: "قيد سند يومية محاسبة journal voucher entry",
  },
  {
    id: "new-item",
    label: "صنف جديد",
    hint: "المخزون",
    href: "/dashboard/items?new=1",
    icon: PackagePlus,
    keywords: "صنف مادة item product new",
  },
  {
    id: "new-supplier",
    label: "مورد جديد",
    hint: "المشتريات",
    href: "/dashboard/suppliers?new=1",
    icon: Store,
    keywords: "مورد supplier new",
  },
  {
    id: "open-pos",
    label: "فتح نقطة البيع",
    hint: "Alt+P",
    href: "/d/pos",
    icon: MonitorSmartphone,
    keywords: "نقطة بيع كاشير pos cashier",
  },
];

const QUICK_LINKS: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "المخزون", href: "/dashboard/inventory", icon: Warehouse },
  { label: "الموردون", href: "/dashboard/suppliers", icon: Store },
  { label: "التقارير", href: "/dashboard/reports", icon: BarChart3 },
  { label: "الوصفات", href: "/dashboard/recipes", icon: ChefHat },
];

const GROUP_ICONS: Record<string, LucideIcon> = {
  pages: LayoutGrid,
  inventory: Boxes,
  warehouses: Warehouse,
  suppliers: Store,
  supplierInvoices: FileText,
  purchaseOrders: ClipboardCheck,
  customerInvoices: ReceiptText,
  recipes: ChefHat,
  menuItems: UtensilsCrossed,
};

const HOTKEY_HINTS: Array<{ keys: string; label: string }> = [
  { keys: "Alt+P", label: "نقطة البيع" },
  { keys: "Alt+I", label: "المخزون" },
  { keys: "Alt+S", label: "الموردون" },
  { keys: "Alt+D", label: "التقارير" },
  { keys: "Alt+N", label: "جديد" },
];

type FlatEntry =
  | { kind: "command"; command: PaletteCommand }
  | { kind: "result"; item: SearchResultItem; groupKey: string };

export function CommandPalette() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmed = query.trim();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setGroups([]);
    setActiveIndex(0);
  }, []);

  // الاستماع لحدث الفتح العالمي (Ctrl+K عبر GlobalHotkeys)
  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ query?: string }>).detail;
      setOpen(true);
      setActiveIndex(0);
      if (detail?.query) setQuery(detail.query);
    }
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen);
    return () => window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        cancelAnimationFrame(raf);
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(trimmed), 250);
    return () => clearTimeout(timer);
  }, [trimmed]);

  useEffect(() => {
    abortRef.current?.abort();
    if (!debouncedQuery) {
      setGroups([]);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          setGroups(data.groups ?? []);
          setActiveIndex(0);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setGroups([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [debouncedQuery]);

  const filteredCommands = useMemo(() => {
    if (!trimmed) return COMMANDS;
    const q = trimmed.toLowerCase();
    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.keywords.toLowerCase().includes(q),
    );
  }, [trimmed]);

  const flatEntries = useMemo<FlatEntry[]>(() => {
    const entries: FlatEntry[] = filteredCommands.map((command) => ({ kind: "command", command }));
    for (const group of groups) {
      for (const item of group.items) {
        entries.push({ kind: "result", item, groupKey: group.key });
      }
    }
    return entries;
  }, [filteredCommands, groups]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatEntries.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      const active = flatEntries[activeIndex];
      if (active) {
        e.preventDefault();
        go(active.kind === "command" ? active.command.href : active.item.href);
      }
    }
  }

  if (!open) return null;

  const hasQuery = trimmed.length > 0;
  const commandsOffset = 0;
  let resultIndex = filteredCommands.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[var(--overlay-bg)] p-4 pt-[12vh] print:hidden">
      <div className="absolute inset-0" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="لوحة الأوامر"
        className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--drawer-border)] bg-[var(--drawer-bg)] shadow-lift"
      >
        <div className="relative border-b border-border">
          <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب أمراً أو ابحث: فاتورة توريد، جرد، مورد، صنف..."
            className="h-14 w-full bg-transparent ps-11 pe-4 text-sm outline-none placeholder:text-muted-foreground"
            aria-label="لوحة الأوامر"
          />
          {loading && (
            <Loader2 className="absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredCommands.length > 0 && (
            <div className="mb-1">
              <p className="px-2.5 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
                إجراءات سريعة
              </p>
              {filteredCommands.map((command, i) => {
                const idx = commandsOffset + i;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={command.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => go(command.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors",
                      isActive ? "bg-primary-light" : "hover:bg-muted",
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                      <command.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {command.label}
                    </span>
                    {command.hint && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">{command.hint}</span>
                    )}
                    {isActive && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          {hasQuery && !loading && groups.length === 0 && filteredCommands.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <SearchX className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">لا توجد نتائج لـ &quot;{trimmed}&quot;</p>
              <p className="text-xs text-muted-foreground">جرّب كلمة أخرى أو تحقق من الإملاء.</p>
            </div>
          )}

          {groups.map((group) => {
            const GroupIcon = GROUP_ICONS[group.key] ?? Search;
            return (
              <div key={group.key} className="mb-1">
                <p className="px-2.5 pb-1 pt-2 text-[11px] font-bold text-muted-foreground/80">{group.label}</p>
                {group.items.map((item) => {
                  const idx = resultIndex++;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={`${group.key}-${item.id}`}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => go(item.href)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors",
                        isActive ? "bg-primary-light" : "hover:bg-muted",
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                        <GroupIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                        {item.subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                        )}
                      </span>
                      {item.meta && (
                        <span className="max-w-[38%] shrink-0 truncate text-[11px] text-muted-foreground">
                          {item.meta}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {!hasQuery && (
            <div className="mt-1 border-t border-border pt-2">
              <p className="px-2.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
                روابط سريعة
              </p>
              <div className="grid grid-cols-2 gap-1.5 px-1 pb-1">
                {QUICK_LINKS.map((link) => (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => go(link.href)}
                    className="flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-start text-xs font-semibold text-foreground transition-colors hover:border-border hover:bg-muted"
                  >
                    <link.icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{link.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" />
            للتنفيذ
          </span>
          <span>Esc للإغلاق</span>
          {HOTKEY_HINTS.map((hint) => (
            <span key={hint.keys} className="hidden items-center gap-1 sm:flex">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-sans text-[10px]">
                {hint.keys}
              </kbd>
              {hint.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
