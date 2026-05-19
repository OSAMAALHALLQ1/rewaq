import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  ChefHat,
  Coffee,
  Megaphone,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingDown,
} from "lucide-react";
import { DashboardMockup } from "@/components/public/dashboard-mockup";
import { BusinessFitForm } from "@/components/public/business-fit-form";
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
  { title: "نشر العروض", description: "منشور واحد إلى القنوات الاجتماعية عبر Node-RED.", icon: Megaphone },
];

const businessProfiles = [
  ["مطعم صغير", "تشغيل سريع مثل Aronium مع مخزون مبسط وتنبيهات واضحة."],
  ["كافيه حديث", "لوحة Foodics-style: كاشير سريع، QR Menu، مخزون، وعروض يومية."],
  ["مطعم متوسط", "تشغيل + محاسبة: مبيعات، مشتريات، موردين، وتكلفة طبق."],
  ["عدة فروع", "صلاحيات، تقارير فرعية، توزيع مخزون، وطبقة محاسبة أقوى."],
];

const recommendationRows = [
  ["مطعم صغير", "Aronium-like", "أقل تعقيدًا، بيع سريع ومخزون أساسي"],
  ["كافيه حديث", "Foodics-like", "QR Menu، شاشة مطبخ، دليفري، وتقارير سهلة"],
  ["مطعم متوسط", "Foodics + محاسبة", "تشغيل يومي مع متابعة مشتريات وربحية"],
  ["مطعم كبير", "نظام مخصص + محاسبة", "فروع، موردين، رواتب، تقارير مالية"],
];

const faqs = [
  ["هل رواق مناسب لمطعم صغير؟", "نعم. يبدأ بفرع واحد ثم يتوسع للفروع والمطابخ السحابية."],
  ["هل التكاملات الاجتماعية حقيقية؟", "نعم، يمكن توجيه النشر إلى Node-RED webhook مفتوح المصدر ثم ربط القنوات من Node-RED."],
  ["هل البيانات معزولة بين العملاء؟", "نعم. بنية قاعدة البيانات تعتمد معرف المؤسسة وسياسات عزل لكل الجداول الأساسية."],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="relative isolate overflow-hidden bg-slate-950 text-white">
          <div className="pointer-events-none absolute inset-y-8 left-[-6rem] hidden w-[58rem] opacity-25 lg:block">
            <DashboardMockup />
          </div>
          <div className="relative mx-auto flex min-h-[70vh] flex-col justify-center px-4 py-8 sm:min-h-[76vh] sm:py-12 lg:px-6">
            <Badge tone="success" className="mb-4 w-fit sm:mb-5">
              منصة عربية للمطاعم والكافيهات
            </Badge>
            <h1 className="max-w-4xl text-3xl font-black leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
              رواق
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 sm:text-lg sm:leading-9 md:text-xl text-slate-200">
              لوحة عملية تجعل البيع، الشراء، المخزون، تكلفة الأطباق، ونشر العروض مفهومة من أول استخدام.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-3">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/dashboard" className="flex items-center justify-center gap-2">
                  فتح لوحة التجربة
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/request-demo">احجز عرضًا تجريبيًا</Link>
              </Button>
            </div>
            <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
              {([
                ["بيع سريع", ReceiptText, "/dashboard/customer-invoices/new"],
                ["طلب شراء", ShoppingCart, "/dashboard/purchase-orders"],
                ["نشر عبر Node-RED", Megaphone, "/dashboard/marketing/create"],
              ] as const).map(([item, Icon, href]) => (
                <Link
                  key={String(item)}
                  href={href}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                >
                  <Icon className="h-4 w-4 text-orange-300" />
                  {item}
                </Link>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-300">
              {["عزل البيانات", "متعدد العملاء", "قنوات اجتماعية متعددة"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-teal-300" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-white py-14">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:px-6">
            <div>
              <Badge tone="success">ابدأ حسب نوع نشاطك</Badge>
              <h2 className="mt-4 text-3xl font-bold">أجب عن 5 أسئلة، ورواق يرتب لك الداشبورد.</h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                ليس كل صاحب عمل يحتاج نفس الشاشة. الكافيه يريد سرعة كاشير وعروض، والمطعم المتوسط يحتاج تكلفة وموردين،
                وصاحب الفروع يحتاج صلاحيات وتوزيع عمل.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {businessProfiles.map(([title, body]) => (
                  <div key={title} className="rounded-lg border bg-slate-50 p-4">
                    <p className="font-semibold">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <BusinessFitForm />
          </div>
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
            {["مطاعم وجبات سريعة", "كافيهات", "مطابخ سحابية"].map((useCase, index) => {
              const Icon = index === 1 ? Coffee : index === 2 ? Store : Sparkles;

              return (
              <Card key={useCase}>
                <CardContent className="p-6">
                  <Icon className="mb-4 h-5 w-5 text-accent" />
                  <h3 className="font-semibold">{useCase}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    تحكم بالمخزون والتكاليف والتسويق اليومي من لوحة واحدة، مع صلاحيات تناسب الفريق.
                  </p>
                </CardContent>
              </Card>
              );
            })}
          </div>
        </section>

        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <div className="mb-8 max-w-3xl">
              <Badge tone="warning">مقارنة عملية لغزة</Badge>
              <h2 className="mt-4 text-3xl font-bold">رواق يأخذ أفضل فكرة من كل نظام، ثم يبسطها.</h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                الهدف ليس تقليد Foodics أو الأصيل أو Aronium، بل جعل اختيار الداشبورد مناسبًا لحجم العمل ومستوى المحاسبة.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {recommendationRows.map(([type, best, why]) => (
                <Card key={type}>
                  <CardContent className="grid gap-3 p-5 sm:grid-cols-[130px_1fr]">
                    <div>
                      <p className="text-sm text-muted-foreground">نوع العمل</p>
                      <p className="font-bold">{type}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-primary">{best}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{why}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
            <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold sm:text-3xl">باقات واضحة للنمو</h2>
                <p className="mt-1 text-sm text-muted-foreground sm:mt-2">ابدأ صغيرًا وتوسع عندما تصبح الفروع أكثر.</p>
              </div>
              <Link href="/pricing" className="text-sm font-semibold text-primary">
                تفاصيل الأسعار
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Starter", "₪129", "فرع واحد ومخزون وتقارير أساسية"],
                ["Growth", "₪249", "حتى 5 فروع، وصفات، وتسويق"],
                ["Scale", "₪499", "صلاحيات وأتمتة وتوسع متقدم"],
              ].map(([name, price, desc]) => (
                <Card key={name} className={name === "Growth" ? "border-primary shadow-lg" : ""}>
                  <CardContent className="p-4 sm:p-6">
                    <h3 className="text-lg font-bold sm:text-xl">{name}</h3>
                    <p className="mt-3 text-2xl font-black sm:mt-4 sm:text-3xl">{price}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-7">{desc}</p>
                    <Button className="mt-4 w-full sm:mt-6" variant={name === "Growth" ? "default" : "outline"} asChild>
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
              شغّل نسخة MVP محليًا، طبّق migrations على Supabase، وابدأ بتجربة مطعم إيوان.
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
