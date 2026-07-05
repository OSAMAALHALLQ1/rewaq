# Decisions - Takka Mobile Overhaul

1. **Bottom nav redesign**: Full redesign with glass-morphic, not just bugfix
2. **MoreSheet**: Extract shared component with createPortal, one instance for both manager and cashier
3. **Read-more**: Use `text-clamp-2` CSS class approach with toggle state
4. **Cashier more sheet**: Same content as manager - settings, reports, logout
5. **Safe-area**: Use CSS env() variables for iOS notch/home indicator
6. **Content padding**: Use `--nav-total-height` CSS variable across all views
7. **Single expanded item**: Use `expandedItemId` pattern (one open at a time) instead of per-item booleans
