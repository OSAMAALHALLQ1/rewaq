import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarDays,
  ChefHat,
  Clock3,
  ClipboardCheck,
  Coffee,
  Megaphone,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  Utensils,
  WalletCards,
} from "lucide-react";
import {
  CategoryPieChart,
  FoodCostLineChart,
  PurchaseAreaChart,
  WasteBarChart,
} from "@/components/dashboard/charts";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getDashboardData } from "@/server/queries/app";
import type { StatusTone } from "@/types/domain";

const quickActions = [
  {
    title: "فاتورة جديدة",
    description: "بيع سريع وخصم مخزون تلقائي",
    href: "/dashboard/customer-invoices/new",
    icon: ReceiptText,
    className: "bg-teal-50 text-primary",
  },
  {
    title: "طلب شراء",
    description: "حوّل النقص إلى طلب للمورد",
    href: "/dashboard/purchase-orders",
    icon: ShoppingCart,
    className: "bg-orange-50 text-accent",
  },
  {
    title: "جرد سريع",
    description: "راجع الكميات قبل نهاية الوردية",
    href: "/dashboard/stock-counts",
    icon: ClipboardCheck,
    className: "bg-blue-50 text-blue-700",
  },
  {
    title: "منشور تسويقي",
    description: "انشر عرضًا على كل القنوات",
    href: "/dashboard/marketing/create",
    icon: Megaphone,
    className: "bg-violet-50 text-violet-700",
  },
];

const workAreas = [
  { title: "التشغيل", body: "المخزون، الجرد، الهدر، والتحويلات.", href: "/dashboard/inventory", icon: Boxes },
  { title: "المشتريات", body: "الموردون وطلبات الشراء والفواتير.", href: "/dashboard/purchase-orders", icon: Truck },
  { title: "المبيعات", body: "بيع سريع، طاولات، وفواتير العملاء.", href: "/dashboard/customer-invoices/new", icon: ReceiptText },
  { title: "القائمة", body: "الوصفات، تكلفة الطعام، وأطباق القائمة.", href: "/dashboard/recipes", icon: Utensils },
  { title: "التسويق", body: "منشور واحد لكل القنوات وتقويم واضح.", href: "/dashboard/marketing", icon: Megaphone },
  { title: "المدفوعات", body: "فواتير مستحقة وخصم مباشر.", href: "/dashboard/bill-payments", icon: WalletCards },
];

const businessDashboardModes = [
  { title: "كافيه حديث", body: "كاشير سريع، QR Menu، عروض يومية، ومخزون بسيط.", icon: Coffee },
  { title: "مطعم متوسط", body: "تكلفة وصفات، موردين، فواتير، ومحاسبة تشغيلية.", icon: Utensils },
  { title: "عدة فروع", body: "صلاحيات، توزيع مخزون، تقارير فروع، ومتابعة مركزية.", icon: Store },
];

const permissionModes = [
  ["المدير", "تحكم شامل: المستخدمون، الصلاحيات، الأسعار، التقارير، التكاملات، ومفاتيح التوزيع."],
  ["الكاشير", "بيع سريع، فتح/إغلاق وردية، طباعة فواتير، واسترجاع محدود حسب سماح المدير."],
  ["أمين المخزن", "استلام مشتريات، جرد، تحويلات، هدر، وحدود دنيا بدون الوصول لأرباح حساسة."],
];

const laborCostRows = [
  ["ستيك لحم", "8.00$", "20 دقيقة", "2.20$", "10.20$"],
  ["بطاطس مقلية", "0.50$", "3 دقائق", "0.33$", "0.83$"],
];

export default async function DashboardPage() {
  const data = await getDashboardData();
  const foodCostTone: StatusTone = data.foodCostPercent > 35 ? "danger" : "success";
  const dailyFocus = [
    {
      title: "مواد تحتاج شراء",
      value: `${data.lowStockCount} مواد`,
      body: "ابدأ من طلب شراء قبل نفاد المخزون.",
      href: "/dashboard/purchase-orders",
      icon: PackageSearch,
      tone: "warning" as const,
    },
    {
      title: "طلبات مفتوحة",
      value: `${data.openPurchaseOrders} طلبات`,
      body: "راجع ما ينتظر الإرسال أو الاستلام.",
      href: "/dashboard/purchase-orders",
      icon: ShoppingCart,
      tone: "default" as const,
    },
    {
      title: "تكلفة الطعام",
      value: formatPercent(data.foodCostPercent),
      body: data.foodCostPercent > 35 ? "تحتاج مراجعة أسعار أو كميات." : "ضمن النطاق المقبول اليوم.",
      href: "/dashboard/food-cost",
      icon: ChefHat,
      tone: foodCostTone,
    },
  ];

  return (
    <>
      <PageHeader
        title="اليوم في رواق"
        description="كل ما يحتاجه صاحب المطعم في شاشة واحدة: ما يستحق الانتباه، أين تبدأ، وكيف تصل بسرعة لكل جزء مهم."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/reports">التقارير</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/customer-invoices/new">بيع سريع</Link>
            </Button>
          </>
        }
      />

      <section className="mb-4 overflow-hidden rounded-lg border bg-slate-950 text-white shadow-sm">
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_420px] lg:p-6">
          <div>
            <Badge tone="success">جاهز للعمل</Badge>
            <h2 className="mt-4 text-2xl font-bold tracking-normal">ابدأ من المهم، واترك التفاصيل للصفحات المتخصصة.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
              الشاشة الرئيسية الآن تعرض قرار اليوم بدل أن تكون مجرد أرقام: بيع، شراء، جرد، نشر، أو مراجعة تكلفة.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group rounded-lg border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                  >
                    <span className={`grid h-10 w-10 place-items-center rounded-lg ${action.className}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="mt-3 block font-semibold">{action.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-300">{action.description}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-300">ملخص سريع</p>
                <p className="mt-1 text-3xl font-bold">{formatCurrency(data.salesEstimate)}</p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-white text-primary">
                <TrendingUp className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-xs text-slate-300">قيمة المخزون</p>
                <p className="mt-1 font-semibold">{formatCurrency(data.inventoryValue)}</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-xs text-slate-300">تنبيهات اليوم</p>
                <p className="mt-1 font-semibold">{data.alerts.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {dailyFocus.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <Badge tone={item.tone}>{item.value}</Badge>
                </div>
                <h2 className="mt-4 font-semibold">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
                <Link href={item.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  فتح الصفحة
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="مبيعات تقديرية"
          value={formatCurrency(data.salesEstimate)}
          description="+8% عن الأسبوع السابق"
          icon={TrendingUp}
          tone="success"
        />
        <MetricCard
          label="تكلفة المخزون"
          value={formatCurrency(data.inventoryValue)}
          description="كل الفروع"
          icon={Boxes}
        />
        <MetricCard
          label="مواد منخفضة"
          value={`${data.lowStockCount}`}
          description="تحتاج طلب شراء"
          icon={AlertTriangle}
          tone="warning"
        />
        <MetricCard
          label="طلبات مفتوحة"
          value={`${data.openPurchaseOrders}`}
          description="قيد الإرسال والاستلام"
          icon={ShoppingCart}
        />
      </div>

      <section className="mt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">وصول سريع لكل العمل</h2>
          <Link href="/dashboard/settings" className="text-sm font-semibold text-primary">
            تخصيص المنصة
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workAreas.map((area) => {
            const Icon = area.icon;

            return (
              <Link
                key={area.href}
                href={area.href}
                className="group rounded-lg border bg-white p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-teal-50 group-hover:text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{area.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">{area.body}</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              الداشبورد حسب نوع العمل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {businessDashboardModes.map((mode) => {
              const Icon = mode.icon;

              return (
                <div key={mode.title} className="flex gap-3 rounded-lg border bg-white p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{mode.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{mode.body}</p>
                  </div>
                </div>
              );
            })}
            <Link href="/dashboard/settings" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              تعديل بيانات النشاط
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              صلاحيات واضحة حسب الوظيفة
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {permissionModes.map(([title, body]) => (
              <div key={title} className="rounded-lg border bg-slate-50 p-4">
                <p className="font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-accent" />
              تكلفة وقت التشغيل والعمالة
            </CardTitle>
            <Badge tone="warning">2000$ ÷ 300 ساعة = 6.66$ للساعة</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg bg-slate-50 p-4 text-sm leading-7 text-muted-foreground">
              ليست كل الوجبات تستهلك نفس الجهد. رواق يحسب تكلفة المواد ثم يضيف تكلفة وقت التحضير:
              <span className="mt-2 block font-semibold text-foreground">
                تكلفة الدقيقة = تكلفة ساعة المطبخ ÷ 60
              </span>
              هذا يجعل تسعير الستيك مختلفًا عن البطاطس حتى لو ظهر الربح السطحي جيدًا.
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الصنف</TableHead>
                  <TableHead>المواد</TableHead>
                  <TableHead>الوقت</TableHead>
                  <TableHead>تكلفة الوقت</TableHead>
                  <TableHead>التكلفة الفعلية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laborCostRows.map((row) => (
                  <TableRow key={row[0]}>
                    {row.map((cell) => (
                      <TableCell key={cell} className={cell === row[0] ? "font-semibold" : undefined}>
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>تكلفة المشتريات خلال آخر 30 يوم</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseAreaChart data={data.purchaseCost30Days} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>مخزون حسب الفئة</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={data.inventoryByCategory} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>نسبة تكلفة الطعام</CardTitle>
              <Badge tone={foodCostTone}>{formatPercent(data.foodCostPercent)}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <FoodCostLineChart data={data.foodCostTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>الهدر حسب الفرع</CardTitle>
          </CardHeader>
          <CardContent>
            <WasteBarChart data={data.wasteByBranch} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              تنبيهات قابلة للتنفيذ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.alerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{alert.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.body}</p>
                  </div>
                  <StatusBadge status={alert.severity} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-primary" />
                وصفات تحتاج مراجعة
              </CardTitle>
              <Link href="/dashboard/recipes" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                الكل
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الوصفة</TableHead>
                  <TableHead>التصنيف</TableHead>
                  <TableHead>التكلفة</TableHead>
                  <TableHead>الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.highCostRecipes.map((recipe) => (
                  <TableRow key={recipe.id}>
                    <TableCell className="font-medium">{recipe.name}</TableCell>
                    <TableCell>{recipe.category}</TableCell>
                    <TableCell>{formatCurrency(recipe.totalCost)}</TableCell>
                    <TableCell>
                      <Badge tone={recipe.totalCost > 6 ? "warning" : "muted"}>راجع السعر</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 rounded-lg border bg-white p-4 text-sm text-muted-foreground">
        <CalendarDays className="h-5 w-5 text-primary" />
        <span>الخطوة التالية المنطقية تظهر حسب التنبيهات وحالة المخزون والتكلفة، لذلك لا يحتاج المستخدم فهمًا محاسبيًا مسبقًا.</span>
      </div>
    </>
  );
}
