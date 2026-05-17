import { CashierTerminal } from "@/components/sales/cashier-terminal";
import { PageHeader } from "@/components/page-header";
import { getCustomerInvoicesData } from "@/server/queries/app";

export default async function NewCustomerInvoicePage() {
  const { branches, menuItems, catalogItems, recipes, inventoryItems, branchStock, shift, organization } = await getCustomerInvoicesData();

  return (
    <>
      <PageHeader
        title="شاشة الكاشير"
        description="اختر أصناف الزبون من المنيو، عدل الكميات والخصم، ثم أصدر الفاتورة واطبعها مباشرة."
      />
      <CashierTerminal
        menuItems={menuItems}
        catalogItems={catalogItems}
        recipes={recipes}
        inventoryItems={inventoryItems}
        branchStock={branchStock}
        branches={branches}
        shift={shift}
        organization={organization}
      />
    </>
  );
}
