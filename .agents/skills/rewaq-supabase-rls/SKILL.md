---
name: rewaq-supabase-rls
description: Use for Supabase/PostgreSQL schema, migrations, RLS, indexes, constraints, SQL functions, RPC transactions, generated types, performance advisors, and multi-tenant isolation in Rewaq.
---

# Supabase and RLS Workflow

1. Start with read-only inspection. Never use production write access by default.
2. Scope MCP to one project with `project_ref` and prefer `read_only=true`.
3. Inspect current migrations and policies before writing SQL.
4. Every business table must carry or inherit reliable organization scope.
5. Add branch/warehouse scope where the domain requires it.
6. Use RLS as defense in depth; also verify permissions in server code.
7. Avoid policies that trust client-supplied organization IDs without membership validation.
8. Add foreign keys, unique constraints, checks, and indexes that enforce invariants.
9. For multi-step posting, prefer a transaction-safe PostgreSQL function/RPC.
10. Provide forward migration, validation queries, data backfill plan, and rollback notes.
11. Test authenticated user, unauthorized branch, cross-tenant access, service role behavior, and null/edge cases.
12. Regenerate database types after accepted schema changes.
