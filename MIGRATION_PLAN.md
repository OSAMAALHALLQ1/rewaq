# Migration Plan

Date: 2026-07-01
Project ref: `thusfzjbzzcevvgddoxs`
Scope: P0-1 only, prepare migration unification and department device key schema repair.

## Do Not Execute Yet

This plan is prepared for manual review. No cloud migration was applied during this work.

Do not run:

- `npx supabase db push`
- `npx supabase db reset`
- cloud seed scripts
- remote type generation

until this plan is reviewed and a backup/snapshot exists.

## Required Backup

Before applying anything:

1. Open Supabase dashboard for `thusfzjbzzcevvgddoxs`.
2. Take a database backup/snapshot, or confirm point-in-time recovery is available.
3. Export the current schema if possible.
4. Keep the access token private. Revoke the token pasted into chat and generate a replacement if needed.

## Current State

Remote applied migrations:

- `001`
- `002`
- `003`
- `004`
- `005`
- one `006`

Local canonical directory `supabase/migrations` contains a duplicate `006`, later migrations `007`-`021`, and the new prepared forward-fixes:

- `022_forward_fix_department_api_keys.sql`
- `023_harden_financial_inventory_rls.sql`

## Why Not `db push` Yet

`supabase/migrations` contains two local migrations with version `006`:

- `006_add_departments_and_api_keys.sql`
- `006_email_approval_and_team_invites.sql`

The remote has one `006` applied. The CLI output cannot prove from the version alone which local file corresponds to the remote `006`, although the device-key mismatch strongly suggests the legacy department migration is part of the live history.

Running `db push` blindly may attempt to apply many unrelated local migrations at once, including account approval, accounting, shifts, kitchen, production, warehouse, and staff changes.

## Prepared Forward-Fix Migration

File:

- `supabase/migrations/022_forward_fix_department_api_keys.sql`

Purpose:

- Make the live `department_api_keys` table compatible with current app code.
- Preserve legacy rows and legacy columns.
- Backfill `key_hash`, `organization_id`, `branch_id`, `device_name`, and `is_active` when legacy department data is available.
- Add `internal_messages` if missing.
- Add RLS policies and indexes for device keys and internal messages.
- Recreate RLS helper functions as PL/pgSQL security-definer functions to reduce RLS recursion risk.

## Prepared RLS Hardening Migration

File:

- `supabase/migrations/023_harden_financial_inventory_rls.sql`

Purpose:

- Remove authenticated DELETE policies from financial and inventory history tables.
- Remove authenticated UPDATE access from `stock_movements` so inventory movement history is append-only through RLS.
- Replace broad `for all` RLS on journal entries, journal lines, chart accounts, transfer items, stock-count items, purchase-order items, invoice items, customer invoice items, customer invoice payments, and supplier price history with operation-specific policies.
- Preserve correction workflows through insert/update, voiding, reversals, or `is_active=false` instead of deleting rows.

Apply this only after the earlier migrations that create the affected accounting, invoice, transfer, and payment tables have been reviewed/applied.

## Recommended Manual Execution Order

### Step 1: Review The New Migration

Review:

- `supabase/migrations/022_forward_fix_department_api_keys.sql`

Confirm that the migration is acceptable because it:

- Does not drop `department_api_keys`.
- Does not drop `departments`.
- Does not drop `department_members`.
- Does not delete rows.
- Makes legacy `department_id` and raw `key` nullable only if they exist.
- Creates new current-app columns if missing.

### Step 2: Apply Only The Forward Fix

Because of duplicate local migration versions, do not use `db push` as the first production action.

Recommended safer options:

1. Apply the SQL contents of `022_forward_fix_department_api_keys.sql` through the Supabase SQL editor for project `thusfzjbzzcevvgddoxs`, or
2. Apply exactly that file through a controlled SQL execution command after review.

Do not apply unrelated pending migrations in the same operation.

### Step 3: Verify Schema

After applying the forward fix, verify these columns exist:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'department_api_keys'
order by ordinal_position;
```

Expected current-app columns:

- `organization_id`
- `branch_id`
- `device_name`
- `key_hash`
- `role`
- `allowed_modules`
- `is_active`
- `last_used_at`
- `created_by`

Verify policies:

```sql
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('department_api_keys', 'internal_messages')
order by tablename, policyname;
```

Verify app compatibility:

- Create a department key from `/dashboard/settings/devices`.
- Log in through `/d/gate`.
- Confirm `/d/pos`, `/d/kitchen`, and `/d/inventory` can authenticate with the new key.

### Step 4: Decide How To Handle Historical Migration Drift

After device-key compatibility is fixed, decide one of these approaches:

1. Keep historical files untouched and continue forward-only with new migrations from `022` onward.
2. Create a documented baseline/squash for future environments only, not for the existing live project.
3. Create a manual migration-repair record if Supabase migration history needs alignment.

Do not rename or delete applied historical migrations without a deliberate migration-history repair process.

### Step 5: Review Later Pending Migrations Separately

Pending local migrations `007` through `021` cover unrelated product areas. Review and apply them in smaller batches:

1. Account approval and team invites.
2. RLS recursion fix.
3. Internal messages, if not already covered by `022`.
4. Accounting ledger.
5. Cashier shifts.
6. Kitchen tickets.
7. Production orders.
8. Manual account activation.
9. Supplier payables and GRNI.
10. Warehouse/staff additions.
11. Financial and inventory RLS hardening from `023`.

## Rollback / Recovery

Preferred recovery is database restore from backup/snapshot.

If a restore is not needed and only the forward fix must be softened:

- Disable newly created keys by setting `is_active=false`; do not delete rows.
- Drop or disable only policies introduced by the migration if a policy blocks access.
- Keep legacy columns and rows intact.
- Do not drop `department_api_keys` unless a backup restore is planned.

Manual rollback snippets should be prepared only after reviewing the actual post-migration schema.

## Documentation Updates

Project ref should be consistent as:

- `thusfzjbzzcevvgddoxs`

Updated or verified:

- `package.json`
- `supabase/config.toml`
- `RAWAQ_PROJECT_BRIEF.md`
- `README.md`
- `CLOUD.md`

## Acceptance Checklist

- [x] Live remote migration state captured.
- [x] Migration diff report written.
- [x] Forward-fix migration prepared.
- [x] Project ref documentation corrected.
- [x] No cloud migration applied.
- [ ] Manual review completed by Anas.
- [ ] Backup/snapshot confirmed.
- [ ] Forward fix applied manually after approval.
