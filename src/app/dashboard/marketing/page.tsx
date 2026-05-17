import Link from "next/link";
import { CalendarDays, FileText, Megaphone, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMarketingData } from "@/server/queries/app";

export default async function MarketingCenterPage() {
  const { accounts, posts, templates } = await getMarketingData();

  return (
    <>
      <PageHeader
        title="مركز التسويق"
        description="اكتب منشورًا واحدًا، خصصه لكل منصة، ثم انشره الآن أو جدوله. فشل منصة واحدة لا يفشل كل العملية."
        actions={
          <Button asChild>
            <Link href="/dashboard/marketing/create">
              <Plus className="h-4 w-4" />
              إنشاء منشور
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <Megaphone className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">منشورات</p>
            <p className="mt-2 text-2xl font-bold">{posts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <CalendarDays className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">مجدولة</p>
            <p className="mt-2 text-2xl font-bold">{posts.filter((post) => post.status === "scheduled").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <FileText className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">قوالب جاهزة</p>
            <p className="mt-2 text-2xl font-bold">{templates.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>آخر المنشورات</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العنوان</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>المنصات</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div className="font-semibold">{post.title}</div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{post.body}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={post.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {post.targets.map((target) => (
                          <Badge key={`${post.id}-${target.platform}`} tone={target.status === "failed" ? "danger" : "success"}>
                            {target.platform}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(post.createdAt).toLocaleDateString("ar-PS")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الحسابات والقوالب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold">الحسابات المرتبطة</h3>
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">{account.accountName}</span>
                    <StatusBadge status={account.status} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">قوالب سريعة</h3>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <Badge key={template.id} tone="muted">
                    {template.name}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
