/**
 * Admin domain queries
 * Handles organization management, users, plans, and system-level data
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import {
  demoOrganization,
  demoBranches,
  demoSystemLogs,
  demoSmartSavingsFeatures,
  demoDigitalReceiptShares,
  demoPermissionSettings,
  demoPayableBills,
  demoBillPaymentBatches,
  demoDirectDebitMandates,
  demoDirectDebitRuns,
  demoCostTracking,
  demoRestaurantTables,
  demoFinancialCalendar,
  demoWasteLogs,
  demoTransfers,
  demoInventoryItems,
  demoCatalogItems,
  demoCategories,
  demoStockMovements,
  demoPurchaseOrders,
  demoSuppliers,
} from "@/lib/demo-data";
import {
  isDemoMode,
  withAdminScope,
  query,
  indexBy,
  numberValue,
  oneOf,
  type AdminClient,
} from "./_shared/utils";
import {
  mapSupplier,
  mapStockMovement,
  mapPurchaseOrder,
} from "./_shared/mappers";

import type {
  BillPaymentBatch,
  CostTrackingData,
  DigitalReceiptShare,
  DirectDebitMandate,
  DirectDebitRun,
  CatalogItem,
  InventoryItem,
  InventoryCategory,
  FinancialCalendarDay,
  PermissionSetting,
  PayableBill,
  PurchaseOrder,
  RestaurantTable,
  Role,
  SmartSavingsFeature,
  StockMovement,
  Supplier,
  Transfer,
  WasteLog,
} from "@/types/domain";

type LooseRow = Record<string, any>;
const systemLogs = demoSystemLogs as SystemLog[];

// ============================================================================
// Types
// ============================================================================

export type AdminBundle = {
  metrics: AdminMetric[];
  organizations: Array<typeof demoOrganization>;
  organization: typeof demoOrganization;
  branches: typeof demoBranches;
  users: AdminUser[];
  plans: AdminPlan[];
  flags: FeatureFlag[];
  logs: SystemLog[];
  tickets: SupportTicket[];
};

export type AdminMetric = {
  label: string;
  value: string;
  delta?: string;
  tone?: "success" | "warning" | "danger" | "default";
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type AdminPlan = {
  id: string;
  name: string;
  price: string;
  features: string[];
};

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  description: string;
};

export type SystemLog = {
  id: string;
  level: "info" | "warning" | "error";
  message: string;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  organization: string;
  subject: string;
  status: "open" | "pending" | "closed";
  priority: "high" | "normal" | "low";
};

export type AccountApprovalRequest = {
  id: string;
  email: string;
  authUserId: string | null;
  authEmailConfirmed: boolean;
  authLastSignInAt: string | null;
  organizationId: string | null;
  ownerName: string;
  organizationName: string;
  businessType: string;
  phone: string | null;
  status: string;
  requestedAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
};

// ============================================================================
// Loaders
// ============================================================================

async function loadAdminBundle(admin: AdminClient) {
  const [organizationRows, membershipRows, profileRows, planRows, flagRows, logRows, ticketRows, approvalRows] =
    await Promise.all([
      query<LooseRow[]>(admin.from("organizations").select("*").order("created_at", { ascending: false }).limit(100), "organizations"),
      query<LooseRow[]>(admin.from("organization_memberships").select("*").order("created_at", { ascending: false }).limit(500), "organization_memberships"),
      query<LooseRow[]>(admin.from("profiles").select("*").limit(500), "profiles"),
      query<LooseRow[]>(admin.from("plans").select("*").order("monthly_price", { ascending: true }), "plans"),
      query<LooseRow[]>((admin as any).from("feature_flags").select("*").order("key"), "feature_flags"),
      query<LooseRow[]>((admin as any).from("system_logs").select("*").order("created_at", { ascending: false }).limit(100), "system_logs"),
      query<LooseRow[]>((admin as any).from("support_tickets").select("*").order("created_at", { ascending: false }).limit(100), "support_tickets"),
      query<LooseRow[]>(admin.from("account_approval_requests").select("*").limit(200), "account_approval_requests"),
    ]);

  const profileMap = indexBy(profileRows, (row) => row.id);
  const organizationMap = indexBy(organizationRows, (row) => row.id);
  const authUsers = await admin.auth.admin.listUsers().catch(() => null);
  const emailByUserId = new Map((authUsers?.data.users ?? []).map((user) => [user.id, user.email ?? user.id]));
  const activeOrganizations = organizationRows.filter((organization: any) => organization.status === "active").length;
  const openTickets = ticketRows.filter((ticket: any) => ticket.status !== "closed").length;

  const metrics: AdminMetric[] = [
    { label: "المؤسسات", value: String(organizationRows.length), delta: `${activeOrganizations} نشطة`, tone: "default" },
    { label: "طلبات اعتماد", value: String(approvalRows.filter((request: any) => request.status !== "approved").length), delta: "بانتظار المراجعة", tone: "warning" },
    { label: "المستخدمون", value: String(membershipRows.length), delta: "عضويات مسجلة", tone: "success" },
    { label: "تذاكر مفتوحة", value: String(openTickets), delta: "دعم العملاء", tone: openTickets > 0 ? "warning" : "success" },
  ];

  return {
    metrics,
    organizations: organizationRows.map((organization: any) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
      status: organization.status,
    })),
    organization: demoOrganization,
    branches: demoBranches,
    users: membershipRows.map((membership: any) => {
      const profile = profileMap.get(membership.user_id);
      return {
        id: membership.user_id,
        name: profile?.full_name ?? emailByUserId.get(membership.user_id) ?? "مستخدم",
        email: emailByUserId.get(membership.user_id) ?? membership.user_id,
        role: membership.role as Role,
      };
    }),
    plans: planRows.map((plan: any) => ({
      id: plan.code,
      name: plan.name,
      price: `₪${numberValue(plan.monthly_price)}`,
      features: Array.isArray(plan.features) ? plan.features.map(String) : [],
    })),
    flags: flagRows.map((flag: any) => ({
      key: flag.key,
      enabled: flag.enabled,
      description: flag.description ?? "",
    })),
    logs: logRows.map((log: any) => ({
      id: log.id,
      level: oneOf(log.level, ["info", "warning", "error"] as const, "info"),
      message: log.message,
      createdAt: log.created_at,
    })),
    tickets: ticketRows.map((ticket: any) => ({
      id: ticket.id,
      organization: ticket.organization_id ? organizationMap.get(ticket.organization_id)?.name ?? "مؤسسة غير معروفة" : "عام",
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
    })),
  };
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Get admin dashboard data
 */
export async function getAdminData(): Promise<AdminBundle> {
  if (isDemoMode()) {
    return {
      metrics: [
        { label: "المؤسسات", value: "24", delta: "+3 هذا الشهر", tone: "success" },
        { label: "إيراد شهري متكرر", value: "₪18,900", delta: "+12%", tone: "success" },
        { label: "طلبات دعم", value: "7", delta: "2 عالية الأولوية", tone: "warning" },
        { label: "وظائف نشر فاشلة", value: "5", delta: "آخر 24 ساعة", tone: "danger" },
      ],
      organizations: [demoOrganization],
      organization: demoOrganization,
      branches: demoBranches,
      users: [
        { id: "user-1", name: "أحمد المالك", email: "ahmed@iwan.example", role: "organization_owner" },
        { id: "user-2", name: "سارة النجار", email: "sara@iwan.example", role: "branch_manager" },
        { id: "user-3", name: "محمود عوض", email: "mahmoud@iwan.example", role: "inventory_manager" },
        { id: "user-4", name: "أحمد الكاشير", email: "cashier@iwan.example", role: "cashier" },
      ],
      plans: [
        { id: "starter", name: "البداية", price: "₪129", features: ["فرع واحد", "مخزون", "تقارير أساسية"] },
        { id: "growth", name: "النمو", price: "₪249", features: ["حتى 5 فروع", "تسويق", "وصفات"] },
        { id: "scale", name: "التوسع", price: "₪499", features: ["فروع غير محدودة", "أتمتة", "صلاحيات متقدمة"] },
      ],
      flags: [
        { key: "ربط_فيسبوك_الحقيقي", enabled: false, description: "تفعيل ربط فيسبوك الحقيقي" },
        { key: "قراءة_الفواتير_آليًا", enabled: false, description: "قراءة الفواتير آليًا" },
        { key: "استيراد_نقاط_البيع", enabled: false, description: "استيراد مبيعات نقاط البيع" },
      ],
      logs: systemLogs,
      tickets: [
        { id: "SUP-91", organization: "مطعم إيوان", subject: "ربط إنستغرام", status: "open", priority: "high" },
        { id: "SUP-92", organization: "كافيه تجريبي", subject: "سؤال عن الفاتورة", status: "pending", priority: "normal" },
      ],
    };
  }

  return withAdminScope(
    {
      metrics: [
        { label: "المؤسسات", value: "24", delta: "+3 هذا الشهر", tone: "success" },
        { label: "إيراد شهري متكرر", value: "₪18,900", delta: "+12%", tone: "success" },
        { label: "طلبات دعم", value: "7", delta: "2 عالية الأولوية", tone: "warning" },
        { label: "وظائف نشر فاشلة", value: "5", delta: "آخر 24 ساعة", tone: "danger" },
      ],
      organizations: [demoOrganization],
      organization: demoOrganization,
      branches: demoBranches,
      users: [
        { id: "user-1", name: "أحمد المالك", email: "ahmed@iwan.example", role: "organization_owner" },
        { id: "user-2", name: "سارة النجار", email: "sara@iwan.example", role: "branch_manager" },
      ],
      plans: [
        { id: "starter", name: "البداية", price: "₪129", features: ["فرع واحد", "مخزون", "تقارير أساسية"] },
        { id: "growth", name: "النمو", price: "₪249", features: ["حتى 5 فروع", "تسويق", "وصفات"] },
        { id: "scale", name: "التوسع", price: "₪499", features: ["فروع غير محدودة", "أتمتة", "صلاحيات متقدمة"] },
      ],
      flags: [
        { key: "ربط_فيسبوك_الحقيقي", enabled: false, description: "تفعيل ربط فيسبوك الحقيقي" },
        { key: "قراءة_الفواتير_آليًا", enabled: false, description: "قراءة الفواتير آليًا" },
        { key: "استيراد_نقاط_البيع", enabled: false, description: "استيراد مبيعات نقاط البيع" },
      ],
      logs: systemLogs,
      tickets: [
        { id: "SUP-91", organization: "مطعم إيوان", subject: "ربط إنستغرام", status: "open", priority: "high" },
      ],
    },
    (admin) => loadAdminBundle(admin),
  );
}

/**
 * Get account approval requests
 */
export async function getAccountApprovalRequests(): Promise<AccountApprovalRequest[]> {
  if (isDemoMode()) {
    return [
      {
        id: "demo-request-1",
        email: "owner@iwan.example",
        authUserId: null,
        authEmailConfirmed: false,
        authLastSignInAt: null,
        organizationId: null,
        ownerName: "مالك مطعم إيوان",
        organizationName: "مطعم إيوان",
        businessType: "restaurant",
        phone: "0590000000",
        status: "pending_owner_approval",
        requestedAt: new Date().toISOString(),
        approvedAt: null,
        rejectionReason: null,
      },
    ];
  }

  return withAdminScope(
    [
      {
        id: "demo-request-1",
        email: "owner@iwan.example",
        authUserId: null,
        authEmailConfirmed: false,
        authLastSignInAt: null,
        organizationId: null,
        ownerName: "مالك مطعم إيوان",
        organizationName: "مطعم إيوان",
        businessType: "restaurant",
        phone: "0590000000",
        status: "pending_owner_approval",
        requestedAt: new Date().toISOString(),
        approvedAt: null,
        rejectionReason: null,
      },
    ],
    async (admin) => {
      const requests = await query(
        (admin as any)
          .from("account_approval_requests")
          .select("id,email,owner_name,organization_name,business_type,phone,status,requested_at,approved_at,rejection_reason")
          .order("requested_at", { ascending: false }),
        "account_approval_requests",
      ) as any[];
      const authUsers = await admin.auth.admin.listUsers().catch(() => null);
      const authUserByEmail = new Map(
        (authUsers?.data.users ?? []).map((user) => [(user.email ?? "").toLowerCase(), user]),
      );
      const userIds = (authUsers?.data.users ?? []).map((user) => user.id);
      const membershipRows = userIds.length
        ? await query(
            (admin as any)
              .from("organization_memberships")
              .select("organization_id,user_id,role")
              .in("user_id", userIds),
            "organization_memberships",
          ) as any[]
        : [];
      const ownerOrgByUserId = new Map(
        membershipRows
          .filter((membership) => membership.role === "organization_owner" || membership.role === "super_admin")
          .map((membership) => [membership.user_id, membership.organization_id]),
      );

      return requests.map((request) => ({
        authUserId: authUserByEmail.get(request.email.toLowerCase())?.id ?? null,
        authEmailConfirmed: Boolean(authUserByEmail.get(request.email.toLowerCase())?.email_confirmed_at),
        authLastSignInAt: authUserByEmail.get(request.email.toLowerCase())?.last_sign_in_at ?? null,
        organizationId: authUserByEmail.get(request.email.toLowerCase())?.id
          ? ownerOrgByUserId.get(authUserByEmail.get(request.email.toLowerCase())!.id) ?? null
          : null,
        id: request.id,
        email: request.email,
        ownerName: request.owner_name,
        organizationName: request.organization_name,
        businessType: request.business_type,
        phone: request.phone,
        status: request.status,
        requestedAt: request.requested_at,
        approvedAt: request.approved_at,
        rejectionReason: request.rejection_reason,
      }));
    },
  );
}

/**
 * Get system logs
 */
export async function getSystemLogs(limit = 100) {
  if (isDemoMode()) {
    return systemLogs;
  }

  return withAdminScope<SystemLog[]>(systemLogs, async (admin) => {
    const { data } = await (admin as any)
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      level: oneOf(row.level, ["info", "warning", "error"] as const, "info"),
      message: row.message,
      createdAt: row.created_at,
    }));
  });
}

/**
 * Get support tickets
 */
export async function getSupportTickets(status?: "open" | "pending" | "closed") {
  if (isDemoMode()) {
    return [
      { id: "SUP-91", organization: "مطعم إيوان", subject: "ربط إنستغرام", status: "open", priority: "high" as const },
      { id: "SUP-92", organization: "كافيه تجريبي", subject: "سؤال عن الفاتورة", status: "pending", priority: "normal" as const },
    ];
  }

  return withAdminScope(
    [
      { id: "SUP-91", organization: "مطعم إيوان", subject: "ربط إنستغرام", status: "open", priority: "high" as const },
    ],
    async (admin) => {
      let queryBuilder = (admin as any)
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (status) {
        queryBuilder = queryBuilder.eq("status", status);
      }

      const { data } = await queryBuilder;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        organization: row.organization_id ?? "عام",
        subject: row.subject,
        status: row.status,
        priority: row.priority,
      }));
    },
  );
}

/**
 * Get smart savings features
 */
export async function getSmartSavingsData(): Promise<SmartSavingsBundle> {
  return {
    features: demoSmartSavingsFeatures,
    receipts: demoDigitalReceiptShares,
  };
}

/**
 * Get permission settings
 */
export async function getPermissionSettings() {
  return demoPermissionSettings;
}

// ============================================================================
// Missing functions for backward compatibility
// These functions were in the old app.ts but not in admin.ts
// ============================================================================

type BillPaymentsBundle = {
  bills: PayableBill[];
  batches: BillPaymentBatch[];
  mandates: DirectDebitMandate[];
  runs: DirectDebitRun[];
};

type SmartSavingsBundle = {
  features: SmartSavingsFeature[];
  receipts: DigitalReceiptShare[];
};

type TablesBundle = {
  tables: RestaurantTable[];
  branches: typeof demoBranches;
};

type OperationsBundle = {
  wasteLogs: WasteLog[];
  transfers: Transfer[];
  branches: typeof demoBranches;
  items: InventoryItem[];
};

type FinancialCalendarBundle = {
  days: FinancialCalendarDay[];
  branches: typeof demoBranches;
};

type CatalogBundle = {
  items: CatalogItem[];
  categories: InventoryCategory[];
  permissions: PermissionSetting[];
  units: Array<{ id: string; organizationId: string; name: string; type: string }>;
};

type ReportsBundle = {
  dashboard: { purchaseCost30Days: Array<{ label: string; value: number }> };
  movements: StockMovement[];
  purchaseOrders: PurchaseOrder[];
  wasteLogs: WasteLog[];
  suppliers: Supplier[];
  branches: typeof demoBranches;
  wasteSummary: {
    totalCost: number;
    byCategory: Array<{ category: string; value: number }>;
    byBranch: Array<{ branch: string; value: number }>;
  };
  stockAlerts: InventoryItem[];
  expiryAlerts: InventoryItem[];
};

type AmwaliData = {
  costTracking: CostTrackingData;
  branches: typeof demoBranches;
};

/**
 * Get bill payments data (backward compatibility)
 */
export async function getBillPaymentsData(): Promise<BillPaymentsBundle> {
  if (isDemoMode()) {
    return {
      bills: demoPayableBills,
      batches: demoBillPaymentBatches,
      mandates: demoDirectDebitMandates,
      runs: demoDirectDebitRuns,
    };
  }

  return withAdminScope<BillPaymentsBundle>(
    {
      bills: demoPayableBills,
      batches: demoBillPaymentBatches,
      mandates: demoDirectDebitMandates,
      runs: demoDirectDebitRuns,
    },
    async (admin, scope) => {
      const [billRows, batchRows, mandateRows, runRows] = await Promise.all([
        (admin as any).from("payable_bills").select("*").eq("organization_id", scope.organizationId).order("due_date"),
        (admin as any).from("bill_payment_batches").select("*").eq("organization_id", scope.organizationId).order("scheduled_at", { ascending: false }),
        (admin as any).from("direct_debit_mandates").select("*").eq("organization_id", scope.organizationId),
        (admin as any).from("direct_debit_runs").select("*").eq("organization_id", scope.organizationId).order("executed_at", { ascending: false }),
      ]);

      return {
        bills: (billRows.data ?? []).map((row: any) => ({
          id: row.id,
          organizationId: row.organization_id ?? scope.organizationId,
          billerName: row.biller_name ?? row.supplier_name ?? "مفوتر",
          category: row.category ?? "مورد",
          billNumber: row.bill_number ?? row.invoice_number ?? row.id.slice(0, 8),
          referenceNumber: row.reference_number ?? row.invoice_number ?? row.id.slice(0, 8),
          paidAmount: numberValue(row.paid_amount),
          remainingAmount: numberValue(row.remaining_amount) || numberValue(row.amount) - numberValue(row.paid_amount),
          amount: numberValue(row.amount),
          dueDate: row.due_date,
          status: row.status === "paid" || row.status === "partial" || row.status === "scheduled" || row.status === "overdue" ? row.status : "due",
          canPartialPay: Boolean(row.can_partial_pay ?? true),
          lastInquiryAt: row.last_inquiry_at ?? row.updated_at ?? new Date().toISOString(),
        })),
        batches: (batchRows.data ?? []).map((row: any) => ({
          id: row.id,
          organizationId: row.organization_id ?? scope.organizationId,
          referenceNumber: row.reference_number ?? row.name ?? row.id.slice(0, 8),
          billIds: Array.isArray(row.bill_ids) ? row.bill_ids : [],
          totalAmount: numberValue(row.total_amount),
          scheduledFor: row.scheduled_for ?? row.scheduled_at ?? undefined,
          status: row.status === "paid" || row.status === "scheduled" ? row.status : "ready",
        })),
        mandates: (mandateRows.data ?? []).map((row: any) => ({
          id: row.id,
          organizationId: row.organization_id ?? scope.organizationId,
          customerName: row.customer_name ?? "عميل",
          billerName: row.biller_name ?? row.supplier_name ?? "مفوتر",
          accountHint: row.account_hint ?? row.bank_account ?? "",
          amountLimit: numberValue(row.amount_limit),
          nextDueDate: row.next_due_date ?? row.created_at?.slice(0, 10) ?? "",
          status: row.status === "active" || row.status === "paused" || row.status === "cancelled" ? row.status : "pending",
          activatedAt: row.activated_at ?? undefined,
          lastPaymentAt: row.last_payment_at ?? undefined,
          channel: row.channel ?? "تطبيق",
        })),
        runs: (runRows.data ?? []).map((row: any) => ({
          id: row.id,
          mandateId: row.mandate_id ?? row.batch_id ?? "",
          billerName: row.biller_name ?? "مفوتر",
          customerName: row.customer_name ?? "عميل",
          dueDate: row.due_date ?? row.executed_at?.slice(0, 10) ?? "",
          amount: numberValue(row.amount ?? row.total_amount),
          status: row.status === "processing" || row.status === "paid" || row.status === "failed" ? row.status : "scheduled",
          message: row.message ?? "",
        })),
      };
    },
  );
}

/**
 * Get Amwali (financial) data (backward compatibility)
 */
export async function getAmwaliData(): Promise<AmwaliData> {
  if (isDemoMode()) {
    return {
      costTracking: demoCostTracking,
      branches: demoBranches,
    };
  }

  return withAdminScope<AmwaliData>(
    {
      costTracking: demoCostTracking,
      branches: demoBranches,
    },
    async (admin, scope) => {
      // Fetch real financial data
      const [salesRows, costRows, branchRows] = await Promise.all([
        (admin as any).from("sales_daily_summaries").select("*").eq("organization_id", scope.organizationId).gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        (admin as any).from("daily_cost_entries").select("*").eq("organization_id", scope.organizationId).gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        admin.from("branches").select("*").eq("organization_id", scope.organizationId),
      ]);

      const totalSales = (salesRows.data ?? []).reduce((sum: number, row: any) => sum + numberValue(row.total_sales), 0);
      const totalCost = (costRows.data ?? []).reduce((sum: number, row: any) => sum + numberValue(row.total_cost), 0);
      const foodCostPercent = totalSales > 0 ? (totalCost / totalSales) * 100 : 0;
      const netProfit = Math.round((totalSales - totalCost) * 0.85);

      return {
        costTracking: {
          ...demoCostTracking,
          salesTotal: totalSales,
          expensesTotal: totalCost,
          netProfit,
          profitMarginPercent: totalSales > 0 ? (netProfit / totalSales) * 100 : 0,
          smartInsights: [
            {
              title: "بيانات محدثة",
              value: `${Math.round(foodCostPercent * 10) / 10}%`,
              notes: "تم تحميل البيانات من النظام",
              tone: "success",
            },
          ],
        },
        branches: (branchRows.data ?? []).map((row: any) => ({
          id: row.id,
          organizationId: row.organization_id,
          name: row.name,
          city: row.city ?? "",
          address: row.address ?? "",
          manager: row.manager_name ?? "",
          status: row.status === "inactive" ? "inactive" : "active",
        })),
      };
    },
  );
}

/**
 * Get tables data (backward compatibility)
 */
export async function getTablesData(): Promise<TablesBundle> {
  if (isDemoMode()) {
    return { tables: demoRestaurantTables, branches: demoBranches };
  }

  return withAdminScope<TablesBundle>({ tables: demoRestaurantTables, branches: demoBranches }, async (admin, scope) => {
    const [tableRows, branchRows] = await Promise.all([
      admin.from("restaurant_tables").select("*").eq("organization_id", scope.organizationId).order("name"),
      admin.from("branches").select("*").eq("organization_id", scope.organizationId).order("name"),
    ]);

    const dbBranches = (branchRows.data ?? []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      city: row.city ?? "",
      address: row.address ?? "",
      manager: row.manager_name ?? "",
      status: row.status === "inactive" || row.status === "archived" ? ("inactive" as const) : ("active" as const),
    }));

    const branchesMap = new Map(dbBranches.map((b) => [b.id, b]));

    return {
      branches: dbBranches,
      tables: (tableRows.data ?? []).map((row: any) => ({
        id: row.id,
        organizationId: row.organization_id,
        branchId: row.branch_id,
        branchName: branchesMap.get(row.branch_id)?.name ?? "فرع غير معروف",
        number: Number(row.number ?? row.name ?? 0),
        zone: row.zone ?? "الصالة",
        seats: row.seats ?? row.capacity ?? 4,
        status: row.status ?? "available",
        openedAt: row.opened_at ?? undefined,
        waiterName: row.waiter_name ?? undefined,
        guests: row.guests ?? undefined,
        currentTotal: numberValue(row.current_total),
        orderItems: [],
      })),
    };
  });
}

/**
 * Get financial calendar data (backward compatibility)
 */
export async function getFinancialCalendarData(): Promise<FinancialCalendarBundle> {
  if (isDemoMode()) {
    return { days: demoFinancialCalendar, branches: demoBranches };
  }

  return withAdminScope<FinancialCalendarBundle>({ days: demoFinancialCalendar, branches: demoBranches }, async (admin, scope) => {
    const [calendarRows, saleRows, expenseRows, branchRows] = await Promise.all([
      (admin as any).from("financial_calendar_days").select("*").eq("organization_id", scope.organizationId).order("date", { ascending: false }).limit(60),
      (admin as any).from("financial_calendar_sales").select("*").eq("organization_id", scope.organizationId),
      (admin as any).from("financial_calendar_expenses").select("*").eq("organization_id", scope.organizationId),
      admin.from("branches").select("*").eq("organization_id", scope.organizationId).order("name"),
    ]);

    const dbBranches = (branchRows.data ?? []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      city: row.city ?? "",
      address: row.address ?? "",
      manager: row.manager_name ?? "",
      status: row.status === "inactive" || row.status === "archived" ? ("inactive" as const) : ("active" as const),
    }));

    const branchesMap = new Map(dbBranches.map((b) => [b.id, b]));

    return {
      branches: dbBranches,
      days: (calendarRows.data ?? []).map((row: any) => ({
        date: row.date,
        branchName: branchesMap.get(row.branch_id)?.name ?? "فرع غير معروف",
        salesTotal: numberValue(row.sales_total),
        expensesTotal: numberValue(row.expenses_total),
        netProfit: numberValue(row.net_profit),
        cashSales: numberValue(row.cash_sales),
        cardSales: numberValue(row.card_sales),
        sales: (saleRows.data ?? [])
          .filter((sale: any) => sale.date === row.date)
          .map((sale: any) => ({
            itemName: sale.item_name ?? "",
            quantity: numberValue(sale.quantity),
            revenue: numberValue(sale.revenue),
          })),
        expenses: (expenseRows.data ?? [])
          .filter((expense: any) => expense.date === row.date)
          .map((expense: any) => ({
            category: expense.category ?? "مصروفات أخرى",
            amount: numberValue(expense.amount),
            notes: expense.notes ?? undefined,
          })),
        status: numberValue(row.net_profit) > 0 ? "profit" : numberValue(row.net_profit) < 0 ? "loss" : "balanced",
      })),
    };
  });
}

/**
 * Get operations data (backward compatibility)
 */
export async function getOperationsData(): Promise<OperationsBundle> {
  if (isDemoMode()) {
    return {
      wasteLogs: demoWasteLogs,
      transfers: demoTransfers,
      branches: demoBranches,
      items: demoInventoryItems,
    };
  }

  return withAdminScope<OperationsBundle>(
    {
      wasteLogs: demoWasteLogs,
      transfers: demoTransfers,
      branches: demoBranches,
      items: demoInventoryItems,
    },
    async (admin, scope) => {
      const [wasteRows, transferRows, branchRows, itemRows] = await Promise.all([
        admin.from("waste_logs").select("*").eq("organization_id", scope.organizationId).order("created_at", { ascending: false }).limit(100),
        admin.from("transfers").select("*").eq("organization_id", scope.organizationId).order("created_at", { ascending: false }).limit(100),
        admin.from("branches").select("*").eq("organization_id", scope.organizationId).order("name"),
        admin.from("inventory_items").select("*").eq("organization_id", scope.organizationId).order("name"),
      ]);

      const dbBranches = (branchRows.data ?? []).map((row: any) => ({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        city: row.city ?? "",
        address: row.address ?? "",
        manager: row.manager_name ?? "",
        status: row.status === "inactive" || row.status === "archived" ? ("inactive" as const) : ("active" as const),
      }));

      const dbItems = (itemRows.data ?? []).map((row: any) => ({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        categoryId: row.category_id ?? "",
        categoryName: "",
        purchaseUnit: "",
        usageUnit: "",
        lastPurchasePrice: numberValue(row.last_purchase_price),
        averageCost: numberValue(row.average_cost),
        minimumQuantity: numberValue(row.minimum_quantity),
        primarySupplierId: row.primary_supplier_id || undefined,
        primarySupplierName: undefined,
        sku: row.sku || undefined,
        notes: row.notes || undefined,
        isActive: row.status === "active",
      }));

      const branchesMap = new Map(dbBranches.map((b) => [b.id, b]));
      const itemsMap = new Map(dbItems.map((i) => [i.id, i]));

      return {
        wasteLogs: (wasteRows.data ?? []).map((row: any) => ({
          id: row.id,
          organizationId: row.organization_id,
          branchName: branchesMap.get(row.branch_id)?.name ?? "فرع غير معروف",
          itemName: itemsMap.get(row.item_id)?.name ?? "مادة غير معروفة",
          quantity: numberValue(row.quantity),
          reason: row.reason ?? "",
          cost: numberValue(row.total_cost ?? row.cost),
          loggedAt: row.created_at ?? row.logged_at,
          notes: row.notes,
        })),
        transfers: (transferRows.data ?? []).map((row: any) => ({
          id: row.id,
          organizationId: row.organization_id,
          fromBranchName: branchesMap.get(row.from_branch_id)?.name ?? "فرع غير معروف",
          toBranchName: branchesMap.get(row.to_branch_id)?.name ?? "فرع غير معروف",
          status: row.status,
          createdAt: row.created_at,
          totalItems: row.total_items ?? 0,
        })),
        branches: dbBranches,
        items: dbItems,
      };
    },
  );
}

/**
 * Get reports data (backward compatibility)
 */
export async function getReportsData(): Promise<ReportsBundle> {
  if (isDemoMode()) {
    return {
      dashboard: { purchaseCost30Days: demoStockMovements.slice(0, 6).map((movement) => ({ label: movement.createdAt.slice(0, 10), value: movement.totalCost })) },
      movements: demoStockMovements,
      purchaseOrders: demoPurchaseOrders,
      wasteLogs: demoWasteLogs,
      suppliers: demoSuppliers,
      branches: demoBranches,
      wasteSummary: {
        totalCost: 670,
        byCategory: [
          { category: "بروتين", value: 320 },
          { category: "نشويات", value: 180 },
          { category: "مخلفات", value: 170 },
        ],
        byBranch: [
          { branch: "الفرع الرئيسي", value: 410 },
          { branch: "فرع الرمال", value: 260 },
        ],
      },
      stockAlerts: demoInventoryItems.filter((item) => item.averageCost < item.minimumQuantity),
      expiryAlerts: demoInventoryItems.slice(0, 4),
    };
  }

  return withAdminScope<ReportsBundle>(
    {
      wasteSummary: {
        totalCost: 670,
        byCategory: [
          { category: "بروتين", value: 320 },
          { category: "نشويات", value: 180 },
        ],
        byBranch: [
          { branch: "الفرع الرئيسي", value: 410 },
        ],
      },
      dashboard: { purchaseCost30Days: [] },
      movements: demoStockMovements,
      purchaseOrders: demoPurchaseOrders,
      wasteLogs: demoWasteLogs,
      suppliers: demoSuppliers,
      branches: demoBranches,
      stockAlerts: [],
      expiryAlerts: [],
    },
    async (admin, scope) => {
      const [
        wasteRows,
        itemRows,
        branchRows,
        movementRows,
        orderRows,
        orderItemRows,
        supplierRows,
      ] = await Promise.all([
        admin.from("waste_logs").select("*").eq("organization_id", scope.organizationId).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        admin.from("inventory_items").select("*").eq("organization_id", scope.organizationId),
        admin.from("branches").select("*").eq("organization_id", scope.organizationId).order("name"),
        admin.from("stock_movements").select("*").eq("organization_id", scope.organizationId).order("created_at", { ascending: false }).limit(100),
        admin.from("purchase_orders").select("*").eq("organization_id", scope.organizationId).order("order_date", { ascending: false }).limit(100),
        admin.from("purchase_order_items").select("*").eq("organization_id", scope.organizationId),
        admin.from("suppliers").select("*").eq("organization_id", scope.organizationId).order("name"),
      ]);

      const branchesMap = new Map((branchRows.data ?? []).map((b: any) => [b.id, b]));
      const itemsMap = new Map((itemRows.data ?? []).map((i: any) => [i.id, i]));
      const suppliersMap = new Map((supplierRows.data ?? []).map((s: any) => [s.id, s]));
      
      const itemsByOrder = new Map<string, any[]>();
      for (const item of orderItemRows.data ?? []) {
        const orderId = item.purchase_order_id;
        if (!itemsByOrder.has(orderId)) {
          itemsByOrder.set(orderId, []);
        }
        itemsByOrder.get(orderId)!.push(item);
      }

      const dbBranches = (branchRows.data ?? []).map((row: any) => ({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        city: row.city ?? "",
        address: row.address ?? "",
        manager: row.manager_name ?? "",
        status: row.status === "inactive" || row.status === "archived" ? ("inactive" as const) : ("active" as const),
      }));

      const dbSuppliers = (supplierRows.data ?? []).map((row: any) => mapSupplier(row, 0));

      const dbMovements = (movementRows.data ?? []).map((row: any) =>
        mapStockMovement(row, branchesMap, itemsMap)
      );

      const dbPurchaseOrders = (orderRows.data ?? []).map((row: any) =>
        mapPurchaseOrder(row, suppliersMap, branchesMap, itemsMap, itemsByOrder.get(row.id) ?? [])
      );

      const dbWasteLogs = (wasteRows.data ?? []).map((row: any) => ({
        id: row.id,
        organizationId: row.organization_id,
        branchName: branchesMap.get(row.branch_id)?.name ?? "فرع غير معروف",
        itemName: itemsMap.get(row.item_id)?.name ?? "مادة غير معروفة",
        quantity: numberValue(row.quantity),
        reason: row.reason ?? "",
        cost: numberValue(row.total_cost ?? row.cost),
        loggedAt: row.created_at ?? row.logged_at,
        notes: row.notes,
      }));

      const totalCost = dbWasteLogs.reduce((sum, row) => sum + row.cost, 0);

      const byBranchMap = new Map<string, number>();
      for (const log of dbWasteLogs) {
        byBranchMap.set(log.branchName, (byBranchMap.get(log.branchName) ?? 0) + log.cost);
      }
      const byBranch = Array.from(byBranchMap.entries()).map(([branch, value]) => ({ branch, value }));

      const dbItems = (itemRows.data ?? []).map((row: any) => ({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        categoryId: row.category_id ?? "",
        categoryName: "",
        purchaseUnit: "",
        usageUnit: "",
        lastPurchasePrice: numberValue(row.last_purchase_price),
        averageCost: numberValue(row.average_cost),
        minimumQuantity: numberValue(row.minimum_quantity),
        primarySupplierId: row.primary_supplier_id || undefined,
        primarySupplierName: undefined,
        sku: row.sku || undefined,
        notes: row.notes || undefined,
        isActive: row.status === "active",
      }));

      return {
        wasteSummary: {
          totalCost,
          byCategory: [],
          byBranch,
        },
        dashboard: {
          purchaseCost30Days: dbMovements.slice(0, 6).map((row) => ({
            label: String(row.createdAt ?? "").slice(0, 10),
            value: row.totalCost,
          })),
        },
        movements: dbMovements,
        purchaseOrders: dbPurchaseOrders,
        wasteLogs: dbWasteLogs,
        suppliers: dbSuppliers,
        branches: dbBranches,
        stockAlerts: dbItems.filter((item) => item.averageCost < item.minimumQuantity),
        expiryAlerts: dbItems.slice(0, 4),
      };
    },
  );
}

/**
 * Get catalog data (backward compatibility)
 */
export async function getCatalogData(): Promise<CatalogBundle> {
  if (isDemoMode()) {
    return {
      items: demoCatalogItems,
      categories: demoCategories,
      permissions: demoPermissionSettings,
      units: [],
    };
  }

  return withAdminScope<CatalogBundle>(
    {
      items: demoCatalogItems,
      categories: demoCategories,
      permissions: demoPermissionSettings,
      units: [],
    },
    async (admin, scope) => {
      const [itemRows, unitRows] = await Promise.all([
        admin.from("catalog_items").select("*").eq("organization_id", scope.organizationId).order("name"),
        admin.from("units").select("*").eq("organization_id", scope.organizationId),
      ]);

      return {
        items: (itemRows.data ?? []).map((row: any) => ({
          id: row.id,
          organizationId: row.organization_id,
          code: row.code ?? row.sku ?? row.id.slice(0, 8),
          name: row.name ?? "",
          barcodes: row.barcode ? [row.barcode] : [],
          categoryName: row.category ?? "عام",
          mainUnit: row.main_unit ?? "قطعة",
          units: [],
          purchasePrice: numberValue(row.purchase_price),
          retailPrice: numberValue(row.price ?? row.retail_price),
          wholesalePrice: numberValue(row.wholesale_price),
          minimumQuantity: numberValue(row.minimum_quantity),
          taxRate: numberValue(row.tax_rate),
          isActive: row.status === "active",
          stockQuantity: numberValue(row.stock_quantity),
        })),
        categories: demoCategories,
        permissions: demoPermissionSettings,
        units: (unitRows.data ?? []).map((row: any) => ({
          id: row.id,
          organizationId: row.organization_id,
          name: row.name ?? "",
          type: row.type ?? "count",
        })),
      };
    },
  );
}
