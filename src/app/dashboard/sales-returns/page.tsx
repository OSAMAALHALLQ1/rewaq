import { RotateCcw } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { saveSalesReturnAction } from "@/server/actions/mutations";
import { getInventoryData } from "@/server/queries/app";

const returns = [
  { id: "MR-1", item: "دجاج مبرد", department: "الشاورمة والمشاوي", reason: "إرجاع للمورد", quantity: "12 كغم", status: "مكتمل" },
  { id: "MR-2", item: "منظف أرضيات", department: "قسم الخدمات", reason: "خطأ توريد", quantity: "4 عبوات", status: "قيد المراجعة" },
];

export default async function SalesReturnsPage() {
  const { branches, items } = await getInventoryData();

  return (
    <>
      <PageHeader
        title="مرتجعات المخزن"
        description="تسجيل مرتجعات المواد من الأقسام أو من المبيعات بدون ربط بفواتير العملاء."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>سجل مرتجعات المخزن</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم المرجع</TableHead>
                  <TableHead>المادة</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-bold">{item.id}</TableCell>
                    <TableCell>{item.item}</TableCell>
                    <TableCell>{item.department}</TableCell>
                    <TableCell>{item.reason}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>
                      <Badge tone={item.status === "مكتمل" ? "success" : "warning"}>{item.status}</Badge>
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
            <ActionForm action={saveSalesReturnAction} submitLabel="حفظ المرتجع" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="branchId">القسم</Label>
                <Select id="branchId" name="branchId" required>
                  <option value="">اختر القسم</option>
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
                <Label htmlFor="reason">السبب</Label>
                <Input id="reason" name="reason" placeholder="سبب المرتجع" required />
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
