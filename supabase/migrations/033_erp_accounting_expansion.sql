-- 033: ERP accounting expansion
-- Cost centers, expenses, accounting settings, accounting periods (monthly closing),
-- journal reversals, and extended default chart accounts (discounts / returns).

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1) Cost centers (مراكز التكلفة)
-- ============================================================================

create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_id, code)
);

create index if not exists cost_centers_org_active_idx
  on public.cost_centers (organization_id, is_active, code);

-- ============================================================================
-- 2) Expenses (المصروفات)
-- ============================================================================

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  category text not null,
  description text,
  amount numeric(14,4) not null check (amount > 0),
  expense_date date not null default current_date,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'bank')),
  notes text,
  status text not null default 'posted' check (status in ('draft', 'posted', 'void')),
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists expenses_org_date_idx
  on public.expenses (organization_id, expense_date desc);
create index if not exists expenses_org_category_idx
  on public.expenses (organization_id, category, expense_date desc);

-- ============================================================================
-- 3) Accounting settings (إعدادات المحاسبة المتقدمة) - single row per org
-- ============================================================================

create table if not exists public.accounting_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  currency_code text not null default 'ILS',
  tax_enabled boolean not null default false,
  tax_rate numeric(6,4) not null default 0,
  allow_negative_stock boolean not null default false,
  require_shift_before_sale boolean not null default true,
  require_manager_approval_refund boolean not null default true,
  discount_approval_limit numeric(14,4) not null default 0,
  lock_posted_invoices boolean not null default true,
  enable_branches boolean not null default false,
  enable_cost_centers boolean not null default false,
  enable_advanced_accounting boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- ============================================================================
-- 4) Accounting periods (الإقفال الشهري)
-- ============================================================================

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_year integer not null check (period_year between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, period_year, period_month)
);

create index if not exists accounting_periods_org_idx
  on public.accounting_periods (organization_id, period_year desc, period_month desc);

-- ============================================================================
-- 5) Journal reversal support + cost center dimension on lines
-- ============================================================================

alter table public.journal_entries
  add column if not exists reversal_of_entry_id uuid references public.journal_entries(id) on delete set null;

alter table public.journal_lines
  add column if not exists cost_center_id uuid references public.cost_centers(id) on delete set null;

create index if not exists journal_entries_reversal_idx
  on public.journal_entries (organization_id, reversal_of_entry_id)
  where reversal_of_entry_id is not null;

-- ============================================================================
-- 6) RLS
-- ============================================================================

alter table public.cost_centers enable row level security;
alter table public.expenses enable row level security;
alter table public.accounting_settings enable row level security;
alter table public.accounting_periods enable row level security;

drop policy if exists "cost centers org read" on public.cost_centers;
create policy "cost centers org read" on public.cost_centers
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "cost centers accountant write" on public.cost_centers;
create policy "cost centers accountant write" on public.cost_centers
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[]) or public.is_super_admin());

drop policy if exists "expenses org read" on public.expenses;
create policy "expenses org read" on public.expenses
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "expenses managers write" on public.expenses;
create policy "expenses managers write" on public.expenses
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','accountant','branch_manager']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','accountant','branch_manager']::app_role[]) or public.is_super_admin());

drop policy if exists "accounting settings org read" on public.accounting_settings;
create policy "accounting settings org read" on public.accounting_settings
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "accounting settings owner write" on public.accounting_settings;
create policy "accounting settings owner write" on public.accounting_settings
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner']::app_role[]) or public.is_super_admin());

drop policy if exists "accounting periods org read" on public.accounting_periods;
create policy "accounting periods org read" on public.accounting_periods
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "accounting periods accountant write" on public.accounting_periods;
create policy "accounting periods accountant write" on public.accounting_periods
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[]) or public.is_super_admin());

-- ============================================================================
-- 7) Closed-period guard: block posting journal entries into a closed month
-- ============================================================================

create or replace function public.is_accounting_period_closed(target_org_id uuid, target_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.accounting_periods p
    where p.organization_id = target_org_id
      and p.period_year = extract(year from target_date)::int
      and p.period_month = extract(month from target_date)::int
      and p.status = 'closed'
  );
$$;

create or replace function public.assert_journal_period_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_accounting_period_closed(new.organization_id, new.entry_date) then
    raise exception 'الفترة المحاسبية % - % مقفلة. أعد فتح الفترة قبل الترحيل.',
      extract(year from new.entry_date)::int, extract(month from new.entry_date)::int;
  end if;
  return new;
end;
$$;

drop trigger if exists journal_entries_period_guard on public.journal_entries;
create trigger journal_entries_period_guard
  before insert or update of entry_date on public.journal_entries
  for each row execute function public.assert_journal_period_open();

-- ============================================================================
-- 8) Extend default chart of accounts (خصم المبيعات / مرتجعات المبيعات)
-- ============================================================================

create or replace function public.ensure_default_chart_accounts(target_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chart_of_accounts (organization_id, code, name, account_type, normal_balance, system_key)
  values
    (target_org_id, '1010', 'الصندوق', 'asset', 'debit', 'cash'),
    (target_org_id, '1020', 'البنك / بطاقات', 'asset', 'debit', 'bank'),
    (target_org_id, '1150', 'ذمم العملاء', 'asset', 'debit', 'accounts_receivable'),
    (target_org_id, '1300', 'المخزون', 'asset', 'debit', 'inventory'),
    (target_org_id, '2100', 'ضريبة مبيعات مستحقة', 'liability', 'credit', 'sales_tax_payable'),
    (target_org_id, '2200', 'ذمم الموردين', 'liability', 'credit', 'accounts_payable'),
    (target_org_id, '2250', 'بضاعة مستلمة غير مفوترة', 'liability', 'credit', 'goods_received_not_invoiced'),
    (target_org_id, '3000', 'رأس المال', 'equity', 'credit', 'owner_equity'),
    (target_org_id, '4100', 'مبيعات المطعم', 'revenue', 'credit', 'sales_revenue'),
    (target_org_id, '4150', 'خصم مسموح به (خصومات المبيعات)', 'revenue', 'debit', 'sales_discounts'),
    (target_org_id, '4190', 'مرتجعات المبيعات', 'revenue', 'debit', 'sales_returns'),
    (target_org_id, '5100', 'تكلفة البضاعة المباعة', 'cogs', 'debit', 'cogs'),
    (target_org_id, '5900', 'فروقات الصندوق', 'expense', 'debit', 'cash_over_short'),
    (target_org_id, '6100', 'مصروفات تشغيلية', 'expense', 'debit', 'operating_expense')
  on conflict (organization_id, system_key) do update
    set name = excluded.name,
        account_type = excluded.account_type,
        normal_balance = excluded.normal_balance,
        is_active = true,
        updated_at = now();
end;
$$;

-- ============================================================================
-- 9) Default cost centers seeder (اختياري - يستدعى عند فتح صفحة مراكز التكلفة)
-- ============================================================================

create or replace function public.ensure_default_cost_centers(target_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cost_centers (organization_id, code, name, description)
  values
    (target_org_id, 'CC-100', 'صالة (Dine-in)', 'مبيعات ومصاريف الصالة الداخلية'),
    (target_org_id, 'CC-200', 'سفري (Takeaway)', 'الطلبات الخارجية من المحل'),
    (target_org_id, 'CC-300', 'توصيل (Delivery)', 'طلبات وتكاليف التوصيل'),
    (target_org_id, 'CC-400', 'المطبخ', 'قسم المطبخ والإنتاج')
  on conflict (organization_id, code) do nothing;
end;
$$;

comment on table public.cost_centers is 'Cost centers for advanced ERP reporting (branch, kitchen, delivery, dine-in...).';
comment on table public.expenses is 'Operational expenses with automatic journal posting (debit expense / credit cash-bank).';
comment on table public.accounting_settings is 'Per-organization advanced accounting configuration and control toggles.';
comment on table public.accounting_periods is 'Monthly accounting periods; closed periods block journal posting until reopened.';
