import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Layers3, ShieldCheck, WalletCards } from "lucide-react";
import { PlanCard } from "@/components/billing/plan-card";
import { PlanComparison } from "@/components/billing/plan-comparison";
import { SiteHeader } from "@/components/public/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REWAQ_MODULES, REWAQ_PLAN_LIST } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "باقات رواق وأسعار الاشتراك",
  description: "باقات شهرية واضحة لتشغيل المطاعم وإدارة المخزون والمحاسبة من رواق.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 pb-12 pt-14 text-center sm:pb-16 sm:pt-20 lg:px-6">
            <Badge tone="default">اشتراك شهري واضح بالدولار</Badge>
            <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-black leading-tight text-foreground sm:text-5xl">
              باقات رواق لإدارة المطاعم
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              ابدأ بالتشغيل اليومي، أضف إدارة المخزون والمشتريات عند النمو، أو افتح النظام
              الكامل بالمحاسبة والتسويق والأتمتة.
            </p>

            <dl className="mx-auto mt-8 grid max-w-3xl grid-cols-1 divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-x-reverse sm:divide-y-0">
              <div className="flex items-center justify-center gap-3 px-4 py-4">
                <WalletCards className="h-5 w-5 text-primary" aria-hidden="true" />
                <div className="text-right">
                  <dt className="text-xs text-muted-foreground">الباقات</dt>
                  <dd className="font-extrabold">{REWAQ_PLAN_LIST.length} خيارات واضحة</dd>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 px-4 py-4">
                <Layers3 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <div className="text-right">
                  <dt className="text-xs text-muted-foreground">الباقة المتكاملة</dt>
                  <dd className="font-extrabold">جميع الوحدات وعددها {REWAQ_MODULES.length}</dd>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 px-4 py-4">
                <ShieldCheck className="h-5 w-5 text-amber-600" aria-hidden="true" />
                <div className="text-right">
                  <dt className="text-xs text-muted-foreground">سعر البداية</dt>
                  <dd className="font-extrabold" dir="ltr">
                    150 USD / month
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        </section>

        <section
          className="mx-auto max-w-7xl px-4 py-12 sm:py-16 lg:px-6"
          aria-labelledby="plans-title"
        >
          <div className="mb-7">
            <h2 id="plans-title" className="text-2xl font-extrabold text-foreground sm:text-3xl">
              اختر الباقة المناسبة لمرحلتك
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              الأسعار والحدود والمزايا أدناه هي كتالوج رواق المعتمد.
            </p>
          </div>
          <div className="grid items-stretch gap-5 lg:grid-cols-3">
            {REWAQ_PLAN_LIST.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                action={{ href: "/register", label: "ابدأ طلب الحساب" }}
              />
            ))}
          </div>
        </section>

        <PlanComparison className="mx-auto max-w-7xl px-4 pb-16 lg:px-6" />

        <section className="border-t border-border bg-secondary text-secondary-foreground">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div>
              <h2 className="text-2xl font-extrabold">تحتاج مساعدة في اختيار الباقة؟</h2>
              <p className="mt-1 text-sm leading-6 text-secondary-foreground/70">
                شاركنا عدد الفروع والأجهزة ودورة العمل المطلوبة لنرشح لك البداية الأنسب.
              </p>
            </div>
            <Button variant="light" asChild>
              <Link href="/request-demo">
                اطلب عرضًا مخصصًا
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
