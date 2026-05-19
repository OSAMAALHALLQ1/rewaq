# Mobile Components Reference

## Overview

Complete reference of all mobile-optimized components. Each component is designed for touch interaction with minimum 44x44px targets and responsive sizing.

---

## Navigation Components

### MobileBottomNav
Bottom navigation bar for main app areas (mobile only).

**Location**: `src/components/layout/mobile-bottom-nav.tsx`

```tsx
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

export function MyLayout() {
  return (
    <>
      <main>{/* content */}</main>
      <MobileBottomNav />
    </>
  );
}
```

**Props**: None (auto-configured)
**Features**:
- 5 main navigation items
- Active state styling
- RTL-ready

---

### MobileHeader
Mobile-optimized header with search, profile, and notifications.

**Location**: `src/components/layout/mobile-header.tsx`

```tsx
import { MobileHeader } from "@/components/layout/mobile-header";

<MobileHeader
  session={session}
  branches={branches}
  notifications={notifications}
  onMenuOpen={() => setSidebarOpen(true)}
/>
```

**Props**:
- `session`: `AppSession` - User session data
- `branches`: `Branch[]` - Available branches
- `notifications`: `Notification[]` - User notifications
- `onMenuOpen?`: `() => void` - Callback when menu button clicked

**Features**:
- Compact logo and user info
- Expandable search
- Profile dropdown menu
- Notification bell
- Branch selector

---

## Layout Components

### ResponsivePageShell
Main page wrapper handling desktop/mobile layouts automatically.

**Location**: `src/components/layout/responsive-page-shell.tsx`

```tsx
import { ResponsivePageShell } from "@/components/layout/responsive-page-shell";

export default async function Layout({ children }) {
  const [session, context, notifications] = await Promise.all([...]);
  
  return (
    <ResponsivePageShell
      session={session}
      branches={context.branches}
      notifications={notifications}
    >
      {children}
    </ResponsivePageShell>
  );
}
```

**Props**:
- `children`: `React.ReactNode` - Page content
- `session`: `AppSession` - User session
- `branches`: `Branch[]` - Available branches
- `notifications`: `Notification[]` - User notifications
- `mode?`: `"app" | "admin"` - Navigation mode (default: "app")

**Features**:
- Automatic desktop/mobile layout switching
- Mobile header + bottom nav (mobile)
- Desktop header + sidebar (desktop)
- Safe area support for notches
- Overlay handling

---

## Card Components

### MobileMetricCard
KPI card with trend indicators and styling variants.

**Location**: `src/components/mobile/mobile-cards.tsx`

```tsx
import { MobileMetricCard } from "@/components/mobile/mobile-cards";

<MobileMetricCard
  title="Total Sales"
  value="50,000 SAR"
  description="This month"
  icon={<TrendingUp />}
  trend="up"
  trendValue="+15%"
  variant="success"
/>
```

**Props**:
- `title`: `string` - Metric title
- `value`: `string | number` - Metric value
- `description?`: `string` - Additional description
- `icon?`: `ReactNode` - Icon element
- `trend?`: `"up" | "down" | "neutral"` - Trend direction
- `trendValue?`: `string` - Trend text (e.g., "+15%")
- `variant?`: `"default" | "success" | "warning" | "danger" | "info"` - Color variant

**Features**:
- Responsive sizing
- Trend indicators
- Multiple color variants
- Icon support

---

### MobileQuickAction
Large, touch-friendly action button for quick access to features.

**Location**: `src/components/mobile/mobile-cards.tsx`

```tsx
import { MobileQuickAction } from "@/components/mobile/mobile-cards";

<MobileQuickAction
  title="New Invoice"
  description="Quick sale"
  icon={<Receipt />}
  href="/dashboard/invoices/new"
  variant="primary"
  badge={3}
/>
```

**Props**:
- `title`: `string` - Action title
- `description?`: `string` - Short description
- `icon`: `ReactNode` - Icon element
- `href?`: `string` - Link destination
- `onClick?`: `() => void` - Click handler
- `variant?`: `"default" | "primary" | "success" | "warning" | "danger"`
- `badge?`: `number` - Badge count
- `className?`: `string` - Additional classes

**Features**:
- Large touch targets
- Optional badge
- Icon support
- Multiple variants
- Link or button mode

---

### MobileCard
Generic card container for grouping content.

**Location**: `src/components/mobile/mobile-cards.tsx`

```tsx
import { MobileCard } from "@/components/mobile/mobile-cards";

<MobileCard
  title="Recent Transactions"
  description="Last 10 transactions"
  footer={<button>View All</button>}
>
  {/* Content */}
</MobileCard>
```

**Props**:
- `title?`: `string` - Card title
- `description?`: `string` - Card description
- `children`: `ReactNode` - Card content
- `footer?`: `ReactNode` - Footer content
- `className?`: `string` - Additional classes

**Features**:
- Header with title/description
- Flexible content
- Optional footer
- Proper spacing

---

### MobileListItem
List item for displaying information with icon and badge.

**Location**: `src/components/mobile/mobile-cards.tsx`

```tsx
import { MobileListItem } from "@/components/mobile/mobile-cards";

<MobileListItem
  title="Item Name"
  subtitle="Category"
  description="Additional info"
  icon={<Box />}
  badge={5}
  badgeVariant="success"
  href="/item/123"
/>
```

**Props**:
- `title`: `string` - Item title
- `subtitle?`: `string` - Item subtitle
- `description?`: `string` - Item description
- `icon?`: `ReactNode` - Icon element
- `badge?`: `string | number` - Badge value
- `badgeVariant?`: `"default" | "primary" | "success" | "warning" | "danger"`
- `href?`: `string` - Link destination
- `onClick?`: `() => void` - Click handler
- `divider?`: `boolean` - Show divider (default: true)

**Features**:
- Icon + title + subtitle layout
- Optional badge
- Optional divider
- Touch-friendly spacing
- Link or button mode

---

## Table Components

### MobileCardTable
Card-based table for displaying data on mobile.

**Location**: `src/components/mobile/mobile-table.tsx`

```tsx
import { MobileCardTable } from "@/components/mobile/mobile-table";

<MobileCardTable
  columns={[
    { key: "name", label: "Item", width: "40%" },
    { key: "category", label: "Category", width: "30%" },
    { key: "quantity", label: "Qty", width: "15%" },
    { key: "price", label: "Price", width: "15%" },
  ]}
  data={items}
  renderCell={(key, value) => {
    if (key === "price") return formatCurrency(value);
    return value;
  }}
  onRowClick={(row) => router.push(`/items/${row.id}`)}
/>
```

**Props**:
- `columns`: Column definitions with key, label, width, align
- `data`: Array of row data objects
- `renderCell?`: Function to custom render cell values
- `onRowClick?`: Handler for row clicks
- `emptyState?`: Custom empty state content
- `loading?`: Show loading state
- `className?`: Additional classes

**Features**:
- Card-based rows
- Custom cell rendering
- Touch-friendly
- Loading skeleton
- Empty state

---

### MobileTableRow
Individual table row component.

**Location**: `src/components/mobile/mobile-table.tsx`

```tsx
import { MobileTableRow } from "@/components/mobile/mobile-table";

<MobileTableRow
  primary={{ label: "Item", value: "Coffee" }}
  secondary={[
    { label: "Category", value: "Beverages" },
    { label: "Qty", value: "50" },
  ]}
  details={[
    { label: "Price", value: "150 SAR" },
    { label: "SKU", value: "SKU001" },
  ]}
  badge={{ label: "Active", variant: "success" }}
  onClick={() => handleRowClick()}
/>
```

**Props**:
- `primary`: Primary value and label
- `secondary?`: Array of secondary values
- `details?`: Array of detail values
- `onClick?`: Click handler
- `badge?`: Badge with variant

**Features**:
- Primary + secondary + details layout
- Optional badge
- Proper spacing
- Click handling

---

### MobileTableList
List of MobileTableRow components.

**Location**: `src/components/mobile/mobile-table.tsx`

```tsx
import { MobileTableList } from "@/components/mobile/mobile-table";

<MobileTableList
  rows={items.map(item => ({
    primary: { label: "Item", value: item.name },
    secondary: [...],
    details: [...],
    onClick: () => handleClick(item),
  }))}
/>
```

**Props**:
- `rows`: Array of MobileTableRow props
- `emptyState?`: Custom empty state
- `loading?`: Show loading state
- `className?`: Additional classes

---

## Form Components

### MobileInput
Touch-friendly input field.

**Location**: `src/components/mobile/mobile-forms.tsx`

```tsx
import { MobileInput } from "@/components/mobile/mobile-forms";

<MobileInput
  label="Item Name"
  placeholder="Enter name"
  required
  error="This field is required"
  hint="Maximum 100 characters"
  icon={<Search />}
/>
```

**Props**:
- All standard `<input>` props
- `label?`: `string` - Field label
- `error?`: `string` - Error message
- `hint?`: `string` - Hint text
- `icon?`: `ReactNode` - Icon element

**Features**:
- 44px minimum height
- Large, readable text
- Icon support
- Error/hint display
- Proper keyboard handling

---

### MobileSelect
Touch-friendly select dropdown.

**Location**: `src/components/mobile/mobile-forms.tsx`

```tsx
import { MobileSelect } from "@/components/mobile/mobile-forms";

<MobileSelect
  label="Category"
  options={[
    { value: "beverage", label: "Beverages" },
    { value: "food", label: "Food" },
  ]}
  placeholder="Select category"
  error="Please select one"
/>
```

**Props**:
- All standard `<select>` props
- `label?`: `string` - Field label
- `error?`: `string` - Error message
- `hint?`: `string` - Hint text
- `options`: Array of options
- `placeholder?`: `string` - Placeholder text

**Features**:
- 44px minimum height
- Custom styled dropdown
- Large text
- Error handling

---

### MobileTextarea
Touch-friendly textarea.

**Location**: `src/components/mobile/mobile-forms.tsx`

```tsx
import { MobileTextarea } from "@/components/mobile/mobile-forms";

<MobileTextarea
  label="Notes"
  placeholder="Add notes..."
  error="Too long"
  hint="Maximum 500 characters"
/>
```

**Props**:
- All standard `<textarea>` props
- `label?`: `string` - Field label
- `error?`: `string` - Error message
- `hint?`: `string` - Hint text

**Features**:
- Min-height 96px
- Resizable
- Large text
- Proper spacing

---

### MobileCheckbox
Touch-friendly checkbox.

**Location**: `src/components/mobile/mobile-forms.tsx`

```tsx
import { MobileCheckbox } from "@/components/mobile/mobile-forms";

<MobileCheckbox
  label="Agree to terms"
  description="I agree to the service terms"
/>
```

**Props**:
- All standard `<input type="checkbox">` props
- `label?`: `string` - Checkbox label
- `description?`: `string` - Description text

---

### MobileRadioGroup
Touch-friendly radio group.

**Location**: `src/components/mobile/mobile-forms.tsx`

```tsx
import { MobileRadioGroup } from "@/components/mobile/mobile-forms";

<MobileRadioGroup
  label="Payment Method"
  options={[
    { value: "cash", label: "Cash", description: "Pay now" },
    { value: "card", label: "Card", description: "Credit/Debit" },
  ]}
  value={selectedMethod}
  onChange={setSelectedMethod}
/>
```

**Props**:
- `label?`: `string` - Group label
- `options`: Array of option objects
- `value?`: Selected value
- `onChange?`: Change handler

---

## Button Components

### MobileButton
Touch-friendly button component.

**Location**: `src/components/mobile/mobile-buttons.tsx`

```tsx
import { MobileButton } from "@/components/mobile/mobile-buttons";

<MobileButton
  variant="primary"
  size="md"
  icon={<Plus />}
  loading={isLoading}
>
  Create Item
</MobileButton>
```

**Props**:
- All standard `<button>` props
- `variant?`: `"primary" | "secondary" | "outline" | "ghost" | "danger"`
- `size?`: `"sm" | "md" | "lg" | "full"`
- `icon?`: `ReactNode` - Icon element
- `iconPosition?`: `"start" | "end"` (default: "start")
- `loading?`: `boolean` - Show loading state
- `children`: Button text

**Features**:
- Minimum 44x44px
- Multiple variants
- Icon support
- Loading state
- Active animation

---

### MobileSegmentedControl
Tab-like control for multiple options.

**Location**: `src/components/mobile/mobile-buttons.tsx`

```tsx
import { MobileSegmentedControl } from "@/components/mobile/mobile-buttons";

<MobileSegmentedControl
  options={[
    { value: "tab1", label: "Tab 1", icon: <Icon1 /> },
    { value: "tab2", label: "Tab 2", icon: <Icon2 /> },
  ]}
  value={activeTab}
  onChange={setActiveTab}
  fullWidth
/>
```

**Props**:
- `options`: Array of option objects
- `value`: Selected value
- `onChange`: Change handler
- `fullWidth?`: Stretch to full width
- `size?`: `"sm" | "md" | "lg"`

---

## Dialog Components

### MobileDialog
Bottom-sheet style modal on mobile, centered on desktop.

**Location**: `src/components/mobile/mobile-dialogs.tsx`

```tsx
import { MobileDialog } from "@/components/mobile/mobile-dialogs";

<MobileDialog
  isOpen={isOpen}
  title="Confirm Action"
  description="Are you sure?"
  onClose={() => setIsOpen(false)}
  footer={<button>Cancel</button>}
>
  Content here
</MobileDialog>
```

**Props**:
- `isOpen`: `boolean` - Dialog visibility
- `onClose`: `() => void` - Close handler
- `title?`: `string` - Dialog title
- `description?`: `string` - Dialog description
- `children`: Dialog content
- `footer?`: `ReactNode` - Footer content
- `size?`: `"sm" | "md" | "lg"`
- `fullscreen?`: `boolean` - Full screen on mobile

---

### MobileAlert
Alert dialog with confirm/cancel buttons.

**Location**: `src/components/mobile/mobile-dialogs.tsx`

```tsx
import { MobileAlert } from "@/components/mobile/mobile-dialogs";

<MobileAlert
  isOpen={isOpen}
  title="Delete Item?"
  message="This action cannot be undone."
  variant="danger"
  confirmText="Delete"
  cancelText="Keep"
  onConfirm={() => handleDelete()}
  onClose={() => setIsOpen(false)}
/>
```

**Props**:
- `isOpen`: `boolean` - Alert visibility
- `onClose`: `() => void` - Close handler
- `title`: `string` - Alert title
- `message`: `string` - Alert message
- `variant?`: `"info" | "warning" | "danger" | "success"`
- `confirmText?`: `string` (default: "OK")
- `cancelText?`: `string` (default: "Cancel")
- `onConfirm?`: `() => void` - Confirm handler
- `onCancel?`: `() => void` - Cancel handler

---

### MobileSheet
Side drawer component.

**Location**: `src/components/mobile/mobile-dialogs.tsx`

```tsx
import { MobileSheet } from "@/components/mobile/mobile-dialogs";

<MobileSheet
  isOpen={isOpen}
  title="Options"
  side="end"
  onClose={() => setIsOpen(false)}
>
  Content here
</MobileSheet>
```

**Props**:
- `isOpen`: `boolean` - Sheet visibility
- `onClose`: `() => void` - Close handler
- `title?`: `string` - Sheet title
- `children`: Sheet content
- `footer?`: `ReactNode` - Footer
- `side?`: `"start" | "end"` (default: "end")

---

## Dashboard Components

### MobileDashboardLayout
Main dashboard page wrapper.

**Location**: `src/components/mobile/mobile-dashboard.tsx`

```tsx
import { MobileDashboardLayout } from "@/components/mobile/mobile-dashboard";

<MobileDashboardLayout>
  {/* Sections */}
</MobileDashboardLayout>
```

---

### MobileDashboardSection
Dashboard content section with title and action.

**Location**: `src/components/mobile/mobile-dashboard.tsx`

```tsx
import { MobileDashboardSection } from "@/components/mobile/mobile-dashboard";

<MobileDashboardSection
  title="Quick Actions"
  description="Start your workflow"
  action={{ label: "View All", href: "/path" }}
>
  {/* Cards */}
</MobileDashboardSection>
```

---

### MobileDashboardGrid
Responsive grid for dashboard content.

**Location**: `src/components/mobile/mobile-dashboard.tsx`

```tsx
import { MobileDashboardGrid } from "@/components/mobile/mobile-dashboard";

<MobileDashboardGrid columns="auto" gap="md">
  {/* Cards */}
</MobileDashboardGrid>
```

**Column Options**:
- `"auto"`: 1 col (mobile) → 2 cols (tablet) → 4 cols (desktop)
- `"2"`: 1 col (mobile) → 2 cols (desktop)
- `"3"`: 1 col (mobile) → 2 cols (tablet) → 3 cols (desktop)
- `"4"`: 1 col (mobile) → 2 cols (tablet) → 4 cols (desktop)

---

## Utility Components & Functions

### Mobile Breakpoints
Responsive design system utilities.

**Location**: `src/lib/mobile-breakpoints.ts`

```tsx
import { MOBILE_TYPOGRAPHY, MOBILE_SPACING, MOBILE_GRID_LAYOUTS } from "@/lib/mobile-breakpoints";

// Use in className
<div className={MOBILE_TYPOGRAPHY.heading1}>Title</div>
<div className={`${MOBILE_CONTAINERS.card} ${MOBILE_SPACING.md}`}>Content</div>
```

---

## Quick Reference

### Import Patterns

```tsx
// Buttons
import { MobileButton, MobileSegmentedControl, MobileActionButton } from "@/components/mobile/mobile-buttons";

// Cards
import { MobileMetricCard, MobileQuickAction, MobileCard, MobileListItem } from "@/components/mobile/mobile-cards";

// Tables
import { MobileCardTable, MobileTableRow, MobileTableList } from "@/components/mobile/mobile-table";

// Forms
import { MobileInput, MobileSelect, MobileTextarea, MobileCheckbox, MobileRadioGroup } from "@/components/mobile/mobile-forms";

// Dialogs
import { MobileDialog, MobileAlert, MobileSheet } from "@/components/mobile/mobile-dialogs";

// Dashboard
import { MobileDashboardLayout, MobileDashboardSection, MobileDashboardGrid } from "@/components/mobile/mobile-dashboard";

// Layout
import { ResponsivePageShell } from "@/components/layout/responsive-page-shell";
```

---

**Last Updated**: May 2024
**Version**: 1.0
