import { FileImage, FileText, Upload } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/utils";
import { getPurchasingData } from "@/server/queries/app";
import { saveSupplyInvoiceAction } from "@/server/actions/mutations";

const expiryByItem: Record<string, string> = {
  دجاج: "2026-05-25",
  جبنة: "2026-06-04",
  أرز: "",
  بطاطا: "2026-06-12",
};

export default async function InvoicesPage() {
  const { invoices, suppliers, purchaseOrders, items, branches } = await getPurchasingData();

  return (
    <>
      <PageHeader
        title="فواتير التوريد"
        description="تسجيل فواتير الموردين مع رقم الجوال، رقم الفاتورة، صورة الفاتورة، الأصناف، الكميات، السعر بدون كسور، وتاريخ انتهاء الصلاحية إن وجد."
        actions={
          <Button variant="outline">
            <Upload className="h-4 w-4" />
            رفع صورة فاتورة
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              سجل فواتير التوريد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم المورد</TableHead>
                  <TableHead>رقم جوال المورد</TableHead>
                  <TableHead>رقم الفاتورة</TableHead>
                  <TableHead>تاريخ الفاتورة</TableHead>
                  <TableHead>صورة الفاتورة</TableHead>
                  <TableHead>الأصناف والكميات</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const supplier = suppliers.find((candidate) => candidate.name === invoice.supplierName);
                  const orderItems = purchaseOrders.find((order) => order.supplierName === invoice.supplierName)?.items ?? [];

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-semibold">{invoice.supplierName}</TableCell>
                      <TableCell>{supplier?.phone ?? "-"}</TableCell>
                      <TableCell>{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.issuedAt}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          <FileImage className="h-4 w-4" />
                          صورة
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {orderItems.map((item) => (
                            <div key={item.itemId} className="rounded-lg border bg-slate-50 p-2 text-xs leading-5">
                              <p className="font-semibold">
                                {item.itemName} - كمية {formatNumber(item.quantity)}
                              </p>
                              <p>السعر: {formatNumber(Math.round(item.expectedUnitPrice))}</p>
                              <p>انتهاء الصلاحية: {expiryByItem[item.itemName] || "لا يوجد"}</p>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>إدخال فاتورة توريد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActionForm action={saveSupplyInvoiceAction} submitLabel="حفظ الفاتورة" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="supplierId">اسم المورد</Label>
                <Select id="supplierId" name="supplierId" required>
                  <option value="">اختر المورد</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="branchId">القسم</Label>
                <Select id="branchId" name="branchId" required>
                  <option value="">اختر القسم</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invoiceNumber">رقم الفاتورة</Label>
                <Input id="invoiceNumber" name="invoiceNumber" placeholder="INV-0001" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="issuedAt">تاريخ الفاتورة</Label>
                <Input id="issuedAt" name="issuedAt" type="date" defaultValue="2026-05-20" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="itemId">الصنف</Label>
                <Select id="itemId" name="itemId" required>
                  <option value="">اختر الصنف</option>
                  {items.slice(0, 8).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="quantity">الكمية</Label>
                  <Input id="quantity" name="quantity" type="number" min="0" step="0.01" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unitPrice">السعر</Label>
                  <Input id="unitPrice" name="unitPrice" type="number" step="0.01" min="0" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expirationDate">تاريخ انتهاء الصلاحية</Label>
                <Input id="expirationDate" name="expirationDate" type="date" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" name="notes" />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
