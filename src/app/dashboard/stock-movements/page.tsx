import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { getInventoryData } from "@/server/queries/app";

export default async function StockMovementsPage() {
  const { movements, branches } = await getInventoryData();

  return (
    <>
      <PageHeader
        title="حركات المخزون"
        description="دفتر حركات غير قابل للتجاوز يشرح كل زيادة أو نقصان في المخزون."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-72" placeholder="بحث بالمرجع أو المادة" />
            <Select className="max-w-56" defaultValue="all">
              <option value="all">كل الفروع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Select className="max-w-48" defaultValue="all">
              <option value="all">كل الأنواع</option>
              <option value="purchase">شراء</option>
              <option value="waste">هدر</option>
              <option value="transfer_in">تحويل وارد</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>المادة</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الكمية</TableHead>
                <TableHead>المرجع</TableHead>
                <TableHead>التكلفة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{new Date(movement.createdAt).toLocaleString("ar-PS")}</TableCell>
                  <TableCell className="font-medium">{movement.itemName}</TableCell>
                  <TableCell>{movement.branchName}</TableCell>
                  <TableCell>{movement.movementType}</TableCell>
                  <TableCell>{movement.quantity}</TableCell>
                  <TableCell>{movement.reference ?? "-"}</TableCell>
                  <TableCell>{formatCurrency(Math.abs(movement.totalCost))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
