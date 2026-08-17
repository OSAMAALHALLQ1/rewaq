import { PageHeader } from "@/components/page-header";
import { PurchaseOrdersWorkspace } from "@/components/purchasing/purchase-orders-workspace";
import { todayLocal } from "@/lib/accounting/posting";
import { getPurchasingData } from "@/server/queries/purchasing";

export default async function PurchaseOrdersPage() {
  const { purchaseOrders, suppliers, branches, items } = await getPurchasingData();

  return (
    <>
      <PageHeader
        title="أوامر الشراء والاستلام"
        description="مسودة متعددة البنود، موافقة منفصلة، ثم فحص واستلام جزئي ذري للكميات المقبولة والمرفوضة."
      />
      <PurchaseOrdersWorkspace
        key={purchaseOrders.map((order) => order.id).join(":")}
        purchaseOrders={purchaseOrders}
        suppliers={suppliers}
        branches={branches}
        items={items}
        today={todayLocal()}
      />
    </>
  );
}
