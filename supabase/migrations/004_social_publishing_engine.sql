create extension if not exists "pgcrypto";

create table if not exists social_oauth_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  platform social_platform not null,
  state text not null unique,
  code_verifier text,
  redirect_to text,
  requested_scopes text[] not null default '{}',
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table social_accounts
  add column if not exists provider_user_id text,
  add column if not exists provider_account_id text,
  add column if not exists encrypted_refresh_token text,
  add column if not exists token_type text,
  add column if not exists granted_scopes text[] not null default '{}',
  add column if not exists permission_status text not null default 'pending_review',
  add column if not exists oauth_connected_at timestamptz,
  add column if not exists oauth_error text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists social_accounts_provider_account_idx
  on social_accounts (organization_id, platform, provider_account_id)
  where provider_account_id is not null;

alter table social_media_assets
  add column if not exists url text,
  add column if not exists provider text not null default 'imagekit',
  add column if not exists file_id text,
  add column if not exists media_kind text not null default 'image',
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists duration_seconds numeric(10,2),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table social_publish_jobs
  add column if not exists run_after timestamptz not null default now(),
  add column if not exists status text not null default 'queued',
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists target_id uuid references social_post_targets(id) on delete cascade,
  add column if not exists platform social_platform,
  add column if not exists trigger_source text not null default 'dashboard',
  add column if not exists schedule_kind text not null default 'manual',
  add column if not exists max_attempts integer not null default 3,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists completed_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists external_run_id text,
  add column if not exists payload jsonb not null default '{}'::jsonb;

create index if not exists social_publish_jobs_queue_idx
  on social_publish_jobs (status, run_after, next_retry_at, locked_at);

create index if not exists social_publish_jobs_target_idx
  on social_publish_jobs (organization_id, social_post_id, target_id);

alter table social_publish_logs
  add column if not exists organization_id uuid references organizations(id) on delete cascade,
  add column if not exists social_post_id uuid references social_posts(id) on delete cascade,
  add column if not exists target_id uuid references social_post_targets(id) on delete set null,
  add column if not exists platform social_platform,
  add column if not exists status social_target_status,
  add column if not exists message text,
  add column if not exists provider_response jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists job_id uuid references social_publish_jobs(id) on delete set null,
  add column if not exists social_account_id uuid references social_accounts(id) on delete set null,
  add column if not exists attempt integer not null default 1,
  add column if not exists provider_post_id text,
  add column if not exists provider_url text,
  add column if not exists error_code text,
  add column if not exists error_message text,
  add column if not exists retryable boolean not null default false,
  add column if not exists requested_by uuid references auth.users(id),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz;

create index if not exists social_publish_logs_job_idx
  on social_publish_logs (organization_id, job_id, created_at desc);

create index if not exists social_publish_logs_target_idx
  on social_publish_logs (organization_id, target_id, created_at desc);

alter table social_oauth_states enable row level security;

drop policy if exists "social_oauth_states org read" on social_oauth_states;
create policy "social_oauth_states org read" on social_oauth_states
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "social_oauth_states org write" on social_oauth_states;
create policy "social_oauth_states org write" on social_oauth_states
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

comment on table social_oauth_states is 'Short-lived OAuth state and PKCE verifier records for connecting social accounts.';
comment on column social_accounts.encrypted_access_token is 'Store encrypted access tokens only. Use Supabase Vault/KMS or server-side encryption before production.';
comment on column social_accounts.encrypted_refresh_token is 'Store encrypted refresh tokens only. Never expose in browser code.';
comment on table social_publish_jobs is 'Queue table for dashboard, scheduler, Node-RED, or Trigger.dev publish tasks.';
comment on table social_publish_logs is 'Append-only publishing audit trail with per-platform attempts, failures, retries, and approvals.';
