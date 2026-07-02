create extension if not exists "pgcrypto";

create table if not exists account_approval_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  owner_name text not null,
  organization_name text not null,
  business_type text not null default 'restaurant',
  phone text,
  status text not null default 'pending_email_verification',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  unique (email)
);

create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  invite_code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  role app_role not null,
  branch_id uuid references branches(id) on delete set null,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_id, email),
  unique (invite_code)
);

alter table account_approval_requests enable row level security;
alter table team_invites enable row level security;

drop policy if exists "account approval admin read" on account_approval_requests;
create policy "account approval admin read" on account_approval_requests
  for select to authenticated using (public.is_super_admin());

drop policy if exists "account approval admin write" on account_approval_requests;
create policy "account approval admin write" on account_approval_requests
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "team_invites org read" on team_invites;
create policy "team_invites org read" on team_invites
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "team_invites owner write" on team_invites;
create policy "team_invites owner write" on team_invites
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[]))
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[]));

create index if not exists account_approval_requests_status_idx on account_approval_requests (status, requested_at desc);
create index if not exists team_invites_org_status_idx on team_invites (organization_id, status, created_at desc);

comment on table account_approval_requests is $$Email registration requests that wait for email verification and owner/admin approval before full activation.$$;
comment on table team_invites is $$Owner-created team invitations by email and invite code for cashier, inventory manager, and other roles.$$;
