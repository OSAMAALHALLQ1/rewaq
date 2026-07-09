import Link from "next/link";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const plans = [
  {
    name: "البداية",
    price: "₪129",
    description: "لمطعم أو كافيه بفرع واحد يريد ضبط المخزون والتكلفة.",
    features: ["فرع واحد", "500 مادة مخزون", "موردون ومشتريات", "تقارير أساسية"],
  },
  {
    name: "النمو",
    price: "₪249",
    description: "للفرق التي تدير عدة فروع وتحتاج وصفات وتسويق.",
    features: ["حتى 5 فروع", "تكلفة الوصفات", "مركز التسويق", "صلاحيات مرنة", "تنبيهات داخلية"],
    highlighted: true,
  },
  {
    name: "التوسع",
    price: "₪499",
    description: "للمجموعات التي تحتاج توسعًا وصلاحيات وأتمتة.",
    features: ["فروع غير محدودة", "تقارير متقدمة", "Feature flags", "SLA دعم", "تكاملات مخصصة"],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Badge tone="default">باقات رواق</Badge>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">أسعار تناسب نمو مطعمك</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            كل الباقات تشمل عزل بيانات بين العملاء، واجهة عربية، وبنية قاعدة بيانات جاهزة للتشغيل.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              variant={plan.highlighted ? "dark" : plan.name === "التوسع" ? "light" : "default"}
              className={plan.highlighted ? "shadow-lift" : ""}
            >
              <CardContent className="p-6">
                {plan.highlighted ? <Badge className="mb-4 border-white/15 bg-white/10 text-accent">الأكثر طلبًا</Badge> : null}
                <h2 className="text-2xl font-extrabold">{plan.name}</h2>
                <p className={plan.highlighted ? "mt-2 min-h-14 text-sm leading-7 text-white/70" : "mt-2 min-h-14 text-sm leading-7 text-muted-foreground"}>{plan.description}</p>
                <div className="mt-6 flex items-end gap-2">
                  <span className="text-5xl font-black tabular-nums">{plan.price}</span>
                  <span className={plan.highlighted ? "pb-1 text-sm text-white/70" : "pb-1 text-sm text-muted-foreground"}>شهريًا</span>
                </div>
                <Button className="mt-6 w-full" variant={plan.highlighted ? "light" : "default"} asChild>
                  <Link href="/register">ابدأ بهذه الباقة</Link>
                </Button>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm font-bold">
                      <Check className={plan.highlighted ? "h-4 w-4 text-accent" : "h-4 w-4 text-primary"} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}