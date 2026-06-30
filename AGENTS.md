# Rawaq System

Rawaq is a smart Arabic restaurant management system for POS, kitchen tickets, inventory, warehouses, recipes, suppliers, invoices, returns, waste tracking, employees, permissions, reports, accounting, and workflow automation.

Core rules:
- Arabic-friendly UI is required across customer-facing and back-office screens.
- Never delete financial records.
- Never delete inventory transactions.
- Use correction, reversal, adjustment, or closing records instead of destructive deletes.
- Every important action must create a traceable audit trail, especially invoices, stock movements, approvals, payments, and accounting journals.
- Critical roles are Owner, Manager, Cashier, Kitchen, Warehouse, Accountant, and Super Admin.
- Supabase RLS and server-side authorization must protect every organization, branch, device, and role boundary.
- Restaurant workflows must stay connected: cashier sales, recipe deduction, kitchen tickets, warehouse stock, purchasing, supplier invoices, waste, returns, reports, and ledger postings.
- Before coding a large feature, define the database tables, lifecycle workflow, permissions, and accounting or inventory impact.
- Keep features modular, testable, and safe to operate in production.

Preferred skill order for large Rawaq work:
1. Use `database-architect` to design schema and data lifecycle.
2. Use `event-sourcing-architect` for immutable stock, invoice, audit, and accounting flows.
3. Use `backend-architect` for APIs, services, permissions, and business logic.
4. Use `workflow-automation` for recipe deduction, alerts, approvals, kitchen routing, and closing processes.
5. Use `frontend-developer` and `design-system-architect` for Arabic operational interfaces.
6. Use `business-analyst` for KPIs, profitability, waste, stock, and management reports.
7. Use `payment-integration` for payment, refunds, reconciliation, and billing flows.
8. Use `security-auditor` before exposing sensitive workflows.
9. Use `test-automator` before considering a feature production-ready.
