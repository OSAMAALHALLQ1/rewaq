import { ArrowLeftRight, Plus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { saveTransferAction } from "@/server/actions/mutations";
import { getOperationsData } from "@/server/queries/app";

export default async function TransfersPage() {
  const { transfers, branches, items } = await getOperationsData();

  return (
    <>
      <PageHeader
        title="التحويلات الداخلية"
        description="تحويل المواد بين الأقسام الداخلية مع حركة صادر للمرسل ووارد للمستقبل."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>سجل التحويلات الداخلية</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرقم</TableHead>
                  <TableHead>من</TableHead>
                  <TableHead>إلى</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>عدد المواد</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-medium">{transfer.id}</TableCell>
                    <TableCell>{transfer.fromBranchName}</TableCell>
                    <TableCell>{transfer.toBranchName}</TableCell>
                    <TableCell>
                      <StatusBadge status={transfer.status} />
                    </TableCell>
                    <TableCell>{transfer.totalItems}</TableCell>
                    <TableCell>{transfer.createdAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              تحويل جديد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveTransferAction} submitLabel="حفظ التحويل" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="fromBranchId">من قسم</Label>
                <Select id="fromBranchId" name="fromBranchId" required>
                  <option value="">اختر القسم المرسل</option>
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
                <Input id="notes" name="notes" />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
