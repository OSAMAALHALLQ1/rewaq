export type Role =
  | "super_admin"
  | "organization_owner"
  | "branch_manager"
  | "cashier"
  | "inventory_manager"
  | "purchasing_manager"
  | "chef"
  | "marketing_manager"
  | "accountant"
  | "staff";

export type StatusTone =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: "active" | "trial" | "past_due" | "paused";
};

export type Branch = {
  id: string;
  organizationId: string;
  name: string;
  city: string;
  address: string;
  manager: string;
  status: "active" | "inactive";
};

export type Supplier = {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
  status: "active" | "inactive";
  priceRisk: number;
};

export type InventoryCategory = {
  id: string;
  organizationId: string;
  name: string;
};

export type InventoryItem = {
  id: string;
  organizationId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  purchaseUnit: string;
  usageUnit: string;
  lastPurchasePrice: number;
  averageCost: number;
  minimumQuantity: number;
  primarySupplierId?: string;
  primarySupplierName?: string;
  sku?: string;
  notes?: string;
  isActive: boolean;
};

export type BranchStock = {
  branchId: string;
  branchName: string;
  itemId: string;
  quantity: number;
  reservedQuantity: number;
};

export type StockMovementType =
  | "purchase"
  | "sale_usage"
  | "waste"
  | "transfer_in"
  | "transfer_out"
  | "adjustment"
  | "stock_count"
  | "return";

export type StockMovement = {
  id: string;
  organizationId: string;
  branchId: string;
  branchName: string;
  itemId: string;
  itemName: string;
  movementType: StockMovementType;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reference?: string;
  notes?: string;
  createdAt: string;
};

export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "received"
  | "partially_received"
  | "cancelled";

export type PurchaseOrderItem = {
  itemId: string;
  itemName: string;
  quantity: number;
  expectedUnitPrice: number;
  receivedQuantity: number;
};

export type PurchaseOrder = {
  id: string;
  organizationId: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate?: string;
  total: number;
  notes?: string;
  items: PurchaseOrderItem[];
};

export type Invoice = {
  id: string;
  organizationId: string;
  supplierName: string;
  branchName: string;
  invoiceNumber: string;
  status: "draft" | "matched" | "paid" | "flagged";
  total: number;
  issuedAt: string;
};

export type CustomerInvoiceItem = {
  id: string;
  menuItemId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type CustomerInvoice = {
  id: string;
  organizationId: string;
  branchId: string;
  branchName: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  customerTaxNumber?: string;
  status: "draft" | "issued" | "paid" | "void";
  paymentMethod: "cash" | "card" | "bank_transfer" | "delivery_app";
  issuedAt: string;
  notes?: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxTotal: number;
  total: number;
  items: CustomerInvoiceItem[];
};

export type SalesDocumentType =
  | "sale_invoice"
  | "purchase_invoice"
  | "sale_return"
  | "purchase_return"
  | "quote"
  | "order"
  | "dispatch"
  | "tax_invoice"
  | "simple_invoice"
  | "held_invoice";

export type CatalogUnit = {
  name: string;
  factor: number;
  barcode?: string;
};

export type CatalogItem = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  barcodes: string[];
  categoryName: string;
  mainUnit: string;
  units: CatalogUnit[];
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  branchPrice?: number;
  customerPrice?: number;
  minimumQuantity: number;
  taxRate: number;
  imagePath?: string;
  isActive: boolean;
  stockQuantity: number;
};

export type SalesShift = {
  id: string;
  branchName: string;
  cashierName: string;
  openedAt: string;
  openingCash: number;
  cashSales: number;
  cardSales: number;
  expenses: number;
  withdrawals: number;
  deposits: number;
  expectedCash: number;
  actualCash?: number;
  difference: number;
  status: "open" | "closed";
};

export type RestaurantTableStatus = "available" | "occupied" | "reserved" | "needs_cleaning";

export type RestaurantTableOrderItem = {
  name: string;
  quantity: number;
  total: number;
};

export type RestaurantTable = {
  id: string;
  organizationId: string;
  branchId: string;
  branchName: string;
  number: number;
  zone: string;
  seats: number;
  status: RestaurantTableStatus;
  openedAt?: string;
  waiterName?: string;
  guests?: number;
  currentTotal: number;
  orderItems: RestaurantTableOrderItem[];
};

export type PayableBillStatus = "due" | "partial" | "scheduled" | "paid" | "overdue";
export type PayableBillCategory = "كهرباء" | "ماء" | "إنترنت" | "إيجار" | "مورد" | "خدمات";

export type PayableBill = {
  id: string;
  organizationId: string;
  billerName: string;
  category: PayableBillCategory;
  billNumber: string;
  referenceNumber: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: PayableBillStatus;
  canPartialPay: boolean;
  lastInquiryAt: string;
};

export type BillPaymentBatch = {
  id: string;
  organizationId: string;
  referenceNumber: string;
  billIds: string[];
  totalAmount: number;
  scheduledFor?: string;
  status: "ready" | "scheduled" | "paid";
};

export type DirectDebitMandate = {
  id: string;
  organizationId: string;
  customerName: string;
  billerName: string;
  accountHint: string;
  amountLimit: number;
  nextDueDate: string;
  status: "active" | "paused" | "cancelled" | "pending";
  activatedAt?: string;
  lastPaymentAt?: string;
  channel: "تطبيق" | "بوابة دفع" | "حساب بنكي";
};

export type DirectDebitRun = {
  id: string;
  mandateId: string;
  billerName: string;
  customerName: string;
  dueDate: string;
  amount: number;
  status: "scheduled" | "processing" | "paid" | "failed";
  message: string;
};

export type SmartSavingsFeature = {
  id: string;
  title: string;
  description: string;
  monthlySaving: number;
  status: "active" | "available" | "coming";
};

export type DigitalReceiptShare = {
  invoiceNumber: string;
  customerName: string;
  total: number;
  receiptUrl: string;
  sentAt: string;
  status: "ready" | "viewed" | "sent";
};

export type PermissionSetting = {
  key: string;
  label: string;
  roles: Role[];
};

export type RecipeIngredient = {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
};

export type Recipe = {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  servings: number;
  preparation?: string;
  ingredients: RecipeIngredient[];
  totalCost: number;
  costPerServing: number;
  status: "active" | "draft" | "archived";
};

export type MenuItem = {
  id: string;
  organizationId: string;
  name: string;
  branchId?: string;
  branchName?: string;
  recipeId: string;
  recipeName: string;
  sellingPrice: number;
  recipeCost: number;
  grossProfit: number;
  foodCostPercent: number;
  profitMarginPercent: number;
  imagePath?: string;
  status: "active" | "inactive";
};

export type WasteLog = {
  id: string;
  organizationId: string;
  branchName: string;
  itemName: string;
  quantity: number;
  reason:
    | "تلف"
    | "انتهاء صلاحية"
    | "خطأ تحضير"
    | "كسر/انسكاب"
    | "محاريق"
    | "منظفات"
    | "إرجاع"
    | "سبب آخر";
  cost: number;
  loggedAt: string;
  notes?: string;
};

export type Transfer = {
  id: string;
  organizationId: string;
  fromBranchName: string;
  toBranchName: string;
  status: "draft" | "sent" | "received" | "cancelled";
  createdAt: string;
  totalItems: number;
};

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "telegram"
  | "tiktok"
  | "x"
  | "google_business"
  | "linkedin"
  | "youtube_shorts"
  | "pinterest";

export type SocialAccount = {
  id: string;
  organizationId: string;
  platform: SocialPlatform;
  accountName: string;
  status: "connected" | "expired" | "disabled";
  lastPublishedAt?: string;
};

export type SocialPostTarget = {
  platform: SocialPlatform;
  accountName: string;
  status: "pending" | "publishing" | "published" | "failed";
  error?: string;
};

export type SocialPost = {
  id: string;
  organizationId: string;
  title: string;
  body: string;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
  scheduledAt?: string;
  assetUrl?: string;
  targets: SocialPostTarget[];
  createdAt: string;
};

export type SocialTemplate = {
  id: string;
  organizationId: string;
  name: string;
  body: string;
  category: string;
};

export type Notification = {
  id: string;
  organizationId: string;
  type:
    | "low_stock"
    | "price_increase"
    | "high_food_cost"
    | "publish_failed"
    | "purchase_received"
    | "waste_logged";
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "danger";
  readAt?: string;
  createdAt: string;
};

export type ReportPoint = {
  label: string;
  value: number;
  value2?: number;
};

export type FinancialCalendarSale = {
  itemName: string;
  quantity: number;
  revenue: number;
};

export type FinancialCalendarExpense = {
  category: "أجور" | "مواد خام" | "كهرباء وماء" | "إيجار" | "توصيل" | "مصروفات أخرى";
  amount: number;
  notes?: string;
};

export type FinancialCalendarDay = {
  date: string;
  branchName: string;
  salesTotal: number;
  expensesTotal: number;
  netProfit: number;
  cashSales: number;
  cardSales: number;
  sales: FinancialCalendarSale[];
  expenses: FinancialCalendarExpense[];
  status: "profit" | "loss" | "balanced";
};

export type CostTrackingLine = {
  name: string;
  amount: number;
  quantity?: number;
  unit?: string;
  notes?: string;
};

export type CostTrackingSection = {
  id: string;
  title: string;
  description: string;
  total: number;
  lines: CostTrackingLine[];
};

export type CostCenter = {
  name: string;
  amount: number;
  percent: number;
  status: "healthy" | "watch" | "danger";
  notes: string;
};

export type CostTrackingData = {
  date: string;
  branchName: string;
  channelBreakdown: Array<{ channel: "الصالة" | "الدليفري" | "الاستلام"; orders: number; revenue: number; directCost: number; profit: number }>;
  salesTotal: number;
  expensesTotal: number;
  netProfit: number;
  profitMarginPercent: number;
  sections: CostTrackingSection[];
  costCenters: CostCenter[];
  smartInsights: Array<{ title: string; value: string; notes: string; tone: StatusTone }>;
};

export type DashboardData = {
  salesEstimate: number;
  inventoryValue: number;
  lowStockCount: number;
  openPurchaseOrders: number;
  foodCostPercent: number;
  highCostRecipes: Recipe[];
  alerts: Notification[];
  inventoryByCategory: ReportPoint[];
  purchaseCost30Days: ReportPoint[];
  foodCostTrend: ReportPoint[];
  wasteByBranch: ReportPoint[];
};

export type AdminMetric = {
  label: string;
  value: string;
  delta: string;
  tone: StatusTone;
};
