import { FileText, Wallet } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { saveInvoiceAction } from "@/server/actions/mutations";
import { getPurchasingData } from "@/server/queries/purchasing";
import { SupplierInvoicesClient } from "@/components/purchasing/supplier-invoices-client";

export default async function InvoicesPage() {
  const { invoices, suppliers, purchaseOrders, items, branches } = await getPurchasingData();

  return (
    <>
      <PageHeader
        title="فواتير التوريد (ذمم الموردين)"
        description="تسجيل فاتورة المورد يُنشئ قيداً: مدين المخزون / دائن ذمم الموردين (ديناً على المؤسسة). الفاتورة تبقى غير مسددة حتى يُسجَّل سند دفع. يمكن ربطها بأمر شراء وطلب استحقاق."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700">
            <Wallet className="h-4 w-4" />
            دورة مستحقات وليست دفعة فورية
          </span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <SupplierInvoicesClient invoices={invoices} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              إدخال فاتورة توريد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveInvoiceAction} submitLabel="حفظ الفاتورة (ترحيل كدين)" className="space-y-4">
              <input type="hidden" name="idempotencyKey" value={`supplier-invoice:${crypto.randomUUID()}`} />
              <div className="grid gap-2">
                <Label htmlFor="supplierId">اسم المورد</Label>
                <Select id="supplierId" name="supplierId" required>
                  <option value="">اختر المورد</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="branchId">القسم / الفرع المستلم</Label>
                <Select id="branchId" name="branchId" required>
                  <option value="">اختر القسم / الفرع</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="invoiceNumber">رقم الفاتورة</Label>
                  <Input id="invoiceNumber" name="invoiceNumber" placeholder="INV-0001" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="purchaseOrderId">أمر الشراء (اختياري)</Label>
                  <Select id="purchaseOrderId" name="purchaseOrderId">
                    <option value="">بدون ربط</option>
                    {purchaseOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.supplierName} — {order.orderDate}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="issuedAt">تاريخ الفاتورة</Label>
                  <Input id="issuedAt" name="issuedAt" type="date" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">تاريخ الاستحقاق (اختياري)</Label>
                  <Input id="dueDate" name="dueDate" type="date" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="itemId">الصنف</Label>
                <Select id="itemId" name="itemId" required>
                  <option value="">اختر الصنف</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="quantity">الكمية</Label>
                  <Input id="quantity" name="quantity" type="number" min="0" step="0.01" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unitPrice">سعر الوحدة</Label>
                  <Input id="unitPrice" name="unitPrice" type="number" step="0.01" min="0" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expiryDate">تاريخ انتهاء الصلاحية (اختياري)</Label>
                <Input id="expiryDate" name="expiryDate" type="date" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paymentMethod">طريقة الدفع المتفق عليها (معلومة فقط — لا تُسدَّد هنا)</Label>
                <Select id="paymentMethod" name="paymentMethod">
                  <option value="">غير محدد</option>
                  <option value="cash">نقدي</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="card">بطاقة / شبكة</option>
                  <option value="deferred">آجل (على الحساب)</option>
                </Select>
              </div>
              <p className="text-[11px] leading-5 text-slate-500">
                الحفظ يرحّل قيداً: مدين المخزون / دائن ذمم الموردين، ويُنشئ مستحقاً غير مسدود. تتم السداد لاحقاً من زر «سند دفع» في الجدول أو من صفحة الذمم الدائنة.
              </p>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
