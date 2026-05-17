import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminData } from "@/server/queries/app";

export default async function AdminOrganizationsPage() {
  const { organizations } = await getAdminData();

  return (
    <>
      <PageHeader title="المؤسسات" description="إدارة مؤسسات العملاء وخططهم وحالة الاشتراك." />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            المؤسسات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>المعرف</TableHead>
                <TableHead>الخطة</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((organization) => (
                <TableRow key={organization.id}>
                  <TableCell className="font-semibold">{organization.name}</TableCell>
                  <TableCell>{organization.slug}</TableCell>
                  <TableCell>{organization.plan}</TableCell>
                  <TableCell>
                    <StatusBadge status={organization.status} />
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
