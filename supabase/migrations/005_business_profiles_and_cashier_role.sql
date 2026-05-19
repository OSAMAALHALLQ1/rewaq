alter type app_role add value if not exists 'cashier' after 'branch_manager';

create table if not exists business_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  business_type text not null default 'restaurant',
  service_style text,
  branches_count integer not null default 1,
  daily_orders_estimate integer,
  has_kitchen boolean not null default true,
  has_inventory boolean not null default true,
  has_delivery boolean not null default false,
  recommended_dashboard text not null default 'restaurant_ops',
  recommended_pos text,
  recommended_accounting text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_id)
);

alter table business_profiles enable row level security;

drop policy if exists "business_profiles org read" on business_profiles;
create policy "business_profiles org read" on business_profiles
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "business_profiles owner write" on business_profiles;
create policy "business_profiles owner write" on business_profiles
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[]))
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[]));

create index if not exists business_profiles_org_idx on business_profiles (organization_id, business_type);

comment on table business_profiles is 'Business onboarding answers used to choose the right dashboard for restaurants, cafes, retail, and mixed food operations.';
