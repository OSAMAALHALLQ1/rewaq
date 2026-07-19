---
name: rewaq-architecture
description: Analyze and design changes in the Rewaq restaurant ERP codebase. Use before adding modules, restructuring pages, changing shared services, or creating cross-domain workflows. Do not use for tiny isolated copy changes.
---

# Rewaq Architecture Workflow

1. Map the existing route, UI components, queries, server actions/API handlers, database tables, migrations, RLS policies, and tests.
2. Explain the current workflow before proposing a replacement.
3. Search for existing shared services, document status models, audit helpers, permission checks, and posting functions. Reuse them.
4. Identify domain boundaries: POS/order, inventory, purchasing, production, accounting, permissions, reporting.
5. Produce a small implementation plan with changed files, schema impact, compatibility risk, and tests.
6. Prefer incremental migration over a parallel subsystem.
7. Keep client components thin; place authoritative validation and mutations on the server.
8. Reject fake controls, placeholder actions, hardcoded business data, and duplicated business logic.
9. After implementation, compare the result against the plan and report deviations.
