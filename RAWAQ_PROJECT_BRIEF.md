# Rawaq Project Brief

Rawaq is an Arabic smart restaurant ERP/POS system built with Next.js, React, TypeScript, Tailwind, and Supabase. The goal is to become a complete restaurant operating system similar to high-end accounting and restaurant platforms, covering cashier sales, kitchen tickets, inventory, warehouses, recipes, purchasing, supplier invoices, waste, returns, reports, permissions, manual account approval, and accounting journals.

## Core Product Vision

Rawaq should feel like a serious production system for restaurants, not a demo. It must connect every workflow together:

- Cashier sale creates an invoice, deducts recipe/material inventory, sends kitchen tickets, records shift cash activity, and posts accounting entries.
- Kitchen screens receive real tickets from POS and update preparation status.
- Warehouse screens show live stock by branch and warn about low quantities.
- Purchasing and supplier invoices update inventory and post ledger entries.
- Waste, returns, stock counts, and transfers must affect inventory and accounting through traceable records.
- Admin users approve new accounts manually before they can access the dashboard.

## Current Architecture

- App framework: Next.js App Router.
- Frontend: React/TypeScript with Arabic RTL-friendly operational UI.
- Backend: Next server actions and API routes.
- Database/auth: Supabase.
- Project repo: `OSAMAALHALLQ1/rewaq`.
- Local project path: `C:\Users\Anas\Desktop\rewaq`.
- Supabase project ref: `thusfzjbzzcevvgddoxs`.

## Important Implemented Areas

- Manual account approval flow:
  - New users register and remain pending.
  - Admin approval/rejection controls exist.
  - Admin notification email is configured for `osaco221@gmail.com`.
  - Pending users are redirected to `/pending-approval`.

- Department devices:
  - Device API keys for POS, kitchen, and warehouse.
  - `/d/gate` authenticates department devices.
  - `/d/pos`, `/d/kitchen`, and `/d/inventory` use department keys.
  - Internal department chat is API-backed.

- POS and kitchen:
  - POS catalog loads from Supabase.
  - POS checkout creates customer invoices.
  - Checkout posts sales ledger entries.
  - Checkout creates kitchen tickets.
  - Kitchen screen reads live tickets and updates status.

- Inventory:
  - Warehouse screen reads live stock from `inventory_items` and `branch_stock`.
  - Stock movements are used for purchase, sale usage, waste, transfer, and adjustments.
  - Production orders consume recipe materials from stock.

- Accounting:
  - Chart of accounts and journal ledger exist.
  - Customer invoices post sales, tax, cash/bank, COGS, and inventory lines.
  - Cash shift variances post ledger entries.
  - Supplier invoices post inventory vs accounts payable.
  - Waste posts operating expense vs inventory.
  - Purchase receipt posts inventory vs goods received not invoiced.

## Project Rules

- Arabic-friendly UI is required.
- Never delete financial records.
- Never delete inventory transactions.
- Use correction, reversal, adjustment, or closing records instead of destructive deletes.
- Every important action should have an audit trail.
- Critical roles: Owner, Manager, Cashier, Kitchen, Warehouse, Accountant, Super Admin.
- Supabase RLS and server-side checks must protect organization, branch, role, and device boundaries.
- Before large features, define database tables, workflow lifecycle, permissions, and accounting/inventory impact.

## Installed Codex Skills

The project includes 10 local Codex skills under `.agents/skills`:

- `backend-architect`
- `database-architect`
- `frontend-developer`
- `design-system-architect`
- `workflow-automation`
- `event-sourcing-architect`
- `payment-integration`
- `business-analyst`
- `security-auditor`
- `test-automator`

Use them by asking Codex, for example:

`Use $security-auditor to review Rawaq account approval, Supabase RLS, and department device access.`

## Known Current Blockers

- Supabase cloud migrations have not been pushed from CLI pending manual review of the migration plan.
- Vercel may need environment variables configured:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_REGISTRATION_EMAIL=osaco221@gmail.com`
  - `RESEND_API_KEY`
  - `EMAIL_FROM`

## Best Next Work

1. Fix any Vercel build/deploy error using the exact Vercel log.
2. Apply Supabase migrations to the cloud project after CLI login/token is available.
3. Continue replacing demo/static UI with Supabase-backed data.
4. Improve cost accounting page so it reads real recipes, inventory costs, sales, waste, and overheads.
5. Add ledger coverage for stock counts, manual adjustments, returns, and transfers.
6. Strengthen audit logs for financial, inventory, approval, and device actions.
7. Add focused tests for POS checkout, inventory deduction, approval flow, and accounting postings.

## Suggested Prompt For A New Chat

You are working on Rawaq, an Arabic smart restaurant ERP/POS system in `C:\Users\Anas\Desktop\rewaq`. Read `RAWAQ_PROJECT_BRIEF.md` and `AGENTS.md` first. Continue improving the project toward a production-grade restaurant system with Supabase, manual account approval, POS, kitchen tickets, inventory, purchasing, accounting ledger, reports, and strict permissions. Preserve auditability and never delete financial or inventory history.
