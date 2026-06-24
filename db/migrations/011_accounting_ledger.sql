create extension if not exists "pgcrypto";

create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense', 'cogs')),
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  parent_id uuid references public.chart_of_accounts(id) on delete set null,
  system_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, system_key)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  entry_number text not null,
  entry_date date not null default current_date,
  source_doc_type text,
  source_doc_id uuid,
  memo text,
  status text not null default 'posted' check (status in ('draft', 'posted', 'void')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_id, entry_number),
  unique (organization_id, source_doc_type, source_doc_id)
);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts(id),
  branch_id uuid references public.branches(id) on delete set null,
  debit numeric(14,4) not null default 0 check (debit >= 0),
  credit numeric(14,4) not null default 0 check (credit >= 0),
  memo text,
  created_at timestamptz not null default now(),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create index if not exists chart_of_accounts_org_type_idx on public.chart_of_accounts (organization_id, account_type, is_active);
create index if not exists journal_entries_org_date_idx on public.journal_entries (organization_id, entry_date desc);
create index if not exists journal_entries_source_idx on public.journal_entries (organization_id, source_doc_type, source_doc_id);
create index if not exists journal_lines_account_idx on public.journal_lines (organization_id, account_id, created_at desc);

alter table public.chart_of_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

drop policy if exists "coa org read" on public.chart_of_accounts;
create policy "coa org read" on public.chart_of_accounts
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "coa owner write" on public.chart_of_accounts;
create policy "coa owner write" on public.chart_of_accounts
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[]) or public.is_super_admin());

drop policy if exists "journal entries org read" on public.journal_entries;
create policy "journal entries org read" on public.journal_entries
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "journal entries accountant write" on public.journal_entries;
create policy "journal entries accountant write" on public.journal_entries
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[]) or public.is_super_admin());

drop policy if exists "journal lines org read" on public.journal_lines;
create policy "journal lines org read" on public.journal_lines
  for select to authenticated using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "journal lines accountant write" on public.journal_lines;
create policy "journal lines accountant write" on public.journal_lines
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[]) or public.is_super_admin())
  with check (public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[]) or public.is_super_admin());

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
    (target_org_id, '3000', 'رأس المال', 'equity', 'credit', 'owner_equity'),
    (target_org_id, '4100', 'مبيعات المطعم', 'revenue', 'credit', 'sales_revenue'),
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

comment on table public.chart_of_accounts is 'Organization chart of accounts for restaurant accounting and automatic postings.';
comment on table public.journal_entries is 'Balanced accounting journal entries generated by POS, purchasing, inventory, and manual accounting workflows.';
comment on table public.journal_lines is 'Debit and credit lines for each journal entry.';
