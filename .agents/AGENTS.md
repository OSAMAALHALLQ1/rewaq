### Critical Operational Rules (Added via /learn)
- **Offline-First POS**: The cashier (POS) screen MUST function without internet. Invoices must be queued locally (IndexedDB/localStorage) and auto-synced when the connection returns. Never lose an invoice.
- **Concurrency & Race Conditions**: Wrap any operation that decrements stock or increments a counter (invoice numbers, stock quantities) in a transaction-safe pattern (e.g., row-level locking with `SELECT ... FOR UPDATE` or atomic `UPDATE`s) that prevents race conditions under concurrent requests.
- **Audit Logging**: All sensitive actions (price changes, invoice deletion, manual stock adjustments, permission changes) must be logged to an `audit_logs` table.
- **Testing Requirements**: Any fixes or features involving critical financial or inventory paths (e.g., `issue_customer_invoice`, low stock detection, daily summaries) MUST include a minimal automated test or a detailed manual test script to prove the fix and prevent regressions.
- **Demo vs Production**: Preserve demo mode behavior unchanged. Use real Supabase queries in production mode (never hardcoded/placeholder values).
- **UI Constraints**: Keep all UI labels in Arabic, RTL layout. Social media publishing features are frozen/deprecated — do not touch or extend them.

### Taka & Rewaq Unified Execution Plan (The Main Prompt)
You are working on the unified "Taka/Rewaq" Arabic RTL restaurant management system.
Rewaq is the base (Next.js), and we are porting Taka's frontend logic (POS, Waiter view) into it, while keeping Rewaq's strong database schema.

**Context:**
- This is for small-to-medium restaurants in Palestine: unreliable internet, pricing in Israeli shekels (₪).
- The POS must work offline-first — never lose an invoice.
- Ignore/do not extend any social media publishing features — those are deprecated.

**Before writing any code:**
1. Read the current schema and query files first.
2. Confirm which tables/values are demo-only vs production before touching dashboard or reporting logic.

**For every fix or feature:**
- Add or update a minimal automated test proving the change works.
- Use real Supabase queries in production — never hardcoded values.
- Keep all UI labels in Arabic, RTL layout.
- Wrap any stock decrement or counter increment (invoice numbers, stock quantities) in a transaction-safe pattern preventing race conditions.
- Log sensitive actions (price changes, invoice deletion, manual stock adjustments, permission changes) to an audit_logs table.

**Priority order for Sprints:**
1. Audit for cashier write permissions on pricing/catalog data, and DB-level race conditions on invoice numbering.
2. Add invoice_counters table for atomic, concurrency-safe invoice numbering.
3. Port Rewaq's inventory/recipe schema (inventory_items, branch_stock, stock_movements, recipes, recipe_ingredients) to integrate with Taka's flows.
4. Port issue_customer_invoice logic (stock deduction + cost/profit calculation) with row-level locking.
5. Add offline-first queueing and sync for the POS invoice flow.
6. Add thermal receipt printing (58mm/80mm, Arabic RTL template).
7. Add audit_logs table + logging for price changes, invoice deletion, stock adjustments, permission changes.
8. Port Food Cost calculation and the daily summary reporting view.

**Ask the user before making any schema changes that could break existing production data.**
