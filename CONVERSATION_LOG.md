# Rawaq Conversation Log

Date: 2026-07-01
Project path: `C:\Users\Anas\Desktop\rewaq`

## Context

This thread continued work on Rawaq, an Arabic restaurant ERP/POS system built with Next.js, React, TypeScript, Tailwind, and Supabase.

Initial reminder:

- Main codebase used for GitHub updates: `C:\Users\Anas\Desktop\rewaq`
- Codex saved project folder: `C:\Users\Anas\Documents\رواق`
- Preserve financial and inventory history.
- Never delete financial records or stock movement history.
- Use corrections, reversals, adjustments, voiding, or archival records instead of destructive deletion.

## Project Brief Read

The file `RAWAQ_PROJECT_BRIEF.md` was read first.

Important product areas from the brief:

- Manual account approval
- Department devices
- POS
- Kitchen tickets
- Inventory and warehouse screens
- Purchasing and supplier invoices
- Waste, returns, stock counts, transfers
- Reports
- Permissions
- Accounting ledger

## Initial Project Critique

A direct review identified that Rawaq has a real operational core but is not production-ready yet.

Main concerns:

- Demo data and fallback paths still exist in sensitive workflows.
- POS checkout and dashboard invoice issuing duplicate business logic.
- POS device checkout posts `costTotal: 0`, so COGS/inventory accounting can be wrong.
- Stock updates use read-modify-write without transaction/locking.
- Some direct deletes exist, including staff deletion and branch stock rollback deletion.
- RLS and server-side permissions are too broad in places.
- Tests failed.
- Lint completed with many warnings.
- Build was inconclusive due to timeout.

## Sub-Agent Audit Phase

The user asked to run sub-agents for each relevant task. Four sub-agents were spawned:

1. Security auditor
2. Database architect
3. Backend architect
4. Business analyst

Their findings were merged into:

- `AUDIT_REPORT.md`

Key P0 findings in the audit:

- Migration sources are inconsistent.
- POS checkout is not atomic.
- POS checkout posts zero cost.
- Demo fallbacks can bypass production failures.
- Financial and inventory tables allow destructive behavior.
- Authorization is too broad for sensitive actions.

The audit also documented:

- Missing ledger coverage
- Device auth weaknesses
- Report/demo gaps
- Cost accounting gaps
- Testing failures
- Blockers around Supabase/Vercel environment

## Blocker Review

A separate blocker check was run.

Findings:

- Supabase CLI was initially missing.
- `SUPABASE_ACCESS_TOKEN` was initially missing.
- `.env.local` was missing.
- Vercel CLI and `.vercel` link were missing.
- The project ref appeared inconsistent across files.
- The audit warned not to push migrations until the canonical migration state was known.

These were documented in `AUDIT_REPORT.md` and later in `MIGRATION_STATE_REMOTE.md`.

## P0-1 Prompt

The user provided a specific P0-1 prompt:

Goal:

- Unify migrations.
- Fix the department device key schema.
- Treat `supabase/migrations` as canonical going forward.
- Do not run `db push`, `db reset`, seed scripts, or remote type generation.
- First capture the real migration state from the live Supabase project.

Acceptance criteria:

1. `MIGRATION_STATE_REMOTE.md`
2. `MIGRATION_DIFF_REPORT.md`
3. `MIGRATION_PLAN.md`
4. Correct project ref documentation
5. No actual cloud migration applied

## Supabase CLI Installation

Supabase CLI was installed as a project dev dependency:

```powershell
npm install -D supabase
```

The command timed out from the tool perspective, but installation completed:

```powershell
npx supabase --version
```

Result:

```text
2.109.0
```

Files changed:

- `package.json`
- `package-lock.json`

## Supabase Token Attempts

The user generated and pasted Supabase access tokens in chat.

Security note:

- The actual tokens are intentionally not copied into this log.
- They should be revoked in the Supabase dashboard because they were exposed in chat.

First token result:

- The token could list a project, but did not have access to the originally expected project ref.

Second token result:

- It also could not access `mcgqjnehywomnrjoxdzj`.
- It listed a project named `rewaq` with ref `thusfzjbzzcevvgddoxs`.

The user then clarified that the actual Rawaq Supabase dashboard URL is:

```text
https://supabase.com/dashboard/project/thusfzjbzzcevvgddoxs/sql/new
```

This changed the working project ref to:

```text
thusfzjbzzcevvgddoxs
```

## Remote Supabase Link And Migration State

The project was linked read-only using:

```powershell
npx supabase link --project-ref thusfzjbzzcevvgddoxs
```

Result:

```json
{"project_ref":"thusfzjbzzcevvgddoxs","message":""}
```

Then migration state was fetched:

```powershell
npx supabase migration list --linked
```

Remote applied migrations:

- `001`
- `002`
- `003`
- `004`
- `005`
- one `006`

Local-only migrations included:

- duplicate local `006`
- `007`
- `008`
- `009`
- `010`
- `011`
- `012`
- `013`
- `014`
- `015`
- `016`
- `017`
- `019`
- `020`
- `021`

This was documented in:

- `MIGRATION_STATE_REMOTE.md`

## Migration Difference Findings

The main mismatch is around department devices.

Legacy Supabase migration:

- `supabase/migrations/006_add_departments_and_api_keys.sql`
- Creates:
  - `departments`
  - `department_members`
  - `department_api_keys`
- Uses raw `key text`.

Current code expects:

- `key_hash`
- `organization_id`
- `branch_id`
- `device_name`
- `role`
- `allowed_modules`
- `is_active`
- `last_used_at`

Relevant current code:

- `src/lib/department/auth.ts`
- `src/app/api/auth/department-login/route.ts`
- `src/app/api/department-keys/create/route.ts`
- `src/app/api/department-keys/list/route.ts`
- `src/app/api/department-keys/revoke/route.ts`
- `src/types/database.ts`

The DB-side fix exists in:

- `db/migrations/008_department_access_and_messaging.sql`
- `db/migrations/009_fix_rls_infinite_recursion.sql`
- `db/migrations/010_fix_department_api_keys.sql`

But `010_fix_department_api_keys.sql` uses destructive drops, so it was not copied as-is for live use.

This was documented in:

- `MIGRATION_DIFF_REPORT.md`

## Forward-Fix Migration Prepared

A new migration was added:

- `supabase/migrations/022_forward_fix_department_api_keys.sql`

Purpose:

- Forward-fix the live schema without deleting legacy data.
- Add current-app columns to `department_api_keys`.
- Make legacy `department_id` and raw `key` nullable if they exist.
- Backfill `organization_id`, `branch_id`, `device_name`, `key_hash`, and `is_active` when legacy rows can be mapped.
- Add indexes and RLS policies.
- Add `internal_messages` if missing.
- Rewrite RLS helper functions as PL/pgSQL `security definer` functions to reduce RLS recursion risk.

Important:

- This migration was created locally only.
- It was not applied to Supabase.
- No cloud database write was performed.

## Migration Plan

The plan was written to:

- `MIGRATION_PLAN.md`

Key instructions:

- Take backup/snapshot before any application.
- Do not run `db push` blindly because of duplicate local migration version `006`.
- Review `022_forward_fix_department_api_keys.sql`.
- Apply only the forward-fix migration manually after review.
- Verify schema and policies after applying.
- Later handle pending migrations `007` through `021` in smaller batches.

## Project Ref Corrections

After the user clarified the real dashboard URL, the working project ref was corrected to:

```text
thusfzjbzzcevvgddoxs
```

Files updated:

- `package.json`
- `supabase/config.toml`
- `RAWAQ_PROJECT_BRIEF.md`
- `AUDIT_REPORT.md`

Files already using `thusfzjbzzcevvgddoxs`:

- `README.md`
- `CLOUD.md`

## Migration Drift Check Script

A future guard script was added:

- `scripts/check-migration-drift.mjs`

Purpose:

- Compare `supabase/migrations` and `db/migrations`.
- Detect files present in one directory but not the other.
- Detect duplicate migration versions.

Current result:

- The script fails, as expected, because it detects the current drift and duplicate `006`.

This is intended as a guard for future cleanup, not as a passing check yet.

## Files Created Or Modified

Created:

- `AUDIT_REPORT.md`
- `MIGRATION_STATE_REMOTE.md`
- `MIGRATION_DIFF_REPORT.md`
- `MIGRATION_PLAN.md`
- `CONVERSATION_LOG.md`
- `scripts/check-migration-drift.mjs`
- `supabase/migrations/022_forward_fix_department_api_keys.sql`

Modified:

- `package.json`
- `package-lock.json`
- `supabase/config.toml`
- `RAWAQ_PROJECT_BRIEF.md`
- `AUDIT_REPORT.md`

Supabase CLI also created local link metadata under:

- `supabase/.temp/`

The linked project metadata shows:

```json
{
  "ref": "thusfzjbzzcevvgddoxs",
  "name": "rewaq"
}
```

## Commands That Were Explicitly Not Run

The following were not run:

```powershell
npx supabase db push
npx supabase db reset
npx supabase gen types
```

No cloud seed script was run.

No remote migration was applied.

## Current State

P0-1 is prepared for manual review.

Ready files for review:

- `MIGRATION_STATE_REMOTE.md`
- `MIGRATION_DIFF_REPORT.md`
- `MIGRATION_PLAN.md`
- `supabase/migrations/022_forward_fix_department_api_keys.sql`

Next recommended step:

1. Revoke any Supabase tokens pasted into chat.
2. Review `022_forward_fix_department_api_keys.sql`.
3. Take Supabase backup/snapshot.
4. If approved, manually apply only the forward-fix migration.
5. Then verify device key creation and `/d/gate` login.

