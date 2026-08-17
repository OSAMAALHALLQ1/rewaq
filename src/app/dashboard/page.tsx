import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  ChefHat,
  Globe2,
  Layers3,
  Settings,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleHomePath } from "@/lib/auth/route-access";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getRewaqPlan,
  type RewaqModule,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import {
  getOrganizationEntitlements,
  type OrganizationEntitlements,
} from "@/server/billing/entitlements";
import {
  getAccountingDashboardData,
  type AccountingDashboardData,
} from "@/server/queries/accounting-erp";
import { getOrganizationContext } from "@/server/queries/app";
import { withAdminScope } from "@/server/queries/_shared/utils";

type ManagementLink = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  module: RewaqModule;
};

const MANAGEMENT_LINKS: readonly ManagementLink[] = [
  {
    title: "التقارير والتحليلات",
    description: "تابع مؤشرات المطعم والتشغيل من مكان واحد.",
    href: "/dashboard/reports",
    icon: BarChart3,
    module: "reports",
  },
  {
    title: "الربحية",
    description: "راجع قائمة الأرباح والخسائر دون ازدحام القيود التشغيلية.",
    href: "/dashboard/accounting/p-and-l",
    icon: TrendingUp,
    module: "accounting",
  },
  {
    title: "تكلفة الطعام",
    description: "راقب تكلفة الوصفات وهوامش الأطباق.",
    href: "/dashboard/food-cost",
    icon: ChefHat,
    module: "recipes",
  },
  {
    title: "المنيو والموقع",
    description: "حدّث حضور المطعم الرقمي من بيانات القائمة نفسها.",
    href: "/dashboard/digital-presence",
    icon: Globe2,
    module: "digital_presence",
  },
  {
    title: "الأقسام",
    description: "راجع أقسام المؤسسة وحالتها التشغيلية.",
    href: "/dashboard/branches",
    icon: Building2,
    module: "administration",
  },
  {
    title: "المستخدمون والفريق",
    description: "أدر أعضاء الفريق وأدوارهم الوظيفية.",
    href: "/dashboard/settings/users",
    icon: Users,
    module: "administration",
  },
  {
    title: "الإعدادات العامة",
    description: "اضبط بيانات المؤسسة والأجهزة والاختصارات.",
    href: "/dashboard/settings",
    icon: Settings,
    module: "administration",
  },
] as const;

function money(value: number) {
  return `${value.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ₪`;
}

function MetricCard({
  title,
  value,
  description,
  tone = "default",
}: {
  title: string;
  value: string;
  description: string;
  tone?: "default" | "profit";
}) {
  return (
    <Card className={cn(tone === "profit" && "border-emerald-200 bg-emerald-50/45")}>
      <CardContent className="p-5">
        <p className="text-xs font-bold text-muted-foreground">{title}</p>
        <p
          className={cn(
            "mt-2 text-2xl font-black tabular-nums text-foreground",
            tone === "profit" && "text-emerald-800",
          )}
        >
          {value}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await getCurrentSession();
  const homePath = roleHomePath(session.role);

  // Operational roles land directly in the workspace assigned to them. This
  // is repeated here in addition to the layout guard so a direct request to
  // the generic dashboard never loads management or financial data first.
  if (homePath !== "/dashboard") {
    redirect(homePath);
  }

  const entitlements = await withAdminScope<OrganizationEntitlements | null>(
    null,
    (admin, scope) => getOrganizationEntitlements(admin, scope.organizationId),
  );

  if (!entitlements || !entitlements.selected) {
    throw new Error("تعذر التحقق من باقة المؤسسة، لذلك لم تُحمّل بيانات لوحة الإدارة.");
  }

  const plan = getRewaqPlan(entitlements.planCode);
  const canSeeFinancials =
    (session.role === "organization_owner" || session.role === "super_admin") &&
    entitlements.modules.includes("accounting");

  const [context, financials] = await Promise.all([
    getOrganizationContext(),
    canSeeFinancials
      ? getAccountingDashboardData()
      : Promise.resolve<AccountingDashboardData | null>(null),
  ]);

  const isOwner = session.role === "organization_owner" || session.role === "super_admin";
  const links = MANAGEMENT_LINKS.filter(
    (link) =>
      entitlements.modules.includes(link.module) &&
      (isOwner || (link.module !== "accounting" && link.module !== "recipes")),
  );

  return (
    <>
      <PageHeader
        title="لوحة إدارة المطعم"
        description="ملخص إداري هادئ للأقسام والفريق والأداء، مع إظهار الأدوات التي تسمح بها باقتك فقط."
        actions={
          isOwner ? (
            <>
              <Button asChild variant="outline">
                <Link href="/dashboard/settings/users">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  إدارة الفريق
                </Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard/settings">
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  الإعدادات
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="ملخص المؤسسة">
        <MetricCard
          title="الباقة الحالية"
          value={plan.shortName}
          description={`${entitlements.modules.length.toLocaleString("ar-EG")} وحدة متاحة حسب الاشتراك الحالي`}
        />
        <MetricCard
          title="الأقسام"
          value={context.branches.length.toLocaleString("ar-EG")}
          description="الأقسام المرتبطة بالمؤسسة ضمن نطاق حسابك"
        />
        <MetricCard
          title="وحدات الإدارة المتاحة"
          value={links.length.toLocaleString("ar-EG")}
          description="روابط إدارية يجيزها الدور والباقة معًا"
        />
      </section>

      {financials ? (
        <section className="mb-7" aria-labelledby="profitability-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="profitability-title" className="text-lg font-extrabold text-foreground">
                نظرة الربحية
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ملخص إداري من القيود المرحّلة دون عرض تفاصيل دفتر اليومية.
              </p>
            </div>
            <Badge tone="success">مشمولة في الباقة</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="مبيعات الشهر"
              value={money(financials.monthSales)}
              description="إجمالي الإيرادات المسجلة خلال الشهر"
            />
            <MetricCard
              title="صافي ربح الشهر"
              value={money(financials.monthNetProfit)}
              description="بعد تكلفة البضاعة والمصروفات"
              tone="profit"
            />
            <MetricCard
              title="السيولة"
              value={money(financials.cashBalance + financials.bankBalance)}
              description="النقدية وأرصدة البنوك"
            />
            <MetricCard
              title="قيمة المخزون"
              value={money(financials.inventoryValue)}
              description="القيمة الدفترية الحالية للمخزون"
            />
          </div>
        </section>
      ) : isOwner ? (
        <Card className="mb-7 border-dashed" role="status">
          <CardContent className="flex items-start gap-3 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <WalletCards className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-extrabold text-foreground">الربحية التفصيلية غير مشمولة حاليًا</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                تظل بيانات المحاسبة مخفية لأن باقة {plan.shortName} لا تشمل وحدة المحاسبة.
                يمكنك مراجعة الوحدات المتاحة من صفحة الفوترة.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="management-tools-title">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 id="management-tools-title" className="text-lg font-extrabold text-foreground">
              أدوات الإدارة المتاحة
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              تظهر هنا الأدوات التي يسمح بها اشتراك المؤسسة فقط.
            </p>
          </div>
          {isOwner ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/billing">
                مراجعة الباقة
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-light text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-extrabold text-foreground">{link.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{link.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <Card className="mt-6 bg-muted/35">
        <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
          <Layers3 className="h-5 w-5 text-primary" aria-hidden="true" />
          <CardTitle className="text-base">حدود العرض</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          تُخفى الوحدات غير المسموحة من القائمة، ويعيد الخادم التحقق من الدور والباقة عند فتح
          أي مسار أو تنفيذ عملية.
        </CardContent>
      </Card>
    </>
  );
}
