"use client";

import * as React from "react";
import { AlertCircle, Check, Landmark, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { saveReceiptVoucherAction, savePaymentVoucherAction } from "@/server/actions/treasury";
import type { VoucherData } from "@/server/queries/accounting-treasury";

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function VouchersClient({ data }: { data: VoucherData }) {
  const [tab, setTab] = React.useState<"receipt" | "payment">("receipt");

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("receipt")}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-black flex items-center justify-center gap-2 transition-colors ${
            tab === "receipt" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-slate-200 text-slate-600"
          }`}
        >
          <Wallet className="h-4 w-4" />
          سند قبض
        </button>
        <button
          type="button"
          onClick={() => setTab("payment")}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm font-black flex items-center justify-center gap-2 transition-colors ${
            tab === "payment" ? "bg-rose-600 text-white border-rose-600" : "bg-white border-slate-200 text-slate-600"
          }`}
        >
          <Landmark className="h-4 w-4" />
          سند صرف
        </button>
      </div>

      {tab === "receipt" ? <ReceiptForm data={data} /> : <PaymentForm data={data} />}

      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl">
        <CardHeader className="border-b bg-slate-50/50 py-3 px-5">
          <CardTitle className="text-sm font-black text-slate-900">أحدث السندات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentVouchers.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-400">لا توجد سندات مسجلة بعد.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentVouchers.map((v) => (
                <li key={v.id} className="flex items-center justify-between px-5 py-3 text-xs">
                  <span className="font-mono text-slate-500">{v.entryNumber}</span>
                  <span className="text-slate-700 truncate flex-1 mx-3">{v.memo || "-"}</span>
                  <Badge tone={v.kind === "receipt" ? "success" : "danger"} className="rounded-lg px-2 py-0.5 text-[10px]">
                    {v.kind === "receipt" ? "قبض" : "صرف"}
                  </Badge>
                  <span className="font-mono font-black text-slate-900 ms-3">{formatCurrency(v.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReceiptForm({ data }: { data: VoucherData }) {
  const [cashAccountId, setCashAccountId] = React.useState(data.cashAccounts[0]?.id ?? "");
  const [creditSide, setCreditSide] = React.useState("customer");
  const [customerName, setCustomerName] = React.useState("");
  const [incomeAccountId, setIncomeAccountId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [voucherDate, setVoucherDate] = React.useState(localToday());
  const [reference, setReference] = React.useState("");
  const [memo, setMemo] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.append("voucherDate", voucherDate);
    fd.append("cashAccountId", cashAccountId);
    fd.append("creditSide", creditSide);
    if (creditSide === "customer") fd.append("customerName", customerName.trim());
    else fd.append("incomeAccountId", incomeAccountId);
    fd.append("amount", amount);
    fd.append("reference", reference.trim());
    fd.append("memo", memo.trim());

    startTransition(async () => {
      try {
        const res = await saveReceiptVoucherAction({ ok: false, message: "" }, fd);
        if (!res.ok) setError(res.message);
        else {
          setSuccess(res.message);
          setAmount("");
          setMemo("");
          setReference("");
          setTimeout(() => setSuccess(null), 1500);
        }
      } catch {
        setError("تعذر تسجيل السند.");
      }
    });
  };

  return (
    <Card className="backdrop-blur-md bg-white/80 border border-emerald-200/60 shadow-md rounded-2xl">
      <CardHeader className="border-b bg-emerald-50/40 py-3 px-5">
        <CardTitle className="text-sm font-black text-emerald-800 flex items-center gap-2">
          <Wallet className="h-4 w-4" /> سند قبض (مدين الصندوق/البنك)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4 p-1">
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50/60 p-3 text-xs text-red-800">
              <AlertCircle className="h-4 w-4" />
              <p className="font-bold">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50/60 p-3 text-xs text-green-800">
              <Check className="h-4 w-4" />
              <p className="font-bold">{success}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rCash" className="text-xs font-bold text-slate-500">حساب القبض (مدين)</Label>
              <Select id="rCash" value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)} className="bg-white border-slate-200 text-right">
                {data.cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rDate" className="text-xs font-bold text-slate-500">تاريخ السند</Label>
              <Input id="rDate" type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="bg-white border-slate-200 text-right font-mono" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500">جهة الدائن</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCreditSide("customer")} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${creditSide === "customer" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-slate-200"}`}>ذمم عملاء</button>
              <button type="button" onClick={() => setCreditSide("income")} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${creditSide === "income" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-slate-200"}`}>حساب دخل</button>
            </div>
          </div>
          {creditSide === "customer" ? (
            <div className="space-y-1.5">
              <Label htmlFor="rCust" className="text-xs font-bold text-slate-500">اسم العميل</Label>
              <Input id="rCust" list="customerList" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="bg-white border-slate-200 text-right" placeholder="اسم العميل أو الجهة" />
              <datalist id="customerList">
                {data.customers.map((c) => (<option key={c.id} value={c.name} />))}
              </datalist>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="rIncome" className="text-xs font-bold text-slate-500">حساب الإيراد (دائن)</Label>
              <Select id="rIncome" value={incomeAccountId} onChange={(e) => setIncomeAccountId(e.target.value)} className="bg-white border-slate-200 text-right">
                <option value="">اختر حساب الإيراد</option>
                {data.accounts.filter((a) => a.accountType === "revenue" || a.accountType === "cogs").map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rAmount" className="text-xs font-bold text-slate-500">المبلغ</Label>
              <Input id="rAmount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-white border-slate-200 text-right font-mono" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rRef" className="text-xs font-bold text-slate-500">المرجع (اختياري)</Label>
              <Input id="rRef" value={reference} onChange={(e) => setReference(e.target.value)} className="bg-white border-slate-200 text-right font-mono" placeholder="رقم إيصال / شيك" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rMemo" className="text-xs font-bold text-slate-500">البيان</Label>
            <Textarea id="rMemo" value={memo} onChange={(e) => setMemo(e.target.value)} className="bg-white border-slate-200 text-right" rows={2} />
          </div>
          <Button type="submit" disabled={isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold gap-1.5">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            ترحيل سند القبض
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PaymentForm({ data }: { data: VoucherData }) {
  const [cashAccountId, setCashAccountId] = React.useState(data.cashAccounts[0]?.id ?? "");
  const [debitSide, setDebitSide] = React.useState("supplier");
  const [supplierId, setSupplierId] = React.useState("");
  const [expenseAccountId, setExpenseAccountId] = React.useState("");
  const [applyInvoiceId, setApplyInvoiceId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [voucherDate, setVoucherDate] = React.useState(localToday());
  const [reference, setReference] = React.useState("");
  const [memo, setMemo] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.append("voucherDate", voucherDate);
    fd.append("cashAccountId", cashAccountId);
    fd.append("debitSide", debitSide);
    if (debitSide === "supplier") fd.append("supplierId", supplierId);
    else fd.append("expenseAccountId", expenseAccountId);
    if (applyInvoiceId) fd.append("applyInvoiceId", applyInvoiceId);
    fd.append("amount", amount);
    fd.append("reference", reference.trim());
    fd.append("memo", memo.trim());

    startTransition(async () => {
      try {
        const res = await savePaymentVoucherAction({ ok: false, message: "" }, fd);
        if (!res.ok) setError(res.message);
        else {
          setSuccess(res.message);
          setAmount("");
          setMemo("");
          setReference("");
          setApplyInvoiceId("");
          setTimeout(() => setSuccess(null), 1500);
        }
      } catch {
        setError("تعذر تسجيل السند.");
      }
    });
  };

  return (
    <Card className="backdrop-blur-md bg-white/80 border border-rose-200/60 shadow-md rounded-2xl">
      <CardHeader className="border-b bg-rose-50/40 py-3 px-5">
        <CardTitle className="text-sm font-black text-rose-800 flex items-center gap-2">
          <Landmark className="h-4 w-4" /> سند صرف (دائن الصندوق/البنك)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4 p-1">
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50/60 p-3 text-xs text-red-800">
              <AlertCircle className="h-4 w-4" />
              <p className="font-bold">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50/60 p-3 text-xs text-green-800">
              <Check className="h-4 w-4" />
              <p className="font-bold">{success}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pCash" className="text-xs font-bold text-slate-500">حساب الصرف (دائن)</Label>
              <Select id="pCash" value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)} className="bg-white border-slate-200 text-right">
                {data.cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pDate" className="text-xs font-bold text-slate-500">تاريخ السند</Label>
              <Input id="pDate" type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="bg-white border-slate-200 text-right font-mono" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500">جهة المدين</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDebitSide("supplier")} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${debitSide === "supplier" ? "bg-rose-600 text-white border-rose-600" : "bg-white border-slate-200"}`}>ذمم موردين</button>
              <button type="button" onClick={() => setDebitSide("expense")} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${debitSide === "expense" ? "bg-rose-600 text-white border-rose-600" : "bg-white border-slate-200"}`}>حساب مصروف</button>
            </div>
          </div>
          {debitSide === "supplier" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pSup" className="text-xs font-bold text-slate-500">المورد</Label>
                <Select id="pSup" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="bg-white border-slate-200 text-right">
                  <option value="">اختر المورد</option>
                  {data.suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pInv" className="text-xs font-bold text-slate-500">تطبيق على فاتورة (اختياري)</Label>
                <Select id="pInv" value={applyInvoiceId} onChange={(e) => setApplyInvoiceId(e.target.value)} className="bg-white border-slate-200 text-right">
                  <option value="">دفعة عامة</option>
                  {data.payableInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.number} — {inv.partyName} ({formatCurrency(inv.balanceDue)})</option>
                  ))}
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="pExp" className="text-xs font-bold text-slate-500">حساب المصروف (مدين)</Label>
              <Select id="pExp" value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)} className="bg-white border-slate-200 text-right">
                <option value="">اختر حساب المصروف</option>
                {data.accounts.filter((a) => a.accountType === "expense" || a.accountType === "cogs").map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pAmount" className="text-xs font-bold text-slate-500">المبلغ</Label>
              <Input id="pAmount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-white border-slate-200 text-right font-mono" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pRef" className="text-xs font-bold text-slate-500">المرجع (اختياري)</Label>
              <Input id="pRef" value={reference} onChange={(e) => setReference(e.target.value)} className="bg-white border-slate-200 text-right font-mono" placeholder="رقم شيك / حوالة" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pMemo" className="text-xs font-bold text-slate-500">البيان</Label>
            <Textarea id="pMemo" value={memo} onChange={(e) => setMemo(e.target.value)} className="bg-white border-slate-200 text-right" rows={2} />
          </div>
          <Button type="submit" disabled={isPending} className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold gap-1.5">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            ترحيل سند الصرف
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
