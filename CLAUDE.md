# Rewaq Engineering Instructions

## Product

Rewaq is a multi-tenant restaurant and café operations platform covering POS, tables, KDS, inventory, waste, recipes, production, purchasing, accounting, permissions, branches, marketing, and reporting.

## Non-negotiable rules

1. Inspect the existing implementation before changing it. Do not create a parallel subsystem.
2. Every business query and mutation must be scoped by `organization_id`; apply branch, warehouse, station, and user scope where relevant.
3. UI visibility is never an authorization boundary. Recheck permissions server-side and enforce tenant isolation with database RLS.
4. Never delete posted financial records. Correct them with reversal, credit/debit notes, or controlled void workflows.
5. Every multi-step financial or stock operation must be atomic and idempotent.
6. Block posting into closed accounting periods and use the source document date.
7. Monetary values must use decimal-safe database types and explicit rounding rules.
8. Do not expose service-role keys, access tokens, OAuth secrets, customer data, or bank data.
9. Do not apply production migrations automatically. Produce SQL, validation queries, risk notes, and rollback instructions first.
10. Preserve auditability: actor, timestamp, organization, branch, device, reason, before/after values, approval chain.
11. Do not add fake data, placeholder actions, cosmetic filters, or buttons that do nothing.
12. Prefer small PRs, one domain workflow at a time, with tests and acceptance criteria.

## Required workflow

Before coding:

1. Read relevant pages, queries, server actions, migrations, RLS policies, and tests.
2. Describe the current workflow and identify security/accounting/inventory impact.
3. Write a short plan and state assumptions.
4. Reuse existing conventions and shared services.

During coding:

- Use current package manager and project conventions.
- Validate input on the server.
- Enforce permissions and scope before mutation.
- Add constraints/indexes where correctness requires them.
- Handle retries and duplicate requests safely.
- Keep migrations incremental and backward-compatible when possible.

Before finishing:

1. Run typecheck, lint, tests, build, and relevant Playwright flows.
2. Review tenant isolation and RLS for changed tables.
3. Review debit/credit balance and stock effects for changed workflows.
4. List changed files and migrations.
5. State what was not tested.
6. Never claim success when commands failed.

## Domain invariants

- A posted journal entry must balance: total debit equals total credit.
- A source document must not create duplicate stock movements or journal entries when retried.
- A stock adjustment requires a document, reason, actor, approval state, and audit event.
- A user cannot approve their own sensitive transaction when segregation of duties is enabled.
- Cross-organization and unauthorized cross-branch access must be denied even with crafted URLs or request bodies.
- Cost and profit visibility are separate permissions from quantity and sales visibility.

## Documentation

Use current official documentation before relying on library APIs. Use Context7 or official primary documentation for Next.js, Supabase, Playwright, and other dependencies.


## Claude-specific delegation

Use project subagents in `.claude/agents/` for architecture, accounting, database/RLS, security, Playwright QA, and RTL/UI review. Read-only reviewers should not edit files. The implementation agent performs changes only after the relevant reviews.
