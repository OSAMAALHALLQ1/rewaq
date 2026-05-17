import { Plus, Search } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { saveSupplierAction } from "@/server/actions/mutations";
import { getPurchasingData } from "@/server/queries/app";

export default async function SuppliersPage() {
  const { suppliers } = await getPurchasingData();

  return (
    <>
      <PageHeader title="الموردون" description="إدارة بيانات الموردين ومراقبة مخاطر ارتفاع الأسعار." />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle>قائمة الموردين</CardTitle>
              <div className="relative w-full max-w-80">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="ps-9" placeholder="بحث باسم المورد أو الهاتف" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المورد</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>البريد</TableHead>
                  <TableHead>مخاطر السعر</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <div className="font-semibold">{supplier.name}</div>
                      <p className="text-xs text-muted-foreground">{supplier.address}</p>
                    </TableCell>
                    <TableCell>{supplier.phone}</TableCell>
                    <TableCell>{supplier.email}</TableCell>
                    <TableCell>
                      <Badge tone={supplier.priceRisk >= 15 ? "danger" : supplier.priceRisk >= 8 ? "warning" : "success"}>
                        {supplier.priceRisk}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={supplier.status} />
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
              <Plus className="h-5 w-5 text-primary" />
              إضافة مورد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveSupplierAction} submitLabel="حفظ المورد" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">اسم المورد</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">الهاتف</Label>
                <Input id="phone" name="phone" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">البريد</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">العنوان</Label>
                <Input id="address" name="address" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">الحالة</Label>
                <Select id="status" name="status" defaultValue="active">
                  <option value="active">نشط</option>
                  <option value="inactive">متوقف</option>
                </Select>
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
