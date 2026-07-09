"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const dashboardCopy = {
  cafe: {
    title: "لوحة كافيه حديث",
    body: "كاشير سريع، QR Menu، عروض يومية، مخزون مختصر، وتقارير سهلة للموظفين.",
  },
  small_restaurant: {
    title: "لوحة مطعم صغير",
    body: "بيع سريع، مواد منخفضة، مشتريات بسيطة، ووصفات بدون تعقيد محاسبي.",
  },
  restaurant: {
    title: "لوحة مطعم متوسط",
    body: "Foodics-style للتشغيل اليومي مع طبقة محاسبة: موردين، فواتير، تكلفة طبق، وربحية.",
  },
  chain: {
    title: "لوحة فروع ومحاسبة",
    body: "صلاحيات دقيقة، توزيع مخزون، تقارير فروع، ومحاسبة أثقل شبيهة باحتياج Golden Asseal.",
  },
  other: {
    title: "لوحة عمل مرنة",
    body: "مبيعات، مخزون، فريق، وتسويق حسب احتياج النشاط وليس حسب قالب مطاعم فقط.",
  },
};

export function BusinessFitForm() {
  const [businessType, setBusinessType] = useState<keyof typeof dashboardCopy>("cafe");
  const [branches, setBranches] = useState("1");
  const [priority, setPriority] = useState("pos");

  const recommendation = useMemo(() => {
    const branchCount = Number(branches || 1);

    if (branchCount > 3) {
      return dashboardCopy.chain;
    }

    if (priority === "accounting") {
      return {
        title: "لوحة تشغيل + محاسبة",
        body: "مناسبة للمشتريات الكثيرة، الموردين، الديون، الرواتب، وتقارير مالية رسمية.",
      };
    }

    return dashboardCopy[businessType];
  }, [branches, businessType, priority]);

  const fieldClass = "h-11 w-full rounded-2xl border border-transparent bg-muted px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <Card className="border-primary-light">
      <CardHeader>
        <CardTitle>تعبئة بيانات النشاط</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-sm font-bold">
            نوع النشاط
            <select
              className={fieldClass}
              value={businessType}
              onChange={(event) => setBusinessType(event.target.value as keyof typeof dashboardCopy)}
            >
              <option value="cafe">كافيه حديث</option>
              <option value="small_restaurant">مطعم صغير</option>
              <option value="restaurant">مطعم متوسط</option>
              <option value="chain">سلسلة فروع</option>
              <option value="other">متجر/عمل آخر</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-bold">
            عدد الفروع
            <input
              className={fieldClass}
              inputMode="numeric"
              min="1"
              value={branches}
              onChange={(event) => setBranches(event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm font-bold">
            متوسط الطلبات اليومي
            <input className={fieldClass} placeholder="مثال: 120" inputMode="numeric" />
          </label>
          <label className="space-y-2 text-sm font-bold">
            أهم احتياج
            <select className={fieldClass} value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="pos">كاشير سريع</option>
              <option value="accounting">محاسبة وموردين</option>
              <option value="inventory">مخزون وتكاليف</option>
              <option value="marketing">تسويق وجدولة نشر</option>
            </select>
          </label>
        </div>
        <div className="mt-4 rounded-3xl bg-primary-light p-4 text-sm leading-7 text-primary-light-foreground">
          <p className="font-extrabold">{recommendation.title}</p>
          <p className="mt-1">{recommendation.body}</p>
        </div>
        <Button className="mt-4 w-full" asChild>
          <Link href="/dashboard">عرض الداشبورد المناسب</Link>
        </Button>
      </CardContent>
    </Card>
  );
}