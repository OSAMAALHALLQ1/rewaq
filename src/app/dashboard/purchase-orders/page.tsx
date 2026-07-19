import { PackageCheck, Plus, ShoppingCart } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { todayLocal } from "@/lib/accounting/posting";
import { receivePurchaseOrderAction, savePurchaseOrderAction } from "@/server/actions/mutations";
import { getPurchasingData } from "@/server/queries/purchasing";

export default async function PurchaseOrdersPage() {
  const { purchaseOrders, suppliers, branches, items } = await getPurchasingData();
  const today = todayLocal();

  return (
    <>
      <PageHeader
        title="أوامر الشراء والاستلام"
        description="أنشئ أمر شراء للمورد، ثم سجّل الاستلام ليُحدّث المخزون وقيد البضاعة المستلمة غير المفوترة في عملية واحدة."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              أوامر الشراء
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الأمر</TableHead>
                  <TableHead>المورد / الفرع</TableHead>
                  <TableHead>الصنف والكمية</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.length ? purchaseOrders.map((order) => {
                  const canReceive = order.status === "sent" || order.status === "partially_received";
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-semibold">PO-{order.id.slice(0, 8).toUpperCase()}</div>
                        <div className="text-xs text-muted-foreground">{order.orderDate}</div>
                      </TableCell>
                      <TableCell>
                        <div>{order.supplierName}</div>
                        <div className="text-xs text-muted-foreground">{order.branchName}</div>
                      </TableCell>
                      <TableCell>
                        {order.items.map((item) => (
                          <div key={item.itemId} className="text-sm">
                            {item.itemName}: {item.receivedQuantity}/{item.quantity}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(order.total)}</TableCell>
                      <TableCell><StatusBadge status={order.status} /></TableCell>
                      <TableCell className="min-w-36">
                        {canReceive ? (
                          <ActionForm action={receivePurchaseOrderAction} submitLabel="تسجيل الاستلام">
                            <input type="hidden" name="purchaseOrderId" value={order.id} />
                            <input type="hidden" name="receivedAt" value={today} />
                            <input type="hidden" name="idempotencyKey" value={`goods-receipt:${crypto.randomUUID()}`} />
                          </ActionForm>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {order.status === "received" ? "مستلم بالكامل" : "لا يوجد إجراء متاح"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      لا توجد أوامر شراء حتى الآن.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              أمر شراء جديد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={savePurchaseOrderAction} submitLabel="إنشاء وإرسال الأمر" className="space-y-4">
              <input type="hidden" name="status" value="sent" />
              <input type="hidden" name="idempotencyKey" value={`purchase-order:${crypto.randomUUID()}`} />
              <div className="grid gap-2">
                <Label htmlFor="supplierId">المورد</Label>
                <Select id="supplierId" name="supplierId" required>
                  <option value="">اختر المورد</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="branchId">الفرع المستلم</Label>
                <Select id="branchId" name="branchId" required>
                  <option value="">اختر الفرع</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="itemId">الصنف</Label>
                <Select id="itemId" name="itemId" required>
                  <option value="">اختر الصنف</option>
                  {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="quantity">الكمية</Label>
                  <Input id="quantity" name="quantity" type="number" min="0.0001" step="0.0001" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unitPrice">سعر الوحدة</Label>
                  <Input id="unitPrice" name="unitPrice" type="number" min="0" step="0.0001" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="orderDate">تاريخ الأمر</Label>
                <Input id="orderDate" name="orderDate" type="date" defaultValue={today} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" name="notes" placeholder="شروط التوريد أو ملاحظات الاستلام" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <PackageCheck className="h-4 w-4" />
                الاستلام لاحقاً هو الذي يزيد المخزون ويرحّل قيد GRNI.
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
