# ملف المشروع السحابي: rewaq

هذا الملف هو مرجع تشغيل وربط مشروع **rewaq** مع Supabase وGitHub.  
الغرض منه أن يكون عندك مكان واحد فيه كل تفاصيل المشروع المهمة بدون وضع كلمات مرور أو مفاتيح سرية.

## 1. معلومات المشروع

- اسم المنتج: rewaq
- نوع المشروع: منصة SaaS عربية RTL لإدارة المطاعم والكافيهات والمطابخ السحابية
- مجلد المشروع المحلي: `C:\Users\M.S.I\Downloads\rewaq-saas`
- إطار العمل: Next.js App Router
- اللغة: TypeScript
- التصميم: Tailwind CSS + shadcn/ui style
- قاعدة البيانات: Supabase PostgreSQL
- المصادقة: Supabase Auth
- التخزين: Supabase Storage
- الحماية: Supabase RLS

## 2. روابط المشروع

### Supabase

- رابط المشروع: `https://thusfzjbzzcevvgddoxs.supabase.co`
- Project Ref: `thusfzjbzzcevvgddoxs`
- لوحة التحكم:
  `https://supabase.com/dashboard/project/thusfzjbzzcevvgddoxs`

### GitHub

- المستودع:
  `https://github.com/OSAMAALHALLQ1/rewaq.git`
- الفرع الرئيسي: `main`
- آخر رفع مؤكد: `389f571 Connect Supabase database automation`

## 3. ملفات البيئة المطلوبة

يجب وجود ملف محلي باسم:

```text
.env.local
```

المتغيرات المطلوبة:

```env
NEXT_PUBLIC_SUPABASE_URL=https://thusfzjbzzcevvgddoxs.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=ضع_المفتاح_العام_من_Supabase
DATABASE_URL=ضع_رابط_قاعدة_البيانات_أو_Transaction_Pooler
SUPABASE_SERVICE_ROLE_KEY=
```

مهم:

- لا ترفع `.env.local` إلى GitHub.
- لا تضع كلمة مرور قاعدة البيانات في ملفات Markdown أو README.
- لا تستخدم `SUPABASE_SERVICE_ROLE_KEY` داخل المتصفح.
- `SERVICE_ROLE_KEY` يبقى للسيرفر فقط عند الحاجة لعمليات أدمن قوية.

## 4. أوامر التشغيل

تثبيت الحزم:

```powershell
npm install
```

تشغيل الموقع محليًا:

```powershell
npm run dev
```

رابط المعاينة المحلي:

```text
http://localhost:3000
```

فحص جودة الكود:

```powershell
npm run lint
npx tsc --noEmit
```

## 5. أوامر قاعدة البيانات

تطبيق كل ملفات SQL على Supabase:

```powershell
npm run db:apply
```

هذا الأمر يشغل:

```text
scripts/apply-supabase-sql.ps1
```

ويطبق الملفات بالترتيب:

```text
db/migrations/001_initial_schema.sql
db/migrations/002_pos_inventory_backend.sql
db/seed.sql
```

ملاحظة:

- Supabase CLI لا يدعم التثبيت العالمي عبر `npm install -g supabase`.
- إذا احتجت CLI، استخدم الطرق الرسمية أو اعتمد على MCP/Supabase SQL Editor.
- على Windows قد تحتاج استخدام Transaction Pooler في `DATABASE_URL` إذا كان الاتصال المباشر يواجه مشكلة IPv6.

## 6. ملفات SQL الأساسية

### 001_initial_schema.sql

ينشئ الأساس العام للمنصة:

- المنظمات
- الملفات الشخصية
- الفروع
- العضويات
- الأدوار
- الخطط والاشتراكات
- الوحدات والتحويلات
- فئات المخزون
- الموردين
- مواد المخزون
- رصيد الفروع
- حركات المخزون
- الجرد
- الهدر
- التحويلات بين الفروع
- طلبات الشراء
- فواتير الموردين
- فواتير العملاء الأساسية
- الوصفات
- أطباق المنيو
- التسويق
- الأتمتة
- الإشعارات
- لوحة الأدمن
- RLS Policies
- Storage Bucket باسم `social-assets`

### 002_pos_inventory_backend.sql

ينشئ طبقة الكاشير والتكامل الحقيقي مع المخزون:

- أصناف البيع
- باركودات الأصناف
- مدفوعات فواتير العملاء
- قيود التكاليف اليومية
- ملخص المبيعات اليومي
- دالة البحث بالباركود
- دالة رقم الفاتورة التالي
- دالة إصدار فاتورة عميل
- خصم تلقائي من المخزون عند البيع
- خصم مكونات الوصفة عند بيع وجبة
- تسجيل حركات المخزون
- تسجيل إجمالي الربح والتكلفة
- View باسم `amwali_daily_summary`

### seed.sql

يزرع بيانات تجربة:

- مطعم التايلندي
- فرع شارع عبد القادر الحسيني
- فرع الرمال
- مورد الدجاج
- مورد الخضار
- مورد التغليف
- مواد مخزون
- وصفات
- أطباق قائمة
- أصناف كاشير
- باركودات
- فواتير عملاء
- قوالب تسويق
- إشعارات
- Feature Flags

## 7. أهم الجداول في Supabase

### النظام والصلاحيات

- `organizations`
- `profiles`
- `branches`
- `organization_memberships`
- `plans`
- `subscriptions`

### المخزون

- `inventory_categories`
- `inventory_items`
- `units`
- `unit_conversions`
- `branch_stock`
- `stock_movements`
- `stock_counts`
- `stock_count_items`
- `waste_logs`
- `transfers`
- `transfer_items`

### المشتريات

- `suppliers`
- `purchase_orders`
- `purchase_order_items`
- `invoices`
- `invoice_items`
- `supplier_price_history`

### الوصفات والمنيو

- `recipes`
- `recipe_ingredients`
- `menu_items`
- `menu_item_recipe_mapping`

### الكاشير والفواتير

- `catalog_items`
- `item_barcodes`
- `customer_invoices`
- `customer_invoice_items`
- `customer_invoice_payments`

### أموالي والتكاليف

- `daily_cost_entries`
- `sales_daily_summaries`
- `amwali_daily_summary`

### التسويق

- `social_accounts`
- `social_posts`
- `social_post_targets`
- `social_media_assets`
- `social_publish_jobs`
- `social_publish_logs`
- `social_templates`

### الأتمتة والإشعارات

- `automation_rules`
- `automation_runs`
- `notifications`

### الأدمن

- `feature_flags`
- `system_logs`
- `support_tickets`

## 8. أهم الدوال في قاعدة البيانات

### find_catalog_item_by_barcode

تبحث عن صنف كاشير من خلال الباركود:

```sql
public.find_catalog_item_by_barcode(organization_id, barcode)
```

تستخدم في شاشة البيع السريعة عند مسح الباركود.

### next_invoice_number

تولّد رقم فاتورة يومي:

```sql
public.next_invoice_number(organization_id)
```

### issue_customer_invoice

تصدر فاتورة عميل حقيقية:

```sql
public.issue_customer_invoice(...)
```

ماذا تفعل:

- تتحقق من تسجيل الدخول.
- تتحقق من صلاحية المستخدم على الفرع.
- تنشئ فاتورة عميل.
- تنشئ عناصر الفاتورة.
- تخصم المخزون.
- تخصم مكونات الوصفة تلقائيًا عند بيع وجبة.
- تنشئ `stock_movements`.
- تنشئ دفعة في `customer_invoice_payments`.
- تحدث ملخص اليوم في `sales_daily_summaries`.
- تحسب التكلفة والربح.

## 9. الصفحات المهمة في الموقع

### صفحات عامة

- `/`
- `/pricing`
- `/request-demo`

### مصادقة

- `/login`
- `/register`
- `/forgot-password`

### لوحة التحكم

- `/dashboard`
- `/dashboard/branches`
- `/dashboard/inventory`
- `/dashboard/items`
- `/dashboard/stock-counts`
- `/dashboard/waste`
- `/dashboard/transfers`

### الكاشير والفواتير

- `/dashboard/customer-invoices/new`
- `/dashboard/customer-invoices`
- `/dashboard/tables`
- `/dashboard/sales-returns`
- `/print/customer-invoices/[id]`
- `/r/customer-invoices/[id]`
- `/r/customer-invoices/[id]/image`

### المشتريات

- `/dashboard/suppliers`
- `/dashboard/purchase-orders`
- `/dashboard/invoices`

### الوصفات والمنيو

- `/dashboard/recipes`
- `/dashboard/menu-items`
- `/dashboard/food-cost`

### أموالي والتقارير

- `/dashboard/amwali`
- `/dashboard/cost-accounting`
- `/dashboard/financial-calendar`
- `/dashboard/reports`

### التسويق

- `/dashboard/marketing`
- `/dashboard/marketing/create`
- `/dashboard/marketing/calendar`
- `/dashboard/marketing/accounts`

### الدفع المباشر

- `/dashboard/bill-payments`
- `/dashboard/direct-debit`

### الإعدادات والأدمن

- `/dashboard/settings`
- `/dashboard/settings/users`
- `/dashboard/billing`
- `/admin`

## 10. ميزات منفذة

- واجهة عربية RTL.
- Landing page عربي.
- Auth عبر Supabase مع fallback demo mode.
- Dashboard.
- Sidebar عربية.
- مخزون.
- موردين.
- مشتريات.
- وصفات وتكلفة وصفات.
- منيو.
- شاشة بيع سريعة.
- بحث بالصنف.
- دعم باركود.
- فواتير عملاء.
- QR للفاتورة.
- صفحة فاتورة للعميل عند مسح QR.
- صفحة صورة للفاتورة.
- قوالب فواتير متعددة.
- تخصيص QR للفاتورة أو السوشيال.
- إدارة طاولات.
- فصل فاتورة.
- ورديات.
- عملاء وذمم.
- دفع فواتير.
- خصم مباشر.
- أموالي: تتبع كل شيكل.
- تقويم مالي.
- تسويق ونشر وهمي.
- إشعارات.
- لوحة أدمن.
- SQL كامل مع RLS.
- Seed data.

## 11. نقاط مهمة عن الحماية

- كل الجداول الأساسية فيها `organization_id`.
- RLS مفعل على جداول `public`.
- سياسات الوصول تعتمد على:
  - `is_org_member`
  - `can_access_branch`
  - `has_org_role`
  - `is_super_admin`
- الزائر غير المسجل لا يستطيع تشغيل دوال الفاتورة والباركود.
- دوال الكاشير متاحة للمستخدم المسجل فقط.
- View أموالي تستخدم `security_invoker`.
- توكنات السوشيال لا يجب تخزينها نصًا عاديًا في الإنتاج.

## 12. ما يحتاج عمله من طرف صاحب المشروع

في Supabase:

1. تأكيد وجود الجداول.
2. تأكيد تفعيل RLS.
3. ضبط Auth URL:

```text
Site URL: http://localhost:3000
Redirect URLs: http://localhost:3000/**
```

4. عند النشر، أضف رابط الموقع الحقيقي إلى Redirect URLs.
5. أخذ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ووضعه في `.env.local`.
6. وضع `DATABASE_URL` في `.env.local` عند الحاجة لتشغيل `npm run db:apply`.

في المشروع:

1. تشغيل:

```powershell
npm install
npm run dev
```

2. فتح:

```text
http://localhost:3000
```

3. للفحص:

```powershell
npm run lint
npx tsc --noEmit
```

## 13. أمور مستقبلية مطلوبة للإنتاج

- ربط Facebook Graph API الحقيقي.
- ربط Instagram Content Publishing API الحقيقي.
- ربط Telegram Bot API الحقيقي.
- تشفير social tokens عبر Supabase Vault أو KMS.
- ربط POS imports.
- OCR لفواتير الموردين.
- Billing حقيقي.
- صلاحيات أدق لكل زر داخل الكاشير.
- تقارير محاسبية أعمق.
- ربط قارئ باركود USB وكاميرا موبايل فعليًا.
- توليد PDF رسمي للفواتير من السيرفر.
- تحويل demo queries إلى Supabase queries كاملة في كل الصفحات.

## 14. ملاحظات تشغيل مهمة

- المشروع يعمل حتى بدون مفاتيح Supabase عبر demo mode.
- عند تفعيل مفاتيح Supabase يبدأ Auth الحقيقي بالعمل.
- دوال الكاشير الحقيقية موجودة في Supabase، لكن بعض صفحات القراءة ما زالت تستخدم demo data لحين تحويل كل queries إلى Supabase.
- الفاتورة والباركود وقاعدة البيانات جاهزة كبنية Backend، وتحتاج إكمال ربط كل واجهات القراءة مع الجداول الحقيقية حسب الأولوية.

## 15. آخر تحقق معروف

تم تنفيذ:

```powershell
npm run lint
npx tsc --noEmit
```

والنتيجة كانت ناجحة.

تم التحقق من Supabase:

- عدد جداول public: 47
- عدد سياسات RLS: 169
- بيانات منظمة تجريبية: موجودة
- مواد مخزون: موجودة
- أصناف كاشير: موجودة
- باركودات: موجودة
- فواتير عملاء: موجودة
- دوال الكاشير: موجودة

