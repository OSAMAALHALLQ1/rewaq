# خطة تطوير تجربة الجوال - تكة (Takka Mobile Overhaul)

## TL;DR
> **Summary**: إصلاح وإعادة تصميم تجربة الجوال كاملة: إصلاح الشريط السفلي (إزالة التكرار، ربط الدوال، دعم الكاشير)، إضافة زر "قراءة المزيد" لوصف الأصناف، حل مشكلة اختباء المحتوى، ودعم iPhone/Android مع safe-area
> **Deliverables**: BottomNavigation معاد تصميمه، MoreSheet مشترك، وصف أصناف قابل للتوسيع، CSS محسّن للجوال
> **Effort**: Medium (8-12 tasks)
> **Parallel**: YES - 3 waves
> **Critical Path**: CSS cleanup → Shared MoreSheet → BottomNav redesign → ReadMore toggle → QA

## Context
### Original Request
المستخدم طلب تحسين تجربة الجوال لنظام تكة: إصلاح الشريط السفلي، زر "قراءة المزيد"، المحتوى المختفي، وضمان عمل جميع الصفحات على iPhone/Android

### Interview Summary
- **Bottom nav**: إعادة تصميم كاملة (ليس مجرد إصلاح)
- **قراءة المزيد**: في وصف الأصناف بالمنيو (AdminDashboard + WaiterView)
- **الكاشير**: نفس بوتوم شيت المدير لـ "المزيد"
- **الترتيب**: جميع الإصلاحات في حزمة واحدة

### Known Issues
1. **كود مكرر**: App.jsx الأسطر 668-728 و 731-791 (نفس كود more sheet)
2. **دالة غير مربوطة**: handleBottomNav (548-554) موجودة لكن ما فيشي يوصلها لـ BottomNavigation
3. **الكاشير**: عنده تبويب "المزيد" بدون أي handler
4. **لا يوجد padding-bottom**: المحتوى الرئيسي ما عنده padding للشريط السفلي
5. **CSS مكرر**: index.css و App.css فيه كلاسات bottom-sheet
6. **زر "قراءة المزيد"**: مش موجود - وصف الأصناف لازم يكون قابل للتوسيع

## Work Objectives
### Core Objective
تحسين تجربة الجوال بالكامل: شريط سفلي يعمل بسلاسة مع جميع الأدوار، وصف أصناف قابل للتوسيع، محتوى غير مقطوع

### Deliverables
- BottomNavigation معاد تصميمه (glass-morphic محسّن)
- MoreSheet مشترك للمدير والكاشير
- أزرار "قراءة المزيد" لوصف الأصناف
- CSS محسّن للجوال مع safe-area-inset

### Definition of Done
- [ ] جميع أزرار الشريط السفلي تعمل لجميع الأدوار (مدير، كاشير، جرسون)
- [ ] بوتوم شيت "المزيد" يظهر مرة واحدة فقط بدون تكرار
- [ ] وصف الأصناف الطويلة له زر "قراءة المزيد" / "عرض أقل"
- [ ] المحتوى الرئيسي ما يتقطع تحت الشريط السفلي
- [ ] الموقع يشتغل على iPhone (safe-area) و Android

### Must NOT Have (guardrails)
- لا تغيير في نموذج البيانات (localStorage)
- لا إضافة backend
- لا إعادة كتابة كاملة للتطبيق
- لا تغيير في شاشات الأدوار (مطبخ/بار/شيشة) - فقط إصلاح الشريط السفلي

## Verification Strategy
- **Test decision**: Manual verification + Playwright browser QA
- **QA policy**: كل مهمة لها اختباراتها اليدوية
- **Evidence**: .sisyphus/evidence/task-{N}-{slug}.{ext}

## Execution Strategy
### Parallel Execution Waves

**Wave 1** (أساسيات - 3 مهام بالتوازي):
- CSS cleanup + safe-area
- Shared MoreSheet component extraction
- Read-more CSS foundations

**Wave 2** (تطوير - 3 مهام بالتوازي):
- BottomNavigation إعادة ربط وتصميم
- Read-more toggle integration (AdminDashboard menu + WaiterView)
- Content clipping fix

**Wave 3** (ربط واختبار - 3 مهام):
- دمج MoreSheet في App.jsx للمدير والكاشير
- Browser QA على جميع الأدوار
- اختبار iPhone/Android viewports

## TODOs

### Wave 1: Foundation

- [x] 1. تنظيف الـ CSS المكرر وإضافة safe-area

  **What to do**:
  1. افتح `src/App.css` واحذف جميع كلاسات `.bottom-sheet` و `.more-options` و `.more-options-grid` (هذه موجودة في `src/index.css`)
  2. في `src/index.css`، تأكد إن كلاسات bottom-sheet موجودة ومحسّنة
  3. أضف متغيرات CSS للـ safe-area:
     ```css
     :root {
       --sat: env(safe-area-inset-top);
       --sar: env(safe-area-inset-right);
       --sab: env(safe-area-inset-bottom);
       --sal: env(safe-area-inset-left);
       --nav-height: 72px;
       --nav-total-height: calc(var(--nav-height) + var(--sab));
     }
     ```
  4. تأكد من وجود `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` في `index.html`
  5. أضف padding-bottom محسوب للمحتوى الرئيسي باستخدام `var(--nav-total-height)`

  **Must NOT do**: لا تحذف كل App.css، فقط أزل كلاسات bottom-sheet المكررة

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - تعديلات CSS محضة
  - Skills: [] - لا يحتاج skills خاصة
  - Omitted: كل skills الكود

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [] | Blocked By: []

  **References**:
  - `src/App.css` - نحتاج نقرأها ونشوف كلاسات bottom-sheet
  - `src/index.css` - الـ CSS الرئيسي، نتأكد إن الكلاسات موجودة
  - `index.html` - نضيف viewport-fit=cover

  **Acceptance Criteria**:
  - [ ] `src/App.css` لا يحتوي على `.bottom-sheet` أو `.more-options`
  - [ ] `src/index.css` فيه `--sab` و `--nav-height` و `--nav-total-height`
  - [ ] `index.html` فيه `viewport-fit=cover`
  - [ ] لا يوجد أخطاء LSP بعد التعديلات

  **QA Scenarios**:
  ```
  Scenario: CSS cleanup verification
    Tool: Bash
    Steps: grep -r "\.bottom-sheet" src/App.css → should return empty
    Expected: No bottom-sheet classes remain in App.css
    Evidence: .sisyphus/evidence/task-1-css-cleanup.txt

  Scenario: Safe-area variables exist
    Tool: Bash
    Steps: grep "safe-area-inset-bottom" src/index.css
    Expected: Returns the CSS variable definition
    Evidence: .sisyphus/evidence/task-1-safearea.txt
  ```

  **Commit**: YES | Message: `fix(css): cleanup duplicate bottom-sheet classes and add safe-area-inset support` | Files: [src/App.css, src/index.css, index.html]

- [x] 2. إنشاء مكون MoreSheet مشترك

  **What to do**:
  1. أنشئ ملف `src/components/MoreSheet.jsx`
  2. استخرج الكود المكرر من App.jsx (أسطر 668-728) إلى هذا المكون
  3. المكون يستقبل props: `{ show, onClose, userRole, onLogout, onNavigate }`
  4. محتوى الـ sheet: إعدادات سريعة + تقارير + تسجيل خروج (حسب الدور)
  5. استخدم `createPortal` لوضع الـ sheet في `document.body`
  6. أضف أنيميشن Slide-up للظهور و Slide-down للإخفاء
  7. الـ sheet لازم يكون RTL (direction: rtl)

  **Must NOT do**: لا تغير منطق الـ App.jsx بعد - فقط استخرج الكود

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - UI component
  - Skills: [] - مكون React بسيط
  - Omitted: Skills الكود

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [3, 4, 5] | Blocked By: [1]

  **References**:
  - `src/App.jsx` lines 668-728 - كود الـ more sheet المكرر
  - `src/App.jsx` lines 731-791 - النسخة الثانية المكررة (نفس الشي)
  - `src/App.jsx` line 298 - `showMoreSheet` state
  - `src/App.jsx` line 231-240 - إعدادات الإشعارات والصوت
  - `src/index.css` - كلاسات `.bottom-sheet` الموجودة

  **Acceptance Criteria**:
  - [ ] `src/components/MoreSheet.jsx` موجود ويحتوي على مكون React
  - [ ] المكون يقبل props: show, onClose, userRole, onLogout, onNavigate
  - [ ] يستخدم createPortal
  - [ ] يدعم RTL
  - [ ] LSP diagnostics بدون أخطاء

  **QA Scenarios**:
  ```
  Scenario: MoreSheet creates without error
    Tool: Bash
    Steps: grep -r "export default function MoreSheet" src/components/MoreSheet.jsx
    Expected: Returns the function declaration
    Evidence: .sisyphus/evidence/task-2-moresheet-exists.txt

  Scenario: MoreSheet uses createPortal
    Tool: Bash
    Steps: grep "createPortal" src/components/MoreSheet.jsx
    Expected: Returns the line with createPortal
    Evidence: .sisyphus/evidence/task-2-portal.txt
  ```

  **Commit**: YES | Message: `feat(ui): extract shared MoreSheet component from duplicated App.jsx code` | Files: [src/components/MoreSheet.jsx]

- [x] 3. إضافة كلاسات CSS لـ "قراءة المزيد" (Read More)

  **What to do**:
  1. في `src/index.css`، أضف كلاسات:
     ```css
     .text-clamp-2 {
       display: -webkit-box;
       -webkit-line-clamp: 2;
       -webkit-box-orient: vertical;
       overflow: hidden;
       transition: -webkit-line-clamp 0.3s ease;
     }
     .text-clamp-2.expanded {
       -webkit-line-clamp: unset;
     }
     .read-more-btn {
       background: none;
       border: none;
       color: var(--color-primary, #eab308);
       cursor: pointer;
       font-size: 0.85rem;
       padding: 2px 0;
       font-weight: 600;
     }
     .read-more-btn:hover {
       text-decoration: underline;
     }
     ```
  2. تأكد ما فيش تعارض مع كلاسات موجودة

  **Must NOT do**: لا تطبق الـ classes على المكونات بعد - هذي المهمة فقط CSS

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - CSS فقط
  - Skills: []
  - Omitted: -

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [7, 8] | Blocked By: []

  **References**:
  - `src/index.css` - نضيف الكلاسات هنا

  **Acceptance Criteria**:
  - [ ] `src/index.css` يحتوي على `.text-clamp-2` و `.read-more-btn`
  - [ ] LSP diagnostics بدون أخطاء

  **QA Scenarios**:
  ```
  Scenario: Read More CSS classes exist
    Tool: Bash
    Steps: grep -E "\.text-clamp-2|\.read-more-btn" src/index.css
    Expected: Returns both class definitions
    Evidence: .sisyphus/evidence/task-3-readmore-css.txt
  ```

  **Commit**: YES | Message: `feat(css): add read-more and text-clamp CSS classes for expandable descriptions` | Files: [src/index.css]

### Wave 2: Core Development

- [x] 4. إعادة تصميم BottomNavigation وإصلاح الربط

  **What to do**:
  1. افتح `src/components/BottomNavigation.jsx`
  2. أضف prop جديد: `onMoreClick` - يُستدعى عند الضغط على زر "المزيد"
  3. أعد تصميم الـ nav bar:
     - استخدم glass-morphic بخلفية شفافة مع backdrop-filter
     - أيقونات أكبر وأنعم (stroke-width: 1.5)
     - التبويب النشط مع glow أصفر (#eab308)
     - أضف أنيميشن انتقال (active tab indicator يتحرك)
     - أضف safe-area-inset-bottom
     - ارتفاع الشريط 64-72px
  4. تأكد من دعم RTL (الترتيب ينعكس)
  5. حسّن `BottomNavigation.module.css` أو استخدم inline styles/Styled components

  **Must NOT do**: لا تغير هيكل الـ ROLE_NAV (يبقى في BottomNavigation.jsx)

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - UI + CSS
  - Skills: []
  - Omitted: -

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [5] | Blocked By: [1, 2]

  **References**:
  - `src/components/BottomNavigation.jsx` - المكون الرئيسي
  - `src/components/BottomNavigation.module.css` - CSS الموجود
  - `src/App.jsx` line 548-554 - `handleBottomNav` function
  - Glass-morphic style: backdrop-filter: blur(16px), background: rgba(255,255,255,0.85)

  **Acceptance Criteria**:
  - [ ] `onMoreClick` prop موجود في BottomNavigation
  - [ ] الأيقونات واضحة مع glow للـ active tab
  - [ ] RTL مدعوم (الترتيب يعكس)
  - [ ] LSP diagnostics بدون أخطاء

  **QA Scenarios**:
  ```
  Scenario: BottomNavigation accepts onMoreClick prop
    Tool: Bash
    Steps: grep "onMoreClick" src/components/BottomNavigation.jsx
    Expected: Returns prop definition and usage
    Evidence: .sisyphus/evidence/task-4-onmoreclick.txt

  Scenario: RTL support
    Tool: Bash
    Steps: grep "rtl\|RTL\|direction.*right\|right.*direction" src/components/BottomNavigation.jsx src/components/BottomNavigation.module.css
    Expected: Returns RTL-related code
    Evidence: .sisyphus/evidence/task-4-rtl.txt
  ```

  **Commit**: YES | Message: `feat(ui): redesign BottomNavigation with glass-morphic style, onMoreClick prop, and RTL support` | Files: [src/components/BottomNavigation.jsx, src/components/BottomNavigation.module.css]

- [x] 5. ربط MoreSheet في App.jsx وإصلاح التكرار

  **What to do**:
  1. افتح `src/App.jsx`
  2. استورد `MoreSheet` من `./components/MoreSheet`
  3. استبدل الكود المكرر (أسطر 668-728 و 731-791) بكود واحد:
     ```jsx
     <MoreSheet
       show={showMoreSheet}
       onClose={() => setShowMoreSheet(false)}
       userRole={user.role}
       onLogout={handleLogout}
       onNavigate={(tab) => { setActiveTab(tab); setShowMoreSheet(false); }}
     />
     ```
  4. عدّل `handleBottomNav` (سطر 548-554) ليدعم الكاشير:
     ```jsx
     const handleBottomNav = (tab) => {
       setActiveTab(tab);
       setShowMoreSheet(false);
       if (tab === 'more') {
         setShowMoreSheet(true);
       }
     };
     ```
  5. مرر `handleBottomNav` لـ BottomNavigation بدلاً من `setActiveTab`:
     ```jsx
     <BottomNavigation ... onTabClick={handleBottomNav} ... />
     ```
  6. (إذا كان prop اسمه `onTabClick` غير موجود) تأكد من اسم الـ prop في BottomNavigation

  **Must NOT do**: لا تحذف أي كود متعلق بال tabs الأساسية، فقط الـ more sheet المكرر

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - ربط معقد بين مكونات
  - Skills: []
  - Omitted: -

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [6] | Blocked By: [2, 4]

  **References**:
  - `src/App.jsx` lines 668-728 and 731-791 - كود more sheet المكرر (يحذف)
  - `src/App.jsx` lines 548-554 - handleBottomNav function (يُعدّل)
  - `src/App.jsx` line 298 - showMoreSheet state موجود
  - `src/App.jsx` line ~237 - import existing components
  - `src/components/MoreSheet.jsx` - المكون الجديد

  **Acceptance Criteria**:
  - [ ] `handleBottomNav` مربوط بـ BottomNavigation
  - [ ] الكود المكرر (668-728 و 731-791) محذوف
  - [ ] MoreSheet يُستخدم مرة واحدة فقط
  - [ ] زر "المزيد" يشتغل للمدير والكاشير
  - [ ] LSP diagnostics بدون أخطاء

  **QA Scenarios**:
  ```
  Scenario: No more duplicate code
    Tool: Bash
    Steps: grep -c "showMoreSheet && user.role === 'manager'" src/App.jsx
    Expected: Returns 1 (only one instance remains)
    Evidence: .sisyphus/evidence/task-5-dedup.txt

  Scenario: handleBottomNav wired to BottomNavigation
    Tool: Bash
    Steps: grep -A2 "handleBottomNav\|onTabClick\|onMoreClick" src/App.jsx | head -10
    Expected: Shows handleBottomNav being passed to BottomNavigation
    Evidence: .sisyphus/evidence/task-5-wiring.txt
  ```

  **Commit**: YES | Message: `fix(app): deduplicate MoreSheet code, wire handleBottomNav, add cashier more support` | Files: [src/App.jsx]

- [x] 6. إصلاح content clipping للموبايل

  **What to do**:
  1. أضف CSS عام للمحتوى الرئيسي:
     ```css
     .main-content {
       padding-bottom: var(--nav-total-height, 80px);
       min-height: 100vh;
       min-height: 100dvh; /* dynamic viewport height */
     }
     ```
  2. في كل view (WaiterView, CashierView, AdminDashboard، kitchen/bar/shisha views)،
     تأكد من وجود wrapper بـ `className="main-content"` أو padding-bottom مناسب
  3. أضف قواعد CSS إضافية:
     - `html { scroll-behavior: smooth; }`
     - `body { overflow-x: hidden; }` (منع التمرير الأفقي)
     - تأكد من `body { padding: 0; margin: 0; }`

  **Must NOT do**: لا تغير padding للـ desktop breakpoints (فقط mobile <768px)

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - CSS
  - Skills: []
  - Omitted: -

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [9] | Blocked By: [1]

  **References**:
  - `src/index.css` - أضف الكلاسات هنا
  - `src/App.jsx` - الـ main wrapper للتطبيق
  - كل views: WaiterView.jsx, CashierView.jsx, AdminDashboard.jsx، KitchenView.jsx, BarView.jsx, ShishaView.jsx

  **Acceptance Criteria**:
  - [ ] `.main-content` class موجود مع padding-bottom
  - [ ] `100dvh` مستخدمة (وليس فقط `100vh`)
  - [ ] `overflow-x: hidden` مضاف على body للجوال
  - [ ] LSP diagnostics بدون أخطاء

  **QA Scenarios**:
  ```
  Scenario: Main content has nav clearance
    Tool: Bash
    Steps: grep "padding-bottom.*nav" src/index.css || grep "nav-total-height\|--nav-height" src/index.css
    Expected: Returns nav height variable usage
    Evidence: .sisyphus/evidence/task-6-padding.txt

  Scenario: Dynamic viewport height used
    Tool: Bash
    Steps: grep "100dvh\|dvh" src/index.css
    Expected: Returns at least one dvh usage
    Evidence: .sisyphus/evidence/task-6-dvh.txt
  ```

  **Commit**: YES | Message: `fix(css): add mobile content padding-bottom using safe-area and dvh units to prevent clipping` | Files: [src/index.css]

### Wave 3: Read More & Final Integration

- [x] 7. إضافة "قراءة المزيد" لوصف الأصناف في AdminDashboard (قائمة المنيو)

  **What to do**:
  1. في `src/components/AdminDashboard.jsx`، ابحث عن تبويب المنيو (حيث يتم عرض item cards مع وصف)
  2. لكل item card مع وصف (description):
     ```jsx
     const [expanded, setExpanded] = useState(false);
     // ...
     <p className={`item-desc ${!expanded ? 'text-clamp-2' : 'text-clamp-2 expanded'}`}>
       {item.description}
     </p>
     {item.description && item.description.length > 80 && (
       <button className="read-more-btn" onClick={() => setExpanded(!expanded)}>
         {expanded ? 'عرض أقل' : 'قراءة المزيد'}
       </button>
     )}
     ```
  3. استخدم useEffect لتقييم طول النص (80 حرف أو سطرين)
  4. أضف CSS مخصص إذا لزم الأمر (في CSS module أو inline)

  **Must NOT do**: لا تغير هيكل البيانات، فقط أضف الـ toggle

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - UI تغييرات
  - Skills: []
  - Omitted: -

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocked By: [3]

  **References**:
  - `src/components/AdminDashboard.jsx` - تبويب المنيو
  - `src/index.css` - كلاسات `.text-clamp-2` و `.read-more-btn` (مهمة 3)

  **Acceptance Criteria**:
  - [ ] وصف الصنف الطويل (>80 حرف) يظهر مع زر "قراءة المزيد"
  - [ ] بعد الضغط، يتم توسيع النص وزر "عرض أقل"
  - [ ] RTL text alignment محفوظ
  - [ ] LSP diagnostics بدون أخطاء

  **QA Scenarios**:
  ```
  Scenario: Read more button renders for long descriptions
    Tool: Bash
    Steps: grep "قراءة المزيد\|readMore\|read-more\|expanded\|text-clamp" src/components/AdminDashboard.jsx
    Expected: Returns the read-more implementation logic
    Evidence: .sisyphus/evidence/task-7-admin-readmore.txt
  ```

  **Commit**: YES | Message: `feat(ui): add expandable description with "قراءة المزيد" toggle to menu items in admin dashboard` | Files: [src/components/AdminDashboard.jsx]

- [x] 8. إضافة "قراءة المزيد" لوصف الأصناف في WaiterView

  **What to do**:
  1. في `src/components/WaiterView.jsx`، ابحث عن item cards (في عرض المنيو/الطلب)
  2. لكل item مع description، أضف نفس نظام الـ toggle:
     ```jsx
     const [expandedItemId, setExpandedItemId] = useState(null);
     // ...
     <p className={`item-desc ${expandedItemId === item.id ? 'text-clamp-2 expanded' : 'text-clamp-2'}`}>
       {item.description}
     </p>
     {item.description && item.description.length > 60 && (
       <button className="read-more-btn" onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}>
         {expandedItemId === item.id ? 'عرض أقل' : 'قراءة المزيد'}
       </button>
     )}
     ```
  3. استخدم `expandedItemId` (state واحد لكل الأصناف) بدلاً من expanded لكل صنف (أداء أفضل)

  **Must NOT do**: لا تغير منطق الطلب أو الكارت

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - UI تغييرات
  - Skills: []
  - Omitted: -

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocked By: [3]

  **References**:
  - `src/components/WaiterView.jsx` - item cards (ابحث عن item description render)
  - `src/index.css` - كلاسات `.text-clamp-2` و `.read-more-btn`

  **Acceptance Criteria**:
  - [ ] وصف الصنف الطويل يظهر مع زر "قراءة المزيد" في WaiterView
  - [ ] صنف واحد فقط موسع في كل مرة (single expandedItemId)
  - [ ] RTL محفوظ
  - [ ] LSP diagnostics بدون أخطاء

  **QA Scenarios**:
  ```
  Scenario: Read more toggle in WaiterView
    Tool: Bash
    Steps: grep "قراءة المزيد\|expandedItemId\|text-clamp" src/components/WaiterView.jsx
    Expected: Returns read-more implementation
    Evidence: .sisyphus/evidence/task-8-waiter-readmore.txt
  ```

  **Commit**: YES | Message: `feat(ui): add expandable description with "قراءة المزيد" toggle to waiter menu items` | Files: [src/components/WaiterView.jsx]

- [x] 9. اختبار شامل على viewports الجوال وضمان عمل جميع الأدوار

  **What to do**:
  1. نفّذ الأمر `npm run dev` واختبر يدوياً:
     - مدير: كل tabs الشريط السفلي (الرئيسية، الطلبات، الموظفين، المزيد)
     - كاشير: كل tabs (نشطة، فواتير، تقارير، المزيد)
     - جرسون: كل tabs (طاولات، طلبات، الملف الشخصي)
     - تأكد من ظهور more sheet للمدير والكاشير بدون تكرار
  2. استخدم متصفح Chrome DevTools في وضع الجوال (iPhone 14, Pixel 7)
  3. تأكد من:
     - المحتوى لا يُقطع تحت الشريط السفلي
     - safe-area-inset يعمل (في iPhone simulator أو DevTools)
     - RTL سليم في جميع الشاشات
     - "قراءة المزيد" يشتغل في AdminDashboard و WaiterView
  4. صحح أي مشاكل تظهر أثناء الاختبار

  **Must NOT do**: لا تضيف tests آلية (يدوي + screenshot)

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - QA شامل
  - Skills: []
  - Omitted: -

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocked By: [5, 6, 7, 8]

  **References**:
  - جميع الملفات المعدلة في المهام السابقة

  **Acceptance Criteria**:
  - [ ] جميع أزرار الشريط السفلي تشتغل لجميع الأدوار
  - [ ] More sheet يظهر مرة واحدة بدون تكرار
  - [ ] "قراءة المزيد" يوسع النص و "عرض أقل" يرجعه
  - [ ] المحتوى لا يختفي تحت الشريط السفلي
  - [ ] ما في أخطاء في Console

  **QA Scenarios**:
  ```
  Scenario: Build succeeds
    Tool: Bash
    Steps: npm run build 2>&1
    Expected: Build completes with exit code 0
    Evidence: .sisyphus/evidence/task-9-build.txt
  ```

  **Commit**: YES | Message: `fix(qa): post-mobile-overhaul fixes and verification` | Files: [various]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
| # | Message | Files |
|---|---------|-------|
| 1 | `fix(css): cleanup duplicate bottom-sheet classes and add safe-area-inset support` | App.css, index.css, index.html |
| 2 | `feat(ui): extract shared MoreSheet component from duplicated App.jsx code` | MoreSheet.jsx |
| 3 | `feat(css): add read-more and text-clamp CSS classes` | index.css |
| 4 | `feat(ui): redesign BottomNavigation with glass-morphic style, onMoreClick prop, and RTL support` | BottomNavigation.jsx, BottomNavigation.module.css |
| 5 | `fix(app): deduplicate MoreSheet code, wire handleBottomNav, add cashier more support` | App.jsx |
| 6 | `fix(css): add mobile content padding-bottom using safe-area and dvh units` | index.css |
| 7 | `feat(ui): add expandable description with "قراءة المزيد" toggle to admin menu items` | AdminDashboard.jsx |
| 8 | `feat(ui): add expandable description with "قراءة المزيد" toggle to waiter menu items` | WaiterView.jsx |
| 9 | `fix(qa): post-mobile-overhaul fixes and verification` | various |

## Success Criteria
- [ ] BottomNavigation يعمل بسلاسة مع جميع الأدوار (manager, cashier, waiter)
- [ ] MoreSheet يظهر مرة واحدة فقط (لا تكرار)
- [ ] "قراءة المزيد" يوسع وصف الأصناف و "عرض أقل" يرجعه
- [ ] المحتوى الرئيسي لا يختفي تحت الشريط السفلي
- [ ] التطبيق يشتغل على iPhone (مع safe-area) و Android viewports
- [ ] Build ينجح بدون أخطاء
- [ ] RTL سليم في جميع التعديلات
