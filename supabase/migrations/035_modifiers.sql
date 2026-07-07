-- Modifiers: groups of add-ons per catalog item (e.g. size, extras) with prices.
create table if not exists public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  selection_type text not null default 'single' check (selection_type in ('single', 'multiple')),
  min_select integer not null default 0,
  max_select integer not null default 1,
  is_required boolean not null default false,
  display_order integer not null default 0,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(12,4) not null default 0,
  is_default boolean not null default false,
  is_available boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_item_modifier_groups (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  display_order integer not null default 0,
  primary key (catalog_item_id, modifier_group_id)
);

-- Store chosen modifiers on the invoice / kitchen lines.
alter table public.customer_invoice_items
  add column if not exists modifier_option_ids jsonb,
  add column if not exists modifier_summary text;

alter table public.kitchen_ticket_items
  add column if not exists modifier_summary text;

create index if not exists modifier_options_group_idx
  on public.modifier_options (organization_id, modifier_group_id);
create index if not exists cimg_catalog_idx
  on public.catalog_item_modifier_groups (organization_id, catalog_item_id);
create index if not exists cimg_group_idx
  on public.catalog_item_modifier_groups (organization_id, modifier_group_id);

alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.catalog_item_modifier_groups enable row level security;

drop policy if exists "modifier groups org read" on public.modifier_groups;
create policy "modifier groups org read" on public.modifier_groups
  for select to authenticated
  using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "modifier groups org write" on public.modifier_groups;
create policy "modifier groups org write" on public.modifier_groups
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager','chef','staff']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager','chef','staff']::app_role[]) or public.is_super_admin());

drop policy if exists "modifier options org read" on public.modifier_options;
create policy "modifier options org read" on public.modifier_options
  for select to authenticated
  using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "modifier options org write" on public.modifier_options;
create policy "modifier options org write" on public.modifier_options
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager','chef','staff']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager','chef','staff']::app_role[]) or public.is_super_admin());

drop policy if exists "catalog item modifier groups org read" on public.catalog_item_modifier_groups;
create policy "catalog item modifier groups org read" on public.catalog_item_modifier_groups
  for select to authenticated
  using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "catalog item modifier groups org write" on public.catalog_item_modifier_groups;
create policy "catalog item modifier groups org write" on public.catalog_item_modifier_groups
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager','chef','staff']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager','chef','staff']::app_role[]) or public.is_super_admin());

comment on table public.modifier_groups is 'Configurable add-on groups (size, extras) that can be attached to catalog items.';
comment on table public.modifier_options is 'Individual choices within a modifier group with an optional price delta.';
comment on table public.catalog_item_modifier_groups is 'Link table assigning modifier groups to catalog items.';
