# تدقيق تجربة رواق الموحدة

**الحالة:** خط أساس قبل إعادة التصميم  
**النطاق:** واجهة رواق الحالية (Next.js App Router)، مع الحفاظ على POS والمحاسبة والمخزون والعزل بين المؤسسات.  
**التاريخ:** 2026-07-10

## خلاصة تنفيذية

رواق يمتلك أساساً وظيفياً جيداً: مسارات عربية RTL، غلافاً مستمراً لتطبيق لوحة التحكم، شريطاً جانبياً واعياً بالدور، بحثاً عاماً، واجهات محاسبة ومخزون ومشتريات، وPOS تشغيلياً مستقلاً مع طبقة offline. لكن التجربة ما زالت مجموعة صفحات: أغلب القوائم جداول ثابتة متفرقة، والتفاعل ينتقل إلى صفحة أخرى بدلاً من الاحتفاظ بالسياق، كما أن الشريط العلوي لا يملك سياق مستودع أو إنشاء موحد أو مركز موافقات أو لوحة أوامر كاملة.

المسار الآمن ليس استبدال الصفحات دفعة واحدة. نضيف طبقة Workspace فوق المكونات الحالية، ثم نرحّل القوائم عالية التكرار إلى مكونات موحدة واحدة تلو الأخرى. لا تتغير استعلامات البيانات أو server actions أو قواعد المحاسبة/المخزون خلال مرحلة الواجهة.

## ما يجب ألا ينكسر

- عزل المؤسسة/الفرع والصلاحيات: نطاق القراءة من `resolveScope`، ونطاق التعديلات من `resolveMutationScope` و`resolveAccountingScope`؛ لا يوجد مسار بديل لاختيار أول مؤسسة.
- ترحيل المحاسبة عبر `src/lib/accounting/posting.ts` فقط، مع تاريخ المستند الحقيقي وفحص الفترة المغلقة.
- السجلات المالية والمخزنية والتدقيقية غير قابلة للحذف؛ التصحيح بعكس أو تسوية أو تعديل موثق.
- POS في `/d/pos`، والـKDS وExpo وGate ضمن مساحة تشغيلية مستقلة، بما في ذلك offline queue في `src/lib/db/offline.ts`.
- استعلامات وserver actions الحالية، RLS، وصلاحيات الصفحات. إخفاء عنصر تنقل ليس بديلاً عن التحقق في الخادم.

## خريطة المسارات الحالية

| المجال | المسارات الحالية | الملاحظة التصميمية |
| --- | --- | --- |
| الدخول والعامة | `/`, `/pricing`, `/request-demo`, `/login`, `/register`, `/forgot-password`, `/pending-approval` | خارج Workspace التشغيلي. |
| التشغيل المباشر | `/d/pos`, `/d/kitchen`, `/d/expo`, `/d/inventory`, `/d/gate` | مساحة كاملة مستقلة؛ POS غني ويجب دمجه تدريجياً فقط. |
| لوحة القرار | `/dashboard` | لوحة مالية/وصول سريع أكثر من كونها مركز استثناءات تشغيلية. |
| المبيعات | `/dashboard/customer-invoices`, `/dashboard/customer-invoices/new`, `/dashboard/customers`, `/dashboard/sales-returns`, `/dashboard/shifts`, `/dashboard/tables` | القوائم تحتاج قالب Work List وفتح سجل ضمن Drawer. |
| المنتجات والتكلفة | `/dashboard/items`, `/dashboard/menu-items`, `/dashboard/menu-items/[id]`, `/dashboard/modifiers`, `/dashboard/recipes`, `/dashboard/recipes/[id]`, `/dashboard/production`, `/dashboard/food-cost`, `/dashboard/cost-accounting` | صفحات كيان وتفاصيل موجودة، لكن الارتباط السياقي غير موحد. |
| المخزون | `/dashboard/inventory`, `/dashboard/inventory/dashboard`, `/dashboard/inventory/[id]`, `/dashboard/warehouses`, `/dashboard/warehouses/[id]`, `/dashboard/stock-movements`, `/dashboard/stock-counts`, `/dashboard/transfers`, `/dashboard/waste` | أعلى أولوية للترحيل بعد لوحة القرار؛ الجرد الحالي ليس grid سريعاً موحداً. |
| المشتريات | `/dashboard/suppliers`, `/dashboard/invoices`, `/dashboard/purchase-orders` | توجد طبقات receiving وsupplier invoice، لكن تدفق Need → PO → Receipt → Invoice → Payment غير معروض كرحلة واحدة. |
| المحاسبة | `/dashboard/accounting`، و`accounts`, `ledger`, `ledger/new`, `journal`, `vouchers`, `payables`, `receivables`, `expenses`, `cost-centers`, `closing`, `settings`, `trial-balance`, `p-and-l`, `balance-sheet`, `cash-flow`, `tax` | محتوى متخصص قوي؛ يحتاج وضع محاسب واضحاً لا تغيير المنطق المحاسبي. |
| التقارير والخدمات | `/dashboard/reports`, `/dashboard/amwali`, `/dashboard/bill-payments`, `/dashboard/direct-debit`, `/dashboard/smart-savings`, `/dashboard/financial-calendar` | التسميات والتجميع تحتاجان ضبطاً وفق المهام لا حسب مصادر البيانات. |
| الإدارة والتكاملات | `/dashboard/branches`, `/dashboard/settings`, `/dashboard/settings/users`, `/dashboard/settings/devices`, `/dashboard/billing`, ومسارات التسويق وsocial-publishing | تظل تحت مجموعة الإدارة؛ لا تظهر للمستخدم التشغيلي بلا حاجة. |
| إدارة المنصة | `/admin` ومسارات `account-requests`, `organizations`, `users`, `plans`, `feature-flags`, `system-logs`, `support-tickets` | غلاف مستقل، خارج نطاق Workspace المؤسسة. |

## خريطة التطبيق والمكونات

### ما هو موجود وقابل لإعادة الاستخدام

- `src/app/dashboard/layout.tsx`: يجلب الجلسة وسياق المؤسسة والتنبيهات مرة واحدة ويمررها إلى الغلاف.
- `src/components/layout/responsive-page-shell.tsx`: غلاف Dashboard المستمر مع sidebar على سطح المكتب ورأس/قائمة/تنقل سفلي على المحمول.
- `src/components/layout/app-sidebar.tsx` و`nav-config.ts`: تجميع تنقل رئيسي وتصفية بحسب `Role` وحفظ مجموعات مفتوحة في التخزين المحلي.
- `src/components/layout/app-header.tsx`: بحث، اختيار فرع (واجهة فقط حالياً)، اختصارات روابط، إشعارات وهوية المستخدم.
- `src/components/layout/global-search.tsx` و`/api/search`: بحث من لوحة المفاتيح مع Ctrl/Cmd+K ونتائج صفحات وأصناف وموردين وفواتير ووصفات.
- `src/components/ui/*`: Button، Card، Input، Select، Table، Tabs، Modal، EmptyState، Skeleton، Badge كطبقة primitives بسيطة.
- `src/components/accounting/*`, `inventory/add-movement-dialog.tsx`, `purchasing/supplier-invoices-client.tsx`, `dashboard/tables-workspace.tsx`: مكونات مجال مهمة تستدعي الحفاظ على عقودها.
- `src/lib/db/offline.ts`, `src/lib/sales/inventory-impact.ts`, `src/lib/sales/shift-posting.ts`, `src/lib/inventory/ledger.ts`, `src/lib/accounting/posting.ts`: منطق تشغيلي لا ينقل إلى مكونات العرض.

### الأنماط المتكررة أو المتباينة

- قوائم كثيرة تبني `<Table>` محلياً داخل الصفحة: أصناف، وصفات، أوامر شراء، جرد، حركات، فروع، مرتجعات، إنتاج، مبيعات، تسويق وغيرها. لا توجد API موحدة للبحث أو التصفية أو الأعمدة أو الكثافة أو تحديد الصفوف.
- `PageHeader` يستخدم في عدد كبير من الصفحات، لكنه لا يفرض ترتيباً موحداً للحالة/الفلاتر/الإجراءات ولا يدير حالة URL.
- يوجد غلافان متقاربان: `responsive-page-shell.tsx` و`page-shell.tsx`. الأول هو المستعمل من Dashboard؛ يجب عدم توسيع الثاني قبل حسمه أو إزالته بأمان.
- `global-search` هو بحث جيد كنقطة بدء، لكنه ليس Command Palette: لا prefixes، لا إجراءات، لا قائمة حديثة، لا إنشاء، لا احترام صريح لصلاحيات النتائج على مستوى المورد، ولا مركزية للـEsc وطبقات overlays.
- الـsidebar قابل لتوسيع المجموعات لكنه غير قابل للطي، لا يعرض المفضلات/الأخيرة، ولا يحد المستويات المعروضة بحالة عمل موجهة.

## تدفقات البيانات والصلاحيات

| الطبقة | الوضع الحالي | أثر الترحيل |
| --- | --- | --- |
| الجلسة والسياق | `getCurrentSession`, `getOrganizationContext`, `getNotifications` في Dashboard layout | يجب تمديد الـprops بسياق المخزن والموافقات دون جلب عميل غير موثوق. |
| البحث | API يجلب عدة bundles ثم يرتب النتائج محلياً | استبدال تدريجي بفهرسة actions/records تحترم scope؛ لا تعرض href لسجل بلا تحقق. |
| البيانات | `src/server/queries/*` تفصل المجالات: sales, inventory, purchasing, recipes, accounting, dashboard | تبقى كما هي؛ الواجهة الموحدة تستهلك DTOs الحالية وتضيف adapters عند الحاجة. |
| التعديلات | `src/server/actions/*` وطبقات accounting/inventory المتخصصة | لا تكتب الواجهة مباشرةً إلى Supabase ولا تكرر قواعد الأعمال. |
| العزل | RLS والتحقق الخادمي ونطاق المؤسسة/الفرع | كل Drawer أو رابط deep-link يعيد التحقق في مساره/استعلامه. |

## فجوات مقابل تجربة Workspace المطلوبة

### حرجة قبل ترحيل القوائم

1. **طبقة overlay وURL:** لا يوجد نظام Drawer موحد يمثل `record`, `tab`, `view` و`filters` في URL أو يعالج Back/Forward والحماية من فقدان مسودة.
2. **جدول مؤسسي:** مكوّن Table الحالي primitive فقط؛ لا توجد اختيارات صفوف، إجراءات جماعية، فلاتر محفوظة، إدارة أعمدة، تنقل لوحة المفاتيح أو افتراضية.
3. **سياق تشغيلي فعّال:** اختيار الفرع في الرأس لا يظهر أنه يغير نطاق البيانات، ولا يوجد اختيار مستودع. يجب ربطهما بسياق خادمي صريح ومراجعة الأذونات.
4. **أوامر واختصارات مركزية:** Ctrl+K يركّز حقل البحث فقط. المطلوب لوحة قابلة للإجراءات، prefixes، ترتيب النتائج، وAlt shortcuts ضمن provider واحد.
5. **الحالة المستمرة:** الفلاتر وتحديد الصفوف والتمرير والمسودة غالباً خاصة بالصفحة؛ لا توجد قاعدة عامة للاستعادة بعد التحديث.

### تجربة ووصول

- التصميم الحالي يستخدم خلفيات شعاعية وظلالاً وبطاقات متعددة في Dashboard، وهو يناسب العرض الموجز لكنه لا يحقق مركز قرارات يركز على الاستثناءات.
- `globals.css` يضمن RTL والخط وأهداف لمس 44px، لكنه يحتاج tokens دلالية أوضح للحالة والكثافة والحالات المركزة و`prefers-reduced-motion`.
- توجد بعض حركات انتقالية في sidebar؛ أي layer جديدة يجب أن تحبس التركيز وتدعم Esc وتسميات عربية قابلة للقراءة وإشعان الأخطاء.
- نقاط breakpoints متباينة بين ملفات layout، مع Sidebar ظاهر من `md` وملاحظات التعليق التي تقول `lg+`. يلزم توحيد ذلك قبل اعتماد مكونات كثيفة على tablet.

## مخاطر الترحيل وإجراءاتها

| الخطر | المستوى | الإجراء الواجب |
| --- | --- | --- |
| تسريب بيانات بإعادة استخدام نتائج البحث أو بيانات Drawer بين المؤسسات | حرج | كل fetch يعيد scope على الخادم؛ تمسح caches عند تبدل المؤسسة/الفرع؛ لا تعتمد على `href` أو إخفاء UI. |
| كسر قيود أو تسويات محاسبية أثناء تبسيط الواجهة | حرج | يظل `postBalancedJournal` المصدر الوحيد للترحيل؛ تعرض الواجهة الملخص ولا تعيد تطبيقه. |
| خصم مخزون مرتين بسبب POS/offline وتحديثات متفائلة جديدة | حرج | لا تغير queue أو checkout؛ اعرض الحالة عبر adapter واقرأ سجل المزامنة القائم. |
| Drawer يغير سلوك الرجوع أو يفقد التعديلات | عالٍ | طبقة routing واحدة، `history` اختباري، وguard لمسودات النماذج قبل اعتمادها لكل مجال. |
| تجميد قوائم كبيرة بعد إضافة ميزات الجدول | عالٍ | server-side query params حيث تتوفر، pagination أولاً ثم virtualization للـdatasets الكبيرة، وقياس قبل/بعد. |
| اختلاف واجهة POS عالية السرعة عن shell الإداري | متوسط | يبقى POS Full-Screen Operational Canvas ويستورد فقط status/shortcuts المشتركة التي لا تعيق البيع. |
| تضارب بين Mobile shell وPageShell القديم | متوسط | اعتماد `ResponsivePageShell` كالمسار الوحيد للـDashboard؛ جرد الاستيرادات قبل حذف PageShell. |

## خريطة الاستبدال المقترحة

| الموجود | البديل المشترك | أول ترحيل آمن |
| --- | --- | --- |
| `ResponsivePageShell` + Header + Sidebar | `WorkspaceShell` يبني فوقها: branch/warehouse context، quick create، approvals، sync، recent، overlay host | Dashboard فقط، دون تغيير مسارات المجالات. |
| `GlobalSearch` | `CommandPalette` يستعمل فهرس الصفحات والـAPI الحالي كبداية ثم يضيف actions وprefixes | يظهر بالتوازي مع الحقل الحالي؛ Ctrl+K يفتح اللوحة. |
| `ui/table.tsx` + جداول الصفحات | `DataTable` headless بواجهة أعمدة/فلاتر/selection/row activation | inventory items ثم stock counts. |
| `PageHeader` وتنفيذ كل قائمة محلياً | `WorkListPage` (header + status tabs + toolbar + table + bulk bar) | suppliers أو items، مع adapter للبيانات القائم. |
| dialogs الموضعية | `RecordDrawer` + route state + unsaved-draft guard | تفاصيل صنف/مورد للقراءة أولاً؛ لا تحرير في أول نسخة. |
| صفحات بيانات الكيان | `EntityWorkspace` (overview/tabs/timeline/linked docs) | Product/Supplier بعد DataTable وDrawer. |
| Page-level forms | `TransactionEditor` للعمليات المعقدة و`DrawerForm` للبسيطة | جرد المخزون/إضافة حركة، ثم الاستلام والمصروفات. |

## خارطة تنفيذ مرحلية

### المرحلة 0 — حماية خط الأساس

- التقاط لقطات تدفقات: POS checkout/offline sync، قيد محاسبي، إضافة حركة، جرد، استلام، ورد/عكس.
- إضافة اختبارات تفاعل للـshell/keyboard/Drawer فقط دون تعديل domain logic.
- توثيق أي fetch يعتمد على branch أو warehouse قبل جعله selectable.

### المرحلة 1 — الأساس المشترك

- `docs/rewaq-design-system.md` لتوثيق tokens الدلالية، مقياس المسافات، حالات الحالة، طبقات overlay والكثافات.
- `WorkspaceProvider` في Dashboard layout للمستوى الآمن من السياق فقط.
- `OverlayProvider` و`RecordDrawer` مع URL state وEsc وfocus trap.
- `CommandPalette` و`ShortcutProvider` مع لوحة مساعدة `?`، ولا تُسجّل الاختصارات داخل input/textarea أو عناصر تحرير المحتوى.

### المرحلة 2 — القرار والمخزون

- تحويل Dashboard من تجميع بطاقات إلى `DecisionCenter`: الاستثناءات أولاً، ثم Daily Pulse وFood Cost مع drill-down.
- بناء `DataTable` ثم ترحيل items وstock movements وstock counts. الجرد يظل draft-first ولا ينشئ تعديلات قبل الصلاحية والتأكيد.

### المرحلة 3 — المشتريات والكيانات

- ربط purchase needs → orders → receipts → supplier invoices → payments بعلاقات واضحة، لا بتكرار إدخال البنود.
- Supplier وProduct profiles بدعم linked records وtimeline؛ عارض read-only داخل Drawer قبل تحريره.

### المرحلة 4 — المحاسبة والتشغيل

- role-aware Operational/Accountant switch في العرض فقط؛ يحتفظ server بالتحقق.
- TransactionEditor للقيود والمصروفات، ثم توحيد شاشات تقارير مع drill-down.
- تحسين POS بالتكاملات (availability, serving count, sync/printer status) دون تبديل checkout أو منطق المخزون.

### بوابات القبول لكل مرحلة

- lint وtypecheck، واختبارات المجال الموجودة، ثم اختبار يدوي لـRTL ولوحة المفاتيح وBack/Forward وtablet.
- صلاحيات اثنين على الأقل من الأدوار (مثل cashier/accountant) وسياق فرعين قبل دمج أي UI يعتمد السياق.
- مراجعة network: لا تغير server action أو RPC أو payload مالي/مخزني لمجرد تغيير واجهة.

## مقاييس النجاح المقترحة

- الوصول إلى صفحة أو سجل متكرر خلال أقل من 10 ثوانٍ عبر التنقل أو Ctrl+K.
- فتح تفاصيل سجل من قائمة مع بقاء البحث والفلاتر والتمرير كما هي.
- إدخال جرد متتابع بالباركود/لوحة المفاتيح مع حفظ draft فقط حتى الاعتماد.
- عدم وجود فرق وظيفي في POS checkout، sync، journal posting أو inventory movement قبل وبعد الترحيل.
- تباين وحركة وتركيز قابل للاستخدام مع RTL وعلى لوحة مفاتيح فقط.

## قرار التنفيذ التالي

ابدأ بالمرحلة 0/1 فقط: توحيد tokens وWorkspace/overlay/shortcuts وCommand Palette خلف العقود الحالية، ثم استخدم DataTable لترحيل المخزون. لا تبدأ بتغيير صفحات المحاسبة أو POS أو قواعد البيانات في هذه المرحلة.
