import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getOptionalSession } from "@/lib/auth/session";
import { getInventoryData } from "@/server/queries/inventory";
import { getPurchasingData } from "@/server/queries/purchasing";
import { getCustomerInvoicesData } from "@/server/queries/sales";
import { getRecipesData } from "@/server/queries/recipes";
import { pinnedNav, appNav } from "@/components/layout/nav-config";
import { formatCurrency } from "@/lib/utils";

export type SearchResultItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
};

export type SearchResultGroup = {
  key: string;
  label: string;
  items: SearchResultItem[];
};

const STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  inactive: "متوقف",
  draft: "مسودة",
  sent: "مرسل",
  received: "مستلم",
  partially_received: "استلام جزئي",
  cancelled: "ملغي",
  paid: "مدفوع",
  issued: "صادر",
  void: "ملغي",
  matched: "مطابق",
  flagged: "بحاجة مراجعة",
};

function normalize(text: string | null | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ً-ْ]/g, "")
    .trim();
}

function matches(query: string, ...fields: Array<string | null | undefined>): boolean {
  return fields.some((field) => field && normalize(field).includes(query));
}

function rank(query: string, title: string) {
  const normTitle = normalize(title);
  if (normTitle === query) return 0;
  if (normTitle.startsWith(query)) return 1;
  return 2;
}

function buildGroup(key: string, label: string, items: SearchResultItem[], query: string, limit = 6): SearchResultGroup | null {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => rank(query, a.title) - rank(query, b.title));
  return { key, label, items: sorted.slice(0, limit) };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = (url.searchParams.get("q") ?? "").trim();

  if (rawQuery.length === 0) {
    return NextResponse.json({ success: true, query: "", groups: [] });
  }

  // في وضع الإنتاج (Supabase مفعّل) يجب أن يكون هناك مستخدم مسجّل دخول.
  if (hasSupabaseEnv()) {
    const session = await getOptionalSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "يجب تسجيل الدخول أولاً." }, { status: 401 });
    }
  }

  const query = normalize(rawQuery);

  const [inventory, purchasing, customerInvoices, recipesBundle] = await Promise.all([
    getInventoryData().catch(() => null),
    getPurchasingData().catch(() => null),
    getCustomerInvoicesData().catch(() => null),
    getRecipesData().catch(() => null),
  ]);

  const groups: SearchResultGroup[] = [];

  // ── الصفحات والأقسام ──
  const pageItems: SearchResultItem[] = [];
  for (const item of pinnedNav) {
    if (matches(query, item.title)) {
      pageItems.push({ id: item.href, title: item.title, href: item.href, subtitle: "الرئيسية" });
    }
  }
  for (const group of appNav) {
    for (const item of group.items) {
      if (matches(query, item.title)) {
        pageItems.push({ id: item.href, title: item.title, href: item.href, subtitle: group.title });
      }
    }
  }
  const pagesGroup = buildGroup("pages", "الصفحات والأقسام", pageItems, query, 8);
  if (pagesGroup) groups.push(pagesGroup);

  // ── الأصناف والمخزون ──
  if (inventory) {
    const items: SearchResultItem[] = inventory.items
      .filter((it) => matches(query, it.name, it.sku, it.categoryName, it.primarySupplierName))
      .map((it) => ({
        id: it.id,
        title: it.name,
        subtitle: it.categoryName || "بدون فئة",
        meta: formatCurrency(it.averageCost || it.lastPurchasePrice || 0),
        href: `/dashboard/inventory/${it.id}`,
      }));
    const g = buildGroup("inventory", "الأصناف والمخزون", items, query);
    if (g) groups.push(g);

    const warehouseItems: SearchResultItem[] = inventory.branches
      .filter((b) => matches(query, b.name, b.city, b.address, b.manager))
      .map((b) => ({
        id: b.id,
        title: b.name,
        subtitle: b.city || undefined,
        meta: STATUS_LABELS[b.status] ?? b.status,
        href: `/dashboard/warehouses/${b.id}`,
      }));
    const wg = buildGroup("warehouses", "المستودعات والفروع", warehouseItems, query, 4);
    if (wg) groups.push(wg);
  }

  // ── الموردون وفواتير التوريد وطلبيات الشراء ──
  if (purchasing) {
    const supplierItems: SearchResultItem[] = purchasing.suppliers
      .filter((s) => matches(query, s.name, s.phone, s.email, s.address))
      .map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: s.phone || s.address || undefined,
        href: `/dashboard/suppliers`,
      }));
    const sg = buildGroup("suppliers", "الموردون", supplierItems, query, 5);
    if (sg) groups.push(sg);

    const invoiceItems: SearchResultItem[] = purchasing.invoices
      .filter((inv) => matches(query, inv.invoiceNumber, inv.supplierName))
      .map((inv) => ({
        id: inv.id,
        title: inv.invoiceNumber,
        subtitle: inv.supplierName,
        meta: `${STATUS_LABELS[inv.status] ?? inv.status} · ${formatCurrency(inv.total)}`,
        href: `/dashboard/invoices`,
      }));
    const ig = buildGroup("supplierInvoices", "فواتير التوريد", invoiceItems, query, 5);
    if (ig) groups.push(ig);

    const orderItems: SearchResultItem[] = purchasing.purchaseOrders
      .filter((o) => matches(query, o.supplierName, o.branchName, o.id))
      .map((o) => ({
        id: o.id,
        title: `طلبية ${o.supplierName}`,
        subtitle: o.branchName,
        meta: `${STATUS_LABELS[o.status] ?? o.status} · ${formatCurrency(o.total)}`,
        href: `/dashboard/purchase-orders`,
      }));
    const og = buildGroup("purchaseOrders", "طلبيات الشراء", orderItems, query, 5);
    if (og) groups.push(og);
  }

  // ── فواتير العملاء ──
  if (customerInvoices) {
    const items: SearchResultItem[] = customerInvoices.invoices
      .filter((inv) => matches(query, inv.invoiceNumber, inv.customerName, inv.customerPhone))
      .map((inv) => ({
        id: inv.id,
        title: inv.customerName || inv.invoiceNumber,
        subtitle: inv.invoiceNumber,
        meta: `${STATUS_LABELS[inv.status] ?? inv.status} · ${formatCurrency(inv.total)}`,
        href: `/dashboard/customer-invoices/${inv.id}`,
      }));
    const g = buildGroup("customerInvoices", "فواتير وعملاء", items, query);
    if (g) groups.push(g);
  }

  // ── الوصفات وقائمة الطعام ──
  if (recipesBundle) {
    const recipeItems: SearchResultItem[] = recipesBundle.recipes
      .filter((r) => matches(query, r.name, r.category))
      .map((r) => ({
        id: r.id,
        title: r.name,
        subtitle: r.category,
        meta: `${formatCurrency(r.costPerServing)} / الحصة`,
        href: `/dashboard/recipes/${r.id}`,
      }));
    const rg = buildGroup("recipes", "الوصفات", recipeItems, query, 5);
    if (rg) groups.push(rg);

    const menuItems: SearchResultItem[] = recipesBundle.menuItems
      .filter((m) => matches(query, m.name, m.recipeName))
      .map((m) => ({
        id: m.id,
        title: m.name,
        subtitle: m.recipeName || undefined,
        meta: formatCurrency(m.sellingPrice),
        href: `/dashboard/menu-items/${m.id}`,
      }));
    const mg = buildGroup("menuItems", "قائمة الطعام", menuItems, query, 5);
    if (mg) groups.push(mg);
  }

  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  return NextResponse.json({ success: true, query: rawQuery, totalCount, groups });
}
