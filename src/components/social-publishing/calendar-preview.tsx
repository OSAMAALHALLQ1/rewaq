import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarDays, Clock, HelpCircle } from "lucide-react";
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

type CalendarPreviewProps = {
  posts: Post[];
};

export function RawaqContentCalendarPreview({ posts }: CalendarPreviewProps) {
  const scheduled = posts.filter(p => p.status === "scheduled");

  // Get Today's date string, Tomorrow's date string
  const todayStr = new Date().toISOString().split("T")[0];
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  // Categorize
  const todayPosts = scheduled.filter(p => p.scheduledAt && p.scheduledAt.startsWith(todayStr));
  const tomorrowPosts = scheduled.filter(p => p.scheduledAt && p.scheduledAt.startsWith(tomorrowStr));
  const thisWeekPosts = scheduled.filter(p => {
    if (!p.scheduledAt) return false;
    const dateStr = p.scheduledAt.split("T")[0];
    return dateStr !== todayStr && dateStr !== tomorrowStr && new Date(p.scheduledAt) <= endOfWeek;
  });

  const sections = [
    { title: "اليوم", posts: todayPosts, emptyMessage: "لا يوجد منشورات مجدولة اليوم للمطعم." },
    { title: "غدًا", posts: tomorrowPosts, emptyMessage: "لا يوجد منشورات مجدولة للغد." },
    { title: "هذا الأسبوع (مستقبلاً)", posts: thisWeekPosts, emptyMessage: "لا يوجد منشورات مجدولة لباقي أيام هذا الأسبوع." }
  ];

  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5 text-primary" />
          تقويم محتوى المطعم
        </CardTitle>
        <CardDescription>
          عرض المنشورات والعروض الترويجية المجدولة للأيام القادمة.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {sections.map((sec) => (
            <div key={sec.title} className="space-y-2.5">
              <h3 className="text-xs font-extrabold text-slate-400 bg-slate-100/50 w-fit px-2.5 py-1 rounded">
                {sec.title}
              </h3>
              
              {sec.posts.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-3 border border-slate-100 rounded-lg bg-slate-50/20">
                  {sec.emptyMessage}
                </p>
              ) : (
                <div className="space-y-2">
                  {sec.posts.map((post) => {
                    const timeStr = post.scheduledAt ? new Date(post.scheduledAt).toLocaleTimeString("ar-EG", {
                      hour: "2-digit",
                      minute: "2-digit"
                    }) : "";

                    return (
                      <div
                        key={post.id}
                        className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-slate-200 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-semibold text-sm text-slate-800 line-clamp-1">{post.title}</h4>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                            <Clock className="h-3 w-3" />
                            {timeStr}
                          </div>
                        </div>
                        
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {post.body}
                        </p>
                        
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[10px]">
                          <div className="flex flex-wrap gap-1.5">
                            {post.targets && post.targets.length > 0 ? (
                              post.targets.map((t) => (
                                <RawaqPlatformBadge key={t.platform} platform={t.platform} />
                              ))
                            ) : (
                              <span className="text-slate-400">بدون منصات</span>
                            )}
                          </div>
                          <RawaqStatusBadge status={post.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
