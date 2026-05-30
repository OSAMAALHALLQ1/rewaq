-- Migration to add internal messaging table with row level security and real-time subscription
create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  sender_role public.app_role not null,
  recipient_role public.app_role, -- Null indicates General group chat
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.internal_messages enable row level security;

-- Performance Indexes for fast history listings and filtering
create index if not exists internal_messages_org_created_idx 
  on public.internal_messages (organization_id, created_at desc);

create index if not exists internal_messages_branch_idx 
  on public.internal_messages (branch_id);

-- SELECT Policy: Managers see everything; staff see general group chats, their own messages, or messages for their department
drop policy if exists "internal_messages_select_policy" on public.internal_messages;
create policy "internal_messages_select_policy" on public.internal_messages
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      -- Managers (owner, branch manager, super admin) have full oversight
      exists (
        select 1 from public.organization_memberships
        where organization_id = internal_messages.organization_id
          and user_id = auth.uid()
          and role in ('organization_owner', 'branch_manager', 'super_admin')
      )
      -- General staff can only see their department role, general chats, or messages they sent
      or (
        recipient_role is null
        or sender_id = auth.uid()
        or exists (
          select 1 from public.organization_memberships
          where organization_id = internal_messages.organization_id
            and user_id = auth.uid()
            and role = internal_messages.recipient_role
        )
      )
    )
  );

-- INSERT Policy: Authenticated users can insert messages for their organization, representing themselves
drop policy if exists "internal_messages_insert_policy" on public.internal_messages;
create policy "internal_messages_insert_policy" on public.internal_messages
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and sender_id = auth.uid()
  );

-- Enable Supabase Realtime for instant real-time message broadcasting
do $$
begin
  if not exists (
    select 1 
    from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'internal_messages'
  ) then
    alter publication supabase_realtime add table public.internal_messages;
  end if;
end $$;

comment on table public.internal_messages is 'Stores instant, real-time messaging records between departments and branches within a restaurant organization.';
comment on column public.internal_messages.recipient_role is 'Target role/department (e.g. chef, cashier). Null recipient role designates the General Restaurant Group channel.';
