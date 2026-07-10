"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, AlertCircle, Check, Loader2, Info, Calendar, DollarSign, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { saveExpenseAction } from "@/server/actions/accounting";
import { EXPENSE_CATEGORIES, PAYMENT_METHOD_LABELS } from "@/lib/accounting/constants";
import { formatCurrency } from "@/lib/utils";
import type { ExpensesData } from "@/server/queries/accounting-erp";

export function ExpensesClient({ data }: { data: ExpensesData }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Form states
  const [category, setCategory] = React.useState<string>(EXPENSE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [expenseDate, setExpenseDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = React.useState<string>("cash");
  const [branchId, setBranchId] = React.useState("");
  const [costCenterId, setCostCenterId] = React.useState("");
  const [expenseAccountId, setExpenseAccountId] = React.useState("");
  const [payee, setPayee] = React.useState("");
  const [referenceNo, setReferenceNo] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const filteredExpenses = React.useMemo(() => {
    return data.expenses.filter(
      (exp) =>
        exp.category.includes(search) ||
        (exp.description || "").includes(search) ||
        (exp.notes || "").includes(search) ||
        (exp.branchName || "").includes(search) ||
        (exp.costCenterName || "").includes(search)
    );
  }, [data.expenses, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const expenseCategory = category === "أخرى" ? customCategory.trim() : category;

    if (!expenseCategory) {
      setFormError("الرجاء تحديد أو إدخال تصنيف المصروف.");
      return;
    }

    if (Number(amount) <= 0) {
      setFormError("المبلغ يجب أن يكون أكبر من صفر.");
      return;
    }

    const formData = new FormData();
    formData.append("category", expenseCategory);
    formData.append("description", description.trim());
    formData.append("amount", amount);
    formData.append("expenseDate", expenseDate);
    formData.append("paymentMethod", paymentMethod);
    formData.append("branchId", branchId);
    formData.append("costCenterId", costCenterId);
    formData.append("expenseAccountId", expenseAccountId);
    formData.append("payee", payee.trim());
    formData.append("referenceNo", referenceNo.trim());
    formData.append("notes", notes.trim());

    startTransition(async () => {
      try {
        const res = await saveExpenseAction({ ok: false, message: "" }, formData);
        if (!res.ok) {
          setFormError(res.message);
        } else {
          setFormSuccess(res.message);
          // reset form
          setAmount("");
          setDescription("");
          setNotes("");
          setCustomCategory("");
          setPayee("");
          setReferenceNo("");
          setExpenseAccountId("");
          setTimeout(() => {
            setIsOpen(false);
            setFormSuccess(null);
          }, 1500);
          router.refresh();
        }
      } catch (err) {
        setFormError("حدث خطأ أثناء حفظ المصروف، حاول مرة أخرى.");
      }
    });
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Category totals and month summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
          <p className="text-xs font-bold text-slate-400">إجمالي مصروفات الشهر</p>
          <h3 className="font-mono text-xl font-black text-rose-650 mt-2">{formatCurrency(data.monthTotal)}</h3>
          <p className="text-[10px] text-slate-400 mt-1">الشهر الحالي الفعلي</p>
        </Card>
        
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl p-5 md:col-span-2">
          <p className="text-xs font-bold text-slate-400 mb-3">توزيع المصروفات حسب التصنيف</p>
          <div className="flex flex-wrap gap-2">
            {data.byCategory.length === 0 ? (
              <p className="text-xs text-slate-400">لا توجد مصروفات مسجلة هذا الشهر</p>
            ) : (
              data.byCategory.slice(0, 5).map((cat) => (
                <div key={cat.category} className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1.5 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">{cat.category}:</span>
                  <span className="font-mono text-xs text-slate-900 font-bold">{formatCurrency(cat.total)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Search & Add Panel */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="البحث بتصنيف المصروف، الوصف، الفرع أو مركز التكلفة..."
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
          تسجيل مصروف جديد
        </Button>
      </div>

      {/* Expenses Table */}
      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b bg-slate-50/50 text-slate-400">
                  <TableHead className="text-right py-3.5 px-4 font-bold w-24">التاريخ</TableHead>
                  <TableHead className="text-right py-3.5 px-4 font-bold w-32">التصنيف</TableHead>
                  <TableHead className="text-right py-3.5 px-4 font-bold w-32">المستفيد</TableHead>
                  <TableHead className="text-right py-3.5 px-4 font-bold w-24">رقم السند</TableHead>
                  <TableHead className="text-right py-3.5 px-4 font-bold">الوصف / التفاصيل</TableHead>
                  <TableHead className="text-right py-3.5 px-4 font-bold w-28">طريقة الدفع</TableHead>
                  <TableHead className="text-right py-3.5 px-4 font-bold w-28">الفرع</TableHead>
                  <TableHead className="text-right py-3.5 px-4 font-bold w-32">مركز التكلفة</TableHead>
                  <TableHead className="text-left py-3.5 px-4 font-bold w-28">المبلغ</TableHead>
                  <TableHead className="text-center py-3.5 px-4 font-bold w-24">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-slate-400">لا توجد مصروفات مطابقة للبحث</TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((exp) => (
                    <TableRow key={exp.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="py-3 px-4 text-slate-600 font-mono">{exp.expenseDate}</TableCell>
                      <TableCell className="py-3 px-4 text-slate-900 font-black">
                        {exp.category}
                        {exp.expenseAccountLabel && <p className="text-[10px] text-teal-600 font-normal mt-0.5">{exp.expenseAccountLabel}</p>}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-slate-700">{exp.payee || "-"}</TableCell>
                      <TableCell className="py-3 px-4 text-slate-600 font-mono">{exp.referenceNo || "-"}</TableCell>
                      <TableCell className="py-3 px-4 text-slate-650 font-medium">
                        {exp.description || "-"}
                        {exp.notes && <p className="text-[10px] text-slate-400 mt-0.5">{exp.notes}</p>}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-slate-700">
                        {PAYMENT_METHOD_LABELS[exp.paymentMethod] || exp.paymentMethod}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-slate-650">{exp.branchName || "الرئيسي"}</TableCell>
                      <TableCell className="py-3 px-4 text-slate-650">{exp.costCenterName || "-"}</TableCell>
                      <TableCell className="text-left py-3 px-4 font-mono text-rose-650 font-black">
                        {formatCurrency(exp.amount)}
                      </TableCell>
                      <TableCell className="text-center py-3 px-4">
                        <Badge tone={exp.status === "posted" ? "success" : exp.status === "void" ? "danger" : "warning"} className="rounded-lg px-2 py-0.5">
                          {exp.status === "posted" ? "مرحّل" : exp.status === "void" ? "ملغى" : "مسودة"}
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

      {/* Add Expense Modal */}
      <Modal open={isOpen} title="تسجيل مصروف تشغيلي" onClose={() => setIsOpen(false)}>
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
              <Label htmlFor="category" className="text-xs font-bold text-slate-500">تصنيف المصروف</Label>
              <Select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-white border-slate-200 text-right"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </div>

            {category === "أخرى" && (
              <div className="space-y-1.5">
                <Label htmlFor="customCategory" className="text-xs font-bold text-slate-500">التصنيف المخصص</Label>
                <Input
                  id="customCategory"
                  placeholder="مثال: ترخيص، استشارات..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs font-bold text-slate-500">مبلغ المصروف (شامل الضريبة إن وُجدت)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expenseDate" className="text-xs font-bold text-slate-500">تاريخ المصروف</Label>
              <Input
                id="expenseDate"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod" className="text-xs font-bold text-slate-500">طريقة الدفع (مصدر الصرف)</Label>
              <Select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="bg-white border-slate-200 text-right"
              >
                <option value="cash">صندوق المحل (كاش)</option>
                <option value="bank">حساب البنك / مدى (بطاقة)</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payee" className="text-xs font-bold text-slate-500">المستفيد (لمن دُفع المبلغ؟)</Label>
              <Input
                id="payee"
                placeholder="مثال: شركة الكهرباء، مؤسسة التنظيف..."
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="referenceNo" className="text-xs font-bold text-slate-500">رقم السند / المرجع</Label>
              <Input
                id="referenceNo"
                placeholder="رقم الفاتورة الورقية أو سند الصرف"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expenseAccountId" className="text-xs font-bold text-slate-500">حساب الترحيل المحاسبي (يتجاوز التصنيف النصي)</Label>
            <Select
              id="expenseAccountId"
              value={expenseAccountId}
              onChange={(e) => setExpenseAccountId(e.target.value)}
              className="bg-white border-slate-200 text-right"
            >
              <option value="">تلقائي حسب التصنيف (غير مستحسن للمحاسبين)</option>
              {data.expenseAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name}
                </option>
              ))}
            </Select>
            <p className="text-[10px] text-slate-400 leading-5">
              عند اختيار حساب محدد يُرحّل المصروف إليه مباشرة بدل الاعتماد على مطابقة كلمات التصنيف — وهو الخيار الأدق محاسبياً.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="branchId" className="text-xs font-bold text-slate-500">الفرع المسؤول</Label>
              <Select
                id="branchId"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="bg-white border-slate-200 text-right"
              >
                <option value="">الفرع الرئيسي</option>
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="costCenterId" className="text-xs font-bold text-slate-500">مركز التكلفة المرتبط</Label>
              <Select
                id="costCenterId"
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
                className="bg-white border-slate-200 text-right"
              >
                <option value="">اختر مركز التكلفة (اختياري)</option>
                {data.costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.code} - {cc.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-bold text-slate-500">بيان ووصف المصروف</Label>
            <Input
              id="description"
              placeholder="مثال: فاتورة كهرباء المحل لشهر يونيو"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-bold text-slate-500">ملاحظات إضافية</Label>
            <Input
              id="notes"
              placeholder="أية تفاصيل أو رقم مرجعي للفاتورة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              حفظ وترحيل المصروف
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
