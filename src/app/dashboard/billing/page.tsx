import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { PlanCard } from "@/components/billing/plan-card";
import { PlanComparison } from "@/components/billing/plan-comparison";
import { SubscriptionOverview } from "@/components/billing/subscription-overview";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  getOrganizationEntitlements,
  type OrganizationEntitlements,
} from "@/server/billing/entitlements";
import { getCurrentPlanCatalog } from "@/server/billing/plan-catalog";
import { withAdminScope } from "@/server/queries/_shared/utils";

async function loadSubscription(): Promise<OrganizationEntitlements | null> {
  try {
    return await withAdminScope<OrganizationEntitlements | null>(
      null,
      (admin, scope) => getOrganizationEntitlements(admin, scope.organizationId),
    );
  } catch (error) {
    console.error("[dashboard/billing]", error instanceof Error ? error.message : error);
    return null;
  }
}

export default async function BillingPage() {
  const [subscription, plans] = await Promise.all([
    loadSubscription(),
    getCurrentPlanCatalog(),
  ]);

  return (
    <>
      <PageHeader
        title="الفاتورة والاشتراك"
        description="راجع حالة اشتراك مؤسستك وحدود الباقة وقارن خيارات رواق المعتمدة."
        actions={
          <Button variant="outline" asChild>
            <Link href="/pricing">
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              صفحة الأسعار
            </Link>
          </Button>
        }
      />

      <SubscriptionOverview subscription={subscription} />

      <section className="mt-8" aria-labelledby="billing-plans-title">
        <div className="mb-5">
          <h2 id="billing-plans-title" className="text-2xl font-extrabold text-foreground">
            باقات رواق
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            يظهر طلب تغيير الباقة للباقات غير المفعّلة على مؤسستك.
          </p>
        </div>
        <div className="grid items-stretch gap-5 lg:grid-cols-3">
          {plans.map((plan) => {
            const current = subscription?.planCode === plan.code;
            return (
              <PlanCard
                key={plan.code}
                plan={plan}
                current={current}
                action={
                  current
                    ? undefined
                    : { href: "/request-demo", label: "طلب تغيير الباقة" }
                }
              />
            );
          })}
        </div>
      </section>

      <PlanComparison
        plans={plans}
        className="mt-10 pb-2"
        description="الوحدات المتاحة لكل باقة كما هي معتمدة في كتالوج رواق."
      />
    </>
  );
}
