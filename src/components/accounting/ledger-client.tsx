"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertCircle, Check, Loader2, Info, Search, Filter, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reverseJournalEntryAction } from "@/server/actions/accounting";
import { SOURCE_DOC_LABELS } from "@/lib/accounting/constants";
import { formatCurrency } from "@/lib/utils";
import type { GeneralLedgerData } from "@/server/queries/accounting-erp";

export function LedgerClient({ data }: { data: GeneralLedgerData }) {
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = React.useState(data.selectedAccount?.id || "");
  const [from, setFrom] = React.useState(data.from || "");
  const [to, setTo] = React.useState(data.to || "");
  const [search, setSearch] = React.useState("");
  const [reversalEntryId, setReversalEntryId] = React.useState<string | null>(null);
  const [reversalReason, setReversalReason] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const navigate = (accountId: string, nextFrom: string, nextTo: string) => {
    const params = new URLSearchParams();
    if (accountId) params.set("accountId", accountId);
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    router.push(`/dashboard/accounting/ledger?${params.toString()}`);
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedAccountId(val);
    navigate(val, from, to);
  };

  const filteredLines = React.useMemo(() => {
    if (!search.trim()) return data.lines;
    const q = search.trim();
    return data.lines.filter(
      (line) =>
        (line.memo || "").includes(q) ||
        line.entryNumber.includes(q) ||
        (SOURCE_DOC_LABELS[line.sourceDocType || ""] || "").includes(q),
    );
  }, [data.lines, search]);

  const handleExport = () => {
    const header = ["التاريخ", "رقم القيد", "نوع المستند", "البيان", "مدين", "دائن", "الرصيد الجاري"];
    const rows = [
      ["", "", "", "الرصيد الافتتاحي", "", "", data.openingBalance],
      ...filteredLines.map((line) => [
        line.entryDate,
        line.entryNumber,
        SOURCE_DOC_LABELS[line.sourceDocType || ""] || line.sourceDocType || "قيد يدوي",
        line.memo || "",
        line.debit,
        line.credit,
        line.runningBalance,
      ]),
    ];
    const csv =
      "﻿" +
      [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${data.selectedAccount?.code || "account"}-${data.from || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      {/* Account Selector and Filters Card */}
      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto_auto_auto] items-end">
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

          <div className="space-y-2">
            <Label htmlFor="ledgerFrom" className="text-xs font-bold text-slate-500">من تاريخ</Label>
            <Input
              id="ledgerFrom"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-white border-slate-200 rounded-lg text-right font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ledgerTo" className="text-xs font-bold text-slate-500">إلى تاريخ</Label>
            <Input
              id="ledgerTo"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-white border-slate-200 rounded-lg text-right font-mono"
            />
          </div>
          <Button
            type="button"
            onClick={() => navigate(selectedAccountId, from, to)}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold gap-1"
          >
            <Filter className="h-4 w-4" />
            تصفية
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            className="border-slate-200 hover:bg-slate-50 rounded-lg gap-1"
          >
            <Download className="h-4 w-4" />
            تصدير
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="bg-slate-50/50 border border-slate-200/40 p-3 rounded-xl">
            <p className="text-[10px] text-slate-400 font-bold">الحساب الحالي</p>
            <h3 className="text-sm font-black text-slate-800 mt-1">
              {data.selectedAccount?.code} · {data.selectedAccount?.name}
            </h3>
          </div>
          <div className="bg-slate-50/50 border border-slate-200/40 p-3 rounded-xl">
            <p className="text-[10px] text-slate-400 font-bold">الرصيد قبل الفترة</p>
            <h3 className="font-mono text-sm font-black text-slate-700 mt-1">{formatCurrency(data.openingBalance)}</h3>
          </div>
          <div className="bg-slate-50/50 border border-slate-200/40 p-3 rounded-xl">
            <p className="text-[10px] text-slate-400 font-bold">حركة الفترة (مدين / دائن)</p>
            <h3 className="font-mono text-sm font-black text-slate-700 mt-1">
              {formatCurrency(data.periodDebit)} / {formatCurrency(data.periodCredit)}
            </h3>
          </div>
          <div className="bg-teal-50/50 border border-teal-200/40 p-3 rounded-xl">
            <p className="text-[10px] text-teal-600 font-bold">الرصيد الختامي</p>
            <h3 className="font-mono text-base font-black text-teal-700 mt-1">{formatCurrency(data.closingBalance)}</h3>
          </div>
        </div>

        <div className="mt-4 relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="بحث بالبيان، رقم القيد أو نوع المستند..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-3 ps-9 bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
          />
        </div>
      </Card>

      {data.truncated && (
        <Card className="backdrop-blur-md bg-amber-50/50 border border-amber-200/60 shadow-sm rounded-2xl p-4">
          <div className="flex gap-2.5 items-center">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 font-bold">
              تم عرض أول 1000 حركة فقط في هذه الفترة. ضيّق نطاق التاريخ لعرض كشف كامل ودقيق.
            </p>
          </div>
        </Card>
      )}

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
                  <TableHead className="text-right py-3.5 px-4 font-bold w-24">التاريخ</TableHead>
                  <TableHead className="text-right py-3.5 px-4 font-bold w-32">رقم القيد</TableHead>
                  <TableHead className="text-right py-3.5 px-4 font-bold w-28">نوع المستند</TableHead>
                  <TableHead className="text-right py-3.5 px-4 font-bold">البيان / الوصف</TableHead>
                  <TableHead className="text-left py-3.5 px-4 font-bold w-28">مدين (+)</TableHead>
                  <TableHead className="text-left py-3.5 px-4 font-bold w-28">دائن (-)</TableHead>
                  <TableHead className="text-left py-3.5 px-4 font-bold w-32">الرصيد الجاري</TableHead>
                  <TableHead className="text-center py-3.5 px-4 font-bold w-24">خيارات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Opening balance row */}
                <TableRow className="bg-slate-50/60 font-bold">
                  <TableCell colSpan={4} className="py-2.5 px-4 text-slate-600">
                    الرصيد الافتتاحي {data.from ? `قبل ${data.from}` : "(بداية السجل)"}
                  </TableCell>
                  <TableCell className="py-2.5 px-4" />
                  <TableCell className="py-2.5 px-4" />
                  <TableCell className="text-left py-2.5 px-4 font-mono text-slate-700">{formatCurrency(data.openingBalance)}</TableCell>
                  <TableCell className="py-2.5 px-4" />
                </TableRow>

                {filteredLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">لا توجد حركات مطابقة في هذه الفترة</TableCell>
                  </TableRow>
                ) : (
                  filteredLines.map((line) => {
                    const isReversed = line.memo?.startsWith("عكس:") || line.memo?.includes("عكس قيد") || line.sourceDocType === "journal_reversal";
                    return (
                      <TableRow key={line.id} className="hover:bg-slate-50/30 transition-colors">
                        <TableCell className="py-3 px-4 text-slate-600 font-mono">{line.entryDate}</TableCell>
                        <TableCell className="py-3 px-4 font-mono text-slate-700 font-bold">
                          <a
                            href={`/dashboard/accounting/journal?q=${encodeURIComponent(line.entryNumber)}`}
                            className="hover:text-teal-700 hover:underline"
                            title="عرض القيد كاملاً في دفتر اليومية"
                          >
                            {line.entryNumber}
                          </a>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-slate-500">
                          {SOURCE_DOC_LABELS[line.sourceDocType || ""] || "قيد يدوي"}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-slate-900 font-medium">
                          {line.memo || "-"}
                          {(line.branchName || line.costCenterName) && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {line.branchName && <span>فرع: {line.branchName}</span>}
                              {line.branchName && line.costCenterName && " · "}
                              {line.costCenterName && <span>مركز تكلفة: {line.costCenterName}</span>}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-left py-3 px-4 font-mono text-slate-800 font-semibold">
                          {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-left py-3 px-4 font-mono text-slate-850 font-semibold">
                          {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                        </TableCell>
                        <TableCell className="text-left py-3 px-4 font-mono text-teal-700 font-bold">
                          {formatCurrency(line.runningBalance)}
                        </TableCell>
                        <TableCell className="text-center py-3 px-4">
                          {isReversed ? (
                            <Badge tone="danger" className="scale-90 px-2 py-0.5 rounded-lg">قيد عكسي</Badge>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenReversal(line.journalEntryId)}
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
