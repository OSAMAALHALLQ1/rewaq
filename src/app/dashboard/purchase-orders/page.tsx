import { Plus } from "lucide-react";
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
import { saveTransferAction } from "@/server/actions/mutations";
import { getOperationsData } from "@/server/queries/app";

export default async function PurchaseOrdersPage() {
  const { transfers, branches, items } = await getOperationsData();

  return (
    <>
      <PageHeader
        title="طلبات الأقسام"
        description="تدفق إنشاء طلبات الأقسام الداخلية وإرسالها بين الفروع / الأقسام بدون ربط الموردين."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>طلبات الأقسام المفتوحة والسابقة</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرقم</TableHead>
<<<<<<< HEAD
                  <TableHead>القسم المرسل</TableHead>
                  <TableHead>القسم المستقبل</TableHead>
=======
                  <TableHead>من</TableHead>
                  <TableHead>إلى</TableHead>
>>>>>>> 1e006f5ad7af41e7d414774f408bb5e7d5cdf4db
                  <TableHead>الحالة</TableHead>
                  <TableHead>عدد المواد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
<<<<<<< HEAD
                {purchaseOrders.map((order) => {
                  const toBranchName = order.notes?.match(/\[إلى:\s*([^\]]+)\]/)?.[1] || "المخزن الرئيسي";
                  const cleanNotes = order.notes?.replace(/\[إلى:\s*[^\]]+\]\s*/, "") || order.notes;

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-semibold text-xs truncate max-w-28" title={order.id}>
                        {order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{order.branchName}</TableCell>
                      <TableCell>{toBranchName}</TableCell>
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
                  );
                })}
=======
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-semibold">{transfer.id}</TableCell>
                    <TableCell>{transfer.fromBranchName}</TableCell>
                    <TableCell>{transfer.toBranchName}</TableCell>
                    <TableCell>
                      <StatusBadge status={transfer.status} />
                    </TableCell>
                    <TableCell>{transfer.totalItems}</TableCell>
                  </TableRow>
                ))}
>>>>>>> 1e006f5ad7af41e7d414774f408bb5e7d5cdf4db
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
            <ActionForm action={saveTransferAction} submitLabel="حفظ الطلب" className="space-y-4">
              <div className="grid gap-2">
<<<<<<< HEAD
                <Label htmlFor="fromBranchId">القسم الطالب (المرسل)</Label>
                <Select id="fromBranchId" name="fromBranchId" required>
                  <option value="">اختر القسم الطالب</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="toBranchId">القسم المستلم (المخزن)</Label>
                <Select id="toBranchId" name="toBranchId" required>
                  <option value="">اختر القسم المستلم</option>
=======
                <Label htmlFor="fromBranchId">من قسم</Label>
                <Select id="fromBranchId" name="fromBranchId" required>
                  <option value="">اختر القسم المرسل</option>
>>>>>>> 1e006f5ad7af41e7d414774f408bb5e7d5cdf4db
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="toBranchId">إلى قسم</Label>
                <Select id="toBranchId" name="toBranchId" required>
                  <option value="">اختر القسم المستقبل</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="itemId">المادة</Label>
                <Select id="itemId" name="itemId" required>
                  <option value="">اختر المادة</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">الكمية</Label>
                <Input id="quantity" name="quantity" type="number" min="0" step="0.01" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" name="notes" placeholder="ملاحظات اختيارية..." />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
