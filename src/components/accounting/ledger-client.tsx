"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Scale, RefreshCw, AlertCircle, Check, Loader2, Info, ArrowLeftRight, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reverseJournalEntryAction } from "@/server/actions/accounting";
import { ACCOUNTING_TERM_HELP } from "@/lib/accounting/constants";
import { formatCurrency } from "@/lib/utils";
import type { GeneralLedgerData } from "@/server/queries/accounting-erp";

export function LedgerClient({ data }: { data: GeneralLedgerData }) {
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = React.useState(data.selectedAccount?.id || "");
  const [reversalEntryId, setReversalEntryId] = React.useState<string | null>(null);
  const [reversalReason, setReversalReason] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedAccountId(val);
    router.push(`/dashboard/accounting/ledger?accountId=${val}`);
  };

  const handleOpenReversal = (entryId: string) => {
    setReversalEntryId(entryId);
    setReversalReason("");
    setFormError(null);
    setFormSuccess(null);
  };

  const handleReversalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (reversalReason.trim().length < 3) {
      setFormError("الرجاء إدخال سبب مقنع للعكس (3 أحرف على الأقل).");
      return;
    }

    if (!reversalEntryId) return;

    const formData = new FormData();
    formData.append("entryId", reversalEntryId);
    formData.append("reason", reversalReason.trim());

    startTransition(async () => {
      try {
        const res = await reverseJournalEntryAction({ ok: false, message: "" }, formData);
        if (!res.ok) {
          setFormError(res.message);
        } else {
          setFormSuccess(res.message);
          setTimeout(() => {
            setReversalEntryId(null);
            setFormSuccess(null);
          }, 1500);
          router.refresh();
        }
      } catch (err) {
        setFormError("تعذر عكس القيد، حدث خطأ غير متوقع.");
      }
    });
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Account Selector and Details Card */}
      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl p-5">
        <div className="grid gap-6 md:grid-cols-3 items-end">
          <div className="space-y-2">
            <Label htmlFor="accountSelect" className="text-xs font-bold text-slate-500">اختر الحساب لعرض كشف الحركة</Label>
            <Select
              id="accountSelect"
              value={selectedAccountId}
              onChange={handleAccountChange}
              className="bg-white border-slate-200 text-right"
            >
              {data.accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-2 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 border border-slate-200/40 p-4 rounded-xl">
            <div>
              <p className="text-[10px] text-slate-400 font-bold">الحساب الحالي</p>
              <h3 className="text-base font-black text-slate-800 mt-1">
                {data.selectedAccount?.code} · {data.selectedAccount?.name}
              </h3>
            </div>
            <div className="text-left">
              <p className="text-[10px] text-slate-400 font-bold text-right sm:text-left">الرصيد الختامي</p>
              <h3 className="font-mono text-xl font-black text-teal-700 mt-1">
                {formatCurrency(data.closingBalance)}
              </h3>
            </div>
          </div>
        </div>
      </Card>

      {/* Helper Box */}
      <Card className="backdrop-blur-md bg-teal-50/20 border border-teal-200/40 shadow-sm rounded-2xl p-4">
        <div className="flex gap-2.5 items-start">
          <Info className="h-5 w-5 text-teal-650 shrink-0 mt-0.5" />
          <p className="text-xs leading-6 text-slate-600">
            <strong>دفتر الأستاذ (General Ledger):</strong> يعرض جميع القيود اليومية التي أثرت على هذا الحساب المحدد. 
            قاعدة الأمان: تعديل أو حذف القيود التاريخية مباشرة أمر ممنوع منعاً باتاً. لتصحيح قيد خاطئ، استخدم زر <strong>عكس القيد</strong> لتوليد قيد عكسي متوازن يلغي تأثير القيد القديم محاسبياً مع الحفاظ على سجل تدقيق مالي كامل.
          </p>
        </div>
      </Card>

      {/* Ledger Lines Table */}
      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b bg-slate-50/50 text-slate-400">
                  <TableHead className="text-right py-3.5 px-5 font-bold w-24">التاريخ</TableHead>
                  <TableHead className="text-right py-3.5 px-5 font-bold w-32">رقم القيد</TableHead>
                  <TableHead className="text-right py-3.5 px-5 font-bold">البيان / الوصف</TableHead>
                  <TableHead className="text-left py-3.5 px-5 font-bold w-28">مدين (+)</TableHead>
                  <TableHead className="text-left py-3.5 px-5 font-bold w-28">دائن (-)</TableHead>
                  <TableHead className="text-left py-3.5 px-5 font-bold w-32">الرصيد الجاري</TableHead>
                  <TableHead className="text-center py-3.5 px-5 font-bold w-24">خيارات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">لا توجد حركات مسجلة لهذا الحساب حالياً</TableCell>
                  </TableRow>
                ) : (
                  data.lines.map((line) => {
                    const isReversed = line.memo?.startsWith("عكس:") || line.memo?.includes("عكس قيد");
                    return (
                      <TableRow key={line.id} className="hover:bg-slate-50/30 transition-colors">
                        <TableCell className="py-3 px-5 text-slate-600 font-mono">{line.entryDate}</TableCell>
                        <TableCell className="py-3 px-5 font-mono text-slate-700 font-bold">{line.entryNumber}</TableCell>
                        <TableCell className="py-3 px-5 text-slate-900 font-medium">
                          {line.memo || "-"}
                        </TableCell>
                        <TableCell className="text-left py-3 px-5 font-mono text-slate-800 font-semibold">
                          {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-left py-3 px-5 font-mono text-slate-850 font-semibold">
                          {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                        </TableCell>
                        <TableCell className="text-left py-3 px-5 font-mono text-teal-700 font-bold">
                          {formatCurrency(line.runningBalance)}
                        </TableCell>
                        <TableCell className="text-center py-3 px-5">
                          {isReversed ? (
                            <Badge tone="danger" className="scale-90 px-2 py-0.5 rounded-lg">قيد عكسي</Badge>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenReversal(line.id)}
                              className="text-rose-600 hover:text-white hover:bg-rose-600 border-rose-100 hover:border-transparent scale-90 px-2 py-1 h-7 rounded-lg text-[10px]"
                            >
                              <RefreshCw className="h-3 w-3 me-1 inline" />
                              عكس القيد
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Reversal Modal */}
      <Modal open={reversalEntryId !== null} title="عكس قيد محاسبي" onClose={() => setReversalEntryId(null)}>
        <form onSubmit={handleReversalSubmit} className="space-y-4 text-right">
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

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-xs font-bold text-slate-500">سبب العكس / الملاحظات التصحيحية</Label>
            <Input
              id="reason"
              placeholder="مثال: قيد مكرر بالخطأ، أو خطأ في تحديد حساب المصروف"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1 leading-5">
              سيقوم النظام بإنشاء قيد عكسي تلقائي كامل (تبديل المدين والدائن لجميع الأسطر) مرتبط بهذا القيد الأصلي محاسبياً وربطه بسجلات المراجعة.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReversalEntryId(null)}
              disabled={isPending}
              className="rounded-lg border-slate-200 hover:bg-slate-50"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-6 font-bold shadow-md shadow-rose-500/10 gap-1.5"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد العكس والموازنة
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
