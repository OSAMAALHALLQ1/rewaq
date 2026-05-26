import { KeyRound, ShieldCheck, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { roleLabels } from "@/lib/permissions/roles";
import { inviteTeamMemberAction } from "@/server/actions/auth";
import { getAdminData } from "@/server/queries/app";
import type { Role } from "@/types/domain";

const roleGuide = [
  ["المدير", "organization_owner", "يمتلك مفاتيح التوزيع: المستخدمون، الأسعار، التكاملات، الفروع، التقارير، والصلاحيات."],
  ["الكاشير", "cashier", "يرى شاشة البيع والورديات والطباعة فقط، مع قيود على الخصم والإلغاء حسب قرار المدير."],
  ["أمين المخزن", "inventory_manager", "يدير الجرد والاستلام والتحويلات والهدر والحدود الدنيا بدون الاطلاع على كل الأرباح."],
] as const;

export default async function UsersRolesPage() {
  const { users } = await getAdminData();

  return (
    <>
      <PageHeader
        title="المستخدمون والصلاحيات"
        description="المدير يتحكم بكل شيء، والكاشير يرى البيع، وأمين المخزن يرى المخزون. الصلاحيات هنا مصممة حتى لا يضيع الموظف في صفحات لا تخصه."
        actions={<Button>دعوة مستخدم</Button>}
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {roleGuide.map(([title, role, body]) => (
          <Card key={role}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-primary">
                  {role === "organization_owner" ? <KeyRound className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                </span>
                <Badge tone={role === "organization_owner" ? "success" : "default"}>{roleLabels[role]}</Badge>
              </div>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
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
                {users.map((user: any) => (
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

        <Card>
          <CardHeader>
            <CardTitle>دعوة فرد جديد</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={inviteTeamMemberAction} submitLabel="إنشاء كود الدعوة" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">بريد الموظف</Label>
                <Input id="email" name="email" type="email" placeholder="cashier@example.com" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">الصلاحية</Label>
                <select id="role" name="role" className="h-11 rounded-lg border bg-white px-3 text-sm" required>
                  <option value="cashier">كاشير</option>
                  <option value="inventory_manager">أمين مخزن</option>
                  <option value="branch_manager">مدير فرع</option>
                  <option value="accountant">محاسب</option>
                  <option value="marketing_manager">مسؤول تسويق</option>
                  <option value="chef">شيف</option>
                  <option value="staff">موظف محدود</option>
                </select>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
                يتم إنشاء كود دعوة مرتبط بالبريد والصلاحية. الموظف يستخدمه عند إنشاء حسابه، فتظهر له الصفحات المناسبة فقط.
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
