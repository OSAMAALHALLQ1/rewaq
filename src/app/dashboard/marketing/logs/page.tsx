import { Activity } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSocialPlatformLabel } from "@/lib/social/platforms";
import { getMarketingData } from "@/server/queries/app";
import { RetrySocialPostForm } from "@/components/marketing/retry-social-post-form";
import { retrySocialPostAction } from "@/server/actions/social";

export default async function PublishingLogsPage() {
  const { posts } = await getMarketingData();
  const rows = posts.flatMap((post: any) =>
    post.targets.map((target: any) => ({
      id: `${post.id}-${target.platform}`,
      postId: post.id,
      targetId: target.id,
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
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.postTitle}</TableCell>
                  <TableCell>{getSocialPlatformLabel(row.platform)}</TableCell>
                  <TableCell>{row.accountName}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>{row.error ?? "-"}</TableCell>
                  <TableCell>
                    {row.status === "failed" ? (
                      <RetrySocialPostForm
                        action={retrySocialPostAction}
                        postId={row.postId}
                        targetId={row.targetId}
                        label="إعادة هذه القناة"
                      />
                    ) : (
                      "-"
                    )}
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
