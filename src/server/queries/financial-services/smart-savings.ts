import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isDemoMode, withAdminScope, type AppScope } from "@/server/queries/_shared/utils";

export type SmartSavingsReceipt = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  receiptUrl: string;
  status: "ready" | "sent" | "viewed";
  updatedAt: string;
};

export type SmartSavingsData = {
  salesInvoiceCount: number;
  receiptCount: number;
  viewedReceiptCount: number;
  shareCoveragePercent: number;
  viewRatePercent: number;
  receipts: SmartSavingsReceipt[];
};

type ReceiptQueryRow = {
  id: string;
  invoice_id: string;
  share_token: string;
  total: number | string | null;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
  customer_invoices:
    | { invoice_number: string; customer_name: string; branch_id: string }
    | Array<{ invoice_number: string; customer_name: string; branch_id: string }>
    | null;
};

const emptyData: SmartSavingsData = {
  salesInvoiceCount: 0,
  receiptCount: 0,
  viewedReceiptCount: 0,
  shareCoveragePercent: 0,
  viewRatePercent: 0,
  receipts: [],
};

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function invoiceRelation(row: ReceiptQueryRow) {
  return Array.isArray(row.customer_invoices) ? row.customer_invoices[0] : row.customer_invoices;
}

async function loadSmartSavingsData(admin: SupabaseClient, scope: AppScope): Promise<SmartSavingsData> {
  let invoiceCountQuery = admin
    .from("customer_invoices")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", scope.organizationId)
    .neq("status", "draft")
    .neq("status", "void");

  let receiptCountQuery = admin
    .from("digital_receipt_shares")
    .select("id, customer_invoices!inner(branch_id)", { count: "exact", head: true })
    .eq("organization_id", scope.organizationId);

  let viewedCountQuery = admin
    .from("digital_receipt_shares")
    .select("id, customer_invoices!inner(branch_id)", { count: "exact", head: true })
    .eq("organization_id", scope.organizationId)
    .eq("status", "viewed");

  let recentReceiptsQuery = admin
    .from("digital_receipt_shares")
    .select(`
      id,
      invoice_id,
      share_token,
      total,
      status,
      sent_at,
      viewed_at,
      created_at,
      customer_invoices!inner (
        invoice_number,
        customer_name,
        branch_id
      )
    `)
    .eq("organization_id", scope.organizationId);

  if (scope.branchId) {
    invoiceCountQuery = invoiceCountQuery.eq("branch_id", scope.branchId);
    receiptCountQuery = receiptCountQuery.eq("customer_invoices.branch_id", scope.branchId);
    viewedCountQuery = viewedCountQuery.eq("customer_invoices.branch_id", scope.branchId);
    recentReceiptsQuery = recentReceiptsQuery.eq("customer_invoices.branch_id", scope.branchId);
  }

  const [invoiceCountResult, receiptCountResult, viewedCountResult, recentReceiptsResult] = await Promise.all([
    invoiceCountQuery,
    receiptCountQuery,
    viewedCountQuery,
    recentReceiptsQuery.order("created_at", { ascending: false }).limit(50),
  ]);

  const firstError = [invoiceCountResult.error, receiptCountResult.error, viewedCountResult.error, recentReceiptsResult.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const salesInvoiceCount = invoiceCountResult.count ?? 0;
  const receiptCount = receiptCountResult.count ?? 0;
  const viewedReceiptCount = viewedCountResult.count ?? 0;
  const rows = (recentReceiptsResult.data ?? []) as unknown as ReceiptQueryRow[];

  return {
    salesInvoiceCount,
    receiptCount,
    viewedReceiptCount,
    shareCoveragePercent: percent(receiptCount, salesInvoiceCount),
    viewRatePercent: percent(viewedReceiptCount, receiptCount),
    receipts: rows.flatMap((row) => {
      const invoice = invoiceRelation(row);
      if (!invoice) return [];

      return [{
        id: row.id,
        invoiceId: row.invoice_id,
        invoiceNumber: invoice.invoice_number,
        customerName: invoice.customer_name,
        total: Number(row.total ?? 0),
        receiptUrl: `/r/${encodeURIComponent(row.share_token)}`,
        status: row.status === "viewed" || row.status === "sent" ? row.status : "ready",
        updatedAt: row.viewed_at ?? row.sent_at ?? row.created_at,
      }];
    }),
  };
}

export async function getSmartSavingsData(): Promise<SmartSavingsData> {
  if (isDemoMode()) return emptyData;

  return withAdminScope(emptyData, async (admin, scope) =>
    loadSmartSavingsData(admin as unknown as SupabaseClient, scope));
}
