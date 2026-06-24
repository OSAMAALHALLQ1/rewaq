"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  Banknote,
  Calculator,
  ChefHat,
  Factory,
  PackageCheck,
  Plus,
  Printer,
  RotateCcw,
  Scale,
  Trash2,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { StatusTone } from "@/types/domain";

type WarehouseKey = "general" | "kitchen";
type StageKey = "prep" | "cook" | "pack";
type BasisKey = "units" | "minutes" | "revenue";

type RecipeRow = {
  id: string;
  name: string;
  warehouse: WarehouseKey;
  stage: StageKey;
  quantity: number;
  unit: string;
  unitCost: number;
  yieldPercent: number;
  wastePercent: number;
};

type OverheadRow = {
  id: string;
  name: string;
  amount: number;
  basis: BasisKey;
  sharePercent: number;
};

type MenuRow = {
  id: string;
  name: string;
  price: number;
  expectedSales: number;
  cost: number;
};

const warehouseLabels: Record<WarehouseKey, string> = {
  general: "المستودع العام",
  kitchen: "مستودع المطبخ",
};

const stageLabels: Record<StageKey, string> = {
  prep: "تحضير",
  cook: "طبخ / إنتاج",
  pack: "تغليف وتقديم",
};

const basisLabels: Record<BasisKey, string> = {
  units: "عدد الوحدات",
  minutes: "زمن التشغيل",
  revenue: "نسبة الإيراد",
};

const initialRecipe: RecipeRow[] = [
  { id: "chicken", name: "دجاج طازج", warehouse: "kitchen", stage: "prep", quantity: 18, unit: "كغ", unitCost: 17, yieldPercent: 88, wastePercent: 4 },
  { id: "bun", name: "خبز برجر", warehouse: "general", stage: "pack", quantity: 120, unit: "حبة", unitCost: 1.15, yieldPercent: 100, wastePercent: 1 },
  { id: "potato", name: "بطاطا", warehouse: "kitchen", stage: "cook", quantity: 25, unit: "كغ", unitCost: 4.5, yieldPercent: 82, wastePercent: 6 },
  { id: "sauce", name: "صوص خاص", warehouse: "kitchen", stage: "prep", quantity: 7, unit: "كغ", unitCost: 13, yieldPercent: 96, wastePercent: 2 },
  { id: "packaging", name: "علب وتغليف", warehouse: "general", stage: "pack", quantity: 120, unit: "طقم", unitCost: 0.75, yieldPercent: 100, wastePercent: 0 },
];

const initialOverheads: OverheadRow[] = [
  { id: "labor", name: "أجور عمال الإنتاج", amount: 520, basis: "minutes", sharePercent: 100 },
  { id: "rent", name: "إيجار محمل على اليوم", amount: 180, basis: "units", sharePercent: 100 },
  { id: "utilities", name: "كهرباء وماء وغاز", amount: 135, basis: "minutes", sharePercent: 100 },
  { id: "depreciation", name: "إهلاك معدات المطبخ", amount: 95, basis: "units", sharePercent: 100 },
  { id: "admin", name: "إدارة ونظافة ومصاريف أخرى", amount: 85, basis: "revenue", sharePercent: 100 },
];

const initialMenu: MenuRow[] = [
  { id: "classic", name: "برجر كلاسيك", price: 24, expectedSales: 85, cost: 13.4 },
  { id: "double", name: "برجر دبل", price: 34, expectedSales: 42, cost: 19.8 },
  { id: "fries", name: "بطاطس متبلة", price: 9, expectedSales: 110, cost: 3.6 },
  { id: "juice", name: "عصير طبيعي", price: 13, expectedSales: 30, cost: 7.9 },
];

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function Field({
  label,
  value,
  onChange,
  suffix,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
}) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <div className="relative">
        <Input
          type="number"
          min={min}
          value={value}
          onChange={(event) => onChange(toNumber(event.target.value))}
          className={suffix ? "pl-20" : undefined}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 rounded-lg border bg-slate-50 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="font-semibold text-slate-950">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function CostAccountingCalculator() {
  const [productName, setProductName] = useState("وجبة برجر دجاج");
  const [dailyOutput, setDailyOutput] = useState(120);
  const [sellingPrice, setSellingPrice] = useState(24);
  const [prepMinutes, setPrepMinutes] = useState(260);
  const [targetMargin, setTargetMargin] = useState(35);
  const [cashSales, setCashSales] = useState(1850);
  const [cardSales, setCardSales] = useState(940);
  const [deliverySales, setDeliverySales] = useState(520);
  const [discounts, setDiscounts] = useState(75);
  const [taxRate, setTaxRate] = useState(16);
  const [actualMaterialCost, setActualMaterialCost] = useState(790);
  const [actualLaborCost, setActualLaborCost] = useState(560);
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>(initialRecipe);
  const [overheadRows, setOverheadRows] = useState<OverheadRow[]>(initialOverheads);
  const [menuRows, setMenuRows] = useState<MenuRow[]>(initialMenu);

  const totals = useMemo(() => {
    const safeOutput = Math.max(dailyOutput, 1);
    const safeMinutes = Math.max(prepMinutes, 1);

    const enrichedRecipe = recipeRows.map((row) => {
      const grossCost = row.quantity * row.unitCost;
      const yieldLoss = grossCost * ((100 - row.yieldPercent) / 100);
      const wasteCost = grossCost * (row.wastePercent / 100);
      const loadedCost = grossCost + yieldLoss + wasteCost;

      return { ...row, grossCost, yieldLoss, wasteCost, loadedCost };
    });

    const materialTotal = enrichedRecipe.reduce((sum, row) => sum + row.loadedCost, 0);
    const overheadTotal = overheadRows.reduce((sum, row) => sum + row.amount * (row.sharePercent / 100), 0);
    const totalCost = materialTotal + overheadTotal;
    const costPerUnit = totalCost / safeOutput;
    const materialCostPerUnit = materialTotal / safeOutput;
    const overheadCostPerUnit = overheadTotal / safeOutput;
    const contribution = sellingPrice - costPerUnit;
    const foodCostPercent = sellingPrice > 0 ? (materialCostPerUnit / sellingPrice) * 100 : 0;
    const marginPercent = sellingPrice > 0 ? (contribution / sellingPrice) * 100 : 0;
    const targetRate = Math.min(Math.max(targetMargin, 1), 90) / 100;
    const suggestedPrice = costPerUnit / (1 - targetRate);
    const breakEvenUnits = sellingPrice > 0 ? Math.ceil(totalCost / sellingPrice) : 0;
    const plannedRevenue = sellingPrice * dailyOutput;
    const plannedProfit = plannedRevenue - totalCost;

    const cashierGross = cashSales + cardSales + deliverySales;
    const cashierNetBeforeTax = Math.max(cashierGross - discounts, 0);
    const taxValue = cashierNetBeforeTax * (taxRate / 100);
    const cashierNet = cashierNetBeforeTax + taxValue;
    const drawerExpected = cashSales - discounts;

    const generalWarehouseCost = enrichedRecipe
      .filter((row) => row.warehouse === "general")
      .reduce((sum, row) => sum + row.loadedCost, 0);
    const kitchenWarehouseCost = enrichedRecipe
      .filter((row) => row.warehouse === "kitchen")
      .reduce((sum, row) => sum + row.loadedCost, 0);

    const materialVariance = actualMaterialCost - materialTotal;
    const laborPlanned = overheadRows.find((row) => row.id === "labor")?.amount ?? 0;
    const laborVariance = actualLaborCost - laborPlanned;
    const totalVariance = materialVariance + laborVariance;
    const variancePerUnit = totalVariance / safeOutput;
    const minuteCost = overheadTotal / safeMinutes;

    const averageContribution =
      menuRows.reduce((sum, row) => sum + (row.price - row.cost) * row.expectedSales, 0) /
      Math.max(menuRows.reduce((sum, row) => sum + row.expectedSales, 0), 1);
    const averageSales =
      menuRows.reduce((sum, row) => sum + row.expectedSales, 0) / Math.max(menuRows.length, 1);

    const menuEngineering = menuRows.map((row) => {
      const contributionMargin = row.price - row.cost;
      const popularity = row.expectedSales >= averageSales;
      const profitability = contributionMargin >= averageContribution;
      const label = popularity && profitability ? "نجم" : popularity ? "حصان عمل" : profitability ? "لغز" : "ضعيف";
      const tone: StatusTone = popularity && profitability ? "success" : popularity ? "warning" : profitability ? "default" : "danger";

      return {
        ...row,
        contributionMargin,
        foodCostPercent: row.price > 0 ? (row.cost / row.price) * 100 : 0,
        label,
        tone,
      };
    });

    return {
      enrichedRecipe,
      materialTotal,
      overheadTotal,
      totalCost,
      costPerUnit,
      materialCostPerUnit,
      overheadCostPerUnit,
      contribution,
      foodCostPercent,
      marginPercent,
      suggestedPrice,
      breakEvenUnits,
      plannedRevenue,
      plannedProfit,
      cashierGross,
      cashierNetBeforeTax,
      taxValue,
      cashierNet,
      drawerExpected,
      generalWarehouseCost,
      kitchenWarehouseCost,
      materialVariance,
      laborVariance,
      totalVariance,
      variancePerUnit,
      minuteCost,
      menuEngineering,
    };
  }, [
    actualLaborCost,
    actualMaterialCost,
    cardSales,
    cashSales,
    dailyOutput,
    deliverySales,
    discounts,
    menuRows,
    overheadRows,
    prepMinutes,
    recipeRows,
    sellingPrice,
    targetMargin,
    taxRate,
  ]);

  const updateRecipe = (id: string, patch: Partial<RecipeRow>) => {
    setRecipeRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const updateOverhead = (id: string, patch: Partial<OverheadRow>) => {
    setOverheadRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const updateMenu = (id: string, patch: Partial<MenuRow>) => {
    setMenuRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const resetExample = () => {
    setProductName("وجبة برجر دجاج");
    setDailyOutput(120);
    setSellingPrice(24);
    setPrepMinutes(260);
    setTargetMargin(35);
    setCashSales(1850);
    setCardSales(940);
    setDeliverySales(520);
    setDiscounts(75);
    setTaxRate(16);
    setActualMaterialCost(790);
    setActualLaborCost(560);
    setRecipeRows(initialRecipe);
    setOverheadRows(initialOverheads);
    setMenuRows(initialMenu);
  };

  const profitTone = totals.plannedProfit < 0 ? "danger" : totals.marginPercent < 20 ? "warning" : "success";
  const varianceTone = totals.totalVariance > 0 ? "danger" : totals.totalVariance < 0 ? "success" : "muted";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">تكلفة المواد المحملة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-950">{formatCurrency(totals.materialTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">تشمل الفاقد، الهدر، ونسبة التصافي.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">مصروفات وإهلاك محملة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-950">{formatCurrency(totals.overheadTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">أجور، إيجار، مرافق، معدات، وإدارة.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">التكلفة الحقيقية للوجبة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-950">{formatCurrency(totals.costPerUnit)}</p>
            <p className="mt-1 text-xs text-muted-foreground">مواد {formatCurrency(totals.materialCostPerUnit)} + تشغيل {formatCurrency(totals.overheadCostPerUnit)}.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-muted-foreground">
              ربحية الوجبة
              <Badge tone={profitTone}>{formatPercent(totals.marginPercent)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-950">{formatCurrency(totals.contribution)}</p>
            <p className="mt-1 text-xs text-muted-foreground">سعر مقترح {formatCurrency(totals.suggestedPrice)}.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SectionTitle
              icon={Calculator}
              title="بيانات المنتج واليوم التشغيلي"
              description="هذه الخانات هي أساس توزيع تكلفة الريسبي والمصاريف على الوجبات."
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={resetExample}>
                <RotateCcw className="h-4 w-4" />
                إعادة المثال
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                طباعة
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2 text-sm font-medium text-slate-700 xl:col-span-2">
              <span>اسم المنتج أو الوجبة</span>
              <Input value={productName} onChange={(event) => setProductName(event.target.value)} />
            </label>
            <Field label="إنتاج اليوم" value={dailyOutput} onChange={setDailyOutput} suffix="وجبة" min={1} />
            <Field label="سعر البيع" value={sellingPrice} onChange={setSellingPrice} suffix="شيكل" />
            <Field label="دقائق التشغيل" value={prepMinutes} onChange={setPrepMinutes} suffix="دقيقة" min={1} />
            <Field label="هامش الربح المطلوب" value={targetMargin} onChange={setTargetMargin} suffix="بالمئة" min={1} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <SectionTitle
                icon={ChefHat}
                title="كرت الريسبي والمراحل الإنتاجية"
                description="كل مادة لها مستودع، مرحلة إنتاج، كمية، سعر، تصافي، وهدر."
              />
              <Button
                onClick={() =>
                  setRecipeRows((current) => [
                    ...current,
                    {
                      id: crypto.randomUUID(),
                      name: "مادة جديدة",
                      warehouse: "kitchen",
                      stage: "prep",
                      quantity: 1,
                      unit: "كغ",
                      unitCost: 0,
                      yieldPercent: 100,
                      wastePercent: 0,
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                إضافة مادة
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المادة</TableHead>
                  <TableHead>المستودع</TableHead>
                  <TableHead>المرحلة</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>الوحدة</TableHead>
                  <TableHead>سعر الوحدة</TableHead>
                  <TableHead>التصافي</TableHead>
                  <TableHead>الهدر</TableHead>
                  <TableHead>التكلفة</TableHead>
                  <TableHead>حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totals.enrichedRecipe.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-40">
                      <Input value={row.name} onChange={(event) => updateRecipe(row.id, { name: event.target.value })} />
                    </TableCell>
                    <TableCell className="min-w-36">
                      <Select value={row.warehouse} onChange={(event) => updateRecipe(row.id, { warehouse: event.target.value as WarehouseKey })}>
                        <option value="general">{warehouseLabels.general}</option>
                        <option value="kitchen">{warehouseLabels.kitchen}</option>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-36">
                      <Select value={row.stage} onChange={(event) => updateRecipe(row.id, { stage: event.target.value as StageKey })}>
                        <option value="prep">{stageLabels.prep}</option>
                        <option value="cook">{stageLabels.cook}</option>
                        <option value="pack">{stageLabels.pack}</option>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-28">
                      <Input type="number" min={0} value={row.quantity} onChange={(event) => updateRecipe(row.id, { quantity: toNumber(event.target.value) })} />
                    </TableCell>
                    <TableCell className="min-w-24">
                      <Input value={row.unit} onChange={(event) => updateRecipe(row.id, { unit: event.target.value })} />
                    </TableCell>
                    <TableCell className="min-w-28">
                      <Input type="number" min={0} value={row.unitCost} onChange={(event) => updateRecipe(row.id, { unitCost: toNumber(event.target.value) })} />
                    </TableCell>
                    <TableCell className="min-w-24">
                      <Input type="number" min={0} value={row.yieldPercent} onChange={(event) => updateRecipe(row.id, { yieldPercent: toNumber(event.target.value) })} />
                    </TableCell>
                    <TableCell className="min-w-24">
                      <Input type="number" min={0} value={row.wastePercent} onChange={(event) => updateRecipe(row.id, { wastePercent: toNumber(event.target.value) })} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(row.loadedCost)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRecipeRows((current) => current.filter((item) => item.id !== row.id))}
                        disabled={recipeRows.length === 1}
                        aria-label="حذف المادة"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <SectionTitle
                icon={Warehouse}
                title="المستودعات المطلوبة للإنتاج"
                description="تقسيم الاستهلاك بين المستودع العام ومستودع المطبخ."
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">المستودع العام</span>
                  <Badge tone="default">مواد عامة وتغليف</Badge>
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCurrency(totals.generalWarehouseCost)}</p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">مستودع المطبخ</span>
                  <Badge tone="success">مواد إنتاج مباشرة</Badge>
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCurrency(totals.kitchenWarehouseCost)}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  تنبيه رقابي
                </div>
                أي صرف من مستودع المطبخ يجب أن يكون مقابل ريسبي أو أمر إنتاج حتى تظهر الانحرافات.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle
                icon={PackageCheck}
                title="نتيجة تكلفة المنتج"
                description="خلاصة تصلح للتسعير، القرار، ومراجعة نقطة التعادل."
              />
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-muted-foreground">إيراد اليوم المخطط</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(totals.plannedRevenue)}</p>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-muted-foreground">ربح اليوم المخطط</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(totals.plannedProfit)}</p>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-muted-foreground">نقطة التعادل</p>
                <p className="mt-1 text-xl font-bold">{formatNumber(totals.breakEvenUnits)} وجبة</p>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-muted-foreground">تكلفة دقيقة التشغيل</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(totals.minuteCost)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <SectionTitle
              icon={Factory}
              title="توزيع المصاريف والإهلاك"
              description="حمّل المصاريف على المنتج حسب الوحدات، زمن التشغيل، أو الإيراد."
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>البند</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>أساس التوزيع</TableHead>
                  <TableHead>النسبة</TableHead>
                  <TableHead>المحمل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overheadRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-44">
                      <Input value={row.name} onChange={(event) => updateOverhead(row.id, { name: event.target.value })} />
                    </TableCell>
                    <TableCell className="min-w-28">
                      <Input type="number" min={0} value={row.amount} onChange={(event) => updateOverhead(row.id, { amount: toNumber(event.target.value) })} />
                    </TableCell>
                    <TableCell className="min-w-36">
                      <Select value={row.basis} onChange={(event) => updateOverhead(row.id, { basis: event.target.value as BasisKey })}>
                        <option value="units">{basisLabels.units}</option>
                        <option value="minutes">{basisLabels.minutes}</option>
                        <option value="revenue">{basisLabels.revenue}</option>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-24">
                      <Input type="number" min={0} value={row.sharePercent} onChange={(event) => updateOverhead(row.id, { sharePercent: toNumber(event.target.value) })} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(row.amount * (row.sharePercent / 100))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle
              icon={Banknote}
              title="خانة الكاشير وإقفال الوردية"
              description="إدخال سريع للمبيعات النقدية، الشبكة، التوصيل، الخصم، والضريبة."
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="مبيعات كاش" value={cashSales} onChange={setCashSales} suffix="شيكل" />
              <Field label="مبيعات شبكة" value={cardSales} onChange={setCardSales} suffix="شيكل" />
              <Field label="مبيعات توصيل" value={deliverySales} onChange={setDeliverySales} suffix="شيكل" />
              <Field label="خصومات وتسويات" value={discounts} onChange={setDiscounts} suffix="شيكل" />
              <Field label="نسبة الضريبة" value={taxRate} onChange={setTaxRate} suffix="بالمئة" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-sm text-muted-foreground">إجمالي المبيعات قبل الخصم</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(totals.cashierGross)}</p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-sm text-muted-foreground">المبلغ المتوقع في الدرج</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(totals.drawerExpected)}</p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-sm text-muted-foreground">قيمة الضريبة</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(totals.taxValue)}</p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-sm text-muted-foreground">صافي الإقفال</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(totals.cashierNet)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <SectionTitle
              icon={TrendingUp}
              title="هندسة المنيو"
              description="تصنيف الأصناف حسب الشعبية وهامش المساهمة لتحديد رفع السعر أو الترويج."
            />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الصنف</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>المبيعات</TableHead>
                  <TableHead>التكلفة</TableHead>
                  <TableHead>هامش المساهمة</TableHead>
                  <TableHead>التصنيف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totals.menuEngineering.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-40">
                      <Input value={row.name} onChange={(event) => updateMenu(row.id, { name: event.target.value })} />
                    </TableCell>
                    <TableCell className="min-w-24">
                      <Input type="number" min={0} value={row.price} onChange={(event) => updateMenu(row.id, { price: toNumber(event.target.value) })} />
                    </TableCell>
                    <TableCell className="min-w-24">
                      <Input type="number" min={0} value={row.expectedSales} onChange={(event) => updateMenu(row.id, { expectedSales: toNumber(event.target.value) })} />
                    </TableCell>
                    <TableCell className="min-w-24">
                      <Input type="number" min={0} value={row.cost} onChange={(event) => updateMenu(row.id, { cost: toNumber(event.target.value) })} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(row.contributionMargin)}</TableCell>
                    <TableCell>
                      <Badge tone={row.tone}>{row.label}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle
              icon={Scale}
              title="انحرافات التكلفة"
              description="مقارنة المخطط بالفعلي لتحديد أثر الهدر أو زيادة الأجور على تكلفة البيع."
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="تكلفة المواد الفعلية" value={actualMaterialCost} onChange={setActualMaterialCost} suffix="شيكل" />
              <Field label="تكلفة الأجور الفعلية" value={actualLaborCost} onChange={setActualLaborCost} suffix="شيكل" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-muted-foreground">انحراف المواد</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(totals.materialVariance)}</p>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-muted-foreground">انحراف الأجور</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(totals.laborVariance)}</p>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-muted-foreground">إجمالي الانحراف</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-xl font-bold">{formatCurrency(totals.totalVariance)}</p>
                  <Badge tone={varianceTone}>{totals.totalVariance > 0 ? "غير ملائم" : totals.totalVariance < 0 ? "توفير" : "مطابق"}</Badge>
                </div>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-muted-foreground">أثره على الوجبة</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(totals.variancePerUnit)}</p>
              </div>
            </div>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm leading-7 text-teal-900">
              معادلة التكلفة: مواد الريسبي بعد التصافي والهدر + المصاريف المحملة + الإهلاك، ثم القسمة على إنتاج اليوم. هذه هي النواة التي سنربطها لاحقًا بفواتير الشراء، أوامر الإنتاج، والكاشير.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
