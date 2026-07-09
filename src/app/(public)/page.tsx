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
      <main className="overflow-hidden">
        <section className="mx-auto mt-4 max-w-7xl px-3 sm:px-4 lg:px-6">
          <div className="relative overflow-hidden rounded-[1.75rem] bg-secondary text-white shadow-lift">
            <div className="grid min-h-[calc(100vh-7rem)] items-center gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-10 lg:py-10">
              <div className="relative z-10">
                <Badge tone="default" className="mb-5 w-fit border-white/15 bg-white/10 text-accent">
                  منصة عربية للمطاعم والكافيهات
                </Badge>
                <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight text-accent sm:text-6xl lg:text-7xl">
                  رواق
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-9 text-white/78 sm:text-xl">
                  لوحة عملية تجعل البيع، الشراء، المخزون، تكلفة الأطباق، ونشر العروض مفهومة من أول استخدام.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button size="lg" asChild className="w-full sm:w-auto">
                    <Link href="/dashboard" className="flex items-center justify-center gap-2">
                      فتح لوحة التجربة
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="light" asChild className="w-full sm:w-auto">
                    <Link href="/request-demo">احجز عرضًا تجريبيًا</Link>
                  </Button>
                </div>

                <div className="mt-8 grid gap-2 sm:grid-cols-3">
                  {([
                    ["بيع سريع", ReceiptText, "/dashboard/customer-invoices/new"],
                    ["طلب شراء", ShoppingCart, "/dashboard/purchase-orders"],
                    ["نشر عبر Node-RED", Megaphone, "/dashboard/marketing/create"],
                  ] as const).map(([item, Icon, href]) => (
                    <Link
                      key={String(item)}
                      href={href}
                      className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      <Icon className="h-4 w-4 text-accent" />
                      {item}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="relative z-10">
                <DashboardMockup />
              </div>
            </div>

            <div className="border-t border-white/10 px-5 py-4 sm:px-8 lg:px-10">
              <div className="flex flex-wrap gap-3 text-sm font-bold text-white/75">
                {["عزل البيانات", "متعدد العملاء", "قنوات اجتماعية متعددة"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full bg-white/6 px-4 py-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <div className="grid gap-4 md:grid-cols-4">
            {problems.map((problem, index) => (
              <Card key={problem} variant={index === 1 ? "dark" : index === 2 ? "primary" : index === 3 ? "light" : "default"}>
                <CardContent className="flex min-h-36 flex-col justify-between p-5">
                  <TrendingDown className={index === 1 || index === 2 ? "h-5 w-5 text-accent" : "h-5 w-5 text-destructive"} />
                  <p className="text-sm font-bold leading-7 opacity-85">{problem}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 lg:grid-cols-[0.88fr_1.12fr] lg:px-6">
          <div className="flex flex-col justify-center">
            <Badge tone="default" className="w-fit">ابدأ حسب نوع نشاطك</Badge>
            <h2 className="mt-4 max-w-xl text-4xl font-black leading-tight tracking-tight">أجب عن 5 أسئلة، ورواق يرتب لك الداشبورد.</h2>
            <p className="mt-4 max-w-2xl leading-8 text-muted-foreground">
              ليس كل صاحب عمل يحتاج نفس الشاشة. الكافيه يريد سرعة كاشير وعروض، والمطعم المتوسط يحتاج تكلفة وموردين،
              وصاحب الفروع يحتاج صلاحيات وتوزيع عمل.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {businessProfiles.map(([title, body], index) => (
                <div key={title} className={index === 0 ? "rounded-3xl bg-secondary p-5 text-white" : "rounded-3xl border border-border bg-white p-5 shadow-soft"}>
                  <p className="font-extrabold">{title}</p>
                  <p className={index === 0 ? "mt-2 text-sm leading-6 text-white/70" : "mt-2 text-sm leading-6 text-muted-foreground"}>{body}</p>
                </div>
              ))}
            </div>
          </div>
          <BusinessFitForm />
        </section>

        <section id="features" className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <Badge tone="default">إدارة عمليات المطاعم</Badge>
                <h2 className="mt-4 text-4xl font-black tracking-tight">حل تشغيلي واضح، بدون تعقيد زائد.</h2>
                <p className="mt-3 leading-8 text-muted-foreground">
                  كل ميزة مصممة لتقليل العمل اليدوي وربط التكلفة اليومية بقرارات الشراء والتسويق.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map(({ title, description, icon: Icon }, index) => (
                <Card key={title} variant={index === 1 ? "dark" : index === 2 ? "primary" : index === 4 ? "light" : "default"}>
                  <CardHeader>
                    <div className={index === 1 || index === 2 ? "mb-3 grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white" : "mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary-light text-primary"}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle>{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={index === 1 || index === 2 ? "text-sm leading-7 text-white/72" : "text-sm leading-7 text-muted-foreground"}>{description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto my-16 max-w-7xl px-4 lg:px-6">
          <div className="rounded-[1.5rem] bg-secondary p-6 text-white shadow-lift sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
              <div>
                <Badge className="border-white/15 bg-white/10 text-accent">كيف يعمل؟</Badge>
                <h2 className="mt-4 text-4xl font-black tracking-tight">كيف يعمل؟</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                {["اربط الفروع والمستخدمين", "أدخل المواد والموردين", "احسب الوصفات والقائمة", "انشر العروض وتابع التقارير"].map(
                  (step, index) => (
                    <div key={step} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                      <span className="text-4xl font-black text-accent">{index + 1}</span>
                      <p className="mt-4 text-sm font-bold leading-7 text-white/78">{step}</p>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 lg:px-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {["مطاعم وجبات سريعة", "كافيهات", "مطابخ سحابية"].map((useCase, index) => {
              const Icon = index === 1 ? Coffee : index === 2 ? Store : Sparkles;

              return (
                <Card key={useCase} variant={index === 1 ? "light" : "default"}>
                  <CardContent className="p-6">
                    <Icon className="mb-4 h-5 w-5 text-primary" />
                    <h3 className="text-lg font-extrabold">{useCase}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      تحكم بالمخزون والتكاليف والتسويق اليومي من لوحة واحدة، مع صلاحيات تناسب الفريق.
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="bg-muted py-16">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <div className="mb-8 max-w-3xl">
              <Badge tone="default">مقارنة عملية لغزة</Badge>
              <h2 className="mt-4 text-4xl font-black tracking-tight">رواق يأخذ أفضل فكرة من كل نظام، ثم يبسطها.</h2>
              <p className="mt-3 leading-8 text-muted-foreground">
                الهدف ليس تقليد Foodics أو الأصيل أو Aronium، بل جعل اختيار الداشبورد مناسبًا لحجم العمل ومستوى المحاسبة.
              </p>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-border bg-white shadow-soft">
              {recommendationRows.map(([type, best, why], index) => (
                <div key={type} className="grid gap-3 border-b border-border p-5 last:border-b-0 md:grid-cols-[180px_1fr_44px] md:items-center">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">نوع العمل</p>
                    <p className="font-extrabold">{type}</p>
                  </div>
                  <div>
                    <p className="font-extrabold text-primary">{best}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{why}</p>
                  </div>
                  <span className={index === 1 ? "grid h-11 w-11 place-items-center rounded-full bg-secondary text-white" : "grid h-11 w-11 place-items-center rounded-full border border-dashed border-secondary/35 text-primary"}>
                    <ArrowLeft className="h-4 w-4" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
            <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tight">باقات واضحة للنمو</h2>
                <p className="mt-2 text-sm text-muted-foreground">ابدأ صغيرًا وتوسع عندما تصبح الفروع أكثر.</p>
              </div>
              <Link href="/pricing" className="rounded-full bg-primary-light px-4 py-2 text-sm font-extrabold text-primary">
                تفاصيل الأسعار
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Starter", "₪129", "فرع واحد ومخزون وتقارير أساسية"],
                ["Growth", "₪249", "حتى 5 فروع، وصفات، وتسويق"],
                ["Scale", "₪499", "صلاحيات وأتمتة وتوسع متقدم"],
              ].map(([name, price, desc]) => (
                <Card key={name} variant={name === "Growth" ? "dark" : name === "Scale" ? "light" : "default"}>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-extrabold">{name}</h3>
                    <p className="mt-4 text-4xl font-black tabular-nums">{price}</p>
                    <p className={name === "Growth" ? "mt-3 text-sm leading-7 text-white/70" : "mt-3 text-sm leading-7 text-muted-foreground"}>{desc}</p>
                    <Button className="mt-6 w-full" variant={name === "Growth" ? "light" : "default"} asChild>
                      <Link href="/register">اختيار الباقة</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-16 lg:px-6">
          <h2 className="text-center text-4xl font-black tracking-tight">أسئلة شائعة</h2>
          <div className="mt-8 space-y-3">
            {faqs.map(([question, answer]) => (
              <Card key={question}>
                <CardContent className="p-6">
                  <h3 className="font-extrabold">{question}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 lg:px-6">
          <div className="rounded-[1.5rem] bg-secondary px-6 py-10 text-white shadow-lift md:px-10">
            <h2 className="text-4xl font-black tracking-tight">جاهز ترى تكلفة الطبق قبل نهاية اليوم؟</h2>
            <p className="mt-3 max-w-2xl leading-8 text-white/75">
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