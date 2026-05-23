import { RotateCcw, Search } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { saveReturnAction } from "@/server/actions/mutations";
import { getInventoryData } from "@/server/queries/app";

export default async function SalesReturnsPage() {
  const { movements, branches, items } = await getInventoryData();
  const returns = movements.filter((m) => m.movementType === "return");

  return (
    <>
      <PageHeader
        title="مرتجعات المخزن"
        description="تسجيل مرتجعات المواد من الأقسام أو للموردين بدون أي ربط بفواتير العملاء أو المبيعات."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>سجل مرتجعات المخزن</CardTitle>
              <div className="relative max-w-72">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="ps-9" placeholder="بحث بالمادة أو القسم" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المادة</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>الكمية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{new Date(item.createdAt).toLocaleDateString("ar-PS")}</TableCell>
                    <TableCell className="font-bold">{item.itemName}</TableCell>
                    <TableCell>{item.branchName}</TableCell>
                    <TableCell>{item.notes || "مرتجع مخزن"}</TableCell>
                    <TableCell>
                      <Badge tone="warning">{Math.abs(item.quantity)}</Badge>
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
              <RotateCcw className="h-5 w-5 text-primary" />
              مرتجع مخزن جديد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveReturnAction} submitLabel="حفظ المرتجع" className="space-y-4">
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
                <Label htmlFor="itemId">المادة</Label>
                <Select id="itemId" name="itemId" required>
                  <option value="">اختر المادة</option>
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
                <Label htmlFor="notes">السبب / ملاحظات</Label>
                <Textarea id="notes" name="notes" placeholder="اكتب سبب إرجاع المواد..." required />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
