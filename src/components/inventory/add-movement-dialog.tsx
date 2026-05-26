"use client";

import { useState } from "react";
import { Plus, RefreshCw, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { saveManualAdjustmentAction } from "@/server/actions/adjustments";

type AddMovementDialogProps = {
  itemId: string;
  itemName: string;
  usageUnit: string;
  branches: Array<{ id: string; name: string }>;
};

export function AddMovementDialog({ itemId, itemName, usageUnit, branches }: AddMovementDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || "");
  const [movementType, setMovementType] = useState<"purchase" | "waste" | "adjustment" | "stock_count">("adjustment");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) {
      setErrorMsg("يرجى اختيار الفرع.");
      return;
    }

    const qtyNum = Number(quantity);
    if (isNaN(qtyNum) || qtyNum === 0) {
      setErrorMsg("يرجى إدخال كمية صحيحة غير صفرية.");
      return;
    }

    // Standard business rules adjustments:
    // If movementType is 'waste', quantity must be negative. If positive was entered, automatically convert it.
    let finalQuantity = qtyNum;
    if (movementType === "waste" && qtyNum > 0) {
      finalQuantity = -qtyNum;
    }
    // If movementType is 'purchase' and negative entered, convert to positive.
    if (movementType === "purchase" && qtyNum < 0) {
      finalQuantity = -qtyNum;
    }

    setLoading(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("itemId", itemId);
    formData.append("branchId", selectedBranch);
    formData.append("movementType", movementType);
    formData.append("quantity", String(finalQuantity));
    formData.append("notes", notes.trim());

    try {
      const res = await saveManualAdjustmentAction(formData);
      if (res.ok) {
        setQuantity("");
        setNotes("");
        setOpen(false);
        // Refresh page to load the new movement and updated stock
        window.location.reload();
      } else {
        setErrorMsg(res.message);
      }
    } catch (err) {
      setErrorMsg("حدث عطل غير متوقع أثناء إرسال الطلب.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-1 bg-primary text-white hover:bg-primary/95 font-bold text-xs h-9">
        <Plus className="h-4 w-4" />
        إضافة حركة
      </Button>

      <Modal
        open={open}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
        title={`إضافة حركة مخزن يدوية: ${itemName}`}
        description="تسجيل حركة صادر أو وارد يدوية للمادة وتعديل الكمية المتاحة في الفرع المحدد فوراً."
        className="max-w-md text-right"
      >
        <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-600 flex items-start gap-2">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="branchId" className="text-xs font-bold text-slate-800">الفرع المخصص للحركة:</Label>
            <select
              id="branchId"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-teal-500/50"
              required
            >
              <option value="" disabled>اختر الفرع...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="movementType" className="text-xs font-bold text-slate-800">نوع الحركة وتصنيفها:</Label>
            <select
              id="movementType"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as any)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-teal-500/50"
              required
            >
              <option value="adjustment">تعديل وتسوية مخزون عام (adjustment)</option>
              <option value="purchase">شراء وتوريد إضافي (purchase)</option>
              <option value="waste">هدر وتالف يدوي (waste)</option>
              <option value="stock_count">تسوية فرق جرد (stock_count)</option>
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="quantity" className="text-xs font-bold text-slate-800">
              الكمية المطلوبة ({usageUnit}):
            </Label>
            <Input
              id="quantity"
              type="text"
              inputMode="decimal"
              placeholder={
                movementType === "waste" 
                  ? "أدخل كمية الخصم، مثال: 5" 
                  : "أدخل القيمة: رقم موجب للزيادة، سالب للنقصان"
              }
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="text-right h-10 border-slate-200 text-xs font-semibold focus:ring-teal-550/50"
            />
            <span className="text-[10px] text-slate-400">
              {movementType === "waste" 
                ? "💡 سيتم خصم هذه الكمية تلقائياً من مخزون الفرع."
                : "💡 الرقم الموجب يزيد المخزون (مثال: 10)، والرقم السالب ينقص المخزون (مثال: -5)."}
            </span>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="notes" className="text-xs font-bold text-slate-800">السبب / ملاحظات الحركة:</Label>
            <Textarea
              id="notes"
              placeholder="اكتب تفاصيل التعديل أو سبب هذه التسوية اليدوية..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              className="min-h-20 text-right text-xs border-slate-200 focus:ring-teal-550/50"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg active:scale-[0.98] transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  يتم التسجيل...
                </span>
              ) : (
                "حفظ وتسجيل الحركة"
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => setOpen(false)}
              className="h-10 text-xs font-bold text-slate-650 hover:bg-slate-50 border-slate-200"
            >
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
