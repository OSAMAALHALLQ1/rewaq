import { getCustomerInvoicesData } from "@/server/queries/app";
import { CustomerInvoicesClient } from "@/components/dashboard/customer-invoices-client";

export default async function CustomerInvoicesPage() {
  const data = await getCustomerInvoicesData();

  return (
    <CustomerInvoicesClient
      invoices={data.invoices}
      branches={data.branches}
      catalogItems={data.catalogItems}
    />
  );
}
