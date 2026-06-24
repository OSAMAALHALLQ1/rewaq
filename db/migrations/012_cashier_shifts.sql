create extension if not exists "pgcrypto";

create table if not exists public.sales_shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  cashier_user_id uuid references auth.users(id) on delete set null,
  device_key_id uuid references public.department_api_keys(id) on delete set null,
  cashier_name text not null default 'كاشير',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash numeric(12,4) not null default 0,
  actual_cash numeric(12,4),
  expected_cash numeric(12,4) not null default 0,
  cash_sales numeric(12,4) not null default 0,
  card_sales numeric(12,4) not null default 0,
  expenses numeric(12,4) not null default 0,
  withdrawals numeric(12,4) not null default 0,
  deposits numeric(12,4) not null default 0,
  difference numeric(12,4) not null default 0,
  status text not null default 'open' check (status in ('open', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  closed_by uuid references auth.users(id)
);

create unique index if not exists sales_shifts_one_open_device_idx
  on public.sales_shifts (organization_id, device_key_id)
  where status = 'open' and device_key_id is not null;

create index if not exists sales_shifts_org_branch_status_idx
  on public.sales_shifts (organization_id, branch_id, status, opened_at desc);

create table if not exists public.cash_drawer_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  shift_id uuid not null references public.sales_shifts(id) on delete cascade,
  entry_type text not null check (entry_type in ('opening', 'cash_sale', 'card_sale', 'expense', 'withdrawal', 'deposit', 'closing_adjustment')),
  amount numeric(12,4) not null,
  reference_doc_type text,
  reference_doc_id uuid,
  memo text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists cash_drawer_entries_shift_idx
  on public.cash_drawer_entries (organization_id, shift_id, created_at desc);

alter table public.sales_shifts enable row level security;
alter table public.cash_drawer_entries enable row level security;

drop policy if exists "sales shifts org read" on public.sales_shifts;
create policy "sales shifts org read" on public.sales_shifts
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "sales shifts owner write" on public.sales_shifts;
create policy "sales shifts owner write" on public.sales_shifts
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[]) or public.is_super_admin());

drop policy if exists "cash drawer org read" on public.cash_drawer_entries;
create policy "cash drawer org read" on public.cash_drawer_entries
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "cash drawer owner write" on public.cash_drawer_entries;
create policy "cash drawer owner write" on public.cash_drawer_entries
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[]) or public.is_super_admin());

alter table public.customer_invoices
  add column if not exists shift_id uuid references public.sales_shifts(id) on delete set null;

create index if not exists customer_invoices_shift_idx
  on public.customer_invoices (organization_id, shift_id, issued_at desc);

comment on table public.sales_shifts is 'Cashier shifts with opening cash, expected cash, actual cash, sales totals, and closing variance.';
comment on table public.cash_drawer_entries is 'Cash drawer events for opening, sales, deposits, withdrawals, expenses, and closing adjustments.';
