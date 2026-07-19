"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { paySupplierInvoiceAction } from "@/server/actions/mutations";
import { formatCurrency } from "@/lib/utils";
import type { Invoice } from "@/types/domain";

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function SupplierInvoicesClient({ invoices }: { invoices: Invoice[] }) {
  const router = useRouter();
  const [payInvoice, setPayInvoice] = React.useState<Invoice | null>(null);
  const [amount, setAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("cash");
  const [paymentDate, setPaymentDate] = React.useState(localToday());
  const [reference, setReference] = React.useState("");
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const openPayModal = (invoice: Invoice) => {
    setPayInvoice(invoice);
    setAmount(String(invoice.balanceDue));
    setPaymentMethod("cash");
    setPaymentDate(localToday());
    setReference("");
    setPaymentIdempotencyKey(`supplier-payment:${crypto.randomUUID()}`);
    setFormError(null);
    setFormSuccess(null);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payInvoice) return;
    setFormError(null);

    const formData = new FormData();
    formData.append("invoiceId", payInvoice.id);
    formData.append("amount", amount);
    formData.append("paymentMethod", paymentMethod);
    formData.append("paymentDate", paymentDate);
    formData.append("reference", reference.trim());
    formData.append("idempotencyKey", paymentIdempotencyKey);

    startTransition(async () => {
      try {
        const res = await paySupplierInvoiceAction({ ok: false, message: "" }, formData);
        if (!res.ok) {
          setFormError(res.message);
        } else {
          setFormSuccess(res.message);
          setTimeout(() => {
            setPayInvoice(null);
            setFormSuccess(null);
          }, 1500);
          router.refresh();
        }
      } catch {
        setFormError("تعذر تسجيل الدفعة، حاول مرة أخرى.");
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>سجل فواتير التوريد</CardTitle>
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link href="/dashboard/accounting/payables">أعمار الذمم وكشوف الموردين</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المورد</TableHead>
                  <TableHead>رقم الفاتورة</TableHead>
                  <TableHead>تاريخ الفاتورة</TableHead>
                  <TableHead>تاريخ الاستحقاق</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>المدفوع</TableHead>
                  <TableHead>الرصيد المتبقي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>سداد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-slate-400">
                      لا توجد فواتير توريد مسجلة
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => {
                    const overdue =
                      invoice.balanceDue > 0.001 && invoice.dueDate && invoice.dueDate < localToday();
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-semibold">{invoice.supplierName}</TableCell>
                        <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                        <TableCell className="font-mono text-xs">{invoice.issuedAt?.slice(0, 10)}</TableCell>
                        <TableCell className={`font-mono text-xs ${overdue ? "text-red-600 font-bold" : ""}`}>
                          {invoice.dueDate || "-"}
                          {overdue && <span className="block text-[10px]">متأخرة!</span>}
                        </TableCell>
                        <TableCell className="font-mono">{formatCurrency(invoice.total)}</TableCell>
                        <TableCell className="font-mono text-emerald-600">{formatCurrency(invoice.paidAmount)}</TableCell>
                        <TableCell className={`font-mono font-bold ${invoice.balanceDue > 0.001 ? "text-rose-600" : "text-slate-400"}`}>
                          {formatCurrency(invoice.balanceDue)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={invoice.status} />
                        </TableCell>
                        <TableCell>
                          {invoice.balanceDue > 0.001 && invoice.status !== "void" ? (
                            <Button
                              size="sm"
                              onClick={() => openPayModal(invoice)}
                              className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg h-8 gap-1"
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              سند دفع
                            </Button>
                          ) : (
                            <span className="text-[10px] text-slate-400">مسددة</span>
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

      {/* Payment voucher modal */}
      <Modal open={payInvoice !== null} title={`سند دفع — فاتورة ${payInvoice?.invoiceNumber ?? ""}`} onClose={() => setPayInvoice(null)}>
        <form onSubmit={handlePaySubmit} className="space-y-4 text-right" dir="rtl">
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

          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-xs flex flex-wrap gap-x-6 gap-y-1.5">
            <span>المورد: <b>{payInvoice?.supplierName}</b></span>
            <span>إجمالي الفاتورة: <b className="font-mono">{formatCurrency(payInvoice?.total ?? 0)}</b></span>
            <span>الرصيد المستحق: <b className="font-mono text-rose-600">{formatCurrency(payInvoice?.balanceDue ?? 0)}</b></span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payAmount" className="text-xs font-bold text-slate-500">مبلغ الدفعة (يمكن دفع جزء)</Label>
              <Input
                id="payAmount"
                type="number"
                step="0.01"
                min="0.01"
                max={payInvoice?.balanceDue}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-white border-slate-200 rounded-lg text-right font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payMethod" className="text-xs font-bold text-slate-500">طريقة الدفع</Label>
              <Select id="payMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="bg-white border-slate-200 text-right">
                <option value="cash">نقدي (الصندوق)</option>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="card">بطاقة / شبكة</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payDate" className="text-xs font-bold text-slate-500">تاريخ الدفع</Label>
              <Input
                id="payDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="bg-white border-slate-200 rounded-lg text-right font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payReference" className="text-xs font-bold text-slate-500">مرجع السند (اختياري)</Label>
              <Input
                id="payReference"
                placeholder="رقم حوالة، رقم شيك..."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="bg-white border-slate-200 rounded-lg text-right font-mono"
              />
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-5">
            سيُسجّل قيد: مدين ذمم الموردين / دائن الصندوق أو البنك، ويُحدَّث رصيد الفاتورة تلقائياً (مدفوعة جزئياً أو مدفوعة).
          </p>

          <div className="mt-2 flex items-center justify-end gap-2.5 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setPayInvoice(null)} disabled={isPending} className="rounded-lg border-slate-200">
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending} className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-6 font-bold gap-1.5">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              تسجيل الدفعة
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
