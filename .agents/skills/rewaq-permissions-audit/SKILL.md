---
name: rewaq-permissions-audit
description: Design or audit Rewaq roles, permission keys, branch and warehouse scopes, financial limits, approvals, segregation of duties, sensitive-field visibility, server checks, and RLS enforcement.
---

# Permissions Audit

Use permission keys, not scattered role-name checks.

Evaluate six dimensions:

1. Resource: orders, tables, inventory, waste, purchasing, production, accounting, users, settings.
2. Action: view, create, edit_draft, submit, approve, post, reverse, void, export.
3. Scope: organization, brand, region, branch, warehouse, station, shift, own records.
4. Sensitive visibility: cost, purchase price, profit, bank balances, payroll, customer data.
5. Limit: discount percentage, refund amount, waste value, stock difference, purchase order, payment, journal value.
6. Approval: who approves, whether maker-checker applies, number of approval levels, expiry.

Rules:

- Default deny.
- Check on every server mutation and protected query.
- RLS must deny crafted cross-tenant/cross-branch requests.
- The creator must not approve their own sensitive transaction when segregation is enabled.
- Permission changes require audit logs.
- Temporary access must have reason, grantor, and expiry.
- Add tests for denied UI route, denied direct request, exceeded limit, and approval workflow.
