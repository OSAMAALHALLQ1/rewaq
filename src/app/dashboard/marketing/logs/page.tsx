import { Activity } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMarketingData } from "@/server/queries/app";

export default async function PublishingLogsPage() {
  const { posts } = await getMarketingData();
  const rows = posts.flatMap((post) =>
    post.targets.map((target) => ({
      id: `${post.id}-${target.platform}`,
      postTitle: post.title,
      ...target,
      createdAt: post.createdAt,
    })),
  );

  return (
    <>
      <PageHeader
        title="سجلات النشر"
        description="كل منصة لها نتيجة مستقلة حتى لا يفشل النشر الكامل عند تعطل منصة واحدة."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Publishing Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنشور</TableHead>
                <TableHead>المنصة</TableHead>
                <TableHead>الحساب</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الخطأ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.postTitle}</TableCell>
                  <TableCell>{row.platform}</TableCell>
                  <TableCell>{row.accountName}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>{row.error ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
