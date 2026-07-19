---
name: rewaq-release-gate
description: Run the final release and pull-request quality gate for Rewaq after code changes, migrations, permission changes, accounting changes, inventory changes, or deployment preparation.
---

# Rewaq Release Gate

Do not declare completion until all applicable checks run.

1. Confirm the diff matches the requested scope.
2. Run the repository's actual package-manager commands for typecheck, lint, unit tests, integration tests, build, and Playwright smoke.
3. Review changed migrations, RLS policies, indexes, and generated types.
4. Run or inspect tenant-isolation and branch-scope tests.
5. Review permission checks on UI, server, and database layers.
6. For financial changes, verify balanced entries, closed periods, idempotency, reversal, and subledger reconciliation.
7. For stock changes, verify immutable movements, no negative-stock policy violations, valuation, and duplicate protection.
8. Scan for secrets, unsafe logging, and vulnerable dependency additions.
9. List every changed file and migration.
10. Report failed/not-run checks honestly and block release for critical failures.
11. Include deployment steps, validation queries, monitoring signals, and rollback notes.
