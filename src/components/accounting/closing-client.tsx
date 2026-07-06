"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, AlertCircle, Check, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { closePeriodAction, reopenPeriodAction } from "@/server/actions/accounting";
import { formatCurrency } from "@/lib/utils";
import type { AccountingPeriod } from "@/server/queries/accounting-erp";

export function ClosingClient({ data }: { data: { periods: AccountingPeriod[] } }) {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = React.useState<AccountingPeriod | null>(null);
  const [isClosingAction, setIsClosingAction] = React.useState(true); // true = close, false = reopen
  const [notes, setNotes] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleOpenAction = (period: AccountingPeriod, isClose: boolean) => {
    setSelectedPeriod(period);
    setIsClosingAction(isClose);
    setNotes("");
    setFormError(null);
    setFormSuccess(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!selectedPeriod) return;

    const formData = new FormData();
    formData.append("year", selectedPeriod.year.toString());
    formData.append("month", selectedPeriod.month.toString());
    formData.append("notes", notes.trim());

    startTransition(async () => {
      try {
        const action = isClosingAction ? closePeriodAction : reopenPeriodAction;
        const res = await action({ ok: false, message: "" }, formData);
        if (!res.ok) {
          setFormError(res.message);
        } else {
          setFormSuccess(res.message);
          setTimeout(() => {
            setSelectedPeriod(null);
            setFormSuccess(null);
          }, 1500);
          router.refresh();
        }
      } catch (err) {
        setFormError("حدث خطأ أثناء معالجة العملية، حاول مرة أخرى.");
      }
    });
  };

  const getMonthName = (m: number) => {
    const months = [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    ];
    return months[m - 1] || "";
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Helper Box */}
      <Card className="backdrop-blur-md bg-teal-50/20 border border-teal-200/40 shadow-sm rounded-2xl p-4">
        <div className="flex gap-2.5 items-start">
          <Info className="h-5 w-5 text-teal-650 shrink-0 mt-0.5" />
          <p className="text-xs leading-6 text-slate-600">
            <strong>الإقفال الشهري (Monthly Closing):</strong> إقفال الفترة يضمن تجميدها بالكامل وحظر إضافة أو تعديل أو إلغاء أية قيود محاسبية أو فواتير داخل هذا الشهر لحماية التقارير الضريبية والقوائم المالية المقدمة للجهات الرسمية. 
            تنبيه هام: لا يمكن إقفال الشهر الحالي أو الأشهر المستقبلية التي لا تزال العمليات جارية فيها.
          </p>
        </div>
      </Card>

      {/* Periods Table */}
      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b bg-slate-50/50 text-slate-400">
                  <TableHead className="text-right py-3.5 px-5 font-bold">الفترة المحاسبية</TableHead>
                  <TableHead className="text-right py-3.5 px-5 font-bold">عدد العمليات</TableHead>
                  <TableHead className="text-right py-3.5 px-5 font-bold">القيود المعلقة (Draft)</TableHead>
                  <TableHead className="text-left py-3.5 px-5 font-bold">مجموع المدين / الدائن</TableHead>
                  <TableHead className="text-center py-3.5 px-5 font-bold">اتزان القيود</TableHead>
                  <TableHead className="text-center py-3.5 px-5 font-bold">تاريخ الإقفال</TableHead>
                  <TableHead className="text-center py-3.5 px-5 font-bold w-28">حالة الفترة</TableHead>
                  <TableHead className="text-center py-3.5 px-5 font-bold w-36">الخيارات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.periods.map((p) => {
                  const isCurrentOrFuture = p.year > currentYear || (p.year === currentYear && p.month >= currentMonth);
                  
                  return (
                    <TableRow key={`${p.year}-${p.month}`} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="py-3 px-5 text-slate-900 font-black">
                        {getMonthName(p.month)} {p.year}
                      </TableCell>
                      <TableCell className="py-3 px-5 text-slate-700 font-mono font-bold">
                        {p.entryCount} قيد
                      </TableCell>
                      <TableCell className="py-3 px-5 font-mono">
                        {p.draftCount > 0 ? (
                          <Badge tone="warning" className="rounded-lg">{p.draftCount} غير مرحل</Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-left py-3 px-5 font-mono text-slate-800">
                        {formatCurrency(p.debitTotal)}
                      </TableCell>
                      <TableCell className="text-center py-3 px-5">
                        <Badge tone={p.balanced ? "success" : "danger"} className="rounded-lg px-2 py-0.5">
                          {p.balanced ? "متزن" : "غير متزن"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-3 px-5 text-slate-650 font-mono">
                        {p.closedAt ? p.closedAt.slice(0, 10) : "-"}
                      </TableCell>
                      <TableCell className="text-center py-3 px-5">
                        <Badge tone={p.status === "closed" ? "danger" : "success"} className="rounded-lg px-2 py-0.5 flex items-center justify-center gap-1">
                          {p.status === "closed" ? (
                            <>
                              <Lock className="h-3 w-3" />
                              مقفلة
                            </>
                          ) : (
                            <>
                              <Unlock className="h-3 w-3" />
                              مفتوحة
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-3 px-5">
                        {p.status === "closed" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAction(p, false)}
                            className="text-teal-700 hover:bg-teal-50 border-teal-150 h-7 text-[10px] rounded-lg gap-1"
                          >
                            <Unlock className="h-3 w-3" />
                            إعادة فتح الفترة
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isCurrentOrFuture}
                            onClick={() => handleOpenAction(p, true)}
                            className="text-rose-600 hover:bg-rose-50 border-rose-100 disabled:opacity-40 disabled:hover:bg-transparent h-7 text-[10px] rounded-lg gap-1"
                            title={isCurrentOrFuture ? "لا يمكن إقفال الفترة الحالية أو المستقبلية" : "إقفال الدفاتر"}
                          >
                            <Lock className="h-3 w-3" />
                            إقفال الفترة
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Modal 
        open={selectedPeriod !== null} 
        title={isClosingAction ? "إقفال الدفاتر المالية للفترة" : "إعادة فتح الدفاتر المالية للفترة"} 
        onClose={() => setSelectedPeriod(null)}
      >
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

          {isClosingAction ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-6">
                أنت على وشك <strong>إقفال</strong> الشهر المحاسبي ({selectedPeriod && `${getMonthName(selectedPeriod.month)} ${selectedPeriod.year}`}). 
                بإتمام هذه الخطوة، سيتم حظر تسجيل أية فواتير أو مصروفات أو قيود جديدة بهذا التاريخ نهائياً. تأكد من ترحيل جميع القيود المعلقة (Draft) وتطابق أرصدة الصناديق.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-650 leading-6">
                أنت تطلب <strong>إعادة فتح</strong> الدفاتر لـ ({selectedPeriod && `${getMonthName(selectedPeriod.month)} ${selectedPeriod.year}`}). 
                سيتمكن المحاسبون من تعديل الحركات وتعديل وتمرير قيود جديدة داخل هذا الشهر مجدداً. الرجاء إدخال سبب إعادة الفتح للتوثيق والرقابة.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-xs font-bold text-slate-500">ملاحظات / أسباب العملية</Label>
            <Input
              id="notes"
              placeholder={isClosingAction ? "مثال: مراجعة الدفاتر وتطابق ضريبة المبيعات والرواتب" : "مثال: تعديل قيد تسوية مصروف الإيجار"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
              required={!isClosingAction}
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedPeriod(null)}
              disabled={isPending}
              className="rounded-lg border-slate-200 hover:bg-slate-50"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className={`rounded-lg px-6 font-bold shadow-md gap-1.5 ${
                isClosingAction 
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/10" 
                  : "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/10"
              }`}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isClosingAction ? "تأكيد إقفال الشهر" : "تأكيد فتح الشهر"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
