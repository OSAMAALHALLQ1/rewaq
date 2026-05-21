import { PackageCheck, Plus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { receivePurchaseOrderFormAction, savePurchaseOrderAction } from "@/server/actions/mutations";
import { getPurchasingData } from "@/server/queries/app";

export default async function PurchaseOrdersPage() {
  const { purchaseOrders, suppliers, branches } = await getPurchasingData();

  return (
    <>
      <PageHeader
        title="طلبيات الأقسام"
        description="تدفق طلبيات الأقسام: مسودة، إرسال، تجهيز، واستلام. الاعتماد يحدث المخزون وسجل الصادر والوارد."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>طلبيات الأقسام المفتوحة والسابقة</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرقم</TableHead>
                  <TableHead>المورد</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>المجموع</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-semibold">{order.id}</TableCell>
                    <TableCell>{order.supplierName}</TableCell>
                    <TableCell>{order.branchName}</TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell>{formatCurrency(order.total)}</TableCell>
                    <TableCell>
                      {order.status !== "received" ? (
                        <form action={receivePurchaseOrderFormAction}>
                          <input type="hidden" name="purchaseOrderId" value={order.id} />
                          <Button size="sm" variant="outline" type="submit">
                            <PackageCheck className="h-4 w-4" />
                            استلام
                          </Button>
                        </form>
                      ) : (
                        <span className="text-sm text-muted-foreground">مكتمل</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              طلب قسم جديد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={savePurchaseOrderAction} submitLabel="حفظ الطلب" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="supplierId">المورد</Label>
                <Select id="supplierId" name="supplierId" required>
                  <option value="">اختر</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="branchId">القسم الطالب</Label>
                <Select id="branchId" name="branchId" required>
                  <option value="">اختر</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">الحالة</Label>
                <Select id="status" name="status" defaultValue="draft">
                  <option value="draft">مسودة</option>
                  <option value="sent">مرسل</option>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="orderDate">التاريخ</Label>
                <Input id="orderDate" name="orderDate" type="date" defaultValue="2026-05-16" required />
              </div>
              <div className="rounded-lg border bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
                في هذه المرحلة يتم حفظ رأس الطلب. يمكن إضافة المواد والكميات على الطلب من شاشة التفاصيل لاحقًا.
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
