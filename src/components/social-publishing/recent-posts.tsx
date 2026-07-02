import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, FileText, Megaphone } from "lucide-react";
import { RawaqPlatformBadge, RawaqStatusBadge } from "./badges";

type Post = {
  id: string;
  title: string;
  body: string;
  status: string;
  scheduledAt?: string | null;
  createdAt: string;
  targets?: Array<{ platform: string }>;
};

type RecentPostsProps = {
  posts: Post[];
  onSelectPost: (post: Post) => void;
};

export function RawaqRecentPostsList({ posts, onSelectPost }: RecentPostsProps) {
  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-primary" />
            سجل المنشورات الأخير
          </CardTitle>
          <CardDescription>
            متابعة حالة المنشورات والعروض التي تم نشرها أو جدولتها مؤخرًا.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <FileText className="h-10 w-10 text-slate-300 mb-2" />
            <p className="text-sm">لا يوجد منشورات ترويجية للمطعم حالياً.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-full text-right" dir="rtl">
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="text-right font-bold text-slate-800">المنشور</TableHead>
                  <TableHead className="text-right font-bold text-slate-800">قنوات النشر</TableHead>
                  <TableHead className="text-right font-bold text-slate-800">تاريخ النشر / الجدولة</TableHead>
                  <TableHead className="text-right font-bold text-slate-800">الحالة</TableHead>
                  <TableHead className="text-left font-bold text-slate-800 pl-4">الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => {
                  const date = post.scheduledAt || post.createdAt;
                  const displayDate = new Date(date).toLocaleDateString("ar-EG", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  });

                  return (
                    <TableRow key={post.id} className="hover:bg-slate-50/40">
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-semibold text-slate-800">{post.title}</p>
                          <p className="text-xs text-slate-400 line-clamp-1 max-w-[280px] mt-0.5">
                            {post.body}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {post.targets && post.targets.length > 0 ? (
                            post.targets.map((t) => (
                              <RawaqPlatformBadge key={t.platform} platform={t.platform} />
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">لا يوجد</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {displayDate}
                      </TableCell>
                      <TableCell>
                        <RawaqStatusBadge status={post.status} />
                      </TableCell>
                      <TableCell className="text-left pl-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectPost(post)}
                          className="h-8 gap-1 text-xs text-slate-600 hover:text-primary"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          معاينة
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
