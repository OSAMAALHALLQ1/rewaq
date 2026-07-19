---
name: rewaq-playwright-e2e
description: Create, run, and debug Playwright end-to-end tests for Rewaq workflows, roles, multi-tenant isolation, POS, inventory, purchasing, accounting, tables, KDS, and responsive RTL interfaces.
---

# Playwright E2E Rules

1. Reuse the project's current Playwright configuration.
2. Prefer stable accessible locators and test IDs; avoid brittle CSS selectors.
3. Never hardcode production credentials. Use seeded test tenants and environment variables.
4. Isolate test data by unique run ID and clean it safely.
5. Capture trace, screenshot, and video on failure according to project policy.
6. Assert business outcomes, not only visible success messages.
7. For financial/stock flows, verify source document, stock movement, journal entry, and balances.
8. Test direct URL/request access for unauthorized roles, not only hidden navigation.
9. Cover desktop and a representative mobile viewport for critical pages.
10. Report flaky behavior separately; do not hide it with unlimited retries.

Core scenarios:

- Login and tenant isolation.
- Shift -> order -> kitchen -> payment -> invoice.
- Purchase order -> receipt -> supplier invoice -> partial payment.
- Stock count -> approval -> adjustment.
- Waste -> approval -> inventory/accounting effect.
- Duplicate request/idempotency.
- Closed period denial.
