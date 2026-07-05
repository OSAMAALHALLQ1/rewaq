export const DB_NAME = 'taka_restaurant_v2';
export const DB_VERSION = 1;
export const STORE_NAME = 'records';

export const TABLES_KEY = 'tables';
export const EMPLOYEES_KEY = 'employees';
export const BILLS_KEY = 'bills';
export const NOTIFICATIONS_KEY = 'notifications';
export const MENU_KEY = 'menu';
export const DEPT_ORDERS_KEY = 'department_orders';
export const SESSION_KEY = 'session';
export const DEPARTMENTS_KEY = 'departments';
export const ARCHIVES_KEY = 'invoice_archives';


export const TAX_RATE = 0.0;
export const SERVICE_RATE = 0.0;
export const MAX_NOTIFICATIONS = 30;
export const MAX_BILLS_KEPT = 1000;

export const TABLE_FIELD_MAP = {
  id: 'id',
  name: 'name',
  seats: 'seats',
  area: 'area',
  status: 'status',
  currentOrder: 'current_order',
  notes: 'notes',
  subtotal: 'subtotal',
  tax: 'tax',
  serviceCharge: 'service_charge',
  total: 'total',
  waiterCode: 'waiter_code',
  seatedAt: 'seated_at',
  guests: 'guests',
  restaurantId: 'restaurant_id'
};

export const EMPLOYEE_FIELD_MAP = {
  id: 'id',
  name: 'name',
  nameEn: 'name_en',
  role: 'role',
  username: 'username',
  password: 'password',
  code: 'code',
  phone: 'phone',
  email: 'email',
  salary: 'salary',
  active: 'active',
  lastLogin: 'last_login',
  restaurantName: 'restaurant_name',
  restaurantId: 'restaurant_id'
};

export const MENU_FIELD_MAP = {
  id: 'id',
  nameAr: 'name_ar',
  nameEn: 'name_en',
  name: 'name',
  category: 'category',
  price: 'price',
  description: 'description',
  image: 'image',
  department: 'department',
  available: 'available',
  prepTime: 'prep_time',
  restaurantId: 'restaurant_id'
};

export const DEPARTMENT_FIELD_MAP = {
  id: 'id',
  name: 'name',
  nameEn: 'name_en',
  image: 'icon',
  color: 'color',
  description: 'description',
  workHours: 'work_hours',
  activeOrders: 'active_orders',
  lastOrderAt: 'last_order_at',
  restaurantId: 'restaurant_id'
};

export const BILL_FIELD_MAP = {
  id: 'id',
  tableId: 'table_id',
  tableName: 'table_name',
  cashierCode: 'cashier_code',
  cashierName: 'cashier_name',
  timestamp: 'timestamp',
  dateFormatted: 'date_formatted',
  timeFormatted: 'time_formatted',
  items: 'items',
  subtotal: 'subtotal',
  tax: 'tax',
  serviceCharge: 'service_charge',
  total: 'total',
  paymentMethod: 'payment_method',
  notes: 'notes',
  waiterCode: 'waiter_code',
  seatedAt: 'seated_at',
  seatedDuration: 'seated_duration',
  restaurantId: 'restaurant_id'
};

export const NOTIFICATION_FIELD_MAP = {
  id: 'id',
  title: 'title',
  message: 'message',
  type: 'type',
  targetRoles: 'target_roles',
  targetRole: 'target_role',
  targetDepartment: 'target_department',
  timestamp: 'timestamp',
  read: 'read',
  restaurantId: 'restaurant_id'
};

export const DEPT_ORDER_FIELD_MAP = {
  id: 'id',
  tableId: 'table_id',
  tableName: 'table_name',
  waiterCode: 'waiter_code',
  waiterName: 'waiter_name',
  timestamp: 'timestamp',
  items: 'items',
  subtotal: 'subtotal',
  tax: 'tax',
  serviceCharge: 'service_charge',
  total: 'total',
  status: 'status',
  restaurantId: 'restaurant_id'
};

export const ARCHIVE_FIELD_MAP = {
  id: 'id',
  archiveName: 'archive_name',
  createdAt: 'created_at',
  invoiceCount: 'invoice_count',
  totalAmount: 'total_amount',
  pdfData: 'pdf_data',
  restaurantId: 'restaurant_id'
};

