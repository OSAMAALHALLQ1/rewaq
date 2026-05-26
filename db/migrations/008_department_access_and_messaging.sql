-- Migration: 008_department_access_and_messaging
-- Description: Creates schema for 10-symbol dynamic API keys and internal messaging system

-- 1. Create department_api_keys Table
create table if not exists public.department_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  device_name text not null,
  key_hash text not null unique, -- Hashed key for security (Manager creates raw 10-symbol key)
  role public.app_role not null default 'staff',
  allowed_modules text[] not null default '{}'::text[], -- e.g. {'inventory', 'recipes', 'pos'}
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

-- 2. Create internal_messages Table
create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  sender_role public.app_role not null default 'staff',
  recipient_role public.app_role, -- If NULL, represents the general group chat for the branch/organization
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- 3. Enable Row Level Security (RLS)
alter table public.department_api_keys enable row level security;
alter table public.internal_messages enable row level security;

-- 4. Set up triggers for updated_at
drop trigger if exists set_department_api_keys_updated_at on public.department_api_keys;
create trigger set_department_api_keys_updated_at 
  before update on public.department_api_keys 
  for each row execute function set_updated_at();

-- 5. RLS Policies for department_api_keys
-- Owners and super admins can manage keys
drop policy if exists "Owners manage keys" on public.department_api_keys;
create policy "Owners manage keys" on public.department_api_keys
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from organization_memberships
      where organization_id = department_api_keys.organization_id
        and user_id = (select auth.uid())
        and role = 'organization_owner'
    )
  );

-- Authorized members of the organization can read keys
drop policy if exists "Org members read keys" on public.department_api_keys;
create policy "Org members read keys" on public.department_api_keys
  for select to authenticated
  using (public.is_org_member(organization_id));

-- 6. RLS Policies for internal_messages
-- Managers/Owners can view all messages for oversight
drop policy if exists "Managers read all messages" on public.internal_messages;
create policy "Managers read all messages" on public.internal_messages
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from organization_memberships
      where organization_id = internal_messages.organization_id
        and user_id = (select auth.uid())
        and role in ('organization_owner', 'branch_manager')
    )
  );

-- Staff can view messages sent to their role, sent by them, or sent to the general channel (NULL)
drop policy if exists "Staff read relevant messages" on public.internal_messages;
create policy "Staff read relevant messages" on public.internal_messages
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      recipient_role is null -- General group
      or sender_id = (select auth.uid()) -- Sent by me
      or exists (
        select 1 from organization_memberships
        where organization_id = internal_messages.organization_id
          and user_id = (select auth.uid())
          and role = internal_messages.recipient_role -- Sent to my role
      )
    )
  );

-- Any authenticated organization member can insert a message
drop policy if exists "Org members insert messages" on public.internal_messages;
create policy "Org members insert messages" on public.internal_messages
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
  );

-- 7. Add optimal indexes for performance
create index if not exists dept_keys_hash_idx on public.department_api_keys (key_hash) where is_active = true;
create index if not exists dept_keys_org_idx on public.department_api_keys (organization_id);
create index if not exists internal_msg_org_role_idx on public.internal_messages (organization_id, recipient_role, created_at);

-- 8. Enable Supabase Realtime Replication for the tables
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Add internal_messages to publication
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

    -- Add notifications to publication (just in case not already added)
    if not exists (
      select 1 
      from pg_publication_rel pr 
      join pg_class c on pr.prrelid = c.oid 
      join pg_namespace n on c.relnamespace = n.oid 
      where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
        and c.relname = 'notifications' 
        and n.nspname = 'public'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;
