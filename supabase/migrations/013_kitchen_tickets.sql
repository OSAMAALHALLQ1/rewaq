create extension if not exists "pgcrypto";

create table if not exists public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  customer_invoice_id uuid references public.customer_invoices(id) on delete cascade,
  shift_id uuid references public.sales_shifts(id) on delete set null,
  ticket_number text not null,
  customer_name text not null default 'عميل',
  table_number text,
  channel text not null default 'pickup',
  status text not null default 'pending' check (status in ('pending', 'preparing', 'ready', 'served', 'cancelled')),
  priority text not null default 'normal' check (priority in ('normal', 'rush')),
  notes text,
  opened_at timestamptz not null default now(),
  started_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create unique index if not exists kitchen_tickets_org_number_idx
  on public.kitchen_tickets (organization_id, ticket_number);

create unique index if not exists kitchen_tickets_invoice_idx
  on public.kitchen_tickets (organization_id, customer_invoice_id)
  where customer_invoice_id is not null;

create index if not exists kitchen_tickets_active_idx
  on public.kitchen_tickets (organization_id, branch_id, status, opened_at desc);

create table if not exists public.kitchen_ticket_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kitchen_ticket_id uuid not null references public.kitchen_tickets(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  catalog_item_id uuid references public.catalog_items(id) on delete set null,
  name text not null,
  quantity numeric(12,4) not null default 1,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'preparing', 'ready', 'served', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists kitchen_ticket_items_ticket_idx
  on public.kitchen_ticket_items (organization_id, kitchen_ticket_id);

alter table public.kitchen_tickets enable row level security;
alter table public.kitchen_ticket_items enable row level security;

drop policy if exists "kitchen tickets org read" on public.kitchen_tickets;
create policy "kitchen tickets org read" on public.kitchen_tickets
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "kitchen tickets kitchen write" on public.kitchen_tickets;
create policy "kitchen tickets kitchen write" on public.kitchen_tickets
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[]) or public.is_super_admin());

drop policy if exists "kitchen ticket items org read" on public.kitchen_ticket_items;
create policy "kitchen ticket items org read" on public.kitchen_ticket_items
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "kitchen ticket items kitchen write" on public.kitchen_ticket_items;
create policy "kitchen ticket items kitchen write" on public.kitchen_ticket_items
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[]) or public.is_super_admin());

comment on table public.kitchen_tickets is 'Kitchen display tickets created from POS invoices for active preparation workflow.';
comment on table public.kitchen_ticket_items is 'Prepared items grouped under kitchen tickets, linked back to menu and catalog items.';
