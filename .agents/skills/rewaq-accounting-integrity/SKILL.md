---
name: rewaq-accounting-integrity
description: Review or implement any Rewaq workflow that creates, changes, posts, reverses, or reports financial entries, invoices, payments, expenses, tax, receivables, payables, inventory valuation, or period closing.
---

# Accounting Integrity Checklist

Before editing, identify the source document, accounting date, currency, accounts, dimensions, posting status, approval state, and reversal behavior.

For every posting:

1. Verify total debit equals total credit.
2. Use the document date and block closed periods.
3. Create a stable link between source document and journal entry.
4. Add an idempotency constraint so retries cannot duplicate entries.
5. Execute document update and journal posting in one database transaction/RPC.
6. Never delete posted entries. Reverse them with references to the original.
7. Reconcile subledgers to the general ledger.
8. Preserve organization, branch, cost center, and user scope.
9. Record audit metadata and approval chain.
10. Add tests for success, duplicate request, partial failure, permission denied, closed period, and reversal.

Do not approve cash-flow, tax, AR, AP, or inventory valuation logic from UI appearance alone. Trace the underlying query and accounting model.
