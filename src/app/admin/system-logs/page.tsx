import { FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminData } from "@/server/queries/app";

export default async function SystemLogsPage() {
  const { logs } = await getAdminData();

  return (
    <>
      <PageHeader title="سجلات النظام" description="سجلات النظام المهمة للأدمن والتكاملات." />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            السجلات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المستوى</TableHead>
                <TableHead>الرسالة</TableHead>
                <TableHead>وقت الإنشاء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <StatusBadge status={log.level} />
                  </TableCell>
                  <TableCell>{log.message}</TableCell>
                  <TableCell>{log.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
