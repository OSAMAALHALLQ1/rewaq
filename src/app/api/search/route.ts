import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getOptionalSession } from "@/lib/auth/session";
import { getInventoryData } from "@/server/queries/inventory";
import { getPurchasingData } from "@/server/queries/purchasing";
import { getCustomerInvoicesData } from "@/server/queries/sales";
import { getRecipesData } from "@/server/queries/recipes";
import { PAGE_INDEX } from "@/lib/search/page-index";
import { tokenize, scoreMatch } from "@/lib/search/match";
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

function buildGroup(key: string, label: string, scored: Array<{ item: SearchResultItem; score: number }>, limit = 6): SearchResultGroup | null {
  if (scored.length === 0) return null;
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  return { key, label, items: sorted.slice(0, limit).map((s) => s.item) };
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

  const tokens = tokenize(rawQuery);
  if (tokens.length === 0) {
    return NextResponse.json({ success: true, query: rawQuery, totalCount: 0, groups: [] });
  }

  const [inventory, purchasing, customerInvoices, recipesBundle] = await Promise.all([
    getInventoryData().catch(() => null),
    getPurchasingData().catch(() => null),
    getCustomerInvoicesData().catch(() => null),
    getRecipesData().catch(() => null),
  ]);

  const groups: SearchResultGroup[] = [];

  // ── الصفحات والأقسام (فهرس شامل بالمحتوى والمرادفات) ──
  const pageScored = PAGE_INDEX.flatMap((page) => {
    const score = scoreMatch(tokens, [
      [page.title, 3],
      [page.keywords.join(" "), 2],
      [page.description, 1.5],
      [page.section, 1],
    ]);
    if (score === null) return [];
    return [{
      score,
      item: {
        id: page.href,
        title: page.title,
        subtitle: page.section,
        meta: page.description,
        href: page.href,
      } satisfies SearchResultItem,
    }];
  });
  const pagesGroup = buildGroup("pages", "الصفحات والأقسام", pageScored, 8);
  if (pagesGroup) groups.push(pagesGroup);

  // ── الأصناف والمخزون ──
  if (inventory) {
    const itemScored = inventory.items.flatMap((it) => {
      const score = scoreMatch(tokens, [
        [it.name, 3],
        [it.sku, 2],
        [it.categoryName, 1.5],
        [it.primarySupplierName, 1],
      ]);
      if (score === null) return [];
      return [{
        score,
        item: {
          id: it.id,
          title: it.name,
          subtitle: it.categoryName || "بدون فئة",
          meta: formatCurrency(it.averageCost || it.lastPurchasePrice || 0),
          href: `/dashboard/inventory/${it.id}`,
        } satisfies SearchResultItem,
      }];
    });
    const g = buildGroup("inventory", "الأصناف والمخزون", itemScored);
    if (g) groups.push(g);

    const warehouseScored = inventory.branches.flatMap((b) => {
      const score = scoreMatch(tokens, [
        [b.name, 3],
        [b.city, 1.5],
        [b.address, 1],
        [b.manager, 1],
      ]);
      if (score === null) return [];
      return [{
        score,
        item: {
          id: b.id,
          title: b.name,
          subtitle: b.city || undefined,
          meta: STATUS_LABELS[b.status] ?? b.status,
          href: `/dashboard/warehouses/${b.id}`,
        } satisfies SearchResultItem,
      }];
    });
    const wg = buildGroup("warehouses", "المستودعات والفروع", warehouseScored, 4);
    if (wg) groups.push(wg);
  }

  // ── الموردون وفواتير التوريد وطلبيات الشراء ──
  if (purchasing) {
    const supplierScored = purchasing.suppliers.flatMap((s) => {
      const score = scoreMatch(tokens, [
        [s.name, 3],
        [s.phone, 2],
        [s.email, 1.5],
        [s.address, 1],
      ]);
      if (score === null) return [];
      return [{
        score,
        item: {
          id: s.id,
          title: s.name,
          subtitle: s.phone || s.address || undefined,
          href: `/dashboard/suppliers`,
        } satisfies SearchResultItem,
      }];
    });
    const sg = buildGroup("suppliers", "الموردون", supplierScored, 5);
    if (sg) groups.push(sg);

    const invoiceScored = purchasing.invoices.flatMap((inv) => {
      const score = scoreMatch(tokens, [
        [inv.invoiceNumber, 3],
        [inv.supplierName, 2],
      ]);
      if (score === null) return [];
      return [{
        score,
        item: {
          id: inv.id,
          title: inv.invoiceNumber,
          subtitle: inv.supplierName,
          meta: `${STATUS_LABELS[inv.status] ?? inv.status} · ${formatCurrency(inv.total)}`,
          href: `/dashboard/invoices`,
        } satisfies SearchResultItem,
      }];
    });
    const ig = buildGroup("supplierInvoices", "فواتير التوريد", invoiceScored, 5);
    if (ig) groups.push(ig);

    const orderScored = purchasing.purchaseOrders.flatMap((o) => {
      const score = scoreMatch(tokens, [
        [o.supplierName, 3],
        [o.branchName, 1.5],
        [o.id, 1],
      ]);
      if (score === null) return [];
      return [{
        score,
        item: {
          id: o.id,
          title: `طلبية ${o.supplierName}`,
          subtitle: o.branchName,
          meta: `${STATUS_LABELS[o.status] ?? o.status} · ${formatCurrency(o.total)}`,
          href: `/dashboard/purchase-orders`,
        } satisfies SearchResultItem,
      }];
    });
    const og = buildGroup("purchaseOrders", "طلبيات الشراء", orderScored, 5);
    if (og) groups.push(og);
  }

  // ── فواتير العملاء ──
  if (customerInvoices) {
    const invScored = customerInvoices.invoices.flatMap((inv) => {
      const score = scoreMatch(tokens, [
        [inv.customerName, 3],
        [inv.invoiceNumber, 2.5],
        [inv.customerPhone, 2],
      ]);
      if (score === null) return [];
      return [{
        score,
        item: {
          id: inv.id,
          title: inv.customerName || inv.invoiceNumber,
          subtitle: inv.invoiceNumber,
          meta: `${STATUS_LABELS[inv.status] ?? inv.status} · ${formatCurrency(inv.total)}`,
          href: `/dashboard/customer-invoices/${inv.id}`,
        } satisfies SearchResultItem,
      }];
    });
    const g = buildGroup("customerInvoices", "فواتير وعملاء", invScored);
    if (g) groups.push(g);
  }

  // ── الوصفات وقائمة الطعام ──
  if (recipesBundle) {
    const recipeScored = recipesBundle.recipes.flatMap((r) => {
      const score = scoreMatch(tokens, [
        [r.name, 3],
        [r.category, 1.5],
        [r.ingredients.map((ing) => ing.itemName).join(" "), 1],
      ]);
      if (score === null) return [];
      return [{
        score,
        item: {
          id: r.id,
          title: r.name,
          subtitle: r.category,
          meta: `${formatCurrency(r.costPerServing)} / الحصة`,
          href: `/dashboard/recipes/${r.id}`,
        } satisfies SearchResultItem,
      }];
    });
    const rg = buildGroup("recipes", "الوصفات", recipeScored, 5);
    if (rg) groups.push(rg);

    const menuScored = recipesBundle.menuItems.flatMap((m) => {
      const score = scoreMatch(tokens, [
        [m.name, 3],
        [m.recipeName, 1.5],
      ]);
      if (score === null) return [];
      return [{
        score,
        item: {
          id: m.id,
          title: m.name,
          subtitle: m.recipeName || undefined,
          meta: formatCurrency(m.sellingPrice),
          href: `/dashboard/menu-items/${m.id}`,
        } satisfies SearchResultItem,
      }];
    });
    const mg = buildGroup("menuItems", "قائمة الطعام", menuScored, 5);
    if (mg) groups.push(mg);
  }

  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  return NextResponse.json({ success: true, query: rawQuery, totalCount, groups });
}
