"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  ChefHat,
  ClipboardCheck,
  CornerDownLeft,
  FileText,
  LayoutGrid,
  Loader2,
  MonitorSmartphone,
  ReceiptText,
  Search,
  SearchX,
  Store,
  UtensilsCrossed,
  Warehouse,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchResultGroup, SearchResultItem } from "@/app/api/search/route";

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

const QUICK_LINKS: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "نقطة البيع", href: "/d/pos", icon: MonitorSmartphone },
  { label: "المخزون", href: "/dashboard/inventory/dashboard", icon: Warehouse },
  { label: "الموردون", href: "/dashboard/suppliers", icon: Store },
  { label: "فواتير العملاء", href: "/dashboard/customer-invoices", icon: ReceiptText },
  { label: "الوصفات", href: "/dashboard/recipes", icon: ChefHat },
  { label: "التقارير", href: "/dashboard/reports", icon: BarChart3 },
];

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent font-bold text-primary">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

type GlobalSearchProps = {
  variant?: "desktop" | "mobile";
  autoFocus?: boolean;
  className?: string;
  onNavigate?: () => void;
};

export function GlobalSearch({ variant = "desktop", autoFocus, className, onNavigate }: GlobalSearchProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmed = query.trim();

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch results
  useEffect(() => {
    abortRef.current?.abort();

    if (!debouncedQuery) {
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

  const flatItems = useMemo(() => groups.flatMap((g) => g.items.map((item) => ({ item, group: g }))), [groups]);

  const indexByKey = useMemo(() => {
    const map = new Map<string, number>();
    flatItems.forEach((entry, idx) => {
      map.set(`${entry.group.key}-${entry.item.id}`, idx);
    });
    return map;
  }, [flatItems]);

  // Click outside to close
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // Ctrl+K / Cmd+K to focus (desktop only)
  useEffect(() => {
    if (variant !== "desktop") return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variant]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      setGroups([]);
      inputRef.current?.blur();
      onNavigate?.();
      router.push(href);
    },
    [router, onNavigate],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      const active = flatItems[activeIndex];
      if (active) {
        e.preventDefault();
        go(active.item.href);
      }
    }
  }

  const showPanel = open;
  const hasQuery = trimmed.length > 0;
  const totalResults = flatItems.length;
  const listboxId = useId();

  return (
    <div
      ref={containerRef}
      className={cn("relative", variant === "desktop" ? "w-full max-w-lg" : "w-full", className)}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="بحث عام: صنف، فاتورة، مورد، عميل، وصفة، صفحة..."
          className={cn(
            "w-full rounded-full border border-transparent bg-muted text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary",
            variant === "desktop"
              ? "h-11 ps-10 pe-10"
              : "py-2.5 ps-10 pe-10",
          )}
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setGroups([]);
              inputRef.current?.focus();
            }}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-slate-200/70 hover:text-foreground"
            aria-label="مسح البحث"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showPanel && (
        <div
          id={listboxId}
          className={cn(
            "z-50 overflow-hidden rounded-3xl border border-border bg-white shadow-lift",
            variant === "desktop" ? "absolute inset-x-0 top-full mt-2" : "static mt-2",
          )}
        >
          <div className={cn("overflow-y-auto p-2", variant === "desktop" ? "max-h-[70vh]" : "max-h-[55vh]")}>
            {!hasQuery && (
              <>
                <p className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
                  روابط سريعة
                </p>
                <div className="grid grid-cols-2 gap-1.5 px-1 pb-2">
                  {QUICK_LINKS.map((link) => (
                    <button
                      key={link.href}
                      type="button"
                      onClick={() => go(link.href)}
                      className="flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-start text-xs font-semibold text-foreground transition-colors hover:border-border hover:bg-slate-50"
                    >
                      <link.icon className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{link.label}</span>
                    </button>
                  ))}
                </div>
                <p className="border-t border-border px-2.5 py-2 text-[11px] text-muted-foreground">
                  اكتب للبحث في كل أقسام النظام: الأصناف، الفواتير، الموردون، العملاء، الوصفات، المستودعات...
                </p>
              </>
            )}

            {hasQuery && loading && (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2">
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />
                      <div className="h-2 w-1/4 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasQuery && !loading && groups.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <SearchX className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">لا توجد نتائج لـ &quot;{trimmed}&quot;</p>
                <p className="text-xs text-muted-foreground">جرّب كلمة أخرى أو تحقق من الإملاء.</p>
              </div>
            )}

            {hasQuery && !loading && groups.length > 0 && (
              <>
                <p className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
                  {totalResults} نتيجة
                </p>
                {groups.map((group) => {
                  const GroupIcon = GROUP_ICONS[group.key] ?? Search;
                  return (
                    <div key={group.key} className="mb-1">
                      <p className="px-2.5 pb-1 pt-2 text-[11px] font-bold text-muted-foreground/80">{group.label}</p>
                      <div role="listbox">
                        {group.items.map((item: SearchResultItem) => {
                          const flatIndex = indexByKey.get(`${group.key}-${item.id}`) ?? -1;
                          const isActive = flatIndex === activeIndex;
                          return (
                            <button
                              key={`${group.key}-${item.id}`}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onMouseEnter={() => setActiveIndex(flatIndex)}
                              onClick={() => go(item.href)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-start transition-colors",
                                isActive ? "bg-primary-light" : "hover:bg-muted",
                              )}
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                                <GroupIcon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-foreground">
                                  {highlightMatch(item.title, trimmed)}
                                </span>
                                {item.subtitle && (
                                  <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                                )}
                              </span>
                              {item.meta && (
                                <span className="max-w-[38%] shrink-0 truncate text-[11px] text-muted-foreground">{item.meta}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {variant === "desktop" && (hasQuery || loading) && (
            <div className="flex items-center justify-between border-t border-border bg-slate-50/80 px-3 py-1.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" />
                للفتح
              </span>
              <span>Esc للإغلاق</span>
              {loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
