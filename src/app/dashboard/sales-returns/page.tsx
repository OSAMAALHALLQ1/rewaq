import { RotateCcw, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const returns = [
  { id: "MR-1", item: "دجاج مبرد", department: "الشاورمة والمشاوي", reason: "إرجاع للمورد", quantity: "12 كغم", status: "مكتمل" },
  { id: "MR-2", item: "منظف أرضيات", department: "قسم الخدمات", reason: "خطأ توريد", quantity: "4 عبوات", status: "قيد المراجعة" },
];

export default function SalesReturnsPage() {
  return (
    <>
      <PageHeader
        title="مرتجعات المخزن"
        description="تسجيل مرتجعات المواد من الأقسام أو للموردين بدون أي ربط بفواتير العملاء أو المبيعات."
        actions={
          <Button>
            <RotateCcw className="h-4 w-4" />
            مرتجع مخزن جديد
          </Button>
        }
      />
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
    </>
  );
}
