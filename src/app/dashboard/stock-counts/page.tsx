import { PageHeader } from "@/components/page-header";
import { StockCountWorkspace } from "@/components/inventory/stock-count-workspace";
import { getStockCountsData } from "@/server/queries/app";
import { todayLocal } from "@/lib/accounting/posting";
import { requireAuthOrRedirect } from "@/lib/auth/require-auth";

type Props = {
  searchParams: Promise<{ session?: string }>;
};

export default async function StockCountsPage({ searchParams }: Props) {
  const [data, auth, params] = await Promise.all([
    getStockCountsData(),
    requireAuthOrRedirect(),
    searchParams,
  ]);
  const canApprove = ["super_admin", "organization_owner", "branch_manager"].includes(auth.role);

  return (
    <>
      <PageHeader
        title="جلسات الجرد"
        description="لقطة ثابتة، عد أعمى، مراجعة وإعادة عد، اعتماد منفصل، ثم ترحيل ذري للمخزون والقيد المحاسبي."
      />
      <StockCountWorkspace
        branches={data.branches}
        categories={data.categories}
        counts={data.counts}
        selectedCountId={params.session}
        countedAt={todayLocal()}
        canApprove={canApprove}
      />
    </>
  );
}
