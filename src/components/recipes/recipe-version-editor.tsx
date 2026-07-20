"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormSubmit } from "@/components/form-submit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { activateRecipeVersionAction } from "@/server/actions/mutations";
import type { ActionState } from "@/server/actions/auth";

type InventoryOption = { id: string; name: string; averageCost: number };
type IngredientLine = { id: string; itemId: string; quantity: number; yieldPercent: number };

const initialState: ActionState = { ok: false, message: "" };

export function RecipeVersionEditor({ inventoryItems }: { inventoryItems: InventoryOption[] }) {
  const [state, formAction] = useActionState(activateRecipeVersionAction, initialState);
  const [activationKey] = useState(() => crypto.randomUUID());
  const [lines, setLines] = useState<IngredientLine[]>([]);
  const [laborCost, setLaborCost] = useState(0);
  const [overheadCost, setOverheadCost] = useState(0);
  const [servings, setServings] = useState(1);

  const materialCost = useMemo(
    () => lines.reduce((sum, line) => {
      const item = inventoryItems.find((candidate) => candidate.id === line.itemId);
      return sum + (item?.averageCost ?? 0) * line.quantity / Math.max(line.yieldPercent, 0.01) * 100;
    }, 0),
    [inventoryItems, lines],
  );
  const totalCost = materialCost + laborCost + overheadCost;
  const costPerServing = totalCost / Math.max(servings, 0.01);

  const updateLine = (id: string, patch: Partial<IngredientLine>) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  };

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="activationKey" value={activationKey} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">اسم الوصفة</Label>
          <Input id="name" name="name" placeholder="مثال: برجر دجاج" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="category">التصنيف</Label>
          <Input id="category" name="category" placeholder="وجبات" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="servings">عدد الحصص الناتجة</Label>
          <Input id="servings" name="servings" type="number" value={servings} min="0.01" step="0.01" onChange={(event) => setServings(Number(event.target.value) || 1)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="targetFoodCostPercent">نسبة تكلفة الطعام المستهدفة (%)</Label>
          <Input id="targetFoodCostPercent" name="targetFoodCostPercent" type="number" defaultValue="30" min="0.01" max="99.99" step="0.01" required />
        </div>
      </div>

      <div className="rounded-xl border p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="font-bold">المكونات والتصافي</p>
            <p className="text-xs text-muted-foreground">تُجمّد تكلفة المادة الحالية داخل إصدار الوصفة عند الاعتماد.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setLines((current) => [...current, { id: crypto.randomUUID(), itemId: "", quantity: 1, yieldPercent: 100 }])}>
            <Plus className="h-4 w-4" /> إضافة مادة
          </Button>
        </div>
        {lines.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">أضف مادة واحدة على الأقل لاعتماد الوصفة.</p> : null}
        <div className="space-y-2">
          {lines.map((line) => {
            const item = inventoryItems.find((candidate) => candidate.id === line.itemId);
            const lineCost = (item?.averageCost ?? 0) * line.quantity / Math.max(line.yieldPercent, 0.01) * 100;
            return (
              <div key={line.id} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_100px_100px_auto_auto] sm:items-end">
                <label className="grid gap-1 text-xs font-medium"><span>المادة</span><Select value={line.itemId} onChange={(event) => updateLine(line.id, { itemId: event.target.value })}><option value="">اختر المادة</option>{inventoryItems.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</Select></label>
                <label className="grid gap-1 text-xs font-medium"><span>الكمية</span><Input type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) || 0 })} /></label>
                <label className="grid gap-1 text-xs font-medium"><span>التصافي %</span><Input type="number" min="0.01" max="100" step="0.01" value={line.yieldPercent} onChange={(event) => updateLine(line.id, { yieldPercent: Number(event.target.value) || 0 })} /></label>
                <span className="pb-2 text-xs font-bold text-muted-foreground">{formatCurrency(lineCost)}</span>
                <Button type="button" variant="ghost" size="icon" aria-label="حذف المادة" onClick={() => setLines((current) => current.filter((candidate) => candidate.id !== line.id))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium"><span>تكلفة العمالة للدفعة</span><Input name="laborCostPerBatch" type="number" min="0" step="0.0001" value={laborCost} onChange={(event) => setLaborCost(Number(event.target.value) || 0)} /></label>
        <label className="grid gap-2 text-sm font-medium"><span>التحميل غير المباشر للدفعة</span><Input name="overheadCostPerBatch" type="number" min="0" step="0.0001" value={overheadCost} onChange={(event) => setOverheadCost(Number(event.target.value) || 0)} /></label>
      </div>
      <label className="grid gap-2 text-sm font-medium"><span>طريقة التحضير</span><Textarea name="preparation" /></label>
      <input type="hidden" name="ingredientsJson" value={JSON.stringify(lines.filter((line) => line.itemId).map((line) => ({ itemId: line.itemId, quantity: line.quantity, yieldPercent: line.yieldPercent })))} />

      <div className="grid gap-2 rounded-xl bg-muted p-3 text-sm sm:grid-cols-3">
        <span>تكلفة المواد: <strong>{formatCurrency(materialCost)}</strong></span>
        <span>تكلفة الدفعة: <strong>{formatCurrency(totalCost)}</strong></span>
        <span>تكلفة الحصة: <strong>{formatCurrency(costPerServing)}</strong></span>
      </div>
      {state.message ? <Badge tone={state.ok ? "success" : "danger"}>{state.message}</Badge> : null}
      <FormSubmit disabled={lines.length === 0}>اعتماد إصدار الوصفة</FormSubmit>
    </form>
  );
}
