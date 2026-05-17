import { Building2, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrganizationContext } from "@/server/queries/app";

export default async function BranchesPage() {
  const { branches } = await getOrganizationContext();

  return (
    <>
      <PageHeader
        title="الفروع"
        description="إدارة فروع المؤسسة وربط المخزون، المشتريات، التقارير، والصلاحيات بكل فرع."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            فرع جديد
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            فروع المؤسسة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الفرع</TableHead>
                <TableHead>المدينة</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>المدير</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-semibold">{branch.name}</TableCell>
                  <TableCell>{branch.city}</TableCell>
                  <TableCell>{branch.address}</TableCell>
                  <TableCell>{branch.manager}</TableCell>
                  <TableCell>
                    <StatusBadge status={branch.status} />
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
