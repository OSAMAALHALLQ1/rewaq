"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle, Check, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { saveCostCenterAction } from "@/server/actions/accounting";
import { formatCurrency } from "@/lib/utils";
import type { CostCenter } from "@/server/queries/accounting-erp";

export function CostCentersClient({ data }: { data: { costCenters: CostCenter[] } }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Form states
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!code.trim() || !name.trim()) {
      setFormError("الرجاء إدخال كود واسم مركز التكلفة.");
      return;
    }

    const formData = new FormData();
    formData.append("code", code.trim());
    formData.append("name", name.trim());
    formData.append("description", description.trim());

    startTransition(async () => {
      try {
        const res = await saveCostCenterAction({ ok: false, message: "" }, formData);
        if (!res.ok) {
          setFormError(res.message);
        } else {
          setFormSuccess(res.message);
          setCode("");
          setName("");
          setDescription("");
          setTimeout(() => {
            setIsOpen(false);
            setFormSuccess(null);
          }, 1500);
          router.refresh();
        }
      } catch (err) {
        setFormError("حدث خطأ أثناء حفظ مركز التكلفة، حاول مرة أخرى.");
      }
    });
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header and Add Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md shadow-teal-500/10 gap-1.5"
        >
          <Plus className="h-4.5 w-4.5" />
          إضافة مركز تكلفة جديد
        </Button>
      </div>

      {/* Helper Box / Explanation for Non-Accountants */}
      <Card className="backdrop-blur-md bg-teal-50/20 border border-teal-200/40 shadow-sm rounded-2xl p-5">
        <div className="flex gap-3 items-start">
          <Info className="h-5.5 w-5.5 text-teal-650 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-slate-900">ما هي مراكز التكلفة؟ (Explanation of Cost Centers)</h4>
            <p className="text-xs text-slate-600 mt-1.5 leading-6">
              مركز التكلفة هو وحدة داخل المطعم أو الشركة تسجل التكاليف والمصروفات التي تنفق عليها بشكل منفصل (مثلاً: قسم المطبخ، قسم التوصيل، قسم صالة الزبائن). 
              يساعدك هذا التقسيم على معرفة ربحية كل قسم ومراقبة النفقات التشغيلية الموجهة له بشكل دقيق جداً واتخاذ قرارات تحسين الكفاءة دون خلط الحسابات ببعضها.
            </p>
          </div>
        </div>
      </Card>

      {/* Cost Centers Table */}
      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b bg-slate-50/50 text-slate-400">
                  <TableHead className="text-right py-3.5 px-5 font-bold w-32">كود المركز</TableHead>
                  <TableHead className="text-right py-3.5 px-5 font-bold">اسم مركز التكلفة</TableHead>
                  <TableHead className="text-right py-3.5 px-5 font-bold">الوصف والبيان</TableHead>
                  <TableHead className="text-left py-3.5 px-5 font-bold w-48">مصروفات الشهر الجاري</TableHead>
                  <TableHead className="text-center py-3.5 px-5 font-bold w-24">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.costCenters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-slate-400">لا توجد مراكز تكلفة مسجلة حالياً</TableCell>
                  </TableRow>
                ) : (
                  data.costCenters.map((cc) => (
                    <TableRow key={cc.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-mono py-3 px-5 text-slate-700 font-bold">{cc.code}</TableCell>
                      <TableCell className="py-3 px-5 text-slate-900 font-black">{cc.name}</TableCell>
                      <TableCell className="py-3 px-5 text-slate-650">{cc.description || "-"}</TableCell>
                      <TableCell className="text-left py-3 px-5 font-mono font-bold text-slate-800">
                        {formatCurrency(cc.monthExpenses)}
                      </TableCell>
                      <TableCell className="text-center py-3 px-5">
                        <Badge tone={cc.isActive ? "success" : "muted"} className="rounded-lg px-2 py-0.5">
                          {cc.isActive ? "نشط" : "معطل"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Cost Center Modal */}
      <Modal open={isOpen} title="إضافة مركز تكلفة جديد" onClose={() => setIsOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4 text-right">
          {formError && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50/60 p-3.5 text-xs text-red-800">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <p className="font-bold">{formError}</p>
            </div>
          )}
          {formSuccess && (
            <div className="flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50/60 p-3.5 text-xs text-green-800">
              <Check className="h-4.5 w-4.5 shrink-0" />
              <p className="font-bold">{formSuccess}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-xs font-bold text-slate-500">كود مركز التكلفة (فريد)</Label>
              <Input
                id="code"
                placeholder="مثال: CC-250"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold text-slate-500">اسم مركز التكلفة</Label>
              <Input
                id="name"
                placeholder="مثال: التجهيز والمطبخ المركزي"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-bold text-slate-500">الوصف والبيان</Label>
            <Input
              id="description"
              placeholder="وصف موجز للمركز وما يحتويه من مصروفات..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
              className="rounded-lg border-slate-200 hover:bg-slate-50"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-6 font-bold shadow-md shadow-teal-500/10 gap-1.5"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ مركز التكلفة
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
