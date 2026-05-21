create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum (
      'super_admin',
      'organization_owner',
      'branch_manager',
      'cashier',
      'inventory_manager',
      'purchasing_manager',
      'chef',
      'marketing_manager',
      'accountant',
      'staff'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'record_status') then
    create type record_status as enum ('active', 'inactive', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'purchase_order_status') then
    create type purchase_order_status as enum ('draft', 'sent', 'received', 'partially_received', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum ('draft', 'matched', 'paid', 'flagged');
  end if;

  if not exists (select 1 from pg_type where typname = 'customer_invoice_status') then
    create type customer_invoice_status as enum ('draft', 'issued', 'paid', 'void');
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum ('cash', 'card', 'bank_transfer', 'delivery_app');
  end if;

  if not exists (select 1 from pg_type where typname = 'stock_movement_type') then
    create type stock_movement_type as enum ('purchase', 'sale_usage', 'waste', 'transfer_in', 'transfer_out', 'adjustment', 'stock_count', 'return');
  end if;

  if not exists (select 1 from pg_type where typname = 'transfer_status') then
    create type transfer_status as enum ('draft', 'sent', 'received', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'social_platform') then
    create type social_platform as enum ('facebook', 'instagram', 'telegram', 'whatsapp', 'tiktok', 'x', 'google_business', 'linkedin', 'youtube_shorts', 'pinterest');
  end if;

  if not exists (select 1 from pg_type where typname = 'social_post_status') then
    create type social_post_status as enum ('draft', 'scheduled', 'publishing', 'published', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'social_target_status') then
    create type social_target_status as enum ('pending', 'publishing', 'published', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type notification_type as enum ('low_stock', 'price_increase', 'high_food_cost', 'publish_failed', 'purchase_received', 'waste_logged');
  end if;
end $$;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'starter',
  status text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  locale text not null default 'ar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  city text,
  address text,
  manager_name text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'staff',
  branch_id uuid references branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_id, user_id)
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  monthly_price numeric(12,2) not null default 0,
  features jsonb not null default '[]'::jsonb,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid references plans(id),
  status text not null default 'trial',
  current_period_start date,
  current_period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  symbol text not null,
  kind text not null default 'count',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists unit_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  from_unit_id uuid not null references units(id),
  to_unit_id uuid not null references units(id),
  factor numeric(18,6) not null,
  item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists inventory_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category_id uuid references inventory_categories(id),
  primary_supplier_id uuid references suppliers(id),
  name text not null,
  purchase_unit_id uuid references units(id),
  usage_unit_id uuid references units(id),
  last_purchase_price numeric(12,4) not null default 0,
  average_cost numeric(12,4) not null default 0,
  minimum_quantity numeric(14,4) not null default 0,
  sku text,
  notes text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'unit_conversions_item_fk'
  ) then
    alter table unit_conversions
      add constraint unit_conversions_item_fk foreign key (item_id) references inventory_items(id) on delete cascade;
  end if;
end $$;

create table if not exists branch_stock (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  quantity numeric(14,4) not null default 0,
  reserved_quantity numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (branch_id, item_id)
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete restrict,
  movement_type stock_movement_type not null,
  quantity numeric(14,4) not null,
  unit_cost numeric(12,4) not null default 0,
  total_cost numeric(12,4) generated always as (quantity * unit_cost) stored,
  source_doc_type text,
  source_doc_id uuid,
  idempotency_key text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_id, idempotency_key)
);

create table if not exists stock_counts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  status text not null default 'draft',
  counted_at timestamptz,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists stock_count_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stock_count_id uuid not null references stock_counts(id) on delete cascade,
  item_id uuid not null references inventory_items(id),
  system_quantity numeric(14,4) not null default 0,
  counted_quantity numeric(14,4) not null default 0,
  variance_quantity numeric(14,4) generated always as (counted_quantity - system_quantity) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists waste_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  item_id uuid not null references inventory_items(id),
  quantity numeric(14,4) not null,
  reason text not null,
  cost numeric(12,4) not null default 0,
  logged_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  from_branch_id uuid not null references branches(id),
  to_branch_id uuid not null references branches(id),
  status transfer_status not null default 'draft',
  sent_at timestamptz,
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (from_branch_id <> to_branch_id)
);

create table if not exists transfer_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  transfer_id uuid not null references transfers(id) on delete cascade,
  item_id uuid not null references inventory_items(id),
  quantity numeric(14,4) not null,
  unit_cost numeric(12,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  branch_id uuid not null references branches(id),
  status purchase_order_status not null default 'draft',
  order_date date not null default current_date,
  expected_date date,
  total numeric(12,4) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  item_id uuid not null references inventory_items(id),
  quantity numeric(14,4) not null,
  expected_unit_price numeric(12,4) not null default 0,
  received_quantity numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  branch_id uuid not null references branches(id),
  purchase_order_id uuid references purchase_orders(id),
  invoice_number text,
  status invoice_status not null default 'draft',
  total numeric(12,4) not null default 0,
  issued_at date not null default current_date,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  item_id uuid not null references inventory_items(id),
  quantity numeric(14,4) not null,
  unit_price numeric(12,4) not null,
  total numeric(12,4) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists customer_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id),
  invoice_number text not null,
  customer_name text not null,
  customer_phone text,
  customer_tax_number text,
  status customer_invoice_status not null default 'draft',
  payment_method payment_method not null default 'cash',
  issued_at timestamptz not null default now(),
  subtotal numeric(12,4) not null default 0,
  discount numeric(12,4) not null default 0,
  tax_rate numeric(8,4) not null default 0,
  tax_total numeric(12,4) not null default 0,
  total numeric(12,4) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_id, invoice_number)
);

create table if not exists customer_invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_invoice_id uuid not null references customer_invoices(id) on delete cascade,
  menu_item_id uuid,
  name text not null,
  quantity numeric(12,4) not null,
  unit_price numeric(12,4) not null,
  total numeric(12,4) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  item_id uuid not null references inventory_items(id),
  unit_price numeric(12,4) not null,
  previous_unit_price numeric(12,4),
  price_change_percent numeric(8,2),
  source_doc_type text,
  source_doc_id uuid,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text,
  servings numeric(10,2) not null default 1,
  preparation text,
  total_cost numeric(12,4) not null default 0,
  cost_per_serving numeric(12,4) not null default 0,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  item_id uuid not null references inventory_items(id),
  quantity numeric(14,4) not null,
  unit_id uuid references units(id),
  yield_percent numeric(5,2) not null default 100,
  unit_cost numeric(12,4) not null default 0,
  total_cost numeric(12,4) generated always as (quantity * unit_cost / nullif(yield_percent / 100, 0)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  name text not null,
  selling_price numeric(12,4) not null,
  image_path text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists menu_item_recipe_mapping (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete restrict,
  portion_multiplier numeric(10,4) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (menu_item_id, recipe_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_invoice_items_menu_item_fk'
  ) then
    alter table customer_invoice_items
      add constraint customer_invoice_items_menu_item_fk foreign key (menu_item_id) references menu_items(id) on delete set null;
  end if;
end $$;

create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  platform social_platform not null,
  account_name text not null,
  external_account_id text,
  encrypted_access_token text,
  token_expires_at timestamptz,
  status text not null default 'connected',
  last_published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

comment on column social_accounts.encrypted_access_token is 'TODO: encrypt with Supabase Vault/KMS before production. Never store social tokens as plain text.';

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  body text not null,
  status social_post_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists social_post_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  social_post_id uuid not null references social_posts(id) on delete cascade,
  social_account_id uuid not null references social_accounts(id),
  platform social_platform not null,
  body_override text,
  status social_target_status not null default 'pending',
  provider_post_id text,
  provider_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists social_media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  social_post_id uuid references social_posts(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  size_bytes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists social_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  social_post_id uuid not null references social_posts(id) on delete cascade,
  run_after timestamptz not null default now(),
  status text not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists social_publish_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  social_post_id uuid not null references social_posts(id) on delete cascade,
  target_id uuid references social_post_targets(id) on delete set null,
  platform social_platform not null,
  status social_target_status not null,
  message text,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists social_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  action_type text not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  automation_rule_id uuid references automation_rules(id) on delete set null,
  status text not null default 'running',
  input jsonb,
  output jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text not null,
  severity text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  enabled boolean not null default false,
  organization_id uuid references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists system_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  level text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  subject text not null,
  body text,
  status text not null default 'open',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships
    where user_id = (select auth.uid())
      and role = 'super_admin'
  );
$$;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships
    where organization_id = target_org_id
      and user_id = (select auth.uid())
  ) or public.is_super_admin();
$$;

create or replace function public.can_access_branch(target_org_id uuid, target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships
    where organization_id = target_org_id
      and user_id = (select auth.uid())
      and (
        role in ('organization_owner', 'inventory_manager', 'purchasing_manager', 'chef', 'marketing_manager', 'accountant')
        or branch_id is null
        or branch_id = target_branch_id
      )
  ) or public.is_super_admin();
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'organizations','profiles','branches','organization_memberships','plans','subscriptions','units',
    'unit_conversions','inventory_categories','suppliers','inventory_items','branch_stock',
    'stock_movements','stock_counts','stock_count_items','waste_logs','transfers','transfer_items',
    'purchase_orders','purchase_order_items','invoices','invoice_items','customer_invoices',
    'customer_invoice_items','supplier_price_history',
    'recipes','recipe_ingredients','menu_items','menu_item_recipe_mapping','social_accounts',
    'social_posts','social_post_targets','social_media_assets','social_publish_jobs','social_publish_logs',
    'social_templates','automation_rules','automation_runs','notifications','feature_flags','system_logs',
    'support_tickets'
  ]
  loop
    execute format('alter table %I enable row level security', target_table);
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = target_table and column_name = 'updated_at'
    ) then
      execute format('drop trigger if exists %I on %I', 'set_' || target_table || '_updated_at', target_table);
      execute format('create trigger %I before update on %I for each row execute function set_updated_at()', 'set_' || target_table || '_updated_at', target_table);
    end if;
  end loop;
end $$;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'organizations','profiles','branches','organization_memberships','plans','subscriptions','units',
        'unit_conversions','inventory_categories','suppliers','inventory_items','branch_stock',
        'stock_movements','stock_counts','stock_count_items','waste_logs','transfers','transfer_items',
        'purchase_orders','purchase_order_items','invoices','invoice_items','customer_invoices',
        'customer_invoice_items','supplier_price_history',
        'recipes','recipe_ingredients','menu_items','menu_item_recipe_mapping','social_accounts',
        'social_posts','social_post_targets','social_media_assets','social_publish_jobs','social_publish_logs',
        'social_templates','automation_rules','automation_runs','notifications','feature_flags','system_logs',
        'support_tickets'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end $$;

create policy "profiles own row" on profiles
  for all to authenticated
  using (id = (select auth.uid()) or public.is_super_admin())
  with check (id = (select auth.uid()) or public.is_super_admin());

create policy "organizations visible to members" on organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy "organizations insert by authenticated" on organizations
  for insert to authenticated
  with check (created_by = (select auth.uid()) or public.is_super_admin());

create policy "organizations update by owner" on organizations
  for update to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from organization_memberships
      where organization_id = organizations.id
        and user_id = (select auth.uid())
        and role = 'organization_owner'
    )
  );

create policy "memberships visible to org members" on organization_memberships
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy "memberships managed by owners" on organization_memberships
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from organization_memberships m
      where m.organization_id = organization_memberships.organization_id
        and m.user_id = (select auth.uid())
        and m.role = 'organization_owner'
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from organization_memberships m
      where m.organization_id = organization_memberships.organization_id
        and m.user_id = (select auth.uid())
        and m.role = 'organization_owner'
    )
  );

create policy "plans read" on plans for select to authenticated using (true);
create policy "plans admin write" on plans for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "feature flags read" on feature_flags
  for select to authenticated
  using (true);

create policy "feature flags admin write" on feature_flags
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "system logs admin read" on system_logs
  for select to authenticated
  using (public.is_super_admin() or (organization_id is not null and public.is_org_member(organization_id)));

create policy "system logs admin write" on system_logs
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "support tickets scoped" on support_tickets
  for all to authenticated
  using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'subscriptions','units','unit_conversions','inventory_categories','suppliers','inventory_items',
    'recipes','recipe_ingredients','menu_items','menu_item_recipe_mapping','social_accounts',
    'social_posts','social_post_targets','social_media_assets','social_publish_jobs','social_publish_logs',
    'social_templates','automation_rules','automation_runs','notifications'
  ]
  loop
    execute format('create policy %I on %I for select to authenticated using (public.is_org_member(organization_id))', target_table || ' org read', target_table);
    execute format('create policy %I on %I for insert to authenticated with check (public.is_org_member(organization_id))', target_table || ' org insert', target_table);
    execute format('create policy %I on %I for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))', target_table || ' org update', target_table);
    execute format('create policy %I on %I for delete to authenticated using (public.is_org_member(organization_id))', target_table || ' org delete', target_table);
  end loop;
end $$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'branch_stock','stock_movements','stock_counts','waste_logs',
    'purchase_orders','invoices','customer_invoices'
  ]
  loop
    execute format('create policy %I on %I for select to authenticated using (public.can_access_branch(organization_id, branch_id))', target_table || ' branch read', target_table);
    execute format('create policy %I on %I for insert to authenticated with check (public.can_access_branch(organization_id, branch_id))', target_table || ' branch insert', target_table);
    execute format('create policy %I on %I for update to authenticated using (public.can_access_branch(organization_id, branch_id)) with check (public.can_access_branch(organization_id, branch_id))', target_table || ' branch update', target_table);
    execute format('create policy %I on %I for delete to authenticated using (public.can_access_branch(organization_id, branch_id))', target_table || ' branch delete', target_table);
  end loop;
end $$;

create policy "branches branch read" on branches
  for select to authenticated
  using (public.can_access_branch(organization_id, id));
create policy "branches branch insert" on branches
  for insert to authenticated
  with check (public.can_access_branch(organization_id, id));
create policy "branches branch update" on branches
  for update to authenticated
  using (public.can_access_branch(organization_id, id))
  with check (public.can_access_branch(organization_id, id));
create policy "branches branch delete" on branches
  for delete to authenticated
  using (public.can_access_branch(organization_id, id));

create policy "stock_count_items org read" on stock_count_items
  for select to authenticated
  using (public.is_org_member(organization_id));
create policy "stock_count_items org write" on stock_count_items
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "transfers branch read" on transfers
  for select to authenticated
  using (
    public.can_access_branch(organization_id, from_branch_id)
    or public.can_access_branch(organization_id, to_branch_id)
  );
create policy "transfers branch write" on transfers
  for all to authenticated
  using (
    public.can_access_branch(organization_id, from_branch_id)
    or public.can_access_branch(organization_id, to_branch_id)
  )
  with check (
    public.can_access_branch(organization_id, from_branch_id)
    or public.can_access_branch(organization_id, to_branch_id)
  );

create policy "transfer_items org scoped" on transfer_items
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "purchase_order_items org scoped" on purchase_order_items
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "invoice_items org scoped" on invoice_items
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "customer_invoice_items org scoped" on customer_invoice_items
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "supplier_price_history org scoped" on supplier_price_history
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create index if not exists organization_memberships_user_org_idx on organization_memberships (user_id, organization_id);
create index if not exists organization_memberships_org_role_idx on organization_memberships (organization_id, role);
create index if not exists branches_org_idx on branches (organization_id);
create index if not exists branch_stock_org_branch_idx on branch_stock (organization_id, branch_id);
create index if not exists stock_movements_org_branch_item_idx on stock_movements (organization_id, branch_id, item_id, created_at desc);
create index if not exists inventory_items_org_idx on inventory_items (organization_id);
create index if not exists suppliers_org_idx on suppliers (organization_id);
create index if not exists purchase_orders_org_branch_idx on purchase_orders (organization_id, branch_id, status);
create index if not exists customer_invoices_org_branch_idx on customer_invoices (organization_id, branch_id, issued_at desc);
create index if not exists recipes_org_idx on recipes (organization_id);
create index if not exists menu_items_org_idx on menu_items (organization_id, branch_id);
create index if not exists social_posts_org_status_idx on social_posts (organization_id, status, scheduled_at);
create index if not exists notifications_org_user_idx on notifications (organization_id, user_id, read_at);

insert into storage.buckets (id, name, public)
values ('social-assets', 'social-assets', false)
on conflict (id) do nothing;

drop policy if exists "social assets read" on storage.objects;
create policy "social assets read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'social-assets'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "social assets write" on storage.objects;
create policy "social assets write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'social-assets'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );
