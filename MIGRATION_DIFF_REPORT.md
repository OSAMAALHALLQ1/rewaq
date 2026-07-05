# Migration Diff Report

Date: 2026-07-01
Canonical future migration directory: `supabase/migrations`
Live project ref: `thusfzjbzzcevvgddoxs`

## Summary

The live Supabase project has migrations `001` through one `006` applied. The local repository contains many later migrations that are not applied remotely. There is also a duplicate local migration version `006` in `supabase/migrations`, which makes the history ambiguous.

The most important schema mismatch is `department_api_keys`:

- The legacy Supabase migration creates raw key storage with `department_id` and `key`.
- Current application code expects hashed device keys with `key_hash`, `organization_id`, `branch_id`, `role`, `allowed_modules`, and `is_active`.
- The safer schema exists in `db/migrations/010_fix_department_api_keys.sql`, but that migration is not part of the current applied remote history.

## Remote Vs Local

| Version/File | Remote | `supabase/migrations` | `db/migrations` | Notes |
| --- | --- | --- | --- | --- |
| `001_initial_schema.sql` | applied | present | present | Base schema. |
| `002_pos_inventory_backend.sql` | applied | present | present | POS/inventory backend functions. |
| `003_social_platform_expansion.sql` | applied | present | present | Social expansion. |
| `004_social_publishing_engine.sql` | applied | present | present | Social publishing. |
| `005_business_profiles_and_cashier_role.sql` | applied | present | present | Business profile/cashier role. |
| `006_add_departments_and_api_keys.sql` | likely applied | present | absent | Legacy raw-key department schema. |
| `006_email_approval_and_team_invites.sql` | not applied | present | present as version 006 in `db` | Duplicate local version in `supabase`. |
| `007_whatsapp_social_platform.sql` | not applied | present | present | Local only. |
| `008_admin_user_setup.sql` | not applied | present | absent | Supabase-only local. |
| `008_department_access_and_messaging.sql` | not applied | absent | present | Contains newer `department_api_keys` and `internal_messages` shape. |
| `009_social_recurrence.sql` | not applied | present | absent | Supabase-only local. |
| `009_fix_rls_infinite_recursion.sql` | not applied | absent | present | Needed RLS helper fix. |
| `010_add_internal_messages.sql` | not applied | present | absent | Adds internal messages only. |
| `010_fix_department_api_keys.sql` | not applied | absent | present | Drops legacy department tables and recreates current key schema. Too destructive for direct use on live data. |
| `011`-`017` | not applied | present | present | Accounting, shifts, kitchen, production, approval, payables, GRNI. |
| `019`-`021` | not applied | present | absent | Warehouse/staff migrations in canonical directory only. |
| `022_forward_fix_department_api_keys.sql` | not applied | present | absent | New forward-fix migration prepared by this P0-1 work. |
| `023_harden_financial_inventory_rls.sql` | not applied | present | absent | Forward-only RLS hardening to remove destructive client delete paths from financial/inventory history. |

## Device Key Schema Conflict

### Legacy Supabase 006

`supabase/migrations/006_add_departments_and_api_keys.sql` creates:

- `departments`
- `department_members`
- `department_api_keys`

Its `department_api_keys` table has:

- `department_id`
- raw `key text not null unique`
- `name`
- `disabled`

This does not match the current application.

### Current Code Expectations

Current code queries and writes:

- `key_hash`
- `organization_id`
- `branch_id`
- `device_name`
- `role`
- `allowed_modules`
- `is_active`
- `last_used_at`

Observed in:

- `src/lib/department/auth.ts`
- `src/app/api/auth/department-login/route.ts`
- `src/app/api/department-keys/create/route.ts`
- `src/app/api/department-keys/list/route.ts`
- `src/app/api/department-keys/revoke/route.ts`
- `src/types/database.ts`

### DB Fix Versions

`db/migrations/008_department_access_and_messaging.sql` creates the current schema from scratch, but assumes no legacy table conflict.

`db/migrations/010_fix_department_api_keys.sql` drops the legacy `department_api_keys`, `department_members`, and `departments` tables, then recreates the current schema. This matches app code but is too destructive to run blindly on a live database.

### New Forward Fix

`supabase/migrations/022_forward_fix_department_api_keys.sql` was added to reconcile the live schema without dropping legacy data:

- Adds current app columns to `department_api_keys`.
- Makes legacy `department_id` and `key` nullable if they exist, so current app inserts can work.
- Backfills `organization_id`, `branch_id`, `device_name`, `key_hash`, and `is_active` from legacy departments/branches when possible.
- Adds current indexes and RLS policies.
- Adds `internal_messages`.
- Rewrites RLS helper functions to avoid recursive planner inlining issues.

## Project Ref Drift

The actual Supabase project used for Rawaq is `thusfzjbzzcevvgddoxs`.

Files originally inconsistent:

- `package.json` used `mcgqjnehywomnrjoxdzj`.
- `supabase/config.toml` used `mcgqjnehywomnrjoxdzj`.
- `RAWAQ_PROJECT_BRIEF.md` used `mcgqjnehywomnrjoxdzj`.
- `README.md` and `CLOUD.md` already used `thusfzjbzzcevvgddoxs`.

This P0-1 work updates the project-local references to `thusfzjbzzcevvgddoxs`.

## Risks

- Duplicate `006` migration versions in `supabase/migrations` can confuse future migration operations.
- The live database is behind many local migrations; applying all at once would touch account approval, accounting, shifts, kitchen tickets, production, warehouse, and staff schemas.
- The new `022` migration is prepared but not applied. It must be reviewed manually and backed up before use.
- The Supabase token used during this review was pasted into chat and should be revoked.

## Recommendation

1. Treat `supabase/migrations` as canonical going forward.
2. Do not edit or delete historical migration files until the team decides how to handle duplicate `006`; use forward-fix migrations for live safety.
3. Review `022_forward_fix_department_api_keys.sql`.
4. Take a Supabase backup/snapshot.
5. Apply migrations deliberately, starting with schema compatibility needed for device keys, not by blindly pushing every local migration.

## Local Drift Check

`scripts/check-migration-drift.mjs` now treats `supabase/migrations` as the canonical forward chain. It still compares shared migration files with `db/migrations`, but it no longer requires both directories to contain identical file lists because the canonical chain intentionally includes Supabase-only forward fixes.

The check specifically verifies that the legacy-only `db/migrations` repairs for department access, RLS recursion, and device-key schema are covered by `supabase/migrations/022_forward_fix_department_api_keys.sql`. It also rejects the destructive drop-table repair from `db/migrations/010_fix_department_api_keys.sql` if that pattern appears in the canonical forward fix.

The duplicate local version `006` remains a documented historical ambiguity. The check allows only the known pair and warns that `db push` must not be used until a deliberate migration-history repair path is chosen.
