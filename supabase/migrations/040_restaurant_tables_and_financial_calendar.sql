-- ============================================================================
-- 040: Restaurant tables + financial calendar tables
-- These are referenced by the dashboard "Tables" and "Financial Calendar"
-- pages. They were missing from earlier migrations, which caused the
-- server queries to throw (and the pages to crash in production).
-- All objects use "if not exists" so re-running is safe.
-- ============================================================================

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  number integer not null default 0,
  name text,
  zone text not null default 'الصالة',
  seats integer not null default 4,
  capacity integer,
  status text not null default 'available',
  opened_at timestamptz,
  waiter_name text,
  guests integer,
  current_total numeric(12,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_calendar_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  date date not null,
  sales_total numeric(12,4) not null default 0,
  expenses_total numeric(12,4) not null default 0,
  net_profit numeric(12,4) not null default 0,
  cash_sales numeric(12,4) not null default 0,
  card_sales numeric(12,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, branch_id, date)
);

create table if not exists public.financial_calendar_sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  date date not null,
  item_name text not null default '',
  quantity numeric(12,4) not null default 0,
  revenue numeric(12,4) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_calendar_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  date date not null,
  category text not null default 'مصروفات أخرى',
  amount numeric(12,4) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table public.restaurant_tables enable row level security;
alter table public.financial_calendar_days enable row level security;
alter table public.financial_calendar_sales enable row level security;
alter table public.financial_calendar_expenses enable row level security;

-- Policies (reuse existing helpers). Tables with branch_id use can_access_branch,
-- the others use is_org_member.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'restaurant_tables',
    'financial_calendar_days',
    'financial_calendar_sales',
    'financial_calendar_expenses'
  ]
  loop
    execute format('drop policy if exists %I on %I', target_table || ' branch read', target_table);
    execute format('drop policy if exists %I on %I', target_table || ' branch insert', target_table);
    execute format('drop policy if exists %I on %I', target_table || ' branch update', target_table);
    execute format('drop policy if exists %I on %I', target_table || ' branch delete', target_table);

    execute format('create policy %I on %I for select to authenticated using (public.can_access_branch(organization_id, branch_id))', target_table || ' branch read', target_table);
    execute format('create policy %I on %I for insert to authenticated with check (public.can_access_branch(organization_id, branch_id))', target_table || ' branch insert', target_table);
    execute format('create policy %I on %I for update to authenticated using (public.can_access_branch(organization_id, branch_id)) with check (public.can_access_branch(organization_id, branch_id))', target_table || ' branch update', target_table);
    execute format('create policy %I on %I for delete to authenticated using (public.can_access_branch(organization_id, branch_id))', target_table || ' branch delete', target_table);
  end loop;

end $$;
