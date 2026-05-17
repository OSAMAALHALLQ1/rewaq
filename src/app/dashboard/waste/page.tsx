import { PackageMinus, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { getOperationsData } from "@/server/queries/app";

export default async function WastePage() {
  const { wasteLogs, branches, items } = await getOperationsData();

  return (
    <>
      <PageHeader
        title="الهدر والتلف"
        description="تسجيل الهدر ينقص المخزون ويضيف حركة مخزون من نوع هدر ويظهر في التقارير."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>سجل الهدر</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>المادة</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>التكلفة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wasteLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.loggedAt}</TableCell>
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
              تسجيل هدر
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>الفرع</Label>
              <Select>
                {branches.map((branch) => (
                  <option key={branch.id}>{branch.name}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>المادة</Label>
              <Select>
                {items.map((item) => (
                  <option key={item.id}>{item.name}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>الكمية</Label>
              <Input type="number" min="0" step="0.01" />
            </div>
            <div className="grid gap-2">
              <Label>السبب</Label>
              <Select>
                {["تلف", "انتهاء صلاحية", "خطأ تحضير", "كسر/انسكاب", "إرجاع", "سبب آخر"].map((reason) => (
                  <option key={reason}>{reason}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>ملاحظات</Label>
              <Textarea />
            </div>
            <Button className="w-full">
              <Plus className="h-4 w-4" />
              حفظ الهدر
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
