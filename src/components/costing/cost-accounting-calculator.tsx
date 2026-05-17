"use client";

import { useMemo, useState } from "react";
import { Calculator, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

type MaterialRow = {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
};

const initialMaterials: MaterialRow[] = [
  { id: "chicken", name: "دجاج", quantity: 3, unitCost: 50 },
  { id: "flour", name: "طحين", quantity: 1, unitCost: 50 },
  { id: "potatoes", name: "بطاطا", quantity: 3, unitCost: 70 },
  { id: "sauce", name: "صوص", quantity: 2, unitCost: 40 },
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
          className={suffix ? "pl-16" : undefined}
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

export function CostAccountingCalculator() {
  const [productName, setProductName] = useState("ساندويتش دجاج");
  const [dailyOutput, setDailyOutput] = useState(100);
  const [sellingPrice, setSellingPrice] = useState(25);
  const [laborCost, setLaborCost] = useState(400);
  const [rentCost, setRentCost] = useState(120);
  const [utilitiesCost, setUtilitiesCost] = useState(100);
  const [otherCost, setOtherCost] = useState(0);
  const [targetMargin, setTargetMargin] = useState(35);
  const [materials, setMaterials] = useState<MaterialRow[]>(initialMaterials);

  const totals = useMemo(() => {
    const rawMaterialsTotal = materials.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const operatingTotal = laborCost + rentCost + utilitiesCost + otherCost;
    const dailyTotalCost = rawMaterialsTotal + operatingTotal;
    const safeOutput = Math.max(dailyOutput, 1);
    const materialCostPerUnit = rawMaterialsTotal / safeOutput;
    const operatingCostPerUnit = operatingTotal / safeOutput;
    const trueCostPerUnit = dailyTotalCost / safeOutput;
    const grossProfitPerUnit = sellingPrice - trueCostPerUnit;
    const totalExpectedRevenue = sellingPrice * dailyOutput;
    const dailyProfit = totalExpectedRevenue - dailyTotalCost;
    const marginPercent = sellingPrice > 0 ? (grossProfitPerUnit / sellingPrice) * 100 : 0;
    const breakEvenUnits = sellingPrice > 0 ? Math.ceil(dailyTotalCost / sellingPrice) : 0;
    const targetRate = Math.min(Math.max(targetMargin, 1), 90) / 100;
    const suggestedPrice = trueCostPerUnit / (1 - targetRate);

    return {
      rawMaterialsTotal,
      operatingTotal,
      dailyTotalCost,
      materialCostPerUnit,
      operatingCostPerUnit,
      trueCostPerUnit,
      grossProfitPerUnit,
      totalExpectedRevenue,
      dailyProfit,
      marginPercent,
      breakEvenUnits,
      suggestedPrice,
    };
  }, [dailyOutput, laborCost, materials, otherCost, rentCost, sellingPrice, targetMargin, utilitiesCost]);

  const updateMaterial = (id: string, patch: Partial<MaterialRow>) => {
    setMaterials((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addMaterial = () => {
    setMaterials((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "مادة جديدة",
        quantity: 1,
        unitCost: 0,
      },
    ]);
  };

  const removeMaterial = (id: string) => {
    setMaterials((current) => current.filter((item) => item.id !== id));
  };

  const resetExample = () => {
    setProductName("ساندويتش دجاج");
    setDailyOutput(100);
    setSellingPrice(25);
    setLaborCost(400);
    setRentCost(120);
    setUtilitiesCost(100);
    setOtherCost(0);
    setTargetMargin(35);
    setMaterials(initialMaterials);
  };

  const profitTone = totals.dailyProfit < 0 ? "danger" : totals.marginPercent < 20 ? "warning" : "success";
  const profitLabel = totals.dailyProfit < 0 ? "خسارة" : totals.marginPercent < 20 ? "ربح ضعيف" : "مربح";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">إجمالي المواد الخام</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-950">{formatCurrency(totals.rawMaterialsTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">كل المواد المستخدمة لإنتاج اليوم.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">تكلفة التشغيل اليومية</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-950">{formatCurrency(totals.operatingTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">أجور، إيجار، مرافق، ومصاريف أخرى.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">التكلفة الحقيقية للقطعة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-950">{formatCurrency(totals.trueCostPerUnit)}</p>
            <p className="mt-1 text-xs text-muted-foreground">المواد والتشغيل مقسومة على الإنتاج.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-muted-foreground">
              ربح القطعة
              <Badge tone={profitTone}>{profitLabel}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-950">{formatCurrency(totals.grossProfitPerUnit)}</p>
            <p className="mt-1 text-xs text-muted-foreground">هامش الربح {formatPercent(totals.marginPercent)}.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                بيانات حساب اليوم
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={resetExample}>
                  <RotateCcw className="h-4 w-4" />
                  إعادة المثال
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  طباعة التقرير
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>اسم المنتج</span>
                <Input value={productName} onChange={(event) => setProductName(event.target.value)} />
              </label>
              <Field label="عدد الإنتاج اليومي" value={dailyOutput} onChange={setDailyOutput} suffix="قطعة" min={1} />
              <Field label="سعر البيع" value={sellingPrice} onChange={setSellingPrice} suffix="شيكل" />
              <Field label="أجور العمال" value={laborCost} onChange={setLaborCost} suffix="شيكل" />
              <Field label="إيجار اليوم" value={rentCost} onChange={setRentCost} suffix="شيكل" />
              <Field label="كهرباء وماء وغاز" value={utilitiesCost} onChange={setUtilitiesCost} suffix="شيكل" />
              <Field label="مصاريف أخرى" value={otherCost} onChange={setOtherCost} suffix="شيكل" />
              <Field label="هامش الربح المطلوب" value={targetMargin} onChange={setTargetMargin} suffix="بالمئة" min={1} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-950">المواد الخام</h3>
                  <p className="text-sm text-muted-foreground">أدخل كل مادة وكمية استخدامها وسعرها لحساب تكلفة الإنتاج.</p>
                </div>
                <Button onClick={addMaterial}>
                  <Plus className="h-4 w-4" />
                  إضافة مادة
                </Button>
              </div>
              <div className="overflow-hidden rounded-xl border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المادة</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>سعر الوحدة</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="min-w-44">
                          <Input value={item.name} onChange={(event) => updateMaterial(item.id, { name: event.target.value })} />
                        </TableCell>
                        <TableCell className="min-w-28">
                          <Input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(event) => updateMaterial(item.id, { quantity: toNumber(event.target.value) })}
                          />
                        </TableCell>
                        <TableCell className="min-w-32">
                          <Input
                            type="number"
                            min={0}
                            value={item.unitCost}
                            onChange={(event) => updateMaterial(item.id, { unitCost: toNumber(event.target.value) })}
                          />
                        </TableCell>
                        <TableCell className="font-semibold">{formatCurrency(item.quantity * item.unitCost)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMaterial(item.id)}
                            aria-label="حذف المادة"
                            disabled={materials.length === 1}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>نتيجة {productName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-slate-50 p-4">
                  <p className="text-sm text-muted-foreground">إيراد اليوم المتوقع</p>
                  <p className="mt-1 text-xl font-bold">{formatCurrency(totals.totalExpectedRevenue)}</p>
                </div>
                <div className="rounded-xl border bg-slate-50 p-4">
                  <p className="text-sm text-muted-foreground">صافي ربح اليوم</p>
                  <p className="mt-1 text-xl font-bold">{formatCurrency(totals.dailyProfit)}</p>
                </div>
                <div className="rounded-xl border bg-slate-50 p-4">
                  <p className="text-sm text-muted-foreground">نقطة التعادل</p>
                  <p className="mt-1 text-xl font-bold">{formatNumber(totals.breakEvenUnits)} قطعة</p>
                </div>
                <div className="rounded-xl border bg-slate-50 p-4">
                  <p className="text-sm text-muted-foreground">سعر مقترح للبيع</p>
                  <p className="mt-1 text-xl font-bold">{formatCurrency(totals.suggestedPrice)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-7 text-teal-900">
                إذا بعت {formatNumber(dailyOutput)} قطعة بسعر {formatCurrency(sellingPrice)}، فإن صافي الربح المتوقع هو{" "}
                <strong>{formatCurrency(totals.dailyProfit)}</strong>. تكلفة المادة للقطعة{" "}
                <strong>{formatCurrency(totals.materialCostPerUnit)}</strong>، وتكلفة التشغيل للقطعة{" "}
                <strong>{formatCurrency(totals.operatingCostPerUnit)}</strong>.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>طريقة الحساب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-slate-700">
              <div className="rounded-xl border bg-white p-4">
                <p className="font-semibold text-slate-950">تكلفة التشغيل اليومية</p>
                <p>أجور العمال + إيجار اليوم + الكهرباء والماء والغاز + المصاريف الأخرى</p>
                <p className="mt-1 font-bold">{formatCurrency(totals.operatingTotal)}</p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="font-semibold text-slate-950">التكلفة الحقيقية للقطعة</p>
                <p>إجمالي المواد الخام + تكلفة التشغيل اليومية، ثم نقسم الناتج على عدد الإنتاج</p>
                <p className="mt-1 font-bold">{formatCurrency(totals.trueCostPerUnit)}</p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="font-semibold text-slate-950">ربح القطعة</p>
                <p>سعر البيع ناقص التكلفة الحقيقية للقطعة</p>
                <p className="mt-1 font-bold">{formatCurrency(totals.grossProfitPerUnit)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
