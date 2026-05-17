import { ClipboardCheck, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInventoryData } from "@/server/queries/app";

export default async function StockCountsPage() {
  const { items, branches } = await getInventoryData();
  const previewItems = items.slice(0, 5);

  return (
    <>
      <PageHeader
        title="الجرد"
        description="ابدأ جردًا لكل فرع، ثم أنشئ حركات تسوية وفروقات جرد للكميات غير المطابقة."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            جرد جديد
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Select className="max-w-72" defaultValue={branches[0]?.id}>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
              <Input className="max-w-64" placeholder="بحث في مواد الجرد" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المادة</TableHead>
                  <TableHead>النظام</TableHead>
                  <TableHead>العد الفعلي</TableHead>
                  <TableHead>الفرق</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewItems.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{80 - index * 7}</TableCell>
                    <TableCell>
                      <Input className="max-w-28" type="number" defaultValue={78 - index * 5} />
                    </TableCell>
                    <TableCell>
                      <Badge tone={index === 1 ? "danger" : "warning"}>{index === 1 ? "-9" : "-2"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <EmptyState
          icon={ClipboardCheck}
          title="سجل الجرد"
          description="عند اعتماد الجرد ستظهر جلسات الجرد هنا مع تفاصيل المواد والكميات."
          actionLabel="اعتماد الجرد"
        />
      </div>
    </>
  );
}
