# Mobile Design System - Quick Reference

## 🎯 Quick Start (5 Minutes)

### 1. Update Dashboard Layout
```tsx
// src/app/dashboard/layout.tsx
- import { PageShellClient } from "@/components/layout/page-shell";
+ import { ResponsivePageShell } from "@/components/layout/responsive-page-shell";
```

### 2. Create Mobile Dashboard
```tsx
// src/app/dashboard/page.tsx
import { MobileDashboardLayout, MobileDashboardSection, MobileDashboardGrid } from "@/components/mobile/mobile-dashboard";
import { MobileMetricCard, MobileQuickAction } from "@/components/mobile/mobile-cards";

export default function DashboardPage() {
  return (
    <MobileDashboardLayout>
      <MobileDashboardSection title="Quick Actions">
        <MobileDashboardGrid columns="2">
          {/* Add cards */}
        </MobileDashboardGrid>
      </MobileDashboardSection>
    </MobileDashboardLayout>
  );
}
```

### 3. Test Responsiveness
- Open DevTools (F12)
- Enable device toolbar
- Select different devices
- Test landscape/portrait

---

## 📱 Screen Sizes

| Device | Width | Breakpoint |
|--------|-------|-----------|
| iPhone SE | 375px | sm |
| iPhone 12/13 | 390px | sm |
| iPhone 14 Pro Max | 430px | sm |
| iPad | 768px | md-lg |
| iPad Pro | 1024px | lg |
| Desktop | 1280px+ | xl |

---

## 🧩 Core Components

### Navigation
```tsx
// Automatic bottom nav on mobile, sidebar on desktop
<ResponsivePageShell {...props}>
  {children}
</ResponsivePageShell>
```

### Cards
```tsx
<MobileMetricCard title="Sales" value="50K" trend="up" trendValue="+15%" />
<MobileQuickAction title="New" description="Sale" icon={<Icon />} href="/path" />
<MobileCard title="Title">{content}</MobileCard>
```

### Forms
```tsx
<MobileInput label="Name" placeholder="Enter..." />
<MobileSelect label="Category" options={[...]} />
<MobileCheckbox label="Agree" />
```

### Buttons
```tsx
<MobileButton variant="primary" size="md">Action</MobileButton>
<MobileSegmentedControl options={[...]} value={val} onChange={set} />
```

### Tables
```tsx
<MobileCardTable columns={[...]} data={items} />
```

### Dialogs
```tsx
<MobileDialog isOpen={open} onClose={close} title="Title">Content</MobileDialog>
<MobileAlert isOpen={open} title="Confirm?" onConfirm={action} />
```

---

## 🎨 Responsive Patterns

### Grid - Auto Layout (1→2→4)
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

### Grid - 2 Columns
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2">
  {/* 1 col mobile, 2 cols tablet+ */}
</div>
```

### Conditional Content
```tsx
{/* Mobile only */}
<div className="md:hidden">Mobile</div>

{/* Desktop only */}
<div className="hidden md:block">Desktop</div>

{/* Responsive padding */}
<div className="px-3 py-2 md:px-4 md:py-3 lg:px-6 lg:py-4">
  Content
</div>
```

---

## 📏 Spacing & Sizing

### Touch Targets
- Minimum: 44x44px
- Recommended: 48-56px
- Spacing between: 8px+

### Font Sizes
- Mobile: 14-16px (body)
- Tablet: 15-17px
- Desktop: 16-18px

### Padding
- Mobile: 12px (px-3)
- Tablet: 16px (px-4)
- Desktop: 24px (px-6)

---

## 🚀 Performance Tips

1. **Use Responsive Images**
   ```tsx
   <img srcSet="small.jpg 640w, large.jpg 1280w" alt="" />
   ```

2. **Lazy Load Below Fold**
   ```tsx
   <img loading="lazy" alt="" />
   ```

3. **Minimize CSS/JS**
   - Tree-shake unused styles
   - Code splitting per route
   - Optimize images

4. **Monitor Core Web Vitals**
   - FCP < 1.8s
   - LCP < 2.5s
   - CLS < 0.1

---

## ♿ Accessibility Checklist

- [ ] All buttons ≥ 44x44px
- [ ] Focus ring visible on all interactive elements
- [ ] Color contrast ≥ 4.5:1
- [ ] Form labels present
- [ ] Proper ARIA attributes
- [ ] Keyboard navigation works
- [ ] Screen reader tested

---

## 🧪 Testing Devices

### Essential
- iPhone 13 (390px) - most common
- Samsung Galaxy S21 (360px) - Android
- iPad (768px) - tablet

### Recommended
- iPhone 14 Pro Max (430px) - larger iPhone
- iPhone SE (375px) - smaller iPhone
- iPad Pro (1024px) - larger tablet
- Desktop browser (1280px+)

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `MOBILE_DESIGN_SYSTEM.md` | Complete system overview |
| `MOBILE_IMPLEMENTATION_GUIDE.md` | Implementation examples |
| `MOBILE_COMPONENTS_REFERENCE.md` | API reference |
| `MOBILE_DASHBOARD_EXAMPLE.tsx` | Real-world example |
| `MOBILE_QUICK_REFERENCE.md` | This file |

---

## 🔧 Common Tasks

### Add a Metric Card
```tsx
<MobileMetricCard
  title="Total Sales"
  value="50,000 SAR"
  trend="up"
  trendValue="+15%"
  variant="success"
  icon={<TrendingUp />}
/>
```

### Add a Form Input
```tsx
<MobileInput
  label="Item Name"
  placeholder="Enter name"
  required
  error={error}
  hint="Maximum 100 chars"
/>
```

### Add a Dialog
```tsx
const [open, setOpen] = useState(false);
<MobileAlert
  isOpen={open}
  title="Delete?"
  message="Cannot undo"
  variant="danger"
  onConfirm={handleDelete}
  onClose={() => setOpen(false)}
/>
```

### Add a Responsive Grid
```tsx
<MobileDashboardGrid columns="auto">
  {items.map(item => (
    <MobileMetricCard key={item.id} {...item} />
  ))}
</MobileDashboardGrid>
```

---

## 🐛 Debugging

### Check Responsiveness
```bash
# Use DevTools
1. Press F12
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device from dropdown
4. Test all breakpoints
```

### Common Issues

**Horizontal Scrolling**
- Remove fixed widths > 100%
- Check max-width constraints
- Verify padding/margins

**Text Too Small**
- Minimum 16px on mobile
- Use responsive sizes: `text-sm md:text-base`

**Buttons Hard to Click**
- Minimum 44x44px
- Add padding if needed
- Check spacing between buttons

**Layout Breaks**
- Check breakpoint order
- Verify grid columns
- Test on actual devices

---

## 💡 Best Practices

### ✅ Do
- Start with mobile, enhance for desktop (mobile-first)
- Use responsive components from mobile library
- Test on real devices, not just emulation
- Keep animations under 300ms
- Optimize images for mobile networks

### ❌ Don't
- Use fixed widths/heights
- Hide content on mobile unnecessarily
- Make touch targets smaller than 44x44px
- Use heavy animations
- Ignore safe areas on notched devices

---

## 🔗 Related Files

```
src/
├── components/mobile/               # All mobile components
├── components/layout/              # Layout components
├── lib/mobile-breakpoints.ts       # Breakpoint utilities
└── app/mobile-responsive.css       # Mobile CSS

docs/
├── MOBILE_DESIGN_SYSTEM.md
├── MOBILE_IMPLEMENTATION_GUIDE.md
├── MOBILE_COMPONENTS_REFERENCE.md
├── MOBILE_DASHBOARD_EXAMPLE.tsx
└── MOBILE_QUICK_REFERENCE.md       # This file
```

---

## 📞 Need Help?

1. **Component API**: Check `MOBILE_COMPONENTS_REFERENCE.md`
2. **How-To Guides**: Check `MOBILE_IMPLEMENTATION_GUIDE.md`
3. **Design System**: Check `MOBILE_DESIGN_SYSTEM.md`
4. **Examples**: See `MOBILE_DASHBOARD_EXAMPLE.tsx`
5. **Source Code**: Browse `src/components/mobile/`

---

## 🎯 Success Metrics

After mobile redesign:
- **Lighthouse Score**: 85+
- **Core Web Vitals**: All green
- **Mobile Usability**: Perfect score
- **User Satisfaction**: >4.5/5
- **Mobile Traffic**: Increased engagement

---

**Version**: 1.0  
**Last Updated**: May 2024  
**Status**: Complete
