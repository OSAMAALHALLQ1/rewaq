import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  ChefHat,
  Megaphone,
  PackageSearch,
  ShoppingCart,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { DashboardMockup } from "@/components/public/dashboard-mockup";
import { SiteHeader } from "@/components/public/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const problems = [
  "هدر يومي لا يظهر في الحسابات إلا متأخرًا",
  "أسعار موردين تتغير بدون إنذار واضح",
  "صعوبة معرفة تكلفة الطبق الفعلية",
  "جرد يدوي يستهلك وقت الفريق",
];

const features = [
  { title: "إدارة المخزون", description: "حركات مخزون دقيقة، حدود دنيا، وجرد حسب الفرع.", icon: PackageSearch },
  { title: "تكلفة الوصفات", description: "حساب مباشر لتكلفة المكونات والربحية.", icon: ChefHat },
  { title: "المشتريات والموردين", description: "طلبات شراء، فواتير، وسجل أسعار الموردين.", icon: ShoppingCart },
  { title: "تقارير الربحية", description: "تكلفة الطعام، الهدر، المقارنات، وقيمة المخزون.", icon: BarChart3 },
  { title: "إدارة الفروع", description: "صلاحيات وبيانات منفصلة لكل فرع.", icon: Building2 },
  { title: "نشر العروض", description: "منشور واحد إلى فيسبوك وإنستغرام وتلغرام.", icon: Megaphone },
];

const faqs = [
  ["هل رواق مناسب لمطعم صغير؟", "نعم. يبدأ بفرع واحد ثم يتوسع للفروع والمطابخ السحابية."],
  ["هل التكاملات الاجتماعية حقيقية؟", "في النسخة الحالية توجد طبقة نشر تجريبية جاهزة، مع خطة واضحة للربط الحقيقي."],
  ["هل البيانات معزولة بين العملاء؟", "نعم. بنية قاعدة البيانات تعتمد معرف المؤسسة وسياسات عزل لكل الجداول الأساسية."],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:px-6">
          <div>
            <Badge tone="default" className="mb-5">
              منصة عربية للمطاعم والكافيهات
            </Badge>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-slate-950 md:text-6xl">
              منصة واحدة لإدارة مخزون مطعمك، حساب تكلفة أطباقك، وتقليل الهدر وزيادة المبيعات.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-9 text-slate-600">
              رواق يجمع العمليات اليومية، المشتريات، الوصفات، التقارير، ومركز التسويق في واجهة عربية
              سهلة لأصحاب المطاعم ومديري الفروع.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/register" className="flex items-center gap-2">
                  ابدأ تجربة عملية
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/request-demo">احجز عرضًا تجريبيًا</Link>
              </Button>
            </div>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              {["عزل البيانات", "متعدد العملاء", "نشر تجريبي"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <DashboardMockup />
        </section>

        <section className="border-y border-border bg-white py-16">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <div className="grid gap-4 md:grid-cols-4">
              {problems.map((problem) => (
                <Card key={problem}>
                  <CardContent className="p-5">
                    <TrendingDown className="mb-4 h-5 w-5 text-destructive" />
                    <p className="text-sm leading-7 text-slate-700">{problem}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
          <div className="mb-8 max-w-2xl">
            <Badge tone="warning">إدارة عمليات المطاعم</Badge>
            <h2 className="mt-4 text-3xl font-bold">حل تشغيلي واضح، بدون تعقيد زائد.</h2>
            <p className="mt-3 text-slate-600">
              كل ميزة مصممة لتقليل العمل اليدوي وربط التكلفة اليومية بقرارات الشراء والتسويق.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <Card key={title}>
                <CardHeader>
                  <div className="mb-3 grid h-11 w-11 place-items-center rounded-lg bg-teal-50 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="workflow" className="bg-slate-950 py-16 text-white">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <h2 className="text-3xl font-bold">كيف يعمل؟</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {["اربط الفروع والمستخدمين", "أدخل المواد والموردين", "احسب الوصفات والقائمة", "انشر العروض وتابع التقارير"].map(
                (step, index) => (
                  <div key={step} className="rounded-lg border border-white/10 bg-white/5 p-5">
                    <span className="text-3xl font-black text-orange-300">{index + 1}</span>
                    <p className="mt-4 leading-7 text-slate-200">{step}</p>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {["مطاعم وجبات سريعة", "كافيهات", "مطابخ سحابية"].map((useCase) => (
              <Card key={useCase}>
                <CardContent className="p-6">
                  <Sparkles className="mb-4 h-5 w-5 text-accent" />
                  <h3 className="font-semibold">{useCase}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    تحكم بالمخزون والتكاليف والتسويق اليومي من لوحة واحدة، مع صلاحيات تناسب الفريق.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold">باقات واضحة للنمو</h2>
                <p className="mt-2 text-muted-foreground">ابدأ صغيرًا وتوسع عندما تصبح الفروع أكثر.</p>
              </div>
              <Link href="/pricing" className="text-sm font-semibold text-primary">
                تفاصيل الأسعار
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["Starter", "₪129", "فرع واحد ومخزون وتقارير أساسية"],
                ["Growth", "₪249", "حتى 5 فروع، وصفات، وتسويق"],
                ["Scale", "₪499", "صلاحيات وأتمتة وتوسع متقدم"],
              ].map(([name, price, desc]) => (
                <Card key={name} className={name === "Growth" ? "border-primary shadow-lg" : ""}>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold">{name}</h3>
                    <p className="mt-4 text-3xl font-black">{price}</p>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{desc}</p>
                    <Button className="mt-6 w-full" variant={name === "Growth" ? "default" : "outline"} asChild>
                      <Link href="/register">اختيار الباقة</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-16 lg:px-6">
          <h2 className="text-center text-3xl font-bold">أسئلة شائعة</h2>
          <div className="mt-8 space-y-3">
            {faqs.map(([question, answer]) => (
              <Card key={question}>
                <CardContent className="p-5">
                  <h3 className="font-semibold">{question}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 lg:px-6">
          <div className="rounded-lg bg-primary px-6 py-10 text-white md:px-10">
            <h2 className="text-3xl font-bold">جاهز ترى تكلفة الطبق قبل نهاية اليوم؟</h2>
            <p className="mt-3 max-w-2xl text-teal-50">
              شغّل نسخة MVP محليًا، طبّق migrations على Supabase، وابدأ بتجربة مطعم التايلندي.
            </p>
            <Button className="mt-6 bg-white text-primary hover:bg-slate-100" asChild>
              <Link href="/dashboard">فتح لوحة التجربة</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
