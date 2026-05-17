import { WalletCards } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminData } from "@/server/queries/app";

export default async function AdminPlansPage() {
  const { plans } = await getAdminData();

  return (
    <>
      <PageHeader title="الخطط" description="إدارة خطط الاشتراك وحدود الاستخدام." />
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WalletCards className="h-5 w-5 text-primary" />
                {plan.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">{plan.price}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
