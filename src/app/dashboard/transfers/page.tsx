import { TransfersWorkspace } from "@/components/inventory/transfers-workspace";
import { PageHeader } from "@/components/page-header";
import { getOperationsData } from "@/server/queries/app";

export default async function TransfersPage() {
  const { transfers, branches, items } = await getOperationsData();

  return (
    <>
      <PageHeader
        title="التحويلات الداخلية"
        description="تحويل المواد بين الأقسام الداخلية مع حركة صادر للمرسل ووارد للمستقبل."
      />
      <TransfersWorkspace transfers={transfers} branches={branches} items={items} />
    </>
  );
}
