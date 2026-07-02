import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

type Post = {
  status: string;
  createdAt: string;
  scheduledAt?: string | null;
};

export function RawaqSocialStatsCards({ posts = [] }: { posts: Post[] }) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const postsThisWeek = posts.filter(p => new Date(p.createdAt) >= oneWeekAgo).length;
  const pendingPosts = posts.filter(p => p.status === "scheduled" || p.status === "publishing").length;
  const successPosts = posts.filter(p => p.status === "published").length;
  const failedPosts = posts.filter(p => p.status === "failed").length;

  const stats = [
    {
      title: "منشورات هذا الأسبوع",
      value: postsThisWeek,
      icon: CalendarDays,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-50/50",
    },
    {
      title: "بانتظار النشر",
      value: pendingPosts,
      icon: Clock,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-50/50",
    },
    {
      title: "منشورات ناجحة",
      value: successPosts,
      icon: CheckCircle2,
      iconColor: "text-green-500",
      bgColor: "bg-green-50/50",
    },
    {
      title: "منشورات فشلت",
      value: failedPosts,
      icon: AlertTriangle,
      iconColor: "text-red-500",
      bgColor: "bg-red-50/50",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="overflow-hidden border-slate-100 shadow-sm transition hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-xl p-3 ${stat.bgColor}`}>
                <Icon className={`h-6 w-6 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">{stat.title}</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
