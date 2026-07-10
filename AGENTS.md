# Rawaq System

Arabic restaurant management SaaS: POS, kitchen tickets, inventory, purchasing, supplier/customer invoices, returns, waste, employees, permissions, social publishing, and full double-entry accounting.

## Core invariants (never violate)
- **Never delete financial, inventory, or audit records.** Use reversal (`reverseJournalEntry`), adjustment, or period-closing records instead of `delete`.
- **Never hardcode demo credentials** (client or server). Demo login uses `startDemoSessionAction` reading `RAWAQ_DEMO_EMAIL` / `RAWAQ_DEMO_PASSWORD` env vars; it is bound to the isolated demo org only.
- Arabic-first UI on every screen.
- Supabase RLS + server-side checks must protect every organization, branch, device, and role boundary.
- Every important action (invoices, stock movements, approvals, payments, journals) must write an audit trail.

## Commands
- `npm run lint` → `eslint` (no args). Single file: `npx eslint <file>`.
- **Typecheck is NOT a package script and NOT in CI:** `npx tsc --noEmit -p tsconfig.json`.
- `npm run test` → `vitest`. Single file: `npx vitest run __tests__/server/queries/ledger.test.ts`. Coverage: `npm run test:coverage`.
- `npm run dev` and `npm run build` use `--webpack` (not Turbopack).
- CI (`.github/workflows/ci.yml`) runs **only** `lint` + `build`. It does **not** run typecheck or tests — run those manually before a PR.

## Database & types (easy to get wrong)
- **Two migration directories — only one is active:**
  - `supabase/migrations/` (001–038) is the live schema, managed by the Supabase CLI. New migrations go here, named sequentially (e.g. `039_*.sql`).
  - `db/migrations/` (001–009) is **legacy**. `npm run db:apply` applies only a hardcoded list from there (`scripts/apply-supabase-sql.ps1`) and does **NOT** touch `supabase/migrations/`. Do not add new schema to `db/migrations/`.
  - Apply live schema with `npm run db:push` (Supabase CLI). `db:apply` needs `DATABASE_URL` in `.env`/`.env.local` and the CLI; it is only for the old seed path.
- **Type source of truth is the hand-written `src/types/database.ts`** (code imports `@/types/database`). When you add/alter a table or column in a migration, also edit `src/types/database.ts` or typecheck will fail. `npm run db:types` regenerates `src/types/supabase.generated.ts`, but app code does **not** import that file.
- Every new table needs RLS policies mirroring the pattern: `organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())`.

## Tenant isolation
- Scope resolution lives in `src/server/queries/_shared/utils.ts` (`resolveScope`), `src/server/actions/mutations.ts` (`resolveMutationScope`), `src/server/actions/accounting.ts` (`resolveAccountingScope`), and `src/server/actions/social.ts` (`resolveSocialScope`).
- **Never reintroduce a "fall back to the first organization" path** — that leaks another tenant's data. A user with no valid `organization_memberships` row must be denied, not scoped to org #1. `super_admin` must select the org explicitly.

## Accounting engine
- All journal postings go through `src/lib/accounting/posting.ts` (`postBalancedJournal` + per-document helpers). It enforces balanced entries and the closed-period check (`is_accounting_period_closed` RPC) centrally.
- Pass the real document date via `entryDate` — never use `new Date()` server date (UTC can shift the day). Use `todayLocal()` from that module when no document date exists.
- Reports (P&L, balance sheet, trial balance, dashboard, closing, journal listing) must filter `journal_entries.status = 'posted'` only (no drafts/voids).
- Reversals create a counter-entry; they do not delete.

## Tests
- `vitest.setup.ts` deletes Supabase env and sets `RAWAQ_DEMO_MODE=true`, so unit tests run in demo mode with **no real database required**. `vitest.config.ts` aliases `server-only` to a stub.
- Integration behavior against a live DB (RLS, RPCs, posting) is not covered by the suite — verify manually before shipping.

## Before a large feature
- Define the DB tables, lifecycle workflow, permissions, and accounting/inventory impact first. Keep features modular, testable, and safe in production. Restaurant workflows must stay connected (sales → recipe deduction → stock → purchasing → supplier invoices → ledger).

## Preferred skill order for large work
`database-architect` → `event-sourcing-architect` (immutable stock/invoice/audit/accounting) → `backend-architect` → `workflow-automation` → `frontend-developer` / `design-system-architect` → `business-analyst` → `payment-integration` → `security-auditor` → `test-automator`.
