import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMarketingData } from "@/server/queries/app";

export default async function PublishingCalendarPage() {
  const { posts } = await getMarketingData();

  return (
    <>
      <PageHeader
        title="تقويم النشر"
        description="عرض المنشورات المجدولة والمنشورة حسب اليوم، مع إمكانية إضافة طابور نشر لاحقًا."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            مايو 2026
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-7">
            {Array.from({ length: 21 }).map((_, index) => {
              const day = index + 1;
              const dayPosts = posts.filter((post) => new Date(post.scheduledAt ?? post.createdAt).getDate() === day);
              return (
                <div key={day} className="min-h-28 rounded-lg border bg-white p-3">
                  <p className="text-sm font-semibold">{day}</p>
                  <div className="mt-2 space-y-2">
                    {dayPosts.map((post) => (
                      <div key={post.id} className="rounded-md bg-slate-50 p-2 text-xs">
                        <p className="line-clamp-1 font-medium">{post.title}</p>
                        <div className="mt-1">
                          <StatusBadge status={post.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
