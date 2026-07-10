"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash, AlertCircle, Check, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { saveJournalEntryAction } from "@/server/actions/mutations";
import { formatCurrency } from "@/lib/utils";

type AccountLookup = {
  id: string;
  code: string;
  name: string;
  accountType: string;
};

type CostCenterLookup = { id: string; code: string; name: string };
type BranchLookup = { id: string; name: string };

type FormLine = {
  accountId: string;
  debit: string;
  credit: string;
  memo: string;
  costCenterId: string;
};

export function JournalEntryForm({
  accounts,
  costCenters = [],
  branches = [],
}: {
  accounts: AccountLookup[];
  costCenters?: CostCenterLookup[];
  branches?: BranchLookup[];
}) {
  const router = useRouter();
  const [entryDate, setEntryDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [lines, setLines] = React.useState<FormLine[]>([
    { accountId: "", debit: "0", credit: "0", memo: "", costCenterId: "" },
    { accountId: "", debit: "0", credit: "0", memo: "", costCenterId: "" },
  ]);

  const [isPending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);

  const debitTotal = React.useMemo(() => {
    return lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
  }, [lines]);

  const creditTotal = React.useMemo(() => {
    return lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
  }, [lines]);

  const difference = Math.abs(debitTotal - creditTotal);
  const isBalanced = difference < 0.01 && debitTotal > 0;

  const handleAddLine = () => {
    setLines([...lines, { accountId: "", debit: "0", credit: "0", memo: "", costCenterId: "" }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof FormLine, value: string) => {
    setLines(
      lines.map((line, i) => {
        if (i !== index) return line;
        
        // Prevent typing both debit and credit
        if (field === "debit" && parseFloat(value) > 0) {
          return { ...line, debit: value, credit: "0" };
        }
        if (field === "credit" && parseFloat(value) > 0) {
          return { ...line, debit: "0", credit: value };
        }
        
        return { ...line, [field]: value };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!entryDate) {
      setFormError("الرجاء تحديد تاريخ القيد.");
      return;
    }
    if (!memo.trim()) {
      setFormError("الرجاء إدخال بيان القيد العام.");
      return;
    }
    if (lines.some((line) => !line.accountId)) {
      setFormError("الرجاء تحديد الحساب لجميع الأسطر.");
      return;
    }
    if (!isBalanced) {
      setFormError("القيد غير متزن. يجب أن يتطابق إجمالي المدين مع إجمالي الدائن.");
      return;
    }

    const formData = new FormData();
    formData.append("entryDate", entryDate);
    formData.append("memo", memo);
    formData.append("reference", reference.trim());
    formData.append("branchId", branchId);

    // Format lines to pass to server action
    const formattedLines = lines.map((line) => ({
      accountId: line.accountId,
      debit: parseFloat(line.debit) || 0,
      credit: parseFloat(line.credit) || 0,
      memo: line.memo || undefined,
      costCenterId: line.costCenterId || undefined,
    }));
    formData.append("lines", JSON.stringify(formattedLines));

    startTransition(async () => {
      try {
        const result = await saveJournalEntryAction(null as any, formData);
        if (!result.ok) {
          setFormError(result.message || "فشل حفظ القيد المحاسبي.");
        } else {
          router.push("/dashboard/accounting/ledger");
          router.refresh();
        }
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "حدث خطأ غير متوقع.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-right" dir="rtl">
      {formError && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="font-bold">{formError}</p>
        </div>
      )}

      {/* Main Metadata Panel */}
      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-6 grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="entryDate" className="text-xs font-bold text-slate-500">تاريخ القيد</Label>
            <Input
              id="entryDate"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo" className="text-xs font-bold text-slate-500">البيان العام / الوصف</Label>
            <Input
              id="memo"
              type="text"
              placeholder="مثال: سداد قيمة مصروف الإيجار الشهري"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference" className="text-xs font-bold text-slate-500">المرجع / رقم المستند (اختياري)</Label>
            <Input
              id="reference"
              type="text"
              placeholder="مثال: رقم عقد، رقم فاتورة ورقية..."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
            />
          </div>
          {branches.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="branchId" className="text-xs font-bold text-slate-500">الفرع (اختياري)</Label>
              <Select
                id="branchId"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="bg-white border-slate-200 text-right"
              >
                <option value="">بدون فرع محدد</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entry Lines List */}
      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900">أسطر القيد</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLine}
              className="gap-1 border-teal-200 text-teal-700 bg-teal-50/50 hover:bg-teal-50 hover:text-teal-800 rounded-lg"
            >
              <Plus className="h-4 w-4" />
              إضافة سطر
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-2 text-right font-bold w-1/4">الحساب</th>
                  <th className="py-3 px-2 text-right font-bold w-28">مدين (+)</th>
                  <th className="py-3 px-2 text-right font-bold w-28">دائن (-)</th>
                  {costCenters.length > 0 && <th className="py-3 px-2 text-right font-bold w-40">مركز التكلفة</th>}
                  <th className="py-3 px-2 text-right font-bold">البيان الخاص</th>
                  <th className="py-3 px-2 text-center font-bold w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, index) => (
                  <tr key={index} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-2.5 px-2">
                      <Select
                        value={line.accountId}
                        onChange={(e) => handleLineChange(index, "accountId", e.target.value)}
                        className="bg-white border-slate-200 text-right"
                      >
                        <option value="">-- اختر الحساب المحاسبي --</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2.5 px-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={line.debit === "0" ? "" : line.debit}
                        onChange={(e) => handleLineChange(index, "debit", e.target.value)}
                        className="bg-white border-slate-200 font-mono text-left"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={line.credit === "0" ? "" : line.credit}
                        onChange={(e) => handleLineChange(index, "credit", e.target.value)}
                        className="bg-white border-slate-200 font-mono text-left"
                      />
                    </td>
                    {costCenters.length > 0 && (
                      <td className="py-2.5 px-2">
                        <Select
                          value={line.costCenterId}
                          onChange={(e) => handleLineChange(index, "costCenterId", e.target.value)}
                          className="bg-white border-slate-200 text-right"
                        >
                          <option value="">بدون مركز</option>
                          {costCenters.map((cc) => (
                            <option key={cc.id} value={cc.id}>
                              {cc.code} - {cc.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                    )}
                    <td className="py-2.5 px-2">
                      <Input
                        type="text"
                        placeholder="بيان اختياري لهذا السطر"
                        value={line.memo}
                        onChange={(e) => handleLineChange(index, "memo", e.target.value)}
                        className="bg-white border-slate-200 text-right"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={lines.length <= 2}
                        onClick={() => handleRemoveLine(index)}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 border-transparent rounded-lg"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Form Footer & Calculations */}
          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
              <div className="flex items-center gap-2 bg-slate-50 border px-4 py-2 rounded-xl">
                <span className="text-slate-500">إجمالي المدين:</span>
                <span className="font-mono text-slate-800">{formatCurrency(debitTotal)}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border px-4 py-2 rounded-xl">
                <span className="text-slate-500">إجمالي الدائن:</span>
                <span className="font-mono text-slate-800">{formatCurrency(creditTotal)}</span>
              </div>
              
              <Badge tone={isBalanced ? "success" : "danger"} className="h-9 px-4 text-xs font-bold rounded-xl flex items-center gap-1.5 border shadow-sm">
                {isBalanced ? (
                  <>
                    <Check className="h-4 w-4" />
                    قيد متزن
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    {debitTotal === 0 && creditTotal === 0 ? "القيد فارغ" : `غير متزن (الفارق: ${formatCurrency(difference)})`}
                  </>
                )}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/accounting/ledger")}
                disabled={isPending}
                className="gap-1 rounded-lg border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={!isBalanced || isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-6 font-bold shadow-md shadow-teal-500/10 gap-1.5"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ القيد
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
