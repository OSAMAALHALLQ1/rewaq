/**
 * Mobile Breakpoint System
 * Defines responsive breakpoints and utilities for the mobile-first design
 * Follows Tailwind's breakpoint system with custom mobile enhancements
 */

export const BREAKPOINTS = {
  // Mobile first approach
  sm: 640, // Small devices (portrait phones)
  md: 768, // Medium devices (landscape phones / tablets)
  lg: 1024, // Large devices (tablets)
  xl: 1280, // Extra large devices (desktops)
  "2xl": 1536, // Ultra large devices
};

export const SCREEN_SIZES = {
  mobile: "max-width: 640px", // Portrait phones
  mobileLandscape: "640px to 768px", // Landscape phones
  tablet: "768px to 1024px", // Tablets
  desktop: "1024px to 1280px", // Desktops
  largeDesktop: "1280px+", // Large desktops
};

/**
 * Mobile Design System - Typography
 */
export const MOBILE_TYPOGRAPHY = {
  heading1: "text-2xl md:text-3xl lg:text-4xl font-bold", // Page titles
  heading2: "text-xl md:text-2xl lg:text-3xl font-bold", // Section titles
  heading3: "text-lg md:text-xl lg:text-2xl font-bold", // Subsection titles
  subtitle: "text-base md:text-lg text-muted-foreground", // Subtitles
  body: "text-sm md:text-base", // Body text
  small: "text-xs md:text-sm", // Small text
  label: "text-xs md:text-sm font-semibold", // Labels
};

/**
 * Mobile Design System - Spacing
 * Used for consistent padding/margins across mobile screens
 */
export const MOBILE_SPACING = {
  xs: "px-2 py-1 md:px-3 md:py-2", // Extra small
  sm: "px-3 py-2 md:px-4 md:py-3", // Small
  md: "px-4 py-3 md:px-6 md:py-4", // Medium (default)
  lg: "px-6 py-4 md:px-8 md:py-6", // Large
  xl: "px-8 py-6 md:px-12 md:py-8", // Extra large
};

/**
 * Mobile Design System - Cards & Containers
 */
export const MOBILE_CONTAINERS = {
  card: "rounded-lg border border-border bg-white shadow-sm md:rounded-xl md:shadow-md",
  section: "space-y-3 md:space-y-4 lg:space-y-6",
  gridMobile: "grid grid-cols-1", // Single column on mobile
  gridMobileDouble: "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 gap-4", // Auto layout
  fullWidth: "w-full",
};

/**
 * Mobile Design System - Touch Targets
 * Ensures sufficient size for mobile touch interaction
 */
export const MOBILE_TOUCH_TARGETS = {
  button: "min-h-10 min-w-10", // 40x40px minimum
  iconButton: "h-10 w-10", // Square buttons
  touchArea: "p-3", // Safe touch padding
};

/**
 * Mobile Design System - Grid Layouts
 */
export const MOBILE_GRID_LAYOUTS = {
  // Single column on mobile, adaptive on larger screens
  responsive1to2to3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  responsive1to2: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2",
  responsive1to4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  
  // Specific for mobile metrics/cards
  metrics: "grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4",
  actions: "grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 lg:grid-cols-4",
};

/**
 * Mobile Design System - Utilities
 */
export const MOBILE_UTILITIES = {
  hideMobile: "hidden md:block", // Hide on mobile only
  showMobile: "md:hidden", // Show only on mobile
  showTablet: "hidden md:block lg:hidden", // Show only on tablet
  hideTablet: "md:hidden lg:block", // Hide on tablet
};
