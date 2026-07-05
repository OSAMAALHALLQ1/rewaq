# TAKA Production Readiness Review

تاريخ المراجعة: 2026-06-23

## الملخص التنفيذي

المشروع قابل للتشغيل كمطعم واحد صغير/متوسط، ونجح `npm run build` بعد المراجعة. لكنه ليس جاهزا كمنتج إنتاجي قوي بقيمة 7000-10000 دولار قبل نقل جزء من المنطق الحساس من المتصفح إلى Supabase Database Functions/RPC، وتطبيق RLS حقيقي مبني على Supabase Auth، وإصلاح نموذج البيانات للفواتير والطلبات.

تقييم الجاهزية الحالي: **58%**

بعد تطبيق التعديلات الأولية الموجودة في هذا الفرع، وخصوصا `src/db/production_hardening.sql` في بيئة staging مع Supabase Auth: **72-78%**

الهدف الواقعي قبل تسليم إنتاجي مدفوع: **85%+** بعد اختبار ضغط فعلي، ومراقبة، ونسخ احتياطي، وترقية خطة Supabase عند الحاجة.

## مصادر مرجعية

- Supabase تنبه أن RLS يجب أن يكون مفعلا على الجداول الموجودة في schema مكشوفة مثل `public`، ويمكن دمجه مع Supabase Auth لحماية الوصول من المتصفح: https://supabase.com/docs/guides/database/postgres/row-level-security
- حدود Supabase Realtime الحالية للخطة المجانية: 200 اتصال متزامن، 100 رسالة/ثانية، وحصة 2 مليون رسالة Realtime شهريا ضمن صفحة الفوترة: https://supabase.com/docs/guides/realtime/limits و https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase توصي باستخدام Database Functions للعمليات كثيفة البيانات، وتوصي بتقييد صلاحيات تنفيذ الدوال وعدم تركها عامة: https://supabase.com/docs/guides/database/functions

## ما تم تحسينه في الكود أثناء المراجعة

1. أضفت مولد IDs مركزي في `src/utils/ids.js` لاستخدام `crypto.randomUUID()` عند توفره.
2. عدلت إرسال الطلب في `src/components/WaiterView.jsx` لمنع الضغط المزدوج أثناء الحفظ، واستبدلت `Date.now()` كمعرف طلب بمعرف أقوى.
3. عدلت إغلاق الفاتورة في `src/components/CashierView.jsx` ليستخدم رقم فاتورة ثابت لنفس جلسة الطاولة، ويعمل upsert محلي بدل إضافة فاتورة ثانية لنفس الجلسة.
4. عدلت `src/utils/storage/core.js` لتجميع mutations المتكررة في sync queue بدل تراكم نفس العملية عدة مرات.
5. عدلت `src/utils/storage/sync.js` لإضافة retry backoff، ولحصر عمليات الحذف بـ `restaurant_id`.
6. عدلت `src/utils/storage/notifications.js` لمنع تكرار نفس التنبيه خلال نافذة قصيرة.
7. أضفت ملف SQL إنتاجي `src/db/production_hardening.sql` يحتوي فهارس، قيود، RLS مقترح، ودوال `submit_order` و `close_table_invoice` كعمليات ذرية.

## النتائج حسب المحاور

### 1. جودة هيكلية قاعدة البيانات

الخطورة: عالية

المشكلة: الجداول الحالية تعتمد كثيرا على JSONB مثل `tables.current_order` و `dept_orders.items`. هذا سريع للبدء، لكنه يصعب التدقيق، العلاقات، التقارير، والتحكم بالصلاحيات لكل صنف. كذلك `supabase_schema.sql` لا يحتوي أعمدة يستخدمها الكود فعليا مثل `bills.seated_at`, `bills.seated_duration`, `bills.waiter_code`, `employees.restaurant_name`, و `tables.description`.

الدليل: `supabase_schema.sql` يعرف `bills` حتى `restaurant_id` فقط، بينما `BILL_FIELD_MAP` في `src/utils/storage/constants.js` يرسل أعمدة إضافية.

الحل المقترح:

- قصير المدى: تطبيق الأعمدة والفهارس والقيود من `src/db/production_hardening.sql`.
- متوسط المدى: إضافة جداول normalized:
  - `orders`
  - `order_items`
  - `table_sessions`
  - `payments`
  - `audit_events`
- إبقاء `current_order` كـ cache فقط، وليس مصدر الحقيقة الوحيد.

### 2. RLS والصلاحيات

الخطورة: حرجة

المشكلة: ملف `src/db/supabase_saas_migration.sql` يفعل RLS لكنه يضع `USING (true)` لكل الجداول. هذا يعني أن RLS موجود شكليا لكنه لا يمنع القراءة أو الكتابة. بما أن التطبيق يستخدم Supabase مباشرة من المتصفح، فهذا أخطر جزء في النظام.

الدليل: سياسات `USING (true)` في `src/db/supabase_saas_migration.sql`.

الحل المقترح:

- نقل تسجيل الدخول إلى Supabase Auth.
- تخزين `restaurant_id` و `role` في JWT app_metadata.
- تطبيق سياسات مثل الموجودة في `src/db/production_hardening.sql`.
- منع الوصول المباشر لجدول `employees` من غير المدير.
- إنشاء view آمن مثل `employee_profiles` بدون passwords أو phone/session tokens.

مثال من الملف الجديد:

```sql
CREATE POLICY bills_read_cashier_manager ON public.bills
FOR SELECT TO authenticated
USING (
  restaurant_id = public.app_restaurant_id()
  AND public.has_app_role(ARRAY['manager', 'admin', 'cashier'])
);
```

### 3. منع تكرار الطلبات والرسائل

الخطورة: عالية

المشكلة: الطلبات والفواتير كانت تعتمد على `Date.now()`، والعمليات الحساسة تنقسم إلى عدة writes منفصلة. عند ضعف الإنترنت أو الضغط مرتين يمكن حدوث تكرار طلب، تكرار تنبيه، أو فاتورة مكررة.

ما تم تحسينه:

- قفل إرسال الطلب في الواجهة.
- IDs أقوى.
- رقم فاتورة ثابت لجلسة الطاولة.
- منع تكرار التنبيه خلال 8 ثوان.
- coalescing للـ sync queue.

الحل النهائي:

- إضافة `idempotency_key` لكل عملية حساسة.
- جعل إنشاء الطلب وإغلاق الفاتورة عبر RPC داخل قاعدة البيانات.
- استخدام unique indexes:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS bills_restaurant_idempotency_uidx
  ON public.bills (restaurant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

### 4. تحمل مطعم 40 طاولة و20 موظف

الخطورة: متوسطة

التقييم: من حيث عدد المستخدمين، Supabase Free يكفي مبدئيا: 20 موظف أقل من حد 200 اتصال Realtime متزامن. لكن الضغط ليس فقط اتصالات؛ هو عدد رسائل Realtime، وعدد writes، وحجم payload بسبب JSONB.

تقدير عملي:

- 20 موظف × قناة واحدة لكل جهاز = جيد.
- إذا كل عملية طلب تولد 3-8 تغييرات، وكل تغيير يصل لكل المستخدمين، فمطعم متوسط قد يقترب من حصة 2 مليون رسالة شهريا على الخطة المجانية.
- لمشروع مدفوع وقيمة عالية، الخطة المجانية تصلح للتجربة أو أول تشغيل محدود، لكن لا أنصح بها كضمان إنتاجي.

الحل المقترح:

- استخدام Pro عند التسليم الحقيقي.
- فصل Realtime حسب الدور: الجرسون لا يحتاج كل تحديثات الموظفين، والمطبخ لا يحتاج كل الفواتير.
- تقليل payload بتقليل JSONB الكبير في Realtime.

### 5. Realtime

الخطورة: متوسطة إلى عالية

المشكلة: الكود يشترك في قناة واحدة ويراقب 7 جداول: `tables`, `dept_orders`, `bills`, `menu`, `employees`, `departments`, `notifications`. هذا مريح لكنه يزيد الرسائل والاستهلاك والتحديثات غير الضرورية لكل دور.

الدليل: الاشتراكات تبدأ في `src/utils/storage/sync.js` حول `supabase.channel('taka_main_channel')`.

الحل المقترح:

- قنوات حسب الدور:
  - `waiter_channel`: `tables`, `dept_orders`, notifications الخاصة بالجرسون.
  - `kitchen_channel`: `dept_orders` للأصناف kitchen فقط.
  - `cashier_channel`: `tables`, `bills`, notifications الخاصة بالحساب.
  - `manager_channel`: التقارير والإعدادات.
- عدم بث `employees` للكل.
- استخدام `broadcast` أو جدول events خفيف للإشعارات بدل تخزين كل تنبيه كصف دائم عند كل حدث.

### 6. الأداء والفهارس

الخطورة: عالية مع زيادة البيانات

المشكلة: الاستعلامات تعتمد على `restaurant_id`, `timestamp`, `table_id`, `status`, `target_department`, لكن schema الأساسي لا يضيف فهارس لهذه الأعمدة.

الحل المطبق كملف SQL:

- `tables(restaurant_id, status)`
- `dept_orders(restaurant_id, table_id)`
- `dept_orders(restaurant_id, status)`
- `bills(restaurant_id, timestamp DESC)`
- `bills(restaurant_id, table_id, timestamp DESC)`
- `notifications(restaurant_id, read, timestamp DESC)`
- `menu(restaurant_id, department, available)`
- unique indexes على employee code/username لكل مطعم.

### 7. منطق الطلبات والفواتير والإشعارات

الخطورة: حرجة

المشكلة: إغلاق الفاتورة حاليا يعمل كثلاث عمليات منفصلة:

1. حفظ فاتورة.
2. تصفير الطاولة.
3. حذف طلبات الأقسام.

إذا فشلت خطوة في المنتصف، تظهر حالة غير متسقة: فاتورة موجودة والطاولة لم تصفر، أو طاولة تصفرت وطلبات الأقسام بقيت.

الحل: استخدام `close_table_invoice` داخل `src/db/production_hardening.sql`. PostgreSQL function تنفذ داخل transaction واحدة، وتستخدم `FOR UPDATE` لقفل الطاولة أثناء الإغلاق.

### 8. جودة الباك إند والمعمارية

الخطورة: عالية

المشكلة: الباك إند حاليا هو “Supabase مباشر من الواجهة + IndexedDB”. هذا يصلح كـ MVP، لكنه لا يكفي لوصف النظام بأنه backend صلب. المنطق التجاري موجود في React components، وليس في قاعدة البيانات أو service layer.

الحل المقترح:

- نقل العمليات الحساسة إلى Supabase RPC:
  - `submit_order`
  - `close_table_invoice`
  - `update_item_status`
  - `request_bill`
- إضافة audit table لكل عملية حساسة: من فعلها، متى، role، device/session.
- فصل auth عن جدول employees.
- استخدام migrations رسمية بدلا من ملفات SQL يدوية متفرقة.

### 9. Transactions / Functions

الخطورة: حرجة

المشكلة: لا توجد transaction حقيقية في عمليات الطلب والفاتورة. الاعتماد على سلسلة await في المتصفح لا يضمن atomicity.

الحل:

- استخدم الدوال الموجودة في `src/db/production_hardening.sql`.
- امنع تنفيذها من `anon`.
- اسمح بها لـ `authenticated` فقط.

مثال استدعاء مستقبلي من الواجهة:

```js
await supabase.rpc('close_table_invoice', {
  p_bill_id: billId,
  p_table_id: selectedTable.id,
  p_payment_method: paymentMethod,
  p_cashier_code: employee.code,
  p_cashier_name: employee.name,
  p_notes: cashierNote
});
```

### 10. نقاط ضعف تصميمية قد تسبب بطء أو أخطاء

الخطورة: متوسطة إلى عالية

- كلمات مرور الموظفين وأكوادهم موجودة في جدول `employees` وتقرأها الواجهة.
- تسجيل المدير كان hardcoded في component، وتم تحسينه جزئيا، لكنه ما زال ليس auth إنتاجي.
- `restaurant_id` يحدد من localStorage في `src/utils/storage/tenant.js`، وهذا ليس حماية.
- الاعتماد على JSONB كبير في Realtime قد يزيد payload.
- لا يوجد tests للسيناريوهات الحرجة: إرسال طلب مرتين، إغلاق فاتورة أثناء انقطاع النت، أكثر من كاشير يغلق نفس الطاولة.
- `npm run lint` يفشل حاليا بـ 54 مشكلة، أغلبها جودة/React lint قديمة، رغم أن `npm run build` نجح.

## توصيات تنفيذ مرتبة بالأولوية

### P0 قبل أي تسليم إنتاجي

1. لا تستخدم `USING (true)` في Supabase إطلاقا.
2. انقل تسجيل الدخول إلى Supabase Auth.
3. طبق RLS مبني على JWT claims.
4. انقل إغلاق الفاتورة وإنشاء الطلب إلى RPC transactions.
5. أصلح schema mismatch للأعمدة الناقصة.

### P1 قبل التشغيل في مطعم حقيقي

1. طبق الفهارس من `production_hardening.sql`.
2. افصل Realtime حسب الدور.
3. أضف audit logs.
4. اختبر 20 مستخدم متزامن بسيناريوهات فعلية.
5. أضف مراقبة للأخطاء: Sentry أو Logtail أو Supabase logs.

### P2 بعد أول تشغيل

1. نقل التقارير لجداول normalized أو materialized views.
2. أرشفة الفواتير القديمة.
3. إنشاء backup/restore checklist.
4. إضافة rate limiting للعمليات الحساسة.
5. إضافة لوحة صحة النظام: connection status, pending sync queue, failed mutations.

## قرار الإنتاج

لا أوصي بتسليم النظام حاليا كمنتج production نهائي قبل تطبيق P0. أراه صالحا لتجربة ميدانية مضبوطة أو pilot داخلي، بشرط وجود نسخة احتياطية ومراقبة، وعدم فتحه كمنتج SaaS أو نشره لعدة مطاعم قبل إصلاح RLS/auth/transactions.

بعد تطبيق `production_hardening.sql` في staging، وربط Supabase Auth، وتحويل إرسال الطلب والدفع إلى RPC، يصبح المشروع مناسبا لمطعم 40 طاولة و20 موظف بدرجة جيدة، خصوصا على خطة Supabase Pro.
