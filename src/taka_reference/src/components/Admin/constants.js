export const ROLE_COLORS = {
  manager: '#e74c3c', waiter: '#3498db', cashier: '#9b59b6',
  kitchen: '#e67e22', bar: '#1abc9c', shisha: '#27ae60'
};

export const ROLE_LABELS = {
  manager: 'مدير', waiter: 'جرسون', cashier: 'محاسب',
  kitchen: 'مطبخ', bar: 'بار', shisha: 'شيشة'
};

export const STATUS_LABELS = { 
  empty: 'فاضية', 
  eating: 'مشغولة', 
  bill_requested: 'تنتظر دفع', 
  unavailable: 'غير متوفرة' 
};

export const STATUS_COLORS = { 
  empty: '#27ae60', 
  eating: '#e74c3c', 
  bill_requested: '#f39c12', 
  unavailable: '#555' 
};

export const CATEGORY_LABELS = { 
  hot_drinks: 'مشروبات ساخنة',
  cold_drinks: 'مشروبات باردة',
  soft_drinks: 'مشروبات غازية',
  drinks: 'مشروبات',
  appetizers: 'مقبلات',
  salads_western: 'سلطات غربية',
  salads_eastern: 'سلطات شرقية',
  mains: 'وجبات رئيسية',
  sandwiches: 'سندوتشات',
  breakfast: 'إفطار فلسطيني',
  shisha: 'أراجيل',
  shisha_addons: 'إضافات الأراجيل'
};

export const AREA_LABELS = { 
  indoor: 'داخلي', 
  outdoor: 'خارجي', 
  terrace: 'شرفة' 
};

export const PERMISSIONS = [
  { key: 'add_order', label: 'إضافة طلب', manager: true, waiter: true, cashier: false, kitchen: false, bar: false, shisha: false },
  { key: 'view_order', label: 'عرض الطلبات', manager: true, waiter: true, cashier: true, kitchen: true, bar: true, shisha: true },
  { key: 'edit_order', label: 'تعديل طلب', manager: true, waiter: true, cashier: false, kitchen: false, bar: false, shisha: false },
  { key: 'update_status', label: 'تحديث حالة طلب', manager: true, waiter: false, cashier: false, kitchen: true, bar: true, shisha: true },
  { key: 'view_bill', label: 'عرض فاتورة', manager: true, waiter: true, cashier: true, kitchen: false, bar: false, shisha: false },
  { key: 'close_bill', label: 'إغلاق فاتورة', manager: true, waiter: false, cashier: true, kitchen: false, bar: false, shisha: false },
  { key: 'add_menu', label: 'إضافة منيو', manager: true, waiter: false, cashier: false, kitchen: false, bar: false, shisha: false },
  { key: 'reports', label: 'عرض التقارير', manager: true, waiter: false, cashier: false, kitchen: false, bar: false, shisha: false },
];
