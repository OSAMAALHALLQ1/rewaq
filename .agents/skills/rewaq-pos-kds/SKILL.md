---
name: rewaq-pos-kds
description: Implement or audit Rewaq POS, restaurant orders, tables, shifts, cashier actions, discounts, refunds, mixed payments, KDS stations, printing, offline behavior, and synchronization.
---

# POS and KDS Workflow

1. Separate operational order status from financial invoice/payment status.
2. Define explicit states: draft, confirmed, sent_to_kitchen, preparing, ready, served, paid, cancelled/refunded.
3. Every order has a stable client-generated idempotency key.
4. Do not classify every server error as offline. Distinguish network failure from validation, permission, stock, and closed-period errors.
5. Offline storage must use a durable local database, synchronization state, conflict handling, retry limits, and duplicate protection.
6. Discounts, voids, refunds, drawer opens, and price overrides require reason and permissions/approval limits.
7. KDS routes each item to the correct station and records acceptance, preparation, ready time, delay, cancellation, and re-fire.
8. Table workflows cover open, assign waiter, guest count, transfer, merge, split, close, and reservation where enabled.
9. Verify stock and accounting consequences after payment/refund.
10. Test cashier, waiter, kitchen, supervisor, and manager roles, including offline retry and duplicate submission.
