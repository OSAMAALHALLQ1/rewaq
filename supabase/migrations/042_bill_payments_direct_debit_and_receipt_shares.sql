-- ============================================================================
-- 042: Bill payments, direct debit, and digital receipt shares
--
-- These five tables are queried by src/server/queries/admin.ts (bill payments
-- + direct debit dashboards) and src/server/queries/sales.ts (digital receipt
-- shares) but were never declared in any migration. Because those queries read
-- `.data ?? []` instead of throwing, the pages rendered but were permanently
-- empty: every request failed with `relation does not exist` and was swallowed.
--
-- Column names below match exactly what the query mappers read.
-- All objects use "if not exists" so re-running is safe.
-- ============================================================================

create table if not exists public.payable_bills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  biller_name text not null,
  category text not null default 'مورد',
  bill_number text not null,
  reference_number text not null,
  due_date date not null,
  amount numeric(12,4) not null default 0,
  paid_amount numeric(12,4) not null default 0,
  remaining_amount numeric(12,4) not null default 0,
  status text not null default 'due',
  can_partial_pay boolean not null default true,
  last_inquiry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint payable_bills_status_check
    check (status in ('due', 'partial', 'scheduled', 'paid', 'overdue')),
  constraint payable_bills_amounts_check
    check (amount >= 0 and paid_amount >= 0 and remaining_amount >= 0),
  unique (organization_id, bill_number)
);

create table if not exists public.bill_payment_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference_number text not null,
  bill_ids uuid[] not null default '{}',
  total_amount numeric(12,4) not null default 0,
  scheduled_for timestamptz,
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint bill_payment_batches_status_check
    check (status in ('ready', 'scheduled', 'paid')),
  unique (organization_id, reference_number)
);

create table if not exists public.direct_debit_mandates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_name text not null,
  biller_name text not null,
  -- Never store a full bank account number: only the masked tail shown in the UI.
  account_hint text not null default '',
  amount_limit numeric(12,4) not null default 0,
  next_due_date date,
  status text not null default 'pending',
  activated_at timestamptz,
  last_payment_at timestamptz,
  channel text not null default 'تطبيق',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint direct_debit_mandates_status_check
    check (status in ('pending', 'active', 'paused', 'cancelled')),
  constraint direct_debit_mandates_channel_check
    check (channel in ('تطبيق', 'بوابة دفع', 'حساب بنكي'))
);

create table if not exists public.direct_debit_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mandate_id uuid not null references public.direct_debit_mandates(id) on delete cascade,
  biller_name text not null,
  customer_name text not null,
  due_date date not null,
  amount numeric(12,4) not null default 0,
  status text not null default 'scheduled',
  message text not null default '',
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint direct_debit_runs_status_check
    check (status in ('scheduled', 'processing', 'paid', 'failed'))
);

create table if not exists public.digital_receipt_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.customer_invoices(id) on delete cascade,
  -- Unguessable token used for the public /r/customer-invoices/<id> receipt link.
  share_token text not null,
  total numeric(12,4) not null default 0,
  status text not null default 'ready',
  sent_at timestamptz,
  viewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint digital_receipt_shares_status_check
    check (status in ('ready', 'sent', 'viewed')),
  unique (share_token)
);

create index if not exists payable_bills_org_due_idx
  on public.payable_bills (organization_id, due_date);
create index if not exists bill_payment_batches_org_sched_idx
  on public.bill_payment_batches (organization_id, scheduled_for desc);
create index if not exists direct_debit_mandates_org_idx
  on public.direct_debit_mandates (organization_id, status);
create index if not exists direct_debit_runs_org_exec_idx
  on public.direct_debit_runs (organization_id, executed_at desc);
create index if not exists digital_receipt_shares_org_created_idx
  on public.digital_receipt_shares (organization_id, created_at desc);

-- Row Level Security: every table is organization-scoped (no branch column),
-- so membership in the owning organization is the access boundary.
alter table public.payable_bills enable row level security;
alter table public.bill_payment_batches enable row level security;
alter table public.direct_debit_mandates enable row level security;
alter table public.direct_debit_runs enable row level security;
alter table public.digital_receipt_shares enable row level security;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'payable_bills',
    'bill_payment_batches',
    'direct_debit_mandates',
    'direct_debit_runs',
    'digital_receipt_shares'
  ]
  loop
    execute format('drop policy if exists %I on %I', target_table || ' org read', target_table);
    execute format('drop policy if exists %I on %I', target_table || ' org insert', target_table);
    execute format('drop policy if exists %I on %I', target_table || ' org update', target_table);

    execute format('create policy %I on %I for select to authenticated using (public.is_org_member(organization_id))', target_table || ' org read', target_table);
    execute format('create policy %I on %I for insert to authenticated with check (public.is_org_member(organization_id))', target_table || ' org insert', target_table);
    execute format('create policy %I on %I for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))', target_table || ' org update', target_table);
  end loop;
end $$;

-- No delete policy is granted: these rows are financial records. Settlement is
-- expressed by moving `status` to a terminal value, never by removing history.

comment on table public.payable_bills is $$Bills owed by the organization, shown on /dashboard/bill-payments.$$;
comment on table public.bill_payment_batches is $$Groups of payable_bills settled together in one payment run.$$;
comment on table public.direct_debit_mandates is $$Standing customer authorizations to collect recurring payments.$$;
comment on table public.direct_debit_runs is $$Individual collection attempts executed against a mandate.$$;
comment on table public.digital_receipt_shares is $$Share tokens for customer-facing digital receipts.$$;
comment on column public.direct_debit_mandates.account_hint is $$Masked account tail only (e.g. "****1234"). Never store full account numbers.$$;
