import { CashierTerminal } from "@/components/sales/cashier-terminal";
import { PageHeader } from "@/components/page-header";
import { getCustomerInvoicesData } from "@/server/queries/app";

export default async function NewCustomerInvoicePage() {
  const { branches, menuItems, catalogItems, recipes, inventoryItems, branchStock, shift, organization } = await getCustomerInvoicesData();

  return (
    <>
      <PageHeader
        title="شاشة الكاشير"
        description="بحث سريع، تبويبات عمل، وسلة بيع مختصرة. الكاشير لا يحتاج النزول بين قوائم طويلة لإنهاء الطلب."
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
