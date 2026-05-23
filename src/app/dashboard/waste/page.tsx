import { PackageMinus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { saveWasteLogAction } from "@/server/actions/mutations";
import { getOperationsData } from "@/server/queries/app";

export default async function WastePage() {
  const { wasteLogs, branches, items } = await getOperationsData();
  const filteredLogs = wasteLogs.filter((log) => log.reason === "تلف" || log.reason === "محاريق" || log.reason === "سبب آخر");

  return (
    <>
      <PageHeader
        title="التالف والمحاريق"
        description="تسجيل التالف والمحاريق ينقص المخزون ويظهر في تقارير المخزن."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>سجل التالف والمحاريق</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>المادة</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>التكلفة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.loggedAt).toLocaleDateString("ar-PS")}</TableCell>
                    <TableCell>{log.branchName}</TableCell>
                    <TableCell className="font-medium">{log.itemName}</TableCell>
                    <TableCell>
                      <Badge tone="warning">{log.reason}</Badge>
                    </TableCell>
                    <TableCell>{log.quantity}</TableCell>
                    <TableCell>{formatCurrency(log.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageMinus className="h-5 w-5 text-primary" />
              تسجيل تالف / محاريق
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveWasteLogAction} submitLabel="حفظ السجل" className="space-y-4">
<<<<<<< HEAD
              <div className="grid gap-2">
                <Label htmlFor="branchId">القسم</Label>
                <Select id="branchId" name="branchId" required>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="itemId">المادة</Label>
                <Select id="itemId" name="itemId" required>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">الكمية</Label>
                <Input id="quantity" name="quantity" type="number" min="0" step="0.01" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reason">النوع</Label>
                <Select id="reason" name="reason" required>
                  {["تلف", "محاريق"].map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" name="notes" placeholder="ملاحظات اختيارية..." />
              </div>
=======
            <div className="grid gap-2">
              <Label htmlFor="branchId">القسم</Label>
              <Select id="branchId" name="branchId" required>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="itemId">المادة</Label>
              <Select id="itemId" name="itemId" required>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quantity">الكمية</Label>
              <Input id="quantity" name="quantity" type="number" min="0" step="0.01" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">النوع</Label>
              <Select id="reason" name="reason" required>
                {["تلف", "محاريق"].map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea id="notes" name="notes" />
            </div>
>>>>>>> 1e006f5ad7af41e7d414774f408bb5e7d5cdf4db
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
