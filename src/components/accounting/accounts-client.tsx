"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, AlertCircle, Check, Loader2, Info, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { saveAccountAction, toggleAccountActiveAction } from "@/server/actions/accounting";
import { ACCOUNT_TYPE_LABELS, ACCOUNTING_TERM_HELP } from "@/lib/accounting/constants";
import { formatCurrency } from "@/lib/utils";
import type { AccountWithBalance } from "@/server/queries/accounting-erp";

export function AccountsClient({ accounts }: { accounts: AccountWithBalance[] }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // Form states
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [accountType, setAccountType] = React.useState<string>("asset");
  const [normalBalance, setNormalBalance] = React.useState<string>("debit");
  const [parentId, setParentId] = React.useState("");
  const [openingBalance, setOpeningBalance] = React.useState("0");

  const filteredAccounts = React.useMemo(() => {
    return accounts.filter(
      (acc) =>
        acc.code.includes(search) ||
        acc.name.includes(search) ||
        (ACCOUNT_TYPE_LABELS[acc.accountType] || "").includes(search)
    );
  }, [accounts, search]);

  const handleToggleActive = (accountId: string, currentActive: boolean) => {
    setTogglingId(accountId);
    const formData = new FormData();
    formData.append("accountId", accountId);
    formData.append("nextActive", (!currentActive).toString());

    startTransition(async () => {
      try {
        const res = await toggleAccountActiveAction({ ok: false, message: "" }, formData);
        if (!res.ok) {
          alert(res.message);
        } else {
          router.refresh();
        }
      } catch (err) {
        alert("حدث خطأ أثناء تعديل حالة الحساب.");
      } finally {
        setTogglingId(null);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!code.trim() || !name.trim()) {
      setFormError("الرجاء تعبئة كود واسم الحساب.");
      return;
    }

    const formData = new FormData();
    formData.append("code", code.trim());
    formData.append("name", name.trim());
    formData.append("accountType", accountType);
    formData.append("normalBalance", normalBalance);
    formData.append("parentId", parentId);
    formData.append("openingBalance", openingBalance);

    startTransition(async () => {
      try {
        const res = await saveAccountAction({ ok: false, message: "" }, formData);
        if (!res.ok) {
          setFormError(res.message);
        } else {
          setFormSuccess(res.message);
          // reset form
          setCode("");
          setName("");
          setParentId("");
          setOpeningBalance("0");
          setTimeout(() => {
            setIsOpen(false);
            setFormSuccess(null);
          }, 1500);
          router.refresh();
        }
      } catch (err) {
        setFormError("تعذر حفظ الحساب، حدث خطأ غير متوقع.");
      }
    });
  };

  // Adjust normal balance automatically based on selected account type
  React.useEffect(() => {
    if (["asset", "expense", "cogs"].includes(accountType)) {
      setNormalBalance("debit");
    } else {
      setNormalBalance("credit");
    }
  }, [accountType]);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Search and Add Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="البحث باسم الحساب، الكود، أو النوع..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-3 ps-9 bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
          />
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md shadow-teal-500/10 gap-1.5"
        >
          <Plus className="h-4.5 w-4.5" />
          إضافة حساب جديد
        </Button>
      </div>

      {/* Helper Box */}
      <Card className="backdrop-blur-md bg-teal-50/20 border border-teal-200/40 shadow-sm rounded-2xl p-4">
        <div className="flex gap-2.5 items-start">
          <Info className="h-5 w-5 text-teal-650 shrink-0 mt-0.5" />
          <p className="text-xs leading-6 text-slate-600">
            <strong>دليل الحسابات (Chart of Accounts):</strong> هو قائمة بجميع الحسابات المالية التي تستخدمها لتسجيل المعاملات. 
            تنبيه: لا تتوفر إمكانية حذف الحسابات بمجرد تسجيل قيود عليها لضمان سلامة الدفاتر المالية وسجل التدقيق. يمكنك تعطيل الحسابات غير المستخدمة بدلاً من ذلك.
          </p>
        </div>
      </Card>

      {/* Accounts List Table */}
      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b bg-slate-50/50 text-slate-400">
                  <TableHead className="text-right py-3.5 px-5 font-bold w-24">الكود</TableHead>
                  <TableHead className="text-right py-3.5 px-5 font-bold">اسم الحساب</TableHead>
                  <TableHead className="text-right py-3.5 px-5 font-bold">نوع الحساب</TableHead>
                  <TableHead className="text-right py-3.5 px-5 font-bold">طبيعة الحساب</TableHead>
                  <TableHead className="text-left py-3.5 px-5 font-bold">الرصيد الحالي</TableHead>
                  <TableHead className="text-center py-3.5 px-5 font-bold w-24">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-400">لا توجد حسابات مطابقة للبحث</TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((acc) => (
                    <TableRow key={acc.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-mono py-3 px-5 text-slate-700 font-bold">{acc.code}</TableCell>
                      <TableCell className="py-3 px-5 text-slate-900 font-black">
                        {acc.parentId && <span className="text-slate-300 font-normal me-1.5">└──</span>}
                        {acc.name}
                        {acc.systemKey && <Badge tone="muted" className="ms-2 scale-90">نظامي</Badge>}
                      </TableCell>
                      <TableCell className="py-3 px-5 text-slate-650">
                        {ACCOUNT_TYPE_LABELS[acc.accountType] ?? acc.accountType}
                      </TableCell>
                      <TableCell className="py-3 px-5">
                        <Badge tone={acc.normalBalance === "debit" ? "success" : "default"} className="rounded-lg px-2 py-0.5">
                          {acc.normalBalance === "debit" ? "مدين" : "دائن"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left py-3 px-5 font-mono font-bold text-slate-800">
                        {formatCurrency(acc.balance)}
                      </TableCell>
                      <TableCell className="text-center py-3 px-5">
                        <button
                          onClick={() => handleToggleActive(acc.id, acc.isActive)}
                          disabled={togglingId === acc.id || (!!acc.systemKey && acc.isActive)}
                          className="text-slate-600 hover:text-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          title={acc.systemKey && acc.isActive ? "لا يمكن تعطيل حساب نظامي مرتبط بالترحيل التلقائي" : "تعديل الحالة"}
                        >
                          {togglingId === acc.id ? (
                            <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-450" />
                          ) : acc.isActive ? (
                            <ToggleRight className="h-6 w-6 text-teal-600" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-slate-350" />
                          )}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Account Modal */}
      <Modal open={isOpen} title="إضافة حساب جديد لدليل الحسابات" onClose={() => setIsOpen(false)}>
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
              <Label htmlFor="code" className="text-xs font-bold text-slate-500">كود الحساب (رقمي فريد)</Label>
              <Input
                id="code"
                placeholder="مثال: 6120"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold text-slate-500">اسم الحساب</Label>
              <Input
                id="name"
                placeholder="مثال: مصروف هاتف وإنترنت"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="accountType" className="text-xs font-bold text-slate-500">نوع الحساب</Label>
              <Select
                id="accountType"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="bg-white border-slate-200 text-right"
              >
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label} ({val})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="normalBalance" className="text-xs font-bold text-slate-500">طبيعة الحساب</Label>
              <Select
                id="normalBalance"
                value={normalBalance}
                onChange={(e) => setNormalBalance(e.target.value)}
                className="bg-white border-slate-200 text-right"
              >
                <option value="debit">مدين (Debit) - أصول، مصروفات</option>
                <option value="credit">دائن (Credit) - التزامات، حقوق، إيرادات</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="parentId" className="text-xs font-bold text-slate-500">الحساب الرئيسي (اختياري)</Label>
              <Select
                id="parentId"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="bg-white border-slate-200 text-right"
              >
                <option value="">لا يوجد (حساب رئيسي)</option>
                {accounts
                  .filter((acc) => !acc.parentId && acc.isActive)
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="openingBalance" className="text-xs font-bold text-slate-500">الرصيد الافتتاحي (اختياري)</Label>
              <Input
                id="openingBalance"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">سيتم توليد قيد افتتاحي متوازن مقابل حقوق الملكية تلقائياً.</p>
            </div>
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
              إضافة الحساب
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
