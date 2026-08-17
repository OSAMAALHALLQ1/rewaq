import "server-only";

import { demoInvoices } from "@/lib/demo-data";
import type { Invoice } from "@/types/domain";
import { mapInvoice } from "@/server/queries/_shared/mappers";
import { indexBy, isDemoMode, numberValue, query, withAdminScope } from "@/server/queries/_shared/utils";

export type SupplierPaymentHistoryItem = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  supplierName: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string;
};

export type SupplierBillPaymentsData = {
  invoices: Invoice[];
  recentPayments: SupplierPaymentHistoryItem[];
};

const demoData: SupplierBillPaymentsData = { invoices: demoInvoices, recentPayments: [] };

/** Reads the real supplier AP subledger; payable_bills and bill batches are intentionally not used. */
export async function getSupplierBillPaymentsData(): Promise<SupplierBillPaymentsData> {
  if (isDemoMode()) return demoData;

  return withAdminScope(demoData, async (admin, scope) => {
    const [invoiceRows, supplierRows, branchRows, paymentRows] = await Promise.all([
      query(
        admin.from("invoices").select("*").eq("organization_id", scope.organizationId).neq("status", "void").order("due_date", { ascending: true }).limit(150),
        "supplier invoices for payment",
      ),
      query(admin.from("suppliers").select("*").eq("organization_id", scope.organizationId), "suppliers for payment"),
      query(admin.from("branches").select("*").eq("organization_id", scope.organizationId), "branches for payment"),
      query(
        admin.from("supplier_payments").select("*").eq("organization_id", scope.organizationId).order("payment_date", { ascending: false }).limit(20),
        "supplier payment history",
      ),
    ]);

    const supplierMap = indexBy(supplierRows, (row) => row.id);
    const branchMap = indexBy(branchRows, (row) => row.id);
    const invoiceMap = indexBy(invoiceRows, (row) => row.id);

    return {
      invoices: invoiceRows.map((row) => mapInvoice(row, supplierMap, branchMap)),
      recentPayments: paymentRows.map((payment) => {
        const invoice = invoiceMap.get(payment.invoice_id);
        const supplier = payment.supplier_id ? supplierMap.get(payment.supplier_id) : undefined;
        return {
          id: payment.id,
          invoiceId: payment.invoice_id,
          invoiceNumber: invoice?.invoice_number ?? payment.invoice_id.slice(0, 8),
          supplierName: supplier?.name ?? "مورد غير معروف",
          amount: numberValue(payment.amount),
          paymentMethod: payment.payment_method,
          paymentDate: payment.payment_date,
          reference: payment.reference ?? undefined,
        };
      }),
    };
  });
}

export function summarizeSupplierBills(invoices: Invoice[], today: string) {
  const openInvoices = invoices.filter((invoice) => invoice.status !== "void" && invoice.balanceDue > 0.001);
  return {
    openInvoices,
    outstandingTotal: openInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
    overdueCount: openInvoices.filter((invoice) => Boolean(invoice.dueDate && invoice.dueDate < today)).length,
    partialCount: openInvoices.filter((invoice) => invoice.paidAmount > 0.001).length,
  };
}
