# Mobile Implementation Guide

## Quick Start

### 1. Update Page Layouts

Replace `PageShellClient` with `ResponsivePageShell`:

```tsx
// ✅ New
import { ResponsivePageShell } from "@/components/layout/responsive-page-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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

// ❌ Old (deprecated)
import { PageShellClient } from "@/components/layout/page-shell";
```

### 2. Update Dashboard Pages

Convert dashboard pages to use mobile-optimized components:

```tsx
import { MobileDashboardLayout, MobileDashboardSection, MobileDashboardGrid } from "@/components/mobile/mobile-dashboard";
import { MobileMetricCard, MobileQuickAction } from "@/components/mobile/mobile-cards";
import { MobileButton } from "@/components/mobile/mobile-buttons";

export default function DashboardPage() {
  return (
    <MobileDashboardLayout>
      {/* Quick Actions */}
      <MobileDashboardSection 
        title="Quick Actions"
        description="Frequently used features"
      >
        <MobileDashboardGrid columns="2">
          <MobileQuickAction
            title="New Invoice"
            description="Quick sale"
            icon={<ReceiptText />}
            href="/dashboard/invoices/new"
          />
          <MobileQuickAction
            title="Inventory"
            description="Check stock"
            icon={<Boxes />}
            href="/dashboard/inventory"
          />
        </MobileDashboardGrid>
      </MobileDashboardSection>

      {/* Metrics */}
      <MobileDashboardSection 
        title="Key Metrics"
        action={{ label: "View All", href: "/dashboard/reports" }}
      >
        <MobileDashboardGrid columns="auto">
          <MobileMetricCard
            title="Total Sales"
            value="50,000 SAR"
            trend="up"
            trendValue="+15%"
            variant="success"
          />
          <MobileMetricCard
            title="Inventory Cost"
            value="25,000 SAR"
            trend="down"
            trendValue="-8%"
            variant="info"
          />
        </MobileDashboardGrid>
      </MobileDashboardSection>
    </MobileDashboardLayout>
  );
}
```

### 3. Update Tables

Convert traditional tables to mobile-friendly card views:

```tsx
import { MobileCardTable, MobileTableList, MobileTableRow } from "@/components/mobile/mobile-table";

export default function ItemsPage() {
  const items = [...];
  
  return (
    <MobileCardTable
      columns={[
        { key: "name", label: "Item Name", width: "40%" },
        { key: "category", label: "Category", width: "30%" },
        { key: "quantity", label: "Qty", width: "15%" },
        { key: "price", label: "Price", width: "15%" },
      ]}
      data={items}
      renderCell={(key, value) => {
        if (key === "price") return formatCurrency(value);
        return value;
      }}
      onRowClick={(row) => router.push(`/dashboard/items/${row.id}`)}
    />
  );
}
```

Or use the component-based approach:

```tsx
<MobileTableList
  rows={items.map(item => ({
    primary: {
      label: "Item",
      value: item.name,
    },
    secondary: [
      { label: "Category", value: item.category },
      { label: "Qty", value: item.quantity },
    ],
    details: [
      { label: "Price", value: formatCurrency(item.price) },
      { label: "SKU", value: item.sku },
    ],
    badge: {
      label: item.status,
      variant: item.status === "active" ? "success" : "warning",
    },
    onClick: () => router.push(`/items/${item.id}`),
  }))}
/>
```

### 4. Create Mobile Forms

Use mobile-optimized form components:

```tsx
import { MobileFormField, MobileInput, MobileSelect, MobileButton } from "@/components/mobile/mobile-forms";

export default function CreateInvoicePage() {
  return (
    <form className="space-y-6">
      <MobileInput
        label="Customer Name"
        placeholder="Enter customer name"
        required
        icon={<User />}
      />

      <MobileSelect
        label="Payment Method"
        options={[
          { value: "cash", label: "Cash" },
          { value: "card", label: "Card" },
          { value: "transfer", label: "Bank Transfer" },
        ]}
        placeholder="Select payment method"
        required
      />

      <MobileFormField
        label="Notes"
        hint="Optional delivery instructions"
      >
        <textarea
          className="w-full rounded-lg border border-input px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary min-h-24"
          placeholder="Add notes..."
        />
      </MobileFormField>

      <div className="flex gap-2">
        <MobileButton variant="outline" size="full">
          Cancel
        </MobileButton>
        <MobileButton variant="primary" size="full">
          Create Invoice
        </MobileButton>
      </div>
    </form>
  );
}
```

### 5. Use Mobile Dialogs

Replace standard modals with mobile-optimized dialogs:

```tsx
import { MobileDialog, MobileAlert } from "@/components/mobile/mobile-dialogs";

export default function ItemDeletePage() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <button onClick={() => setConfirmOpen(true)}>Delete Item</button>

      <MobileAlert
        isOpen={confirmOpen}
        title="Delete Item?"
        message="This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
```

## Common Patterns

### Pattern 1: Responsive Grid with Auto-Layout

```tsx
{/* Automatically adapts: 1 col (mobile) → 2 cols (tablet) → 4 cols (desktop) */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
  {items.map(item => (
    <MobileMetricCard key={item.id} {...item} />
  ))}
</div>
```

### Pattern 2: Mobile-First Conditional Rendering

```tsx
{/* Show different content based on screen size */}
<>
  <div className="md:hidden">
    {/* Mobile-specific compact view */}
    <MobileListItem title={title} subtitle={subtitle} />
  </div>

  <div className="hidden md:block">
    {/* Desktop-friendly expanded view */}
    <Card>
      <CardContent>
        <h3>{title}</h3>
        <p>{description}</p>
        <Table>{/* Full table */}</Table>
      </CardContent>
    </Card>
  </div>
</>
```

### Pattern 3: Touch-Friendly Buttons

```tsx
{/* Ensure all buttons are touch-friendly */}
<div className="flex flex-col sm:flex-row gap-2 md:gap-3">
  <MobileButton variant="outline" size="full" className="sm:flex-1">
    Cancel
  </MobileButton>
  <MobileButton variant="primary" size="full" className="sm:flex-1">
    Save
  </MobileButton>
</div>
```

### Pattern 4: Responsive Typography

```tsx
{/* Text sizes adapt based on screen */}
<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold">
  Title
</h1>

<p className="text-sm md:text-base lg:text-lg">
  Body text
</p>
```

### Pattern 5: Mobile Navigation

```tsx
{/* Mobile: Bottom nav, Desktop: Sidebar + Header */}
<ResponsivePageShell session={session} branches={branches} notifications={notifications}>
  {/* Automatically shows bottom nav on mobile, sidebar on desktop */}
  {children}
</ResponsivePageShell>
```

## Responsive Design Checklist

- [ ] **Navigation**
  - [ ] Bottom nav visible on mobile
  - [ ] Sidebar drawer accessible
  - [ ] Desktop sidebar persistent
  - [ ] Header collapses on mobile

- [ ] **Layouts**
  - [ ] Single column on mobile
  - [ ] Multi-column grid on tablet
  - [ ] Full layouts on desktop
  - [ ] No horizontal scrolling

- [ ] **Components**
  - [ ] Touch targets ≥ 44x44px
  - [ ] Proper spacing (8px minimum)
  - [ ] Clear focus states
  - [ ] Working animations

- [ ] **Forms**
  - [ ] Input height ≥ 44px
  - [ ] Large, readable text
  - [ ] Proper keyboard types
  - [ ] Clear error messages

- [ ] **Tables/Lists**
  - [ ] Card-based on mobile
  - [ ] Traditional tables on desktop
  - [ ] Proper scrolling
  - [ ] Touch-friendly rows

- [ ] **Performance**
  - [ ] Images responsive
  - [ ] CSS/JS optimized
  - [ ] No layout shifts
  - [ ] Fast load times

- [ ] **Accessibility**
  - [ ] Proper ARIA labels
  - [ ] Semantic HTML
  - [ ] Keyboard navigation
  - [ ] Screen reader tested

- [ ] **Testing**
  - [ ] Tested on real devices
  - [ ] Various network speeds
  - [ ] Both orientations
  - [ ] Different browsers

## Migration Checklist

Use this when converting existing pages:

1. **Replace Layout Wrapper**
   ```tsx
   // OLD: PageShellClient
   // NEW: ResponsivePageShell
   ```

2. **Convert Navigation**
   ```tsx
   // Check that mobile header and bottom nav render correctly
   ```

3. **Update Grid Systems**
   ```tsx
   // Convert to: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
   ```

4. **Convert Tables**
   ```tsx
   // Use MobileCardTable or MobileTableList
   ```

5. **Update Forms**
   ```tsx
   // Use MobileInput, MobileSelect, etc.
   ```

6. **Add Mobile Components**
   ```tsx
   // Replace plain HTML elements with mobile-optimized versions
   ```

7. **Test Responsiveness**
   ```tsx
   // Test on mobile, tablet, and desktop
   ```

8. **Optimize Performance**
   ```tsx
   // Run Lighthouse audit
   // Optimize images and scripts
   // Monitor Core Web Vitals
   ```

## Debugging Mobile Issues

### Common Issues

1. **Horizontal Scrolling**
   - Check for elements wider than viewport
   - Use `overflow-hidden` on body
   - Verify max-width constraints

2. **Text Too Small**
   - Increase font size on mobile
   - Use responsive typography utilities
   - Ensure 16px+ minimum

3. **Touch Targets Too Small**
   - Minimum 44x44px
   - Add padding around targets
   - Check spacing between elements

4. **Slow Performance**
   - Optimize images
   - Minimize CSS/JS
   - Enable compression
   - Use service workers

5. **Layout Shifts**
   - Specify image dimensions
   - Reserve space for dynamic content
   - Use `will-change` sparingly

### Debugging Tools

```tsx
// Add mobile debugging class
<div className="debug-mobile">
  {/* Content */}
</div>
```

```css
/* Visual guides for debugging */
.debug-mobile * {
  outline: 1px solid red;
}

.debug-mobile button,
.debug-mobile a {
  outline: 1px solid blue;
}
```

## Performance Targets

- **Lighthouse Performance Score**: ≥ 90
- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **First Input Delay (FID)**: < 100ms

## Support & Resources

- Check `docs/MOBILE_DESIGN_SYSTEM.md` for complete design system
- Review component examples in `src/components/mobile/`
- Test using browser DevTools mobile emulation
- Use real device testing for accurate results

---

**Need Help?** Check the implementation examples or create an issue with details.
