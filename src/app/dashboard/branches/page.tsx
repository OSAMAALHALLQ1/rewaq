import { Building2, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrganizationContext } from "@/server/queries/app";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBranchAction } from "@/server/actions/mutations";

export default async function BranchesPage() {
  const { branches } = await getOrganizationContext();

  return (
    <>
      <PageHeader
        title="الأقسام"
        description="إدارة أقسام المؤسسة وربط المخزون، المشتريات، التقارير، والصلاحيات بكل قسم."
        actions={
          <Button asChild>
            <a href="#new-section">
            <Plus className="h-4 w-4" />
            قسم جديد
            </a>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            أقسام المؤسسة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>القسم</TableHead>
                <TableHead>المدينة</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>المدير</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تعديل الاسم</TableHead>
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
                  <TableCell>
                    <ActionForm action={saveBranchAction} submitLabel="حفظ التعديل" className="min-w-64">
                      <input type="hidden" name="branchId" value={branch.id} />
                      <div className="flex items-center gap-2">
                        <Pencil className="h-4 w-4 shrink-0 text-primary" />
                        <Input name="name" defaultValue={branch.name} aria-label={`اسم القسم ${branch.name}`} required minLength={2} />
                      </div>
                    </ActionForm>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card id="new-section" className="mt-4 max-w-xl">
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> إضافة قسم تشغيل جديد</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={saveBranchAction} submitLabel="إضافة القسم" className="space-y-3">
            <Label htmlFor="new-section-name">اسم القسم</Label>
            <Input id="new-section-name" name="name" placeholder="مثال: قسم الحلويات أو المطبخ الساخن" required minLength={2} />
          </ActionForm>
        </CardContent>
      </Card>
    </>
  );
}
