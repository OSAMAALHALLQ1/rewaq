-- Forward fix for department device access and RLS helper recursion.
-- This migration is intentionally additive/non-destructive for live databases
-- that already applied the legacy 006_add_departments_and_api_keys.sql file.

create extension if not exists "pgcrypto";

-- Keep the legacy departments tables if they exist, but make the API-key table
-- compatible with the current application code, which expects hashed keys and
-- organization/branch scoping.
create table if not exists public.department_api_keys (
  id uuid primary key default gen_random_uuid()
);

alter table public.department_api_keys
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists branch_id uuid references public.branches(id) on delete cascade,
  add column if not exists device_name text,
  add column if not exists key_hash text,
  add column if not exists role public.app_role not null default 'staff',
  add column if not exists allowed_modules text[] not null default '{}'::text[],
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_used_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- The legacy schema required department_id and raw key. Current application
-- inserts do not provide those columns, so make them nullable if they exist.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'department_api_keys'
      and column_name = 'department_id'
  ) then
    alter table public.department_api_keys alter column department_id drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'department_api_keys'
      and column_name = 'key'
  ) then
    alter table public.department_api_keys alter column key drop not null;
  end if;
end $$;

-- Backfill new columns from the legacy department tables when possible.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'department_api_keys' and column_name = 'department_id')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'department_api_keys' and column_name = 'key')
     and to_regclass('public.departments') is not null then
    update public.department_api_keys dak
       set branch_id = coalesce(dak.branch_id, d.branch_id),
           organization_id = coalesce(dak.organization_id, b.organization_id),
           device_name = coalesce(dak.device_name, dak.name, d.name, 'جهاز قسم'),
           key_hash = coalesce(dak.key_hash, encode(digest(upper(trim(dak.key)), 'sha256'), 'hex')),
           is_active = case
             when dak.disabled is null then coalesce(dak.is_active, true)
             else not dak.disabled
           end,
           updated_at = now()
      from public.departments d
      join public.branches b on b.id = d.branch_id
     where dak.department_id = d.id;
  end if;
end $$;

-- Current application rows should always have a hash and device name. Existing
-- malformed legacy rows are left nullable rather than deleted.
create unique index if not exists department_api_keys_key_hash_key
  on public.department_api_keys (key_hash)
  where key_hash is not null;

create index if not exists dept_keys_hash_idx
  on public.department_api_keys (key_hash)
  where is_active = true and key_hash is not null;

create index if not exists dept_keys_org_idx
  on public.department_api_keys (organization_id);

alter table public.department_api_keys enable row level security;

drop trigger if exists set_department_api_keys_updated_at on public.department_api_keys;
create trigger set_department_api_keys_updated_at
  before update on public.department_api_keys
  for each row execute function set_updated_at();

drop policy if exists "Owners manage keys" on public.department_api_keys;
create policy "Owners manage keys" on public.department_api_keys
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.organization_memberships
      where organization_id = department_api_keys.organization_id
        and user_id = (select auth.uid())
        and role = 'organization_owner'
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1
      from public.organization_memberships
      where organization_id = department_api_keys.organization_id
        and user_id = (select auth.uid())
        and role = 'organization_owner'
    )
  );

drop policy if exists "Org members read keys" on public.department_api_keys;
create policy "Org members read keys" on public.department_api_keys
  for select to authenticated
  using (public.is_org_member(organization_id));

-- Internal department messaging expected by the current app.
create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  sender_role public.app_role not null default 'staff',
  recipient_role public.app_role,
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.internal_messages enable row level security;

drop policy if exists "Managers read all messages" on public.internal_messages;
drop policy if exists "Staff read relevant messages" on public.internal_messages;
drop policy if exists "Org members insert messages" on public.internal_messages;
drop policy if exists "internal_messages_select_policy" on public.internal_messages;
drop policy if exists "internal_messages_insert_policy" on public.internal_messages;

create policy "Managers read all messages" on public.internal_messages
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.organization_memberships
      where organization_id = internal_messages.organization_id
        and user_id = (select auth.uid())
        and role in ('organization_owner', 'branch_manager')
    )
  );

create policy "Staff read relevant messages" on public.internal_messages
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      recipient_role is null
      or sender_id = (select auth.uid())
      or exists (
        select 1
        from public.organization_memberships
        where organization_id = internal_messages.organization_id
          and user_id = (select auth.uid())
          and role = internal_messages.recipient_role
      )
    )
  );

create policy "Org members insert messages" on public.internal_messages
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and (sender_id is null or sender_id = (select auth.uid()))
  );

create index if not exists internal_msg_org_role_idx
  on public.internal_messages (organization_id, recipient_role, created_at);

create index if not exists internal_messages_org_created_idx
  on public.internal_messages (organization_id, created_at desc);

-- RLS helper functions rewritten as plpgsql/security definer to avoid planner
-- inlining and recursive RLS loops.
create or replace function public.is_super_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1
    from public.organization_memberships
    where user_id = auth.uid()
      and role = 'super_admin'
  ) into is_admin;

  return coalesce(is_admin, false);
end;
$$;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  is_member boolean;
begin
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = target_org_id
      and user_id = auth.uid()
  ) into is_member;

  if coalesce(is_member, false) then
    return true;
  end if;

  return public.is_super_admin();
end;
$$;

create or replace function public.can_access_branch(target_org_id uuid, target_branch_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_access boolean;
begin
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = target_org_id
      and user_id = auth.uid()
      and (
        role in ('organization_owner', 'inventory_manager', 'purchasing_manager', 'chef', 'marketing_manager', 'accountant')
        or branch_id is null
        or branch_id = target_branch_id
      )
  ) into has_access;

  if coalesce(has_access, false) then
    return true;
  end if;

  return public.is_super_admin();
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_class c on pr.prrelid = c.oid
      join pg_namespace n on c.relnamespace = n.oid
      where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
        and c.relname = 'internal_messages'
        and n.nspname = 'public'
    ) then
      alter publication supabase_realtime add table public.internal_messages;
    end if;
  end if;
end $$;
