import { WalletCards } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getRecipesData } from "@/server/queries/app";

export default async function FoodCostPage() {
  const { menuItems, branches } = await getRecipesData();

  return (
    <>
      <PageHeader
        title="تحليل تكلفة الطعام"
        description="مقارنة تكلفة الوصفة بسعر البيع ونسبة الربح لكل طبق."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-primary" />
              ربحية الأطباق
            </CardTitle>
            <Select className="max-w-64" defaultValue="all">
              <option value="all">كل الفروع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطبق</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>التكلفة</TableHead>
                <TableHead>الربح الإجمالي</TableHead>
                <TableHead>نسبة تكلفة الطعام</TableHead>
                <TableHead>هامش الربح</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {menuItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold">{item.name}</TableCell>
                  <TableCell>{formatCurrency(item.sellingPrice)}</TableCell>
                  <TableCell>{formatCurrency(item.recipeCost)}</TableCell>
                  <TableCell>{formatCurrency(item.grossProfit)}</TableCell>
                  <TableCell>
                    <Badge tone={item.foodCostPercent > 35 ? "danger" : "success"}>
                      {formatPercent(item.foodCostPercent)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatPercent(item.profitMarginPercent)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
