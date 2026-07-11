import { describe, expect, it } from "vitest";
import { includesNormalized, normalize, tokenize, scoreMatch } from "@/lib/search/match";
import { PAGE_INDEX } from "@/lib/search/page-index";

/** يحاكي بحث الصفحات في /api/search ويعيد المسارات مرتبة بالدرجة. */
function searchPages(query: string): string[] {
  const tokens = tokenize(query);
  return PAGE_INDEX.flatMap((page) => {
    const score = scoreMatch(tokens, [
      [page.title, 3],
      [page.keywords.join(" "), 2],
      [page.description, 1.5],
      [page.section, 1],
    ]);
    return score === null ? [] : [{ href: page.href, score }];
  })
    .sort((a, b) => b.score - a.score)
    .map((r) => r.href);
}

describe("normalize", () => {
  it("يوحد الهمزات والتاء المربوطة والألف المقصورة", () => {
    expect(normalize("إدارة")).toBe(normalize("اداره"));
    expect(normalize("مبيعاتٌ")).toBe("مبيعات");
  });
});

describe("includesNormalized", () => {
  it("يجد الصنف رغم اختلاف الهمزة والتاء المربوطة", () => {
    expect(includesNormalized("ارز بالخضار", ["أرز بالخضاره"])).toBe(true);
  });

  it("يستمر بدعم الرمز والباركود", () => {
    expect(includesNormalized("ABC-10", ["طبق اليوم", "abc-10"])).toBe(true);
  });
});

describe("tokenize", () => {
  it("يقسم الجملة ويزيل ال التعريف", () => {
    expect(tokenize("المخزن الرئيسي")).toEqual(["مخزن", "رييسي"].map(normalize));
  });
});

describe("scoreMatch", () => {
  it("يرفض النتيجة إذا لم تتطابق كل كلمات البحث", () => {
    expect(scoreMatch(tokenize("فاتورة طيران"), [["فاتورة مبيعات", 1]])).toBeNull();
  });

  it("يقبل تطابق الكلمات عبر حقول مختلفة", () => {
    const score = scoreMatch(tokenize("فاتورة مورد"), [
      ["فاتورة توريد", 3],
      ["مورد مشتريات", 2],
    ]);
    expect(score).not.toBeNull();
  });
});

describe("البحث الشامل في فهرس الصفحات", () => {
  it("«وردية» تُظهر صفحة الورديات والكاشير", () => {
    const results = searchPages("وردية");
    expect(results).toContain("/dashboard/shifts");
    expect(results).toContain("/d/pos");
    expect(results[0]).toBe("/dashboard/shifts"); // الأكثر صلة أولًا
  });

  it("«مخزن» تُظهر كل عائلة المخزون", () => {
    const results = searchPages("مخزن");
    for (const href of [
      "/dashboard/inventory",
      "/dashboard/inventory/dashboard",
      "/dashboard/warehouses",
      "/dashboard/stock-movements",
      "/dashboard/waste",
      "/dashboard/reports",
    ]) {
      expect(results).toContain(href);
    }
  });

  it("«المخزن» مع ال التعريف تعمل مثل «مخزن»", () => {
    expect(searchPages("المخزن")).toEqual(searchPages("مخزن"));
  });

  it("«جرد» تُظهر صفحة الجرد", () => {
    expect(searchPages("جرد")[0]).toBe("/dashboard/stock-counts");
  });

  it("بحث بجملة متعددة الكلمات: «فاتورة مورد»", () => {
    const results = searchPages("فاتورة مورد");
    expect(results).toContain("/dashboard/invoices");
  });

  it("«هدر» تُظهر التالف والمحاريق", () => {
    expect(searchPages("هدر")).toContain("/dashboard/waste");
  });

  it("«مصاريف» تُظهر صفحة المصروفات بالمرادف", () => {
    expect(searchPages("مصاريف")).toContain("/dashboard/accounting/expenses");
  });

  it("كلمة غير موجودة لا تعيد شيئًا", () => {
    expect(searchPages("طائرة")).toEqual([]);
  });
});
