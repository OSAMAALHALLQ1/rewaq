import { ClipboardCheck, Plus } from "lucide-react";
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
import { saveStockCountAction } from "@/server/actions/mutations";
import { getStockCountsData } from "@/server/queries/app";

export default async function StockCountsPage() {
  const { items, branches, branchStock, counts } = await getStockCountsData();
  const selectedBranchId = branches[0]?.id ?? "";
  const previewItems = items.slice(0, 8);

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
              <Input className="max-w-64" placeholder="بحث في مواد الجرد" />
            </div>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveStockCountAction} submitLabel="اعتماد الجرد" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="branchId">الفرع</Label>
                <Select id="branchId" name="branchId" defaultValue={selectedBranchId} required>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
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
                  {previewItems.map((item) => {
                    const systemQuantity = branchStock
                      .filter((stock) => stock.branchId === selectedBranchId && stock.itemId === item.id)
                      .reduce((sum, stock) => sum + stock.quantity, 0);

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.name}
                          <input type="hidden" name="itemId" value={item.id} />
                        </TableCell>
                        <TableCell>{systemQuantity}</TableCell>
                        <TableCell>
                          <Input className="max-w-28" name="countedQuantity" type="number" min="0" step="0.01" defaultValue={systemQuantity} />
                        </TableCell>
                        <TableCell>
                          <Badge tone="muted">يُحسب عند الاعتماد</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="grid gap-2">
                <Label htmlFor="notes">ملاحظات الجرد</Label>
                <Textarea id="notes" name="notes" />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              سجل الجرد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {counts.length === 0 ? (
              <p className="rounded-lg border bg-slate-50 p-4 text-sm leading-6 text-muted-foreground">
                عند اعتماد الجرد ستظهر جلسات الجرد هنا مع تفاصيل المواد والكميات.
              </p>
            ) : (
              counts.map((count) => (
                <div key={count.id} className="rounded-lg border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{count.branchName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{count.countedAt ? new Date(count.countedAt).toLocaleString("ar-PS") : "بدون تاريخ"}</p>
                    </div>
                    <Badge tone={count.status === "approved" ? "success" : "warning"}>{count.status}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 p-2">مواد: {count.itemsCount}</div>
                    <div className="rounded-lg bg-slate-50 p-2">فروقات: {count.varianceCount}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
