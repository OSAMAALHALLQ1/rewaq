# Migration State Remote

Date: 2026-07-01
Supabase project ref: `thusfzjbzzcevvgddoxs`
Dashboard URL: `https://supabase.com/dashboard/project/thusfzjbzzcevvgddoxs`

## Status

تم التحقق من الحالة الحقيقية للمشروع الحي قراءة فقط.

The earlier `mcgqjnehywomnrjoxdzj` reference in `package.json`, `supabase/config.toml`, and `RAWAQ_PROJECT_BRIEF.md` was incorrect for this working project. The visible Supabase project named `rewaq` is `thusfzjbzzcevvgddoxs`, and this is the project linked for this P0-1 review.

## Commands Run

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<redacted>"
npx supabase link --project-ref thusfzjbzzcevvgddoxs
npx supabase migration list --linked
```

No `db push`, `db reset`, seed script, or remote type generation was run.

## Remote Migration List

The CLI returned the following migration state:

| Version | Local | Remote | Status |
| --- | --- | --- | --- |
| 001 | yes | yes | applied remotely |
| 002 | yes | yes | applied remotely |
| 003 | yes | yes | applied remotely |
| 004 | yes | yes | applied remotely |
| 005 | yes | yes | applied remotely |
| 006 | yes | yes | applied remotely |
| 006 duplicate | yes | no | local only, duplicate version |
| 007 | yes | no | local only |
| 008 | yes | no | local only |
| 009 | yes | no | local only |
| 010 | yes | no | local only |
| 011 | yes | no | local only |
| 012 | yes | no | local only |
| 013 | yes | no | local only |
| 014 | yes | no | local only |
| 015 | yes | no | local only |
| 016 | yes | no | local only |
| 017 | yes | no | local only |
| 019 | yes | no | local only |
| 020 | yes | no | local only |
| 021 | yes | no | local only |

Raw CLI summary:

```json
{
  "migrations": [
    { "local": "001", "remote": "001", "time": "001" },
    { "local": "002", "remote": "002", "time": "002" },
    { "local": "003", "remote": "003", "time": "003" },
    { "local": "004", "remote": "004", "time": "004" },
    { "local": "005", "remote": "005", "time": "005" },
    { "local": "006", "remote": "006", "time": "006" },
    { "local": "006", "remote": "", "time": "006" },
    { "local": "007", "remote": "", "time": "007" },
    { "local": "008", "remote": "", "time": "008" },
    { "local": "009", "remote": "", "time": "009" },
    { "local": "010", "remote": "", "time": "010" },
    { "local": "011", "remote": "", "time": "011" },
    { "local": "012", "remote": "", "time": "012" },
    { "local": "013", "remote": "", "time": "013" },
    { "local": "014", "remote": "", "time": "014" },
    { "local": "015", "remote": "", "time": "015" },
    { "local": "016", "remote": "", "time": "016" },
    { "local": "017", "remote": "", "time": "017" },
    { "local": "019", "remote": "", "time": "019" },
    { "local": "020", "remote": "", "time": "020" },
    { "local": "021", "remote": "", "time": "021" }
  ],
  "message": "Migrations listed"
}
```

## Interpretation

- The live project is behind the local migration set.
- Only versions `001` through one `006` are applied remotely.
- `supabase/migrations` has two files with version `006`, which creates ambiguity:
  - `006_add_departments_and_api_keys.sql`
  - `006_email_approval_and_team_invites.sql`
- Because the current app expects `department_api_keys.key_hash`, `organization_id`, `branch_id`, `role`, and `allowed_modules`, the applied remote `006` must be treated cautiously. The safe path is a new forward-fix migration rather than editing/deleting historical migrations.

## Security Note

The access token used for this check was pasted into chat. Revoke it in Supabase after this review and generate a replacement if needed.
