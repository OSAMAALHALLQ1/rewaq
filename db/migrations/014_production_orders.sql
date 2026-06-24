create extension if not exists "pgcrypto";

create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  order_number text not null,
  status text not null default 'completed' check (status in ('draft', 'completed', 'cancelled')),
  planned_quantity numeric(14,4) not null default 1,
  completed_quantity numeric(14,4) not null default 1,
  material_cost numeric(12,4) not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_id, order_number)
);

create index if not exists production_orders_org_branch_status_idx
  on public.production_orders (organization_id, branch_id, status, created_at desc);

create table if not exists public.production_order_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  source_branch_id uuid not null references public.branches(id) on delete restrict,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  planned_quantity numeric(14,4) not null default 0,
  issued_quantity numeric(14,4) not null default 0,
  unit_cost numeric(12,4) not null default 0,
  total_cost numeric(12,4) generated always as (issued_quantity * unit_cost) stored,
  yield_percent numeric(5,2) not null default 100,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists production_order_materials_order_idx
  on public.production_order_materials (organization_id, production_order_id);

alter table public.production_orders enable row level security;
alter table public.production_order_materials enable row level security;

drop policy if exists "production orders org read" on public.production_orders;
create policy "production orders org read" on public.production_orders
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "production orders kitchen write" on public.production_orders;
create policy "production orders kitchen write" on public.production_orders
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[]) or public.is_super_admin());

drop policy if exists "production materials org read" on public.production_order_materials;
create policy "production materials org read" on public.production_order_materials
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "production materials kitchen write" on public.production_order_materials;
create policy "production materials kitchen write" on public.production_order_materials
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[]) or public.is_super_admin());

comment on table public.production_orders is 'Restaurant production orders that consume recipe materials from stock and produce kitchen-ready batches.';
comment on table public.production_order_materials is 'Recipe material issues attached to production orders and mirrored in stock movements.';
