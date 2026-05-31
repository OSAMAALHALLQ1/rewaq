/**
 * Admin domain queries
 * Handles organization management, users, plans, and system-level data
 */
import "server-only";
import {
  demoOrganization,
  demoBranches,
  demoSystemLogs,
  demoSmartSavingsFeatures,
  demoPermissionSettings,
} from "@/lib/demo-data";
import {
  isDemoMode,
  withAdminScope,
  query,
  indexBy,
  numberValue,
  optionalText,
  type AdminClient,
} from "./_shared/utils";

import type { Role } from "@/types/domain";

// ============================================================================
// Types
// ============================================================================

export type AdminBundle = {
  metrics: AdminMetric[];
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
  const [organizationRows, membershipRows, profileRows, planRows, flagRows, logRows, ticketRows, approvalRows]: [any, any, any, any, any, any, any, any] =
    await Promise.all([
      query(admin.from("organizations").select("*").order("created_at", { ascending: false }).limit(100), "organizations"),
      query(admin.from("organization_memberships").select("*").order("created_at", { ascending: false }).limit(500), "organization_memberships"),
      query(admin.from("profiles").select("*").limit(500), "profiles"),
      query(admin.from("plans").select("*").order("monthly_price", { ascending: true }), "plans"),
      query((admin as any).from("feature_flags").select("*").order("key"), "feature_flags"),
      query((admin as any).from("system_logs").select("*").order("created_at", { ascending: false }).limit(100), "system_logs"),
      query((admin as any).from("support_tickets").select("*").order("created_at", { ascending: false }).limit(100), "support_tickets"),
      query(admin.from("account_approval_requests").select("*").limit(200), "account_approval_requests"),
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
      level: log.level,
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
      logs: demoSystemLogs,
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
      logs: demoSystemLogs,
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
    return demoSystemLogs;
  }

  return withAdminScope(demoSystemLogs, async (admin) => {
    const { data } = await (admin as any)
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      level: row.level,
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
export async function getSmartSavingsData() {
  return demoSmartSavingsFeatures;
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

type PayableBill = {
  id: string;
  supplierName: string;
  branchName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  status: string;
};

type BillPaymentBatch = {
  id: string;
  name: string;
  totalAmount: number;
  billsCount: number;
  scheduledAt: string;
  status: string;
};

type DirectDebitMandate = {
  id: string;
  supplierName: string;
  bankAccount: string;
  status: string;
  createdAt: string;
};

type DirectDebitRun = {
  id: string;
  batchId: string;
  totalAmount: number;
  billsCount: number;
  executedAt: string;
  status: string;
};

type AmwaliData = {
  summary: {
    totalSales: number;
    totalCost: number;
    grossProfit: number;
    foodCostPercent: number;
    netProfit: number;
  };
  branches: Array<{
    name: string;
    sales: number;
    cost: number;
    profit: number;
  }>;
  topItems: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  insights: Array<{
    type: "success" | "warning" | "danger";
    title: string;
    description: string;
  }>;
};

/**
 * Get bill payments data (backward compatibility)
 */
export async function getBillPaymentsData(): Promise<BillPaymentsBundle> {
  if (isDemoMode()) {
    return {
      bills: [
        { id: "bill-1", supplierName: "مورد الدجاج", branchName: "الفرع الرئيسي", invoiceNumber: "INV-001", amount: 2500, dueDate: "2026-06-15", status: "pending" },
        { id: "bill-2", supplierName: "مورد الخضار", branchName: "فرع الرمال", invoiceNumber: "INV-002", amount: 1800, dueDate: "2026-06-20", status: "pending" },
      ],
      batches: [],
      mandates: [],
      runs: [],
    };
  }

  return withAdminScope(
    {
      bills: [
        { id: "bill-1", supplierName: "مورد الدجاج", branchName: "الفرع الرئيسي", invoiceNumber: "INV-001", amount: 2500, dueDate: "2026-06-15", status: "pending" },
      ],
      batches: [],
      mandates: [],
      runs: [],
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
          supplierName: row.supplier_name ?? "",
          branchName: row.branch_name ?? "",
          invoiceNumber: row.invoice_number ?? "",
          amount: numberValue(row.amount),
          dueDate: row.due_date,
          status: row.status,
        })),
        batches: (batchRows.data ?? []).map((row: any) => ({
          id: row.id,
          name: row.name ?? "",
          totalAmount: numberValue(row.total_amount),
          billsCount: row.bills_count ?? 0,
          scheduledAt: row.scheduled_at,
          status: row.status,
        })),
        mandates: (mandateRows.data ?? []).map((row: any) => ({
          id: row.id,
          supplierName: row.supplier_name ?? "",
          bankAccount: row.bank_account ?? "",
          status: row.status,
          createdAt: row.created_at,
        })),
        runs: (runRows.data ?? []).map((row: any) => ({
          id: row.id,
          batchId: row.batch_id,
          totalAmount: numberValue(row.total_amount),
          billsCount: row.bills_count ?? 0,
          executedAt: row.executed_at,
          status: row.status,
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
      summary: {
        totalSales: 45000,
        totalCost: 13500,
        grossProfit: 31500,
        foodCostPercent: 30,
        netProfit: 28000,
      },
      branches: [
        { name: "الفرع الرئيسي", sales: 28000, cost: 8400, profit: 19600 },
        { name: "فرع الرمال", sales: 17000, cost: 5100, profit: 11900 },
      ],
      topItems: [
        { name: "ساندويتش دجاج", quantity: 450, revenue: 11250 },
        { name: "برجر لحم", quantity: 320, revenue: 9600 },
        { name: "سلطة سيزر", quantity: 280, revenue: 5600 },
      ],
      insights: [
        { type: "success", title: "هامش ربح جيد", description: "نسبة ربح 70% أعلى من المتوسط" },
        { type: "warning", title: "تكلفة طعام مرتفعة", description: "وصلت 30% الأسبوع الماضي" },
        { type: "danger", title: "مشكلة في فرع الرمال", description: "انخفاض المبيعات بنسبة 15%" },
      ],
    };
  }

  return withAdminScope(
    {
      summary: {
        totalSales: 45000,
        totalCost: 13500,
        grossProfit: 31500,
        foodCostPercent: 30,
        netProfit: 28000,
      },
      branches: [
        { name: "الفرع الرئيسي", sales: 28000, cost: 8400, profit: 19600 },
      ],
      topItems: [
        { name: "ساندويتش دجاج", quantity: 450, revenue: 11250 },
      ],
      insights: [
        { type: "success", title: "هامش ربح جيد", description: "نسبة ربح 70% أعلى من المتوسط" },
      ],
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

      return {
        summary: {
          totalSales,
          totalCost,
          grossProfit: totalSales - totalCost,
          foodCostPercent: Math.round(foodCostPercent * 10) / 10,
          netProfit: Math.round((totalSales - totalCost) * 0.85),
        },
        branches: (branchRows.data ?? []).map((row: any) => ({
          name: row.name,
          sales: 0,
          cost: 0,
          profit: 0,
        })),
        topItems: [],
        insights: [
          { type: "success", title: "بيانات محدثة", description: "تم تحميل البيانات من النظام" },
        ],
      };
    },
  );
}

/**
 * Get tables data (backward compatibility)
 */
export async function getTablesData() {
  if (isDemoMode()) {
    return demoRestaurantTables;
  }

  return withAdminScope(demoRestaurantTables, async (admin, scope) => {
    const { data } = await admin
      .from("restaurant_tables")
      .select("*")
      .eq("organization_id", scope.organizationId)
      .order("name");

    return (data ?? []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      branchId: row.branch_id,
      name: row.name ?? "",
      capacity: row.capacity ?? 4,
      status: row.status ?? "available",
    }));
  });
}

/**
 * Get financial calendar data (backward compatibility)
 */
export async function getFinancialCalendarData() {
  if (isDemoMode()) {
    return demoFinancialCalendar;
  }

  return withAdminScope(demoFinancialCalendar, async (admin, scope) => {
    const [calendarRows, saleRows, expenseRows] = await Promise.all([
      (admin as any).from("financial_calendar_days").select("*").eq("organization_id", scope.organizationId).order("date", { ascending: false }).limit(60),
      (admin as any).from("financial_calendar_sales").select("*").eq("organization_id", scope.organizationId),
      (admin as any).from("financial_calendar_expenses").select("*").eq("organization_id", scope.organizationId),
    ]);

    return (calendarRows.data ?? []).map((row: any) => ({
      date: row.date,
      dayName: row.day_name ?? "",
      isWeekend: row.is_weekend ?? false,
      sales: saleRows.data?.find((s: any) => s.date === row.date),
      expenses: expenseRows.data?.find((e: any) => e.date === row.date),
    }));
  });
}

/**
 * Get operations data (backward compatibility)
 */
export async function getOperationsData() {
  if (isDemoMode()) {
    return {
      wasteLogs: demoWasteLogs,
      transfers: demoTransfers,
    };
  }

  return withAdminScope(
    {
      wasteLogs: demoWasteLogs,
      transfers: demoTransfers,
    },
    async (admin, scope) => {
      const [wasteRows, transferRows] = await Promise.all([
        admin.from("waste_logs").select("*").eq("organization_id", scope.organizationId).order("created_at", { ascending: false }).limit(100),
        admin.from("transfers").select("*").eq("organization_id", scope.organizationId).order("created_at", { ascending: false }).limit(100),
      ]);

      return {
        wasteLogs: (wasteRows.data ?? []).map((row: any) => ({
          id: row.id,
          organizationId: row.organization_id,
          branchId: row.branch_id,
          branchName: "",
          itemId: row.item_id,
          itemName: "",
          quantity: numberValue(row.quantity),
          unitCost: numberValue(row.unit_cost),
          totalCost: numberValue(row.total_cost),
          reason: row.reason ?? "",
          notes: row.notes,
          createdAt: row.created_at,
        })),
        transfers: (transferRows.data ?? []).map((row: any) => ({
          id: row.id,
          organizationId: row.organization_id,
          fromBranchId: row.from_branch_id,
          toBranchId: row.to_branch_id,
          fromBranchName: "",
          toBranchName: "",
          status: row.status,
          createdAt: row.created_at,
          items: [],
        })),
      };
    },
  );
}

/**
 * Get reports data (backward compatibility)
 */
export async function getReportsData() {
  if (isDemoMode()) {
    return {
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

  return withAdminScope(
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
      stockAlerts: [],
      expiryAlerts: [],
    },
    async (admin, scope) => {
      const [wasteRows, itemRows] = await Promise.all([
        admin.from("waste_logs").select("*").eq("organization_id", scope.organizationId).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        admin.from("inventory_items").select("*").eq("organization_id", scope.organizationId),
      ]);

      const totalCost = (wasteRows.data ?? []).reduce((sum: number, row: any) => sum + numberValue(row.total_cost), 0);

      return {
        wasteSummary: {
          totalCost,
          byCategory: [],
          byBranch: [],
        },
        stockAlerts: (itemRows.data ?? []).filter((item: any) => numberValue(item.average_cost) < numberValue(item.minimum_quantity)),
        expiryAlerts: [],
      };
    },
  );
}

/**
 * Get catalog data (backward compatibility)
 */
export async function getCatalogData() {
  if (isDemoMode()) {
    return {
      items: demoCatalogItems,
      units: [],
    };
  }

  return withAdminScope(
    {
      items: demoCatalogItems,
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
          name: row.name ?? "",
          barcode: row.barcode ?? "",
          price: numberValue(row.price),
          category: row.category ?? "general",
          status: row.status === "active" ? "active" as const : "inactive" as const,
        })),
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