import { FileImage, FileText, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import { getPurchasingData } from "@/server/queries/app";

const expiryByItem: Record<string, string> = {
  دجاج: "2026-05-25",
  جبنة: "2026-06-04",
  أرز: "",
  بطاطا: "2026-06-12",
};

export default async function InvoicesPage() {
  const { invoices, suppliers, purchaseOrders, items } = await getPurchasingData();

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
            <div className="grid gap-2">
              <Label>اسم المورد</Label>
              <Select>
                {suppliers.map((supplier) => (
                  <option key={supplier.id}>{supplier.name}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>رقم جوال المورد</Label>
              <Input placeholder="05xxxxxxxx" />
            </div>
            <div className="grid gap-2">
              <Label>رقم الفاتورة</Label>
              <Input placeholder="INV-0001" />
            </div>
            <div className="grid gap-2">
              <Label>تاريخ الفاتورة</Label>
              <Input type="date" defaultValue="2026-05-20" />
            </div>
            <div className="grid gap-2">
              <Label>صورة الفاتورة</Label>
              <Input type="file" accept="image/*,.pdf" />
            </div>
            <div className="grid gap-2">
              <Label>الصنف</Label>
              <Select>
                {items.slice(0, 8).map((item) => (
                  <option key={item.id}>{item.name}</option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>الكمية</Label>
                <Input type="number" min="0" />
              </div>
              <div className="grid gap-2">
                <Label>السعر بدون كسور</Label>
                <Input type="number" step="1" min="0" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>تاريخ انتهاء الصلاحية</Label>
              <Input type="date" />
            </div>
            <Badge tone="muted">يمكن إضافة أكثر من صنف للفاتورة من نفس النموذج لاحقًا.</Badge>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
