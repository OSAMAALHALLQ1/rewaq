# Mobile Design System - Complete Guide

## Overview

This document outlines the comprehensive mobile design system for the Rewaq application. The system is built with a mobile-first approach, ensuring excellent performance and responsiveness across all device sizes.

## Architecture

### Three-Tier Responsive Design

#### **Tier 1: Mobile (sm: < 640px)**
- Portrait phones
- Single-column layouts
- Bottom navigation for main areas
- Touch-friendly (44x44px minimum targets)
- Mobile header with compact search
- Card-based table views
- Vertical scrolling emphasis

#### **Tier 2: Tablet (md-lg: 640px - 1024px)**
- Landscape phones & small tablets
- Two-column grid layouts
- Hybrid navigation (desktop header + bottom nav accessible)
- Increased spacing and padding
- Two-column cards/metrics
- Sidebar drawer accessible via menu

#### **Tier 3: Desktop (lg+: 1024px+)**
- Tablets, laptops, and large screens
- Multi-column layouts (3-4 columns)
- Persistent sidebar navigation
- Full desktop header with search
- Traditional table views
- Horizontal content flow

## Navigation Strategy

### Mobile Navigation (md and below)

**Bottom Navigation**
- 5 main navigation items: Home, Sales, Inventory, Purchases, Reports
- Always accessible and visible
- Active state indicated by top border and background color
- Quick navigation between main app areas

**Mobile Header**
- Compact logo and user info
- Search icon (expands on click)
- Profile menu (for settings and logout)
- Notification bell

**Sidebar Drawer**
- Hidden by default
- Overlay effect when open
- Full navigation hierarchy
- Accessible from menu button

### Desktop Navigation (lg and above)

**Persistent Sidebar**
- Left-side fixed navigation
- All navigation items visible
- Quick action buttons for common tasks
- Search and branch selector

**Desktop Header**
- Full search bar
- Branch selector
- Quick action buttons
- Notification bell
- User profile

## Component Library

### Core Mobile Components

#### 1. **MobileButton**
```tsx
<MobileButton variant="primary" size="md">
  Click me
</MobileButton>
```
- **Sizes**: sm (36px), md (40px), lg (48px), full (100% width)
- **Variants**: primary, secondary, outline, ghost, danger
- **Features**: Loading state, icon support, active scale animation

#### 2. **MobileMetricCard**
```tsx
<MobileMetricCard
  title="Total Sales"
  value="15,000 SAR"
  trend="up"
  trendValue="+12%"
  variant="success"
/>
```
- **Variants**: default, success, warning, danger, info
- **Features**: Trend indicators, icons, descriptions

#### 3. **MobileQuickAction**
```tsx
<MobileQuickAction
  title="New Invoice"
  description="Quick sale"
  icon={<ReceiptText />}
  href="/dashboard/invoices/new"
/>
```
- **Features**: Touch-friendly, badge support, icon display

#### 4. **MobileListItem**
```tsx
<MobileListItem
  title="Item Title"
  subtitle="Subtitle"
  badge="5"
  href="/details"
/>
```
- **Features**: Icon support, badges, dividers, descriptions

#### 5. **MobileCardTable**
```tsx
<MobileCardTable
  columns={[...]}
  data={[...]}
  onRowClick={(row) => {...}}
/>
```
- **Features**: Card-based table view, touch-friendly, responsive

#### 6. **MobileInput/MobileSelect/MobileTextarea**
```tsx
<MobileInput
  label="Item Name"
  placeholder="Enter name"
  error="This field is required"
/>
```
- **Features**: Large touch targets (44px), auto-capitalization, proper keyboard types

#### 7. **MobileDialog/MobileSheet**
```tsx
<MobileDialog
  isOpen={isOpen}
  title="Confirm"
  onClose={() => setIsOpen(false)}
>
  Are you sure?
</MobileDialog>
```
- **Features**: Bottom sheet on mobile, centered on desktop, proper scrolling

## Layout Patterns

### Dashboard Page Layout

```tsx
<MobileDashboardLayout>
  <MobileDashboardSection title="Quick Actions">
    <MobileDashboardGrid columns="2">
      {/* Cards */}
    </MobileDashboardGrid>
  </MobileDashboardSection>

  <MobileDashboardSection title="Metrics">
    <MobileDashboardGrid columns="auto">
      {/* Metric cards */}
    </MobileDashboardGrid>
  </MobileDashboardSection>
</MobileDashboardLayout>
```

### Responsive Grid System

```tsx
// Auto-responsive grid
<MobileDashboardGrid columns="auto">
  {/* 1 col (mobile), 2 cols (tablet), 4 cols (desktop) */}
</MobileDashboardGrid>

// Two-column grid
<MobileDashboardGrid columns="2">
  {/* 1 col (mobile), 2 cols (tablet+) */}
</MobileDashboardGrid>

// Three-column grid
<MobileDashboardGrid columns="3">
  {/* 1 col (mobile), 2 cols (tablet), 3 cols (desktop) */}
</MobileDashboardGrid>
```

## Breakpoints & Media Queries

### Tailwind Breakpoints
- `sm`: 640px - Small devices
- `md`: 768px - Medium devices (tablets)
- `lg`: 1024px - Large devices (desktops)
- `xl`: 1280px - Extra large devices
- `2xl`: 1536px - Ultra large devices

### Usage Examples

```tsx
{/* Hidden on mobile, visible on md and up */}
<div className="hidden md:block">Desktop content</div>

{/* Visible on mobile, hidden on md and up */}
<div className="md:hidden">Mobile content</div>

{/* Different layouts for different sizes */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
  {/* Cards */}
</div>
```

## Touch-Friendly Design Principles

### 1. **Touch Targets**
- Minimum 44x44px for all interactive elements
- Adequate spacing between elements (minimum 8px)
- Rounded corners for modern appearance

### 2. **Input Optimization**
- Large input fields (44-48px height)
- Proper keyboard types (number, email, tel, etc.)
- Clear error states
- Helpful hints and labels

### 3. **Feedback & Responsiveness**
- Visual feedback on all interactions
- Active/pressed states
- Loading indicators
- Haptic feedback where possible

### 4. **Navigation Efficiency**
- Minimize taps needed to reach content
- Clear hierarchy and organization
- Quick access to frequent actions
- Breadcrumbs for deep navigation

## Performance Optimizations

### Mobile Performance

1. **Image Optimization**
   - Use responsive images with `srcset`
   - Lazy load images below fold
   - Optimize image formats and sizes

2. **Code Splitting**
   - Separate mobile and desktop components
   - Load only necessary assets
   - Defer non-critical scripts

3. **Network Optimization**
   - Minimize CSS/JS bundle size
   - Use gzip compression
   - Cache static assets
   - Implement service workers

4. **Rendering Performance**
   - Use `will-change: transform` for animated elements
   - Enable GPU acceleration
   - Optimize re-renders
   - Use `transform` over `top/left` for animations

## Safe Area Support

The design system includes support for devices with notches and safe areas:

```tsx
{/* Automatically handled in layouts */}
<main className="px-4 md:px-6"> {/* Safe area included */}
  {/* Content */}
</main>
```

### Safe Area Classes
- `.safe-area-top` - Padding for notch
- `.safe-area-bottom` - Padding for home indicator
- `.safe-area-left` - Padding for left notch
- `.safe-area-right` - Padding for right notch

## Accessibility

### Mobile Accessibility

1. **Touch Targets**: Minimum 44x44px
2. **Color Contrast**: WCAG AA minimum
3. **Focus Management**: Clear focus indicators
4. **Semantic HTML**: Proper ARIA labels
5. **Keyboard Navigation**: Full keyboard support
6. **Screen Readers**: Proper announcements

### Testing Checklist

- [ ] All buttons minimum 44x44px
- [ ] Touch targets spaced at least 8px apart
- [ ] Clear focus states on all interactive elements
- [ ] Proper color contrast (4.5:1 for text)
- [ ] Semantic HTML and ARIA labels
- [ ] Keyboard navigation works
- [ ] Screen reader announces content correctly
- [ ] No horizontal scrolling on mobile

## Implementation Guidelines

### 1. Mobile-First Approach
Always start with mobile layout, then enhance for larger screens:

```tsx
{/* Mobile first */}
<div className="px-3 py-2 text-sm md:px-4 md:py-3 md:text-base lg:px-6 lg:py-4 lg:text-lg">
  Content
</div>
```

### 2. Use Mobile Components
Always use mobile-optimized components from the mobile library:

```tsx
// ✅ Good
import { MobileButton, MobileInput, MobileCard } from "@/components/mobile";

// ❌ Avoid
<button>Click</button>
<input type="text" />
```

### 3. Test Across Devices
- Test on actual mobile devices (not just browser emulation)
- Test various network speeds (3G, 4G, WiFi)
- Test with various orientations (portrait, landscape)
- Test on different devices (iPhone, Android, tablets)

### 4. Monitor Performance
- Use Lighthouse for performance audits
- Monitor Core Web Vitals
- Track real user monitoring (RUM) data
- Optimize based on actual user behavior

## File Structure

```
src/
├── components/
│   ├── mobile/
│   │   ├── mobile-buttons.tsx
│   │   ├── mobile-cards.tsx
│   │   ├── mobile-dashboard.tsx
│   │   ├── mobile-dialogs.tsx
│   │   ├── mobile-forms.tsx
│   │   └── mobile-table.tsx
│   ├── layout/
│   │   ├── mobile-nav-config.ts
│   │   ├── mobile-header.tsx
│   │   ├── mobile-bottom-nav.tsx
│   │   └── responsive-page-shell.tsx
│   └── ui/
│       └── [existing UI components]
├── lib/
│   └── mobile-breakpoints.ts
└── app/
    ├── globals.css
    └── mobile-responsive.css
```

## Future Enhancements

1. **Advanced Gestures**: Swipe, pinch, long-press handling
2. **Progressive Web App (PWA)**: Offline support, app-like feel
3. **Dark Mode**: Complete dark theme support
4. **Accessibility**: Enhanced accessibility features
5. **Analytics**: Mobile-specific analytics
6. **A/B Testing**: Test different mobile UX patterns

## Resources & References

- [MDN: Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Google Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)
- [Lighthouse Performance Audit](https://developers.google.com/web/tools/lighthouse)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design 3](https://m3.material.io/)

---

**Last Updated**: May 2024
**Version**: 1.0
**Status**: Production
