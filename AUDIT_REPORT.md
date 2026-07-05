# Rawaq Audit Report

Date: 2026-07-01

Scope: phase 0 audit for the Rawaq ERP/POS project before production-hardening changes. This report combines security, database, backend, and product-gap reviews. No production code was changed during this audit.

## Executive Summary

Rawaq has a real operational core: Supabase-backed account approval, department devices, POS checkout, kitchen tickets, inventory screens, supplier invoices, stock movements, shifts, and accounting postings. It is not just a mock app.

However, it is not production-ready for financial or inventory use yet. The highest risks are:

- Financial and inventory workflows are often implemented as multi-step TypeScript sequences instead of one atomic database transaction.
- Demo fallbacks can turn missing production environment variables into simulated success.
- Migrations are split and inconsistent between `db/migrations` and `supabase/migrations`.
- RLS and server-side authorization are too broad for sensitive tables and actions.
- Some delete/update paths conflict with the rule that financial and stock history must be preserved.
- POS checkout currently posts sales with `costTotal: 0`, so COGS and inventory accounting can be wrong.
- Tests currently fail, so the project has no reliable safety net for critical flows.

## P0 Findings

### P0-1: Migration Sources Are Inconsistent

There are two migration histories that do not match:

- `supabase/migrations` contains files missing from `db/migrations`: `006_add_departments_and_api_keys.sql`, `008_admin_user_setup.sql`, `009_social_recurrence.sql`, `010_add_internal_messages.sql`, `019_add_warehouse_to_inventory.sql`, `020_ensure_inventory_warehouse.sql`, `021_staff_members.sql`.
- `db/migrations` contains fixes not present in the same form under `supabase/migrations`: `008_department_access_and_messaging.sql`, `009_fix_rls_infinite_recursion.sql`, `010_fix_department_api_keys.sql`.

The most dangerous mismatch is department device keys. `supabase/migrations/006_add_departments_and_api_keys.sql` creates a legacy `department_api_keys` shape with a raw `key`, while current code expects `key_hash`, `organization_id`, `branch_id`, `role`, and `allowed_modules`. The safer repair exists under `db/migrations/010_fix_department_api_keys.sql`, but not in the Supabase migration chain.

Impact: a cloud database can be migrated to a schema that is insecure, incompatible, or missing production columns.

Recommendation:

- Pick one canonical migration directory, preferably `supabase/migrations`.
- Port the device-key repair and RLS recursion fixes into the canonical chain.
- Add a migration consistency check to CI.

### P0-2: POS Checkout Is Not Atomic

The POS checkout route performs invoice creation, items, payments, shift updates, journal posting, inventory deduction, stock movements, and kitchen ticket creation as separate operations in `src/app/api/department/pos/checkout/route.ts`.

If any step fails after the invoice insert, the system can be left with a paid invoice but no correct inventory, no kitchen ticket, or no accounting entry. There is no real rollback, and errors from later stock movement inserts are not consistently checked.

Impact: sales, stock, kitchen, and ledger can diverge.

Recommendation:

- Move POS checkout into a single database RPC/transaction, for example `issue_customer_invoice_v2`.
- Include invoice, items, payment, stock movements, branch stock locks, COGS journal, shift sale, sales summary, and kitchen ticket in one atomic workflow.
- Require an idempotency key from POS devices.

### P0-3: POS Checkout Posts Zero Cost

The department POS checkout route inserts invoice items with `cost_total: 0` and calls `postCustomerInvoiceJournal` with `costTotal: 0`.

Files:

- `src/app/api/department/pos/checkout/route.ts`
- `src/lib/accounting/posting.ts`

Impact: POS sales can post revenue and cash but skip COGS and inventory credit lines. Gross profit and food-cost reports become overstated.

Recommendation:

- Calculate recipe/material cost before posting the customer invoice journal.
- Reuse one shared invoice-issuing workflow for dashboard sales and POS sales.

### P0-4: Demo Fallbacks Can Bypass Production Failure

Several paths return demo data or mock device sessions when Supabase environment variables are missing.

Examples:

- `src/lib/department/auth.ts`
- `src/app/api/department/pos/checkout/route.ts`
- `src/app/api/department/pos/catalog/route.ts`
- `src/server/queries/*`
- `src/server/reports/food-cost.ts`

Impact: a misconfigured production deployment can appear to work while writing no real data, authenticating fake devices, or showing demo reports.

Recommendation:

- Fail closed in production when Supabase env vars are missing.
- Gate demo mode behind an explicit `RAWAQ_DEMO_MODE=true` and disallow it when `NODE_ENV=production`.

### P0-5: Financial And Inventory Tables Allow Destructive Behavior

Migrations include broad delete policies and `on delete cascade` relationships for financial and inventory tables.

Examples:

- Generic delete policies in `supabase/migrations/001_initial_schema.sql`
- `journal_lines` cascade from `journal_entries` in `supabase/migrations/011_accounting_ledger.sql`
- `customer_invoice_items` cascade from `customer_invoices`
- `stock_movements`, `branch_stock`, `waste_logs`, `transfers`, and invoice-related tables are in broad RLS groups.

Code also contains direct deletes:

- `src/server/actions/adjustments.ts` deletes from `branch_stock` during manual rollback.
- `src/app/api/staff/toggle/route.ts` deletes from `staff_members`.

Impact: financial and stock history can be removed instead of corrected by reversal, void, archive, or adjustment.

Recommendation:

- Remove delete permissions from financial and inventory history tables.
- Replace destructive deletes with `voided_at`, `archived_at`, `is_active=false`, reversal entries, or adjustment movements.
- Make `stock_movements`, `journal_entries`, `journal_lines`, invoices, and payments append-only from the application.

### P0-6: Authorization Is Too Broad For Sensitive Actions

Many server actions rely on `resolveMutationScope()` / `requireAuth()` to prove organization membership, but do not enforce role-specific permissions or branch-specific access.

Examples:

- `src/server/actions/mutations.ts`
- `src/server/actions/adjustments.ts`
- `src/app/api/staff/create/route.ts`
- `src/app/api/staff/toggle/route.ts`

Impact: an approved organization member may be able to trigger financial, purchasing, inventory, shift, or staff actions if they can call the action.

Recommendation:

- Add central server-side guards such as `requireRoleCapability()` and `requireBranchCapability()`.
- Apply them to all write actions: invoices, inventory adjustments, transfers, purchase receiving, waste, stock counts, staff management, shifts, ledger, and account approval.

## P1 Findings

### P1-1: Inventory Updates Use Read-Modify-Write Without Locking

Helpers such as `addToBranchStock` and the POS checkout route read `branch_stock.quantity`, calculate a new value, then update the row. This is vulnerable to lost updates when two devices sell or receive stock at the same time.

Impact: branch stock can silently become inaccurate.

Recommendation:

- Use database RPC with `select ... for update` or atomic increments.
- Create a canonical `apply_stock_movement` workflow that updates stock and inserts movement records together.

### P1-2: Idempotency Is Incomplete

Dashboard invoice actions have partial idempotency, but POS checkout does not require an idempotency key. Some stock movements have nullable idempotency keys, and PostgreSQL permits multiple `NULL` values under a unique constraint.

Impact: retries, double-clicks, mobile reconnects, or POS resend can duplicate invoices or stock movements.

Recommendation:

- Require idempotency keys for POS checkout, purchase receiving, stock adjustments, waste, returns, transfers, and shift close.
- Enforce idempotency in database workflows, not only application code.

### P1-3: Journal Entries Are Not Enforced Balanced At DB Level

`postBalancedJournal` checks debit/credit equality in TypeScript, but the database allows direct writes through RLS policies for accountants/owners.

Impact: direct API/RLS writes can create unbalanced ledger entries.

Recommendation:

- Restrict direct journal writes.
- Add database-level posting functions or triggers that validate balance before `posted` status.
- Use reversal entries instead of update/delete for posted entries.

### P1-4: Missing Ledger Coverage

Current accounting posting covers:

- Customer invoice
- Cash variance
- Supplier invoice
- Purchase receipt / GRNI
- Waste / inventory write-off

Missing or unclear:

- Stock count variance
- Manual inventory adjustment, especially positive adjustments
- Returns and refunds
- Transfers between branches/warehouses
- Production variance and overhead allocation

Recommendation:

- Add posting functions for each movement lifecycle.
- Document debit/credit mapping before implementation.

### P1-5: Kitchen Ticket Update Is Not Branch-Scoped

Kitchen ticket listing is branch-aware, but updating a kitchen ticket status checks organization only. A device from one branch could update another branch ticket if it knows the ID.

Recommendation:

- Add branch condition for device-authenticated kitchen ticket updates.
- For devices with no branch, do not fall back silently to the first branch for write operations.

### P1-6: Device Auth Needs Hardening

Device key login stores the raw key in localStorage/cookies for long periods, and sensitive login endpoints do not have rate limiting.

Recommendation:

- Use short-lived signed device sessions stored in HttpOnly Secure cookies.
- Add key rotation, expiry, failed-attempt tracking, and rate limiting.
- Ensure cron routes require a secret in all non-local environments.

## P2 Findings

### P2-1: Database Constraints Are Too Loose

Several child tables carry their own `organization_id` without composite foreign keys ensuring the child organization matches the parent organization.

Examples:

- invoice items to invoices
- customer invoice items to customer invoices
- transfer items to transfers
- stock count items to stock counts
- journal lines to journal entries

Recommendation:

- Add composite foreign keys or triggers to enforce organization and branch consistency.
- Add quantity checks and sign rules for `stock_movements` by movement type.

### P2-2: Number Generation Can Race

Number generation patterns based on count plus one can collide under concurrency.

Recommendation:

- Use sequence/counter rows locked per organization and day.

### P2-3: Reports Still Depend On Demo Or Static Data

Reports and cost accounting contain partial real data, but still rely on demo/static fallback or estimates in multiple places.

Examples:

- `src/server/queries/admin.ts`
- `src/app/dashboard/reports/page.tsx`
- `src/server/reports/food-cost.ts`
- `src/app/dashboard/cost-accounting/page.tsx`

Impact: operational reports are not trustworthy enough for restaurant management decisions.

Recommendation:

- Replace demo/static report rows with Supabase-backed queries.
- Clearly show empty/error states instead of demo values.

### P2-4: Manual Approval Flow Needs Stronger Audit And Transaction Boundaries

Manual approval exists and is useful, but it performs several state changes: profile, organization, branch, membership, user metadata, request status, and email. These are not one DB transaction.

Recommendation:

- Move DB state changes to an approval RPC.
- Send email only after DB approval succeeds.
- Add audit events for approve/reject with admin identity, reason, timestamps, and target user.

## Product Gap Matrix

| Area | Current state | Gap |
| --- | --- | --- |
| Manual account approval | Implemented | Needs stronger audit and transactional approval state |
| Department devices | Partially real | Migration mismatch, weak session storage, no rate limiting |
| POS | Partially real | Non-atomic, no idempotency, zero COGS posting, limited UX |
| Kitchen | Partially real | Branch update gap, no station routing/SLA/history |
| Inventory | Partially real | Non-atomic stock updates, destructive rollback, weak constraints |
| Purchasing | Partially real | PO approval/partial receipt/matching lifecycle incomplete |
| Supplier invoices | Partially real | Lifecycle between invoice, receipt, AP, and GRNI needs definition |
| Waste | Partially real | Needs approval/review workflow and stronger audit |
| Returns | Partial | Needs invoice linkage, refund/payment handling, and ledger reversal |
| Transfers | Partial | Needs complete lifecycle and ledger/inventory guarantees |
| Stock counts | Partial | Needs variance posting and approval workflow |
| Ledger | Partial | Missing postings and DB-level balance/immutability protections |
| Reports | Partial/demo | Many outputs not production-trustworthy yet |
| Cost accounting | Partial | Needs real sales, waste, inventory, recipe, overhead integration |
| Audit trail | Insufficient | No unified append-only event log for sensitive operations |
| Tests | Failing | Critical workflows are not safely covered |

## Verification Snapshot

Commands run during audit:

```powershell
npm test -- --run
```

Result: failed. 12 tests failed out of 51. Failures include role/permission expectations, mapper behavior, optional text normalization, and food-cost report timeouts.

```powershell
npm run lint
```

Result: completed with warnings. 187 warnings were reported, mostly `any` usage and React hook issues in sensitive or user-facing code.

```powershell
npm run build
```

Result: inconclusive. The build attempt timed out after approximately 3 minutes with an EPIPE/timeout, so a longer dedicated build run is still needed.

## Blocker Snapshot

Phase 1 was checked in read-only mode. No migrations were pushed and no remote project was changed.

Current local blockers:

- `SUPABASE_ACCESS_TOKEN` is missing from the current shell environment.
- Supabase CLI is not available on `PATH`.
- Vercel CLI is not available on `PATH`.
- `.env.local` is missing.
- Required local environment variables are missing in the current shell: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_REGISTRATION_EMAIL`, `RESEND_API_KEY`, `EMAIL_FROM`, and `VERCEL_TOKEN`.
- `.vercel` is missing, so local Vercel project linkage cannot be verified.
- Supabase project ref was corrected during P0-1:
  - The live dashboard project for Rawaq is `thusfzjbzzcevvgddoxs`.
  - Earlier references to `mcgqjnehywomnrjoxdzj` in local project metadata were stale for this working project.
- `scripts/apply-supabase-sql.ps1` does not represent the full current migration chain; it applies only part of `db/migrations`.
- The cron route must not be deployed without a required `CRON_SECRET`.

Do not run `supabase db push`, `db:apply`, `db:reset`, cloud seed scripts, or remote type generation until the canonical migration chain and correct Supabase project ref are settled.

## Recommended Execution Order

1. P0: unify migrations and fix department key schema.
2. P0: fail closed in production when Supabase env is missing.
3. P0: remove destructive delete/write policies from financial and inventory history tables.
4. P0: implement a transaction-backed POS checkout workflow with idempotency and real COGS.
5. P0: add server-side role/branch guards to every sensitive write action.
6. P1: implement `apply_stock_movement` / specialized inventory RPC workflows.
7. P1: add ledger postings for stock counts, adjustments, returns, and transfers.
8. P1: add audit event log and write events for approvals, devices, invoices, ledger, and inventory.
9. P2: replace demo/static reporting with real Supabase-backed reports.
10. P2: fix the failing tests, then add critical workflow tests before broad refactors.

## Notes For The Next Phase

- Do not apply Supabase cloud migrations until the canonical migration chain is decided.
- Do not delete financial records, inventory transactions, journal entries, or movement history during cleanup.
- Prefer correction, reversal, voiding, archiving, and adjustment records.
- Before coding large fixes, define table lifecycle, permissions, audit event, and accounting/inventory impact.
