import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { roleLabels } from "@/lib/permissions/roles";
import { getAdminData } from "@/server/queries/app";
import type { Role } from "@/types/domain";

export default async function UsersRolesPage() {
  const { users } = await getAdminData();

  return (
    <>
      <PageHeader
        title="المستخدمون والصلاحيات"
        description="الأدوار المرنة تحدد الوصول حسب المؤسسة والفرع والوظيفة."
        actions={<Button>دعوة مستخدم</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            أعضاء الفريق
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>النطاق</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-semibold">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge tone="default">{roleLabels[user.role as Role]}</Badge>
                  </TableCell>
                  <TableCell>{user.role === "branch_manager" ? "فرع محدد" : "كل المؤسسة"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
