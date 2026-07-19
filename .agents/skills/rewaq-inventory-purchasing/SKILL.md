---
name: rewaq-inventory-purchasing
description: Implement or audit Rewaq inventory, warehouses, units, batches, expiry, transfers, receiving, stock counts, waste, purchase requisitions, purchase orders, supplier invoices, payments, and three-way matching.
---

# Inventory and Purchasing Workflow

For every document, specify:

- Document lifecycle and status transitions.
- Stock effect.
- Accounting effect.
- Approval requirement.
- Idempotency key.
- Audit event.

Required controls:

1. Separate branch, warehouse, location, and production station.
2. Support purchase/storage/recipe/sales units with explicit conversion rules.
3. Batch and expiry operations must preserve traceability and FEFO rules where enabled.
4. Transfers use request -> approve -> ship -> in_transit -> receive -> variance -> close.
5. Stock counts use a frozen snapshot, blind count option, recount, approval, and posted adjustment.
6. Waste records reason, stage, responsibility, batch, quantity, cost, actor, approval, and linked order/production when relevant.
7. Purchasing uses requisition -> quotation/comparison -> PO -> receipt/inspection -> supplier invoice -> payment.
8. Enforce three-way matching tolerances.
9. Never update quantity balances without an immutable stock movement.
10. Add tests for partial receipt, partial payment, duplicate retry, rejected quantity, stock shortage, and accounting reconciliation.
