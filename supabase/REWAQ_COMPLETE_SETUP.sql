-- ============================================================================
-- رواق — ملف الإعداد الشامل الوحيد لقاعدة البيانات
-- ==============================================================================
-- هذا الملف هو كل ترحيلات المشروع (001 حتى 055) مدموجة بترتيب التطبيق الرسمي.
-- شغّله مرة واحدة على مشروع Supabase جديد وفارغ: SQL Editor → الصق → Run.
-- لا تشغّله على قاعدة فيها بيانات إنتاج — مصمم لإنشاء المشروع من الصفر.
-- بعد تشغيله لا تحتاج أي ملف SQL آخر.
-- تاريخ التجميع: 2026-07-18
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 001_initial_schema.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 002_pos_inventory_backend.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sales_channel') then
    create type sales_channel as enum ('dine_in', 'delivery', 'pickup');
  end if;
end $$;

create or replace function public.has_org_role(target_org_id uuid, allowed_roles app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from organization_memberships
      where organization_id = target_org_id
        and user_id = (select auth.uid())
        and role = any (allowed_roles)
    );
$$;

create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  menu_item_id uuid references menu_items(id) on delete set null,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  code text not null,
  name text not null,
  category_name text,
  main_unit text not null default 'قطعة',
  retail_price numeric(12,4) not null default 0,
  wholesale_price numeric(12,4) not null default 0,
  branch_price numeric(12,4),
  customer_price numeric(12,4),
  tax_rate numeric(8,4) not null default 0,
  image_path text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_id, code)
);

create table if not exists item_barcodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  catalog_item_id uuid not null references catalog_items(id) on delete cascade,
  barcode text not null,
  unit_name text not null default 'قطعة',
  unit_factor numeric(14,4) not null default 1,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_id, barcode)
);

create table if not exists customer_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_invoice_id uuid not null references customer_invoices(id) on delete cascade,
  payment_method payment_method not null,
  amount numeric(12,4) not null,
  reference text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists daily_cost_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  entry_date date not null default current_date,
  cost_center text not null,
  name text not null,
  amount numeric(12,4) not null,
  quantity numeric(14,4),
  unit text,
  source_doc_type text,
  source_doc_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists sales_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  summary_date date not null,
  channel sales_channel not null default 'dine_in',
  orders_count integer not null default 0,
  sales_total numeric(12,4) not null default 0,
  ingredient_cost_total numeric(12,4) not null default 0,
  waste_total numeric(12,4) not null default 0,
  labor_total numeric(12,4) not null default 0,
  operating_total numeric(12,4) not null default 0,
  fixed_total numeric(12,4) not null default 0,
  updated_at timestamptz not null default now(),
  unique (organization_id, branch_id, summary_date, channel)
);

alter table customer_invoice_items
  add column if not exists catalog_item_id uuid references catalog_items(id) on delete set null,
  add column if not exists barcode text,
  add column if not exists unit_name text,
  add column if not exists unit_factor numeric(14,4) not null default 1,
  add column if not exists discount numeric(12,4) not null default 0,
  add column if not exists tax_rate numeric(8,4) not null default 0,
  add column if not exists cost_total numeric(12,4) not null default 0,
  add column if not exists gross_profit numeric(12,4) not null default 0;

alter table customer_invoices
  add column if not exists channel sales_channel not null default 'dine_in',
  add column if not exists service_fee numeric(12,4) not null default 0,
  add column if not exists delivery_fee numeric(12,4) not null default 0,
  add column if not exists cost_total numeric(12,4) not null default 0,
  add column if not exists gross_profit numeric(12,4) not null default 0,
  add column if not exists idempotency_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customer_invoices_idempotency_key_unique'
  ) then
    alter table customer_invoices
      add constraint customer_invoices_idempotency_key_unique unique (organization_id, idempotency_key);
  end if;
end $$;

create index if not exists catalog_items_org_code_idx on catalog_items (organization_id, code);
create index if not exists catalog_items_menu_item_idx on catalog_items (organization_id, menu_item_id);
create index if not exists item_barcodes_lookup_idx on item_barcodes (organization_id, barcode);
create index if not exists customer_invoice_items_invoice_idx on customer_invoice_items (organization_id, customer_invoice_id);
create index if not exists daily_cost_entries_org_branch_date_idx on daily_cost_entries (organization_id, branch_id, entry_date, cost_center);
create index if not exists sales_daily_summaries_org_branch_date_idx on sales_daily_summaries (organization_id, branch_id, summary_date);

alter table catalog_items enable row level security;
alter table item_barcodes enable row level security;
alter table customer_invoice_payments enable row level security;
alter table daily_cost_entries enable row level security;
alter table sales_daily_summaries enable row level security;

drop policy if exists "catalog_items org read" on catalog_items;
create policy "catalog_items org read" on catalog_items
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "catalog_items org write" on catalog_items;
create policy "catalog_items org write" on catalog_items
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','inventory_manager','staff']::app_role[]))
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','inventory_manager','staff']::app_role[]));

drop policy if exists "item_barcodes org read" on item_barcodes;
create policy "item_barcodes org read" on item_barcodes
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "item_barcodes org write" on item_barcodes;
create policy "item_barcodes org write" on item_barcodes
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager']::app_role[]))
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager']::app_role[]));

drop policy if exists "customer_invoice_payments org scoped" on customer_invoice_payments;
create policy "customer_invoice_payments org scoped" on customer_invoice_payments
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "daily_cost_entries branch scoped" on daily_cost_entries;
create policy "daily_cost_entries branch scoped" on daily_cost_entries
  for all to authenticated
  using (public.can_access_branch(organization_id, branch_id))
  with check (public.can_access_branch(organization_id, branch_id));

drop policy if exists "sales_daily_summaries branch read" on sales_daily_summaries;
create policy "sales_daily_summaries branch read" on sales_daily_summaries
  for select to authenticated using (public.can_access_branch(organization_id, branch_id));

create or replace function public.find_catalog_item_by_barcode(
  p_organization_id uuid,
  p_barcode text
)
returns table (
  catalog_item_id uuid,
  menu_item_id uuid,
  inventory_item_id uuid,
  code text,
  name text,
  unit_name text,
  unit_factor numeric,
  retail_price numeric,
  tax_rate numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ci.id,
    ci.menu_item_id,
    ci.inventory_item_id,
    ci.code,
    ci.name,
    ib.unit_name,
    ib.unit_factor,
    coalesce(ci.branch_price, ci.customer_price, ci.retail_price),
    ci.tax_rate
  from item_barcodes ib
  join catalog_items ci on ci.id = ib.catalog_item_id and ci.organization_id = ib.organization_id
  where ib.organization_id = p_organization_id
    and ib.barcode = p_barcode
    and ci.status = 'active'
    and public.is_org_member(p_organization_id)
  limit 1;
$$;

create or replace function public.next_invoice_number(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  select coalesce(count(*), 0) + 1
    into next_number
  from customer_invoices
  where organization_id = p_organization_id
    and issued_at::date = current_date;

  return 'فاتورة-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(next_number::text, 4, '0');
end;
$$;

create or replace function public.issue_customer_invoice(
  p_organization_id uuid,
  p_branch_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_payment_method payment_method,
  p_channel sales_channel,
  p_items jsonb,
  p_invoice_discount numeric default 0,
  p_service_fee numeric default 0,
  p_delivery_fee numeric default 0,
  p_notes text default null,
  p_idempotency_key text default null,
  p_allow_negative_stock boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_invoice_number text;
  v_subtotal numeric(12,4) := 0;
  v_tax_total numeric(12,4) := 0;
  v_total numeric(12,4) := 0;
  v_cost_total numeric(12,4) := 0;
  v_line jsonb;
  v_catalog catalog_items%rowtype;
  v_menu_recipe record;
  v_ingredient record;
  v_quantity numeric(14,4);
  v_unit_price numeric(12,4);
  v_discount numeric(12,4);
  v_tax_rate numeric(8,4);
  v_line_subtotal numeric(12,4);
  v_line_tax numeric(12,4);
  v_line_cost numeric(12,4);
  v_stock branch_stock%rowtype;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول لإصدار الفاتورة';
  end if;

  if not public.can_access_branch(p_organization_id, p_branch_id) then
    raise exception 'لا تملك صلاحية على هذا الفرع';
  end if;

  if not public.has_org_role(p_organization_id, array['organization_owner','branch_manager','cashier','staff']::app_role[]) then
    raise exception 'لا تملك صلاحية إصدار فواتير بيع';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'الفاتورة يجب أن تحتوي على صنف واحد على الأقل';
  end if;

  if p_idempotency_key is not null then
    select id into v_invoice_id
    from customer_invoices
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key;

    if v_invoice_id is not null then
      return jsonb_build_object('invoice_id', v_invoice_id, 'status', 'already_issued');
    end if;
  end if;

  v_invoice_number := public.next_invoice_number(p_organization_id);

  insert into customer_invoices (
    organization_id, branch_id, invoice_number, customer_name, customer_phone,
    status, payment_method, channel, discount, service_fee, delivery_fee, notes,
    idempotency_key, created_by
  )
  values (
    p_organization_id, p_branch_id, v_invoice_number, coalesce(nullif(p_customer_name, ''), 'عميل نقدي'), p_customer_phone,
    'paid', p_payment_method, p_channel, greatest(coalesce(p_invoice_discount, 0), 0),
    greatest(coalesce(p_service_fee, 0), 0), greatest(coalesce(p_delivery_fee, 0), 0), p_notes,
    p_idempotency_key, v_user_id
  )
  returning id into v_invoice_id;

  for v_line in select * from jsonb_array_elements(p_items)
  loop
    select * into v_catalog
    from catalog_items
    where id = (v_line->>'catalog_item_id')::uuid
      and organization_id = p_organization_id
      and status = 'active';

    if v_catalog.id is null then
      raise exception 'صنف غير معروف في الفاتورة';
    end if;

    v_quantity := greatest(coalesce((v_line->>'quantity')::numeric, 1), 0);
    v_unit_price := greatest(coalesce((v_line->>'unit_price')::numeric, v_catalog.retail_price), 0);
    v_discount := greatest(coalesce((v_line->>'discount')::numeric, 0), 0);
    v_tax_rate := greatest(coalesce((v_line->>'tax_rate')::numeric, v_catalog.tax_rate), 0);
    v_line_subtotal := greatest((v_unit_price - v_discount) * v_quantity, 0);
    v_line_tax := v_line_subtotal * (v_tax_rate / 100);
    v_line_cost := 0;

    if v_catalog.inventory_item_id is not null then
      select * into v_stock
      from branch_stock
      where organization_id = p_organization_id
        and branch_id = p_branch_id
        and item_id = v_catalog.inventory_item_id
      for update;

      if not found then
        insert into branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity, created_by)
        values (p_organization_id, p_branch_id, v_catalog.inventory_item_id, 0, 0, v_user_id)
        returning * into v_stock;
      end if;

      if not p_allow_negative_stock and v_stock.quantity < v_quantity then
        raise exception 'المخزون لا يكفي للصنف: %', v_catalog.name;
      end if;

      update branch_stock
        set quantity = quantity - v_quantity
      where id = v_stock.id;

      insert into stock_movements (
        organization_id, branch_id, item_id, movement_type, quantity, unit_cost,
        source_doc_type, source_doc_id, idempotency_key, notes, created_by
      )
      values (
        p_organization_id, p_branch_id, v_catalog.inventory_item_id, 'sale_usage', -v_quantity,
        coalesce((select average_cost from inventory_items where id = v_catalog.inventory_item_id), 0),
        'customer_invoice', v_invoice_id, concat(v_invoice_id, ':', v_catalog.inventory_item_id),
        'خصم مباشر من بيع صنف مخزني', v_user_id
      );

      v_line_cost := v_line_cost + v_quantity * coalesce((select average_cost from inventory_items where id = v_catalog.inventory_item_id), 0);
    end if;

    for v_menu_recipe in
      select r.id as recipe_id, m.portion_multiplier
      from menu_item_recipe_mapping m
      join recipes r on r.id = m.recipe_id
      where m.organization_id = p_organization_id
        and m.menu_item_id = v_catalog.menu_item_id
    loop
      for v_ingredient in
        select ri.item_id, ii.name, ri.quantity, ri.unit_cost, v_menu_recipe.portion_multiplier as portion_multiplier
        from recipe_ingredients ri
        join inventory_items ii on ii.id = ri.item_id
        where ri.recipe_id = v_menu_recipe.recipe_id
          and ri.organization_id = p_organization_id
      loop
        select * into v_stock
        from branch_stock
        where organization_id = p_organization_id
          and branch_id = p_branch_id
          and item_id = v_ingredient.item_id
        for update;

        if not found then
          insert into branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity, created_by)
          values (p_organization_id, p_branch_id, v_ingredient.item_id, 0, 0, v_user_id)
          returning * into v_stock;
        end if;

        if not p_allow_negative_stock and v_stock.quantity < (v_ingredient.quantity * v_quantity * v_ingredient.portion_multiplier) then
          raise exception 'المخزون لا يكفي للمادة الخام: %', v_ingredient.name;
        end if;

        update branch_stock
          set quantity = quantity - (v_ingredient.quantity * v_quantity * v_ingredient.portion_multiplier)
        where id = v_stock.id;

        insert into stock_movements (
          organization_id, branch_id, item_id, movement_type, quantity, unit_cost,
          source_doc_type, source_doc_id, idempotency_key, notes, created_by
        )
        values (
          p_organization_id, p_branch_id, v_ingredient.item_id, 'sale_usage',
          -(v_ingredient.quantity * v_quantity * v_ingredient.portion_multiplier), v_ingredient.unit_cost,
          'customer_invoice', v_invoice_id, concat(v_invoice_id, ':', v_ingredient.item_id),
          'خصم تلقائي من وصفة عند بيع وجبة', v_user_id
        )
        on conflict (organization_id, idempotency_key) do nothing;

        v_line_cost := v_line_cost + (v_ingredient.quantity * v_quantity * v_ingredient.portion_multiplier * v_ingredient.unit_cost);
      end loop;
    end loop;

    insert into customer_invoice_items (
      organization_id, customer_invoice_id, catalog_item_id, menu_item_id, name, quantity,
      unit_price, barcode, unit_name, unit_factor, discount, tax_rate, cost_total, gross_profit, created_by
    )
    values (
      p_organization_id, v_invoice_id, v_catalog.id, v_catalog.menu_item_id, v_catalog.name, v_quantity,
      v_unit_price, v_line->>'barcode', coalesce(v_line->>'unit_name', v_catalog.main_unit),
      coalesce((v_line->>'unit_factor')::numeric, 1), v_discount, v_tax_rate, v_line_cost,
      v_line_subtotal - v_line_cost, v_user_id
    );

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax;
    v_cost_total := v_cost_total + v_line_cost;
  end loop;

  v_total := greatest(v_subtotal - greatest(coalesce(p_invoice_discount, 0), 0) + v_tax_total + greatest(coalesce(p_service_fee, 0), 0) + greatest(coalesce(p_delivery_fee, 0), 0), 0);

  update customer_invoices
    set subtotal = v_subtotal,
        tax_total = v_tax_total,
        total = v_total,
        cost_total = v_cost_total,
        gross_profit = v_total - v_cost_total
  where id = v_invoice_id;

  insert into customer_invoice_payments (organization_id, customer_invoice_id, payment_method, amount, created_by)
  values (p_organization_id, v_invoice_id, p_payment_method, v_total, v_user_id);

  insert into sales_daily_summaries (
    organization_id, branch_id, summary_date, channel, orders_count, sales_total, ingredient_cost_total
  )
  values (p_organization_id, p_branch_id, current_date, p_channel, 1, v_total, v_cost_total)
  on conflict (organization_id, branch_id, summary_date, channel)
  do update set
    orders_count = sales_daily_summaries.orders_count + 1,
    sales_total = sales_daily_summaries.sales_total + excluded.sales_total,
    ingredient_cost_total = sales_daily_summaries.ingredient_cost_total + excluded.ingredient_cost_total,
    updated_at = now();

  return jsonb_build_object(
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'subtotal', v_subtotal,
    'tax_total', v_tax_total,
    'total', v_total,
    'cost_total', v_cost_total,
    'gross_profit', v_total - v_cost_total,
    'status', 'issued'
  );
end;
$$;

create or replace view public.amwali_daily_summary
with (security_invoker = true) as
select
  s.organization_id,
  s.branch_id,
  s.summary_date,
  sum(s.sales_total) as sales_total,
  sum(s.ingredient_cost_total) as raw_materials_total,
  coalesce(sum(case when d.cost_center = 'رواتب' then d.amount else 0 end), 0) as labor_total,
  coalesce(sum(case when d.cost_center = 'تشغيل' then d.amount else 0 end), 0) as operating_total,
  coalesce(sum(case when d.cost_center = 'ثابت' then d.amount else 0 end), 0) as fixed_total,
  coalesce(sum(case when d.cost_center = 'هدر' then d.amount else 0 end), 0) as waste_total,
  sum(s.sales_total)
    - sum(s.ingredient_cost_total)
    - coalesce(sum(case when d.cost_center in ('رواتب','تشغيل','ثابت','هدر') then d.amount else 0 end), 0) as net_profit
from sales_daily_summaries s
left join daily_cost_entries d
  on d.organization_id = s.organization_id
 and d.branch_id = s.branch_id
 and d.entry_date = s.summary_date
group by s.organization_id, s.branch_id, s.summary_date;

grant execute on function public.find_catalog_item_by_barcode(uuid, text) to authenticated;
grant execute on function public.issue_customer_invoice(uuid, uuid, text, text, payment_method, sales_channel, jsonb, numeric, numeric, numeric, text, text, boolean) to authenticated;
grant select on public.amwali_daily_summary to authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 003_social_platform_expansion.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter type social_platform add value if not exists 'linkedin';
alter type social_platform add value if not exists 'youtube_shorts';
alter type social_platform add value if not exists 'pinterest';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 004_social_publishing_engine.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists "pgcrypto";

create table if not exists social_oauth_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  platform social_platform not null,
  state text not null unique,
  code_verifier text,
  redirect_to text,
  requested_scopes text[] not null default '{}',
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table social_accounts
  add column if not exists provider_user_id text,
  add column if not exists provider_account_id text,
  add column if not exists encrypted_refresh_token text,
  add column if not exists token_type text,
  add column if not exists granted_scopes text[] not null default '{}',
  add column if not exists permission_status text not null default 'pending_review',
  add column if not exists oauth_connected_at timestamptz,
  add column if not exists oauth_error text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists social_accounts_provider_account_idx
  on social_accounts (organization_id, platform, provider_account_id)
  where provider_account_id is not null;

alter table social_media_assets
  add column if not exists url text,
  add column if not exists provider text not null default 'imagekit',
  add column if not exists file_id text,
  add column if not exists media_kind text not null default 'image',
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists duration_seconds numeric(10,2),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table social_publish_jobs
  add column if not exists run_after timestamptz not null default now(),
  add column if not exists status text not null default 'queued',
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists target_id uuid references social_post_targets(id) on delete cascade,
  add column if not exists platform social_platform,
  add column if not exists trigger_source text not null default 'dashboard',
  add column if not exists schedule_kind text not null default 'manual',
  add column if not exists max_attempts integer not null default 3,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists completed_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists external_run_id text,
  add column if not exists payload jsonb not null default '{}'::jsonb;

create index if not exists social_publish_jobs_queue_idx
  on social_publish_jobs (status, run_after, next_retry_at, locked_at);

create index if not exists social_publish_jobs_target_idx
  on social_publish_jobs (organization_id, social_post_id, target_id);

alter table social_publish_logs
  add column if not exists organization_id uuid references organizations(id) on delete cascade,
  add column if not exists social_post_id uuid references social_posts(id) on delete cascade,
  add column if not exists target_id uuid references social_post_targets(id) on delete set null,
  add column if not exists platform social_platform,
  add column if not exists status social_target_status,
  add column if not exists message text,
  add column if not exists provider_response jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists job_id uuid references social_publish_jobs(id) on delete set null,
  add column if not exists social_account_id uuid references social_accounts(id) on delete set null,
  add column if not exists attempt integer not null default 1,
  add column if not exists provider_post_id text,
  add column if not exists provider_url text,
  add column if not exists error_code text,
  add column if not exists error_message text,
  add column if not exists retryable boolean not null default false,
  add column if not exists requested_by uuid references auth.users(id),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz;

create index if not exists social_publish_logs_job_idx
  on social_publish_logs (organization_id, job_id, created_at desc);

create index if not exists social_publish_logs_target_idx
  on social_publish_logs (organization_id, target_id, created_at desc);

alter table social_oauth_states enable row level security;

drop policy if exists "social_oauth_states org read" on social_oauth_states;
create policy "social_oauth_states org read" on social_oauth_states
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "social_oauth_states org write" on social_oauth_states;
create policy "social_oauth_states org write" on social_oauth_states
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

comment on table social_oauth_states is 'Short-lived OAuth state and PKCE verifier records for connecting social accounts.';
comment on column social_accounts.encrypted_access_token is 'Store encrypted access tokens only. Use Supabase Vault/KMS or server-side encryption before production.';
comment on column social_accounts.encrypted_refresh_token is 'Store encrypted refresh tokens only. Never expose in browser code.';
comment on table social_publish_jobs is 'Queue table for dashboard, scheduler, Node-RED, or Trigger.dev publish tasks.';
comment on table social_publish_logs is 'Append-only publishing audit trail with per-platform attempts, failures, retries, and approvals.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 005_business_profiles_and_cashier_role.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 0060_add_departments_and_api_keys.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Create departments table (departments belong to branches/restaurants)
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Members of departments
CREATE TABLE IF NOT EXISTS department_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  permissions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- API keys for departments (used to authenticate API requests scoped to a department)
CREATE TABLE IF NOT EXISTS department_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  key text NOT NULL UNIQUE,
  name text NULL,
  disabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.department_api_keys
ADD COLUMN IF NOT EXISTS "key" text;

CREATE INDEX IF NOT EXISTS idx_department_api_keys_key ON public.department_api_keys ("key");

-- Note: key generation is left to application code. You can insert keys like:
-- INSERT INTO department_api_keys (department_id, key, name) VALUES ('<dept-id>', md5(random()::text || clock_timestamp()::text), 'Kitchen API');

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 0061_email_approval_and_team_invites.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists "pgcrypto";

create table if not exists account_approval_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  owner_name text not null,
  organization_name text not null,
  business_type text not null default 'restaurant',
  phone text,
  status text not null default 'pending_email_verification',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  unique (email)
);

create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  invite_code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  role app_role not null,
  branch_id uuid references branches(id) on delete set null,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_id, email),
  unique (invite_code)
);

alter table account_approval_requests enable row level security;
alter table team_invites enable row level security;

drop policy if exists "account approval admin read" on account_approval_requests;
create policy "account approval admin read" on account_approval_requests
  for select to authenticated using (public.is_super_admin());

drop policy if exists "account approval admin write" on account_approval_requests;
create policy "account approval admin write" on account_approval_requests
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "team_invites org read" on team_invites;
create policy "team_invites org read" on team_invites
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "team_invites owner write" on team_invites;
create policy "team_invites owner write" on team_invites
  for all to authenticated
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[]))
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[]));

create index if not exists account_approval_requests_status_idx on account_approval_requests (status, requested_at desc);
create index if not exists team_invites_org_status_idx on team_invites (organization_id, status, created_at desc);

comment on table account_approval_requests is $$Email registration requests that wait for email verification and owner/admin approval before full activation.$$;
comment on table team_invites is $$Owner-created team invitations by email and invite code for cashier, inventory manager, and other roles.$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 007_whatsapp_social_platform.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter type social_platform add value if not exists 'whatsapp';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 008_admin_user_setup.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admin User Setup Migration
-- This migration sets up the admin profile after the user is created via Auth

-- Create admin profile
do $$
begin
  -- Insert profile for admin user if it doesn't exist
  insert into profiles (id, full_name, locale)
  select id, 'Osama Alhallq', 'ar'
  from auth.users
  where email = 'osama.alhallq.14@gmail.com'
    and not exists (select 1 from profiles where id = auth.users.id)
  on conflict (id) do update set full_name = 'Osama Alhallq';

  -- Create admin organization
  insert into organizations (id, name, slug, plan, status, created_by)
  select gen_random_uuid(), 'Admin Organization', 'admin-org', 'scale', 'active', id
  from auth.users
  where email = 'osama.alhallq.14@gmail.com'
    and not exists (
      select 1 from organizations 
      where name = 'Admin Organization'
    )
  limit 1;

  -- Add admin to organization with super_admin role
  insert into organization_memberships (organization_id, user_id, role, created_by)
  select 
    (select id from organizations where slug = 'admin-org' limit 1),
    id,
    'super_admin'::app_role,
    id
  from auth.users
  where email = 'osama.alhallq.14@gmail.com'
    and (select id from organizations where slug = 'admin-org' limit 1) is not null
  on conflict (organization_id, user_id)
  do update set role = 'super_admin'::app_role;
end $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 009_social_recurrence.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table social_posts
  add column if not exists recurrence_interval text not null default 'none'
  check (recurrence_interval in ('none', 'daily', 'weekly'));

create index if not exists social_posts_scheduler_idx
  on social_posts (status, scheduled_at, recurrence_interval);

comment on column social_posts.recurrence_interval is 'Restaurant-first automation cadence: none, daily, or weekly. Recurrent publishes clone a new future post to preserve history.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 010_add_internal_messages.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Migration to add internal messaging table with row level security and real-time subscription
create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  sender_role public.app_role not null,
  recipient_role public.app_role, -- Null indicates General group chat
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.internal_messages enable row level security;

-- Performance Indexes for fast history listings and filtering
create index if not exists internal_messages_org_created_idx 
  on public.internal_messages (organization_id, created_at desc);

create index if not exists internal_messages_branch_idx 
  on public.internal_messages (branch_id);

-- SELECT Policy: Managers see everything; staff see general group chats, their own messages, or messages for their department
drop policy if exists "internal_messages_select_policy" on public.internal_messages;
create policy "internal_messages_select_policy" on public.internal_messages
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      -- Managers (owner, branch manager, super admin) have full oversight
      exists (
        select 1 from public.organization_memberships
        where organization_id = internal_messages.organization_id
          and user_id = auth.uid()
          and role in ('organization_owner', 'branch_manager', 'super_admin')
      )
      -- General staff can only see their department role, general chats, or messages they sent
      or (
        recipient_role is null
        or sender_id = auth.uid()
        or exists (
          select 1 from public.organization_memberships
          where organization_id = internal_messages.organization_id
            and user_id = auth.uid()
            and role = internal_messages.recipient_role
        )
      )
    )
  );

-- INSERT Policy: Authenticated users can insert messages for their organization, representing themselves
drop policy if exists "internal_messages_insert_policy" on public.internal_messages;
create policy "internal_messages_insert_policy" on public.internal_messages
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and sender_id = auth.uid()
  );

-- Enable Supabase Realtime for instant real-time message broadcasting
do $$
begin
  if not exists (
    select 1 
    from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'internal_messages'
  ) then
    alter publication supabase_realtime add table public.internal_messages;
  end if;
end $$;

comment on table public.internal_messages is 'Stores instant, real-time messaging records between departments and branches within a restaurant organization.';
comment on column public.internal_messages.recipient_role is 'Target role/department (e.g. chef, cashier). Null recipient role designates the General Restaurant Group channel.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 011_accounting_ledger.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

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
    (target_org_id, '2200', 'ذمم الموردين', 'liability', 'credit', 'accounts_payable'),
    (target_org_id, '2250', 'بضاعة مستلمة غير مفوترة', 'liability', 'credit', 'goods_received_not_invoiced'),
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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 012_cashier_shifts.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 013_kitchen_tickets.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 014_production_orders.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 015_manual_account_activation.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table public.profiles
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists role text not null default 'user',
  add column if not exists status text not null default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check check (status in ('pending', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('user', 'admin', 'super_admin'));
  end if;
end $$;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    status,
    locale
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    lower(new.email),
    nullif(new.raw_user_meta_data->>'phone', ''),
    coalesce(nullif(new.raw_user_meta_data->>'profile_role', ''), 'user'),
    coalesce(nullif(new.raw_user_meta_data->>'profile_status', ''), 'pending'),
    'ar'
  )
  on conflict (id) do update
    set full_name = coalesce(public.profiles.full_name, excluded.full_name),
        email = coalesce(public.profiles.email, excluded.email),
        phone = coalesce(public.profiles.phone, excluded.phone),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_profile();

update public.profiles p
set email = lower(u.email),
    full_name = coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    phone = coalesce(p.phone, nullif(u.raw_user_meta_data->>'phone', '')),
    status = coalesce(nullif(p.status, ''), 'pending'),
    role = coalesce(nullif(p.role, ''), 'user')
from auth.users u
where p.id = u.id;

update public.profiles p
set status = 'approved',
    approved_at = coalesce(p.approved_at, p.created_at),
    role = case
      when exists (
        select 1 from public.organization_memberships m
        where m.user_id = p.id and m.role = 'super_admin'::app_role
      ) then 'super_admin'
      else p.role
    end
where exists (
  select 1 from public.organization_memberships m
  where m.user_id = p.id
);

alter table public.profiles enable row level security;

drop policy if exists "profiles own row" on public.profiles;
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_super_admin());

drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create index if not exists profiles_status_idx on public.profiles (status, created_at desc);
create index if not exists profiles_email_idx on public.profiles (email);

comment on column public.profiles.status is 'Manual account activation status: pending, approved, or rejected.';
comment on column public.profiles.role is 'Platform profile role for manual activation: user, admin, or super_admin.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 016_local_publisher_agent.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter type social_post_status add value if not exists 'ready';
alter type social_post_status add value if not exists 'prepared';

alter type social_target_status add value if not exists 'ready';
alter type social_target_status add value if not exists 'prepared';

alter table social_posts
  add column if not exists image_local_path text,
  add column if not exists local_agent_payload jsonb not null default '{}'::jsonb;

create index if not exists social_posts_local_publisher_queue_idx
  on social_posts (organization_id, status, scheduled_at, created_at desc);

comment on column social_posts.image_local_path is 'Optional local filesystem path used by the Rewaq Publisher desktop agent after downloading media.';
comment on column social_posts.local_agent_payload is 'Semi-automation metadata for the local publisher agent. No Meta Graph API token is required.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 017_purchase_receipt_grni_account.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Adds GRNI account for purchase receipts that arrive before supplier invoices.

insert into public.chart_of_accounts (organization_id, code, name, account_type, normal_balance, system_key)
select id, '2250', 'بضاعة مستلمة غير مفوترة', 'liability', 'credit', 'goods_received_not_invoiced'
from public.organizations
on conflict (organization_id, system_key) do update
  set code = excluded.code,
      name = excluded.name,
      account_type = excluded.account_type,
      normal_balance = excluded.normal_balance,
      updated_at = now();

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
    (target_org_id, '5100', 'تكلفة البضاعة المباعة', 'cogs', 'debit', 'cogs'),
    (target_org_id, '5900', 'فروقات الصندوق', 'expense', 'debit', 'cash_over_short'),
    (target_org_id, '6100', 'مصروفات تشغيلية', 'expense', 'debit', 'operating_expense')
  on conflict (organization_id, system_key) do update
    set name = excluded.name,
        account_type = excluded.account_type,
        normal_balance = excluded.normal_balance,
        updated_at = now();
end;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 018_supplier_payables_account.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Adds supplier payable account to the default chart for purchasing journals.

insert into public.chart_of_accounts (organization_id, code, name, account_type, normal_balance, system_key)
select id, '2200', 'ذمم الموردين', 'liability', 'credit', 'accounts_payable'
from public.organizations
on conflict (organization_id, system_key) do update
  set code = excluded.code,
      name = excluded.name,
      account_type = excluded.account_type,
      normal_balance = excluded.normal_balance,
      updated_at = now();

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
    (target_org_id, '3000', 'رأس المال', 'equity', 'credit', 'owner_equity'),
    (target_org_id, '4100', 'مبيعات المطعم', 'revenue', 'credit', 'sales_revenue'),
    (target_org_id, '5100', 'تكلفة البضاعة المباعة', 'cogs', 'debit', 'cogs'),
    (target_org_id, '5900', 'فروقات الصندوق', 'expense', 'debit', 'cash_over_short'),
    (target_org_id, '6100', 'مصروفات تشغيلية', 'expense', 'debit', 'operating_expense')
  on conflict (organization_id, system_key) do update
    set name = excluded.name,
        account_type = excluded.account_type,
        normal_balance = excluded.normal_balance,
        updated_at = now();
end;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 019_add_warehouse_to_inventory.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Add warehouse column to inventory_items table
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS warehouse text NOT NULL DEFAULT 'general';

-- Add check constraint to ensure only general or kitchen are used
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'inventory_items_warehouse_check'
  ) THEN
    ALTER TABLE public.inventory_items
    ADD CONSTRAINT inventory_items_warehouse_check 
    CHECK (warehouse IN ('general', 'kitchen'));
  END IF;
END $$;

-- Update existing items by category to make it realistic
-- Raw protein, grains, dairy, vegetables, herbs, frozen are kitchen
-- Packaging, disposables, operations, cleaning are general
UPDATE public.inventory_items ii
SET warehouse = 'kitchen'
FROM public.inventory_categories ic
WHERE ii.category_id = ic.id
  AND ic.name IN ('بروتين', 'حبوب ونشويات', 'زيوت', 'صوصات', 'أجبان', 'خضار طازجة', 'فواكه وحمضيات', 'أعشاب طازجة', 'مجمدات', 'مخبوزات', 'بهارات وتوابل');

-- Exception: make sure buns remain general if any
UPDATE public.inventory_items 
SET warehouse = 'general' 
WHERE name = 'خبز برجر';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 020_ensure_inventory_warehouse.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 020: Ensure inventory_items.warehouse column exists on the live DB
-- (re-applies the intent of 019 idempotently so /dashboard/inventory?warehouse=kitchen
--  is not empty after a fresh production deploy).

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS warehouse text NOT NULL DEFAULT 'general';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_items_warehouse_check'
  ) THEN
    ALTER TABLE public.inventory_items
      ADD CONSTRAINT inventory_items_warehouse_check
      CHECK (warehouse IN ('general', 'kitchen'));
  END IF;
END $$;

-- Index for the warehouse filter used by the dashboard pages.
CREATE INDEX IF NOT EXISTS inventory_items_org_warehouse_idx
  ON public.inventory_items (organization_id, warehouse);

-- Populate warehouse from the category name when it is still the default 'general'.
-- Kitchen categories: raw proteins, grains, oils, sauces, dairy, fresh produce, frozen, spices.
-- General categories: packaging, disposables, cleaning, operations.
UPDATE public.inventory_items ii
SET warehouse = 'kitchen',
    updated_at = now()
FROM public.inventory_categories ic
WHERE ii.category_id = ic.id
  AND ii.warehouse = 'general'
  AND ic.name IN (
    'بروتين', 'حبوب ونشويات', 'زيوت', 'صوصات', 'أجبان',
    'خضار طازجة', 'فواكه وحمضيات', 'أعشاب طازجة',
    'مجمدات', 'مخبوزات', 'بهارات وتوابل'
  );

-- Keep bread / buns as general warehouse (packaged stockroom item).
UPDATE public.inventory_items
SET warehouse = 'general',
    updated_at = now()
WHERE name = 'خبز برجر';

COMMENT ON COLUMN public.inventory_items.warehouse IS
  'Stockroom grouping: general (packaging/cleaning/ops) vs kitchen (raw food/prep).';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 021_staff_members.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 021: Staff members with login codes (Tekka-style permission distribution)
-- Each staff member gets a generated login code (W/C/K/M-####) tied to a role,
-- so a manager can distribute access per department without passwords.

CREATE TABLE IF NOT EXISTS public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'staff'
    CHECK (role IN ('waiter', 'cashier', 'kitchen', 'bar', 'shisha', 'manager')),
  login_code text NOT NULL,
  linked_device_key_id uuid REFERENCES public.department_api_keys(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (organization_id, login_code)
);

CREATE INDEX IF NOT EXISTS staff_members_org_idx
  ON public.staff_members (organization_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS staff_members_branch_idx
  ON public.staff_members (branch_id);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff members org read" ON public.staff_members;
CREATE POLICY "staff members org read" ON public.staff_members
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "staff members manager write" ON public.staff_members;
CREATE POLICY "staff members manager write" ON public.staff_members
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[]) OR public.is_super_admin());

COMMENT ON TABLE public.staff_members IS
  'Restaurant staff with short login codes (Tekka-style) for quick department login. Each code is unique per organization.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 022_forward_fix_department_api_keys.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Forward fix for department device access and RLS helper recursion.
-- This migration is intentionally additive/non-destructive for live databases
-- that already applied the legacy 006_add_departments_and_api_keys.sql file.

create extension if not exists "pgcrypto";

-- Keep the legacy departments tables if they exist, but make the API-key table
-- compatible with the current application code, which expects hashed keys and
-- organization/branch scoping.
create table if not exists public.department_api_keys (
  id uuid primary key default gen_random_uuid()
);

alter table public.department_api_keys
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists branch_id uuid references public.branches(id) on delete cascade,
  add column if not exists device_name text,
  add column if not exists key_hash text,
  add column if not exists role public.app_role not null default 'staff',
  add column if not exists allowed_modules text[] not null default '{}'::text[],
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_used_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- The legacy schema required department_id and raw key. Current application
-- inserts do not provide those columns, so make them nullable if they exist.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'department_api_keys'
      and column_name = 'department_id'
  ) then
    alter table public.department_api_keys alter column department_id drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'department_api_keys'
      and column_name = 'key'
  ) then
    alter table public.department_api_keys alter column key drop not null;
  end if;
end $$;

-- Backfill new columns from the legacy department tables when possible.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'department_api_keys' and column_name = 'department_id')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'department_api_keys' and column_name = 'key')
     and to_regclass('public.departments') is not null then
    update public.department_api_keys dak
       set branch_id = coalesce(dak.branch_id, d.branch_id),
           organization_id = coalesce(dak.organization_id, b.organization_id),
           device_name = coalesce(dak.device_name, dak.name, d.name, 'جهاز قسم'),
           key_hash = coalesce(dak.key_hash, encode(digest(upper(trim(dak.key)), 'sha256'), 'hex')),
           is_active = case
             when dak.disabled is null then coalesce(dak.is_active, true)
             else not dak.disabled
           end,
           updated_at = now()
      from public.departments d
      join public.branches b on b.id = d.branch_id
     where dak.department_id = d.id;
  end if;
end $$;

-- Current application rows should always have a hash and device name. Existing
-- malformed legacy rows are left nullable rather than deleted.
create unique index if not exists department_api_keys_key_hash_key
  on public.department_api_keys (key_hash)
  where key_hash is not null;

create index if not exists dept_keys_hash_idx
  on public.department_api_keys (key_hash)
  where is_active = true and key_hash is not null;

create index if not exists dept_keys_org_idx
  on public.department_api_keys (organization_id);

alter table public.department_api_keys enable row level security;

drop trigger if exists set_department_api_keys_updated_at on public.department_api_keys;
create trigger set_department_api_keys_updated_at
  before update on public.department_api_keys
  for each row execute function set_updated_at();

drop policy if exists "Owners manage keys" on public.department_api_keys;
create policy "Owners manage keys" on public.department_api_keys
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.organization_memberships
      where organization_id = department_api_keys.organization_id
        and user_id = (select auth.uid())
        and role = 'organization_owner'
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1
      from public.organization_memberships
      where organization_id = department_api_keys.organization_id
        and user_id = (select auth.uid())
        and role = 'organization_owner'
    )
  );

drop policy if exists "Org members read keys" on public.department_api_keys;
create policy "Org members read keys" on public.department_api_keys
  for select to authenticated
  using (public.is_org_member(organization_id));

-- Internal department messaging expected by the current app.
create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  sender_role public.app_role not null default 'staff',
  recipient_role public.app_role,
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.internal_messages enable row level security;

drop policy if exists "Managers read all messages" on public.internal_messages;
drop policy if exists "Staff read relevant messages" on public.internal_messages;
drop policy if exists "Org members insert messages" on public.internal_messages;
drop policy if exists "internal_messages_select_policy" on public.internal_messages;
drop policy if exists "internal_messages_insert_policy" on public.internal_messages;

create policy "Managers read all messages" on public.internal_messages
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.organization_memberships
      where organization_id = internal_messages.organization_id
        and user_id = (select auth.uid())
        and role in ('organization_owner', 'branch_manager')
    )
  );

create policy "Staff read relevant messages" on public.internal_messages
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      recipient_role is null
      or sender_id = (select auth.uid())
      or exists (
        select 1
        from public.organization_memberships
        where organization_id = internal_messages.organization_id
          and user_id = (select auth.uid())
          and role = internal_messages.recipient_role
      )
    )
  );

create policy "Org members insert messages" on public.internal_messages
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and (sender_id is null or sender_id = (select auth.uid()))
  );

create index if not exists internal_msg_org_role_idx
  on public.internal_messages (organization_id, recipient_role, created_at);

create index if not exists internal_messages_org_created_idx
  on public.internal_messages (organization_id, created_at desc);

-- RLS helper functions rewritten as plpgsql/security definer to avoid planner
-- inlining and recursive RLS loops.
create or replace function public.is_super_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1
    from public.organization_memberships
    where user_id = auth.uid()
      and role = 'super_admin'
  ) into is_admin;

  return coalesce(is_admin, false);
end;
$$;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  is_member boolean;
begin
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = target_org_id
      and user_id = auth.uid()
  ) into is_member;

  if coalesce(is_member, false) then
    return true;
  end if;

  return public.is_super_admin();
end;
$$;

create or replace function public.can_access_branch(target_org_id uuid, target_branch_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_access boolean;
begin
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = target_org_id
      and user_id = auth.uid()
      and (
        role in ('organization_owner', 'inventory_manager', 'purchasing_manager', 'chef', 'marketing_manager', 'accountant')
        or branch_id is null
        or branch_id = target_branch_id
      )
  ) into has_access;

  if coalesce(has_access, false) then
    return true;
  end if;

  return public.is_super_admin();
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_class c on pr.prrelid = c.oid
      join pg_namespace n on c.relnamespace = n.oid
      where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
        and c.relname = 'internal_messages'
        and n.nspname = 'public'
    ) then
      alter publication supabase_realtime add table public.internal_messages;
    end if;
  end if;
end $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 023_harden_financial_inventory_rls.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Harden financial and inventory RLS without deleting or rewriting history.
-- This is a forward-only safety migration: destructive DELETE access is removed
-- from operational history tables, while correction/void/archive workflows stay
-- possible through INSERT or UPDATE policies.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'branch_stock',
    'stock_movements',
    'stock_counts',
    'waste_logs',
    'purchase_orders',
    'invoices',
    'customer_invoices'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('drop policy if exists %I on public.%I', target_table || ' branch delete', target_table);
    end if;
  end loop;
end $$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'transfer_items',
    'stock_count_items',
    'purchase_order_items',
    'invoice_items',
    'customer_invoice_items',
    'customer_invoice_payments',
    'supplier_price_history'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('drop policy if exists %I on public.%I', target_table || ' org scoped', target_table);
    end if;
  end loop;
end $$;

drop policy if exists "transfers branch write" on public.transfers;
drop policy if exists "stock_movements branch update" on public.stock_movements;
drop policy if exists "stock_count_items org read" on public.stock_count_items;
drop policy if exists "stock_count_items org write" on public.stock_count_items;
drop policy if exists "coa owner write" on public.chart_of_accounts;
drop policy if exists "journal entries accountant write" on public.journal_entries;
drop policy if exists "journal lines accountant write" on public.journal_lines;

-- Chart accounts are financial master data. Disable accounts with is_active=false
-- instead of deleting rows that may be referenced by journal history.
drop policy if exists "coa owner insert" on public.chart_of_accounts;
create policy "coa owner insert" on public.chart_of_accounts
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
    or public.is_super_admin()
  );

drop policy if exists "coa owner update" on public.chart_of_accounts;
create policy "coa owner update" on public.chart_of_accounts
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
    or public.is_super_admin()
  );

-- Transfer headers are workflow records: update is allowed for lifecycle state,
-- but delete is intentionally omitted.
drop policy if exists "transfers branch insert" on public.transfers;
create policy "transfers branch insert" on public.transfers
  for insert to authenticated
  with check (
    public.can_access_branch(organization_id, from_branch_id)
    or public.can_access_branch(organization_id, to_branch_id)
  );

drop policy if exists "transfers branch update" on public.transfers;
create policy "transfers branch update" on public.transfers
  for update to authenticated
  using (
    public.can_access_branch(organization_id, from_branch_id)
    or public.can_access_branch(organization_id, to_branch_id)
  )
  with check (
    public.can_access_branch(organization_id, from_branch_id)
    or public.can_access_branch(organization_id, to_branch_id)
  );

-- Transfer and purchase-order line items can be corrected while their parent
-- workflows are still open, but they should not be deleted through client RLS.
drop policy if exists "transfer_items org read" on public.transfer_items;
create policy "transfer_items org read" on public.transfer_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "transfer_items org insert" on public.transfer_items;
create policy "transfer_items org insert" on public.transfer_items
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "transfer_items org update" on public.transfer_items;
create policy "transfer_items org update" on public.transfer_items
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "purchase_order_items org read" on public.purchase_order_items;
create policy "purchase_order_items org read" on public.purchase_order_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "purchase_order_items org insert" on public.purchase_order_items;
create policy "purchase_order_items org insert" on public.purchase_order_items
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "purchase_order_items org update" on public.purchase_order_items;
create policy "purchase_order_items org update" on public.purchase_order_items
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "stock_count_items org read" on public.stock_count_items;
create policy "stock_count_items org read" on public.stock_count_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "stock_count_items org insert" on public.stock_count_items;
create policy "stock_count_items org insert" on public.stock_count_items
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "stock_count_items org update" on public.stock_count_items;
create policy "stock_count_items org update" on public.stock_count_items
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Supplier invoices, customer invoice lines, and payments are financial
-- history. Corrections should be appended or represented by void/reversal
-- records, so direct client update/delete is omitted.
drop policy if exists "invoice_items org read" on public.invoice_items;
create policy "invoice_items org read" on public.invoice_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "invoice_items org insert" on public.invoice_items;
create policy "invoice_items org insert" on public.invoice_items
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "customer_invoice_items org read" on public.customer_invoice_items;
create policy "customer_invoice_items org read" on public.customer_invoice_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "customer_invoice_items org insert" on public.customer_invoice_items;
create policy "customer_invoice_items org insert" on public.customer_invoice_items
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "customer_invoice_payments org read" on public.customer_invoice_payments;
create policy "customer_invoice_payments org read" on public.customer_invoice_payments
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "customer_invoice_payments org insert" on public.customer_invoice_payments;
create policy "customer_invoice_payments org insert" on public.customer_invoice_payments
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "supplier_price_history org read" on public.supplier_price_history;
create policy "supplier_price_history org read" on public.supplier_price_history
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "supplier_price_history org insert" on public.supplier_price_history;
create policy "supplier_price_history org insert" on public.supplier_price_history
  for insert to authenticated
  with check (public.is_org_member(organization_id));

-- Accountants can create draft/posting records through approved workflows.
-- Posted journal entries and lines are not mutable or deletable through RLS.
drop policy if exists "journal entries accountant insert" on public.journal_entries;
create policy "journal entries accountant insert" on public.journal_entries
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
    or public.is_super_admin()
  );

drop policy if exists "journal entries accountant draft update" on public.journal_entries;
create policy "journal entries accountant draft update" on public.journal_entries
  for update to authenticated
  using (
    status = 'draft'
    and (
      public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
      or public.is_super_admin()
    )
  )
  with check (
    status in ('draft', 'void')
    and (
      public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
      or public.is_super_admin()
    )
  );

drop policy if exists "journal lines accountant insert" on public.journal_lines;
create policy "journal lines accountant insert" on public.journal_lines
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
    or public.is_super_admin()
  );

drop policy if exists "journal lines accountant draft update" on public.journal_lines;
create policy "journal lines accountant draft update" on public.journal_lines
  for update to authenticated
  using (
    exists (
      select 1
      from public.journal_entries je
      where je.id = journal_lines.journal_entry_id
        and je.organization_id = journal_lines.organization_id
        and je.status = 'draft'
    )
    and (
      public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
      or public.is_super_admin()
    )
  )
  with check (
    exists (
      select 1
      from public.journal_entries je
      where je.id = journal_lines.journal_entry_id
        and je.organization_id = journal_lines.organization_id
        and je.status = 'draft'
    )
    and (
      public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
      or public.is_super_admin()
    )
  );

comment on policy "journal entries accountant draft update" on public.journal_entries is
  'Only draft journal entries may be updated through authenticated RLS. Posted entries require reversal/void workflows.';

comment on policy "journal lines accountant draft update" on public.journal_lines is
  'Only lines attached to draft journal entries may be updated through authenticated RLS.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 024_pos_checkout_atomic.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Atomic POS Checkout Database Function
-- This function processes POS checkout in a single atomic database transaction.

CREATE OR REPLACE FUNCTION public.pos_checkout_atomic(
  p_org_id uuid,
  p_branch_id uuid,
  p_device_key_id uuid,
  p_device_name text,
  p_customer_name text,
  p_payment_method text,
  p_idempotency_key text,
  p_items jsonb -- Array of objects: [{"catalog_item_id": "uuid", "quantity": 1.5}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_number text;
  v_shift_id uuid;
  v_ticket_id uuid;
  v_item record;
  v_catalog_id uuid;
  v_quantity numeric;
  v_catalog record;
  v_mapping record;
  v_ingredient record;
  v_deduct_qty numeric;
  v_unit_cost numeric;
  v_line_cost numeric;
  v_cost_total numeric := 0;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_total numeric := 0;
  v_count integer;
  v_today_str text;
  v_je_id uuid;
  v_je_number text;
  v_cash_acct_id uuid;
  v_revenue_acct_id uuid;
  v_tax_acct_id uuid;
  v_cogs_acct_id uuid;
  v_inv_acct_id uuid;
  v_line_index integer := 0;
  v_impact_index integer := 0;
  v_stock_qty numeric;
  v_stock_id uuid;
BEGIN
  -- 1. Check idempotency
  SELECT id, invoice_number, total, shift_id
  INTO v_invoice_id, v_invoice_number, v_total, v_shift_id
  FROM customer_invoices
  WHERE organization_id = p_org_id
    AND branch_id = p_branch_id
    AND idempotency_key = p_idempotency_key;

  IF v_invoice_id IS NOT NULL THEN
    -- Find kitchen ticket
    SELECT id INTO v_ticket_id
    FROM kitchen_tickets
    WHERE customer_invoice_id = v_invoice_id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'invoiceId', v_invoice_id,
      'invoiceNumber', v_invoice_number,
      'kitchenTicketId', v_ticket_id,
      'shiftId', v_shift_id,
      'total', v_total
    );
  END IF;

  -- 2. Resolve/Ensure sales shift
  SELECT id INTO v_shift_id
  FROM sales_shifts
  WHERE organization_id = p_org_id
    AND branch_id = p_branch_id
    AND status = 'open'
    AND (device_key_id = p_device_key_id OR (device_key_id IS NULL AND p_device_key_id IS NULL))
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_shift_id IS NULL THEN
    INSERT INTO sales_shifts (
      organization_id, branch_id, device_key_id, cashier_name, status, opening_cash, expected_cash
    ) VALUES (
      p_org_id, p_branch_id, p_device_key_id, p_device_name, 'open', 0, 0
    ) RETURNING id INTO v_shift_id;

    INSERT INTO cash_drawer_entries (
      organization_id, branch_id, shift_id, entry_type, amount, memo
    ) VALUES (
      p_org_id, p_branch_id, v_shift_id, 'opening', 0, 'رصيد افتتاحي تلقائي للوردية'
    );
  END IF;

  -- 3. Calculate totals & stock impacts by looping over items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric)
  LOOP
    v_catalog_id := v_item.catalog_item_id;
    v_quantity := v_item.quantity;

    SELECT * INTO v_catalog FROM catalog_items WHERE id = v_catalog_id AND organization_id = p_org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Catalog item % not found', v_catalog_id;
    END IF;
    IF v_catalog.status != 'active' THEN
      RAISE EXCEPTION 'Catalog item % is inactive', v_catalog.name;
    END IF;

    v_subtotal := v_subtotal + (v_catalog.retail_price * v_quantity);
    v_tax_total := v_tax_total + (v_catalog.retail_price * v_quantity * (v_catalog.tax_rate / 100));

    -- Ingredient stock check and calculation
    IF v_catalog.menu_item_id IS NOT NULL THEN
      FOR v_mapping IN SELECT * FROM menu_item_recipe_mapping WHERE menu_item_id = v_catalog.menu_item_id AND organization_id = p_org_id
      LOOP
        FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = v_mapping.recipe_id AND organization_id = p_org_id
        LOOP
          v_deduct_qty := v_ingredient.quantity * v_mapping.portion_multiplier * v_quantity;
          v_unit_cost := COALESCE(v_ingredient.unit_cost, 0);
          IF v_unit_cost = 0 THEN
            SELECT average_cost INTO v_unit_cost FROM inventory_items WHERE id = v_ingredient.item_id;
          END IF;

          v_cost_total := v_cost_total + (v_deduct_qty * COALESCE(v_unit_cost, 0));

          -- Lock branch stock row for update to prevent race conditions
          SELECT id, quantity INTO v_stock_id, v_stock_qty
          FROM branch_stock
          WHERE organization_id = p_org_id
            AND branch_id = p_branch_id
            AND item_id = v_ingredient.item_id
          FOR UPDATE;

          IF NOT FOUND THEN
            -- Initialize stock row
            INSERT INTO branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity)
            VALUES (p_org_id, p_branch_id, v_ingredient.item_id, 0, 0)
            RETURNING id, quantity INTO v_stock_id, v_stock_qty;
          END IF;

          IF v_stock_qty < v_deduct_qty THEN
            RAISE EXCEPTION 'لا توجد كمية كافية في المخزون للمادة %', (SELECT name FROM inventory_items WHERE id = v_ingredient.item_id);
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  v_total := v_subtotal + v_tax_total;

  -- 4. Generate Invoice Number
  v_invoice_number := get_next_sequence_number(p_org_id, p_branch_id, 'invoice', 'POS-');

  -- 5. Insert Invoice
  INSERT INTO customer_invoices (
    organization_id, branch_id, invoice_number, customer_name, status,
    payment_method, channel, subtotal, discount, tax_total, total,
    cost_total, gross_profit, idempotency_key, shift_id, notes
  ) VALUES (
    p_org_id, p_branch_id, v_invoice_number, p_customer_name, 'paid',
    p_payment_method::payment_method, 'pickup', v_subtotal, 0, v_tax_total, v_total,
    v_cost_total, v_subtotal - v_cost_total, p_idempotency_key, v_shift_id,
    'فاتورة كاشير ذرية'
  ) RETURNING id INTO v_invoice_id;

  -- 6. Insert Items & Process stock updates/movements
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric)
  LOOP
    v_catalog_id := v_item.catalog_item_id;
    v_quantity := v_item.quantity;
    v_line_cost := 0;

    SELECT * INTO v_catalog FROM catalog_items WHERE id = v_catalog_id AND organization_id = p_org_id;

    -- Calculate line cost
    IF v_catalog.menu_item_id IS NOT NULL THEN
      FOR v_mapping IN SELECT * FROM menu_item_recipe_mapping WHERE menu_item_id = v_catalog.menu_item_id AND organization_id = p_org_id
      LOOP
        FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = v_mapping.recipe_id AND organization_id = p_org_id
        LOOP
          v_deduct_qty := v_ingredient.quantity * v_mapping.portion_multiplier * v_quantity;
          v_unit_cost := COALESCE(v_ingredient.unit_cost, 0);
          IF v_unit_cost = 0 THEN
            SELECT average_cost INTO v_unit_cost FROM inventory_items WHERE id = v_ingredient.item_id;
          END IF;

          v_line_cost := v_line_cost + (v_deduct_qty * COALESCE(v_unit_cost, 0));

          -- Deduct Stock (row already guaranteed to exist from step 3)
          UPDATE branch_stock
          SET quantity = quantity - v_deduct_qty
          WHERE organization_id = p_org_id
            AND branch_id = p_branch_id
            AND item_id = v_ingredient.item_id;

          -- Insert Stock Movement
          INSERT INTO stock_movements (
            organization_id, branch_id, item_id, movement_type, quantity,
            unit_cost, total_cost, reference, idempotency_key, notes
          ) VALUES (
            p_org_id, p_branch_id, v_ingredient.item_id, 'sale_usage', -v_deduct_qty,
            COALESCE(v_unit_cost, 0), v_deduct_qty * COALESCE(v_unit_cost, 0), v_invoice_number,
            v_invoice_id::text || ':' || v_line_index::text || ':' || v_impact_index::text || ':' || v_ingredient.item_id::text || ':sale_usage',
            'خصم تلقائي للمبيعات الذرية - فاتورة ' || v_invoice_number
          );
          v_impact_index := v_impact_index + 1;
        END LOOP;
      END LOOP;
    END IF;

    -- Insert Invoice Item
    INSERT INTO customer_invoice_items (
      organization_id, customer_invoice_id, catalog_item_id, menu_item_id,
      name, quantity, unit_price, unit_name, unit_factor, discount,
      tax_rate, cost_total, gross_profit
    ) VALUES (
      p_org_id, v_invoice_id, v_catalog.id, v_catalog.menu_item_id,
      v_catalog.name, v_quantity, v_catalog.retail_price, COALESCE(v_catalog.main_unit, 'قطعة'),
      1, 0, v_catalog.tax_rate, v_line_cost, (v_catalog.retail_price * v_quantity) - v_line_cost
    );

    v_line_index := v_line_index + 1;
  END LOOP;

  -- 7. Insert Payment
  INSERT INTO customer_invoice_payments (
    organization_id, customer_invoice_id, payment_method, amount
  ) VALUES (
    p_org_id, v_invoice_id, p_payment_method::payment_method, v_total
  );

  -- 8. Register Shift Sale
  DECLARE
    v_drawer_type text;
    v_sales_field text;
    v_cash_sales numeric;
    v_card_sales numeric;
    v_exp_cash numeric;
  BEGIN
    IF p_payment_method = 'cash' THEN
      v_drawer_type := 'cash_sale';
      v_sales_field := 'cash_sales';
    ELSE
      v_drawer_type := 'card_sale';
      v_sales_field := 'card_sales';
    END IF;

    INSERT INTO cash_drawer_entries (
      organization_id, branch_id, shift_id, entry_type, amount,
      reference_doc_type, reference_doc_id, memo
    ) VALUES (
      p_org_id, p_branch_id, v_shift_id, v_drawer_type::drawer_entry_type, v_total,
      'customer_invoice', v_invoice_id, 'تحصيل تلقائي للمبيعات الذرية'
    );

    SELECT cash_sales, card_sales, expected_cash
    INTO v_cash_sales, v_card_sales, v_exp_cash
    FROM sales_shifts
    WHERE id = v_shift_id;

    IF p_payment_method = 'cash' THEN
      UPDATE sales_shifts
      SET cash_sales = v_cash_sales + v_total,
          expected_cash = v_exp_cash + v_total,
          updated_at = now()
      WHERE id = v_shift_id;
    ELSE
      UPDATE sales_shifts
      SET card_sales = v_card_sales + v_total,
          updated_at = now()
      WHERE id = v_shift_id;
    END IF;
  END;

  -- 9. Post Accounting Journal Entry & Lines (balanced check enforced)
  -- Ensure default accounts
  PERFORM ensure_default_chart_accounts(p_org_id);

  -- Load account ids
  IF p_payment_method = 'cash' THEN
    SELECT id INTO v_cash_acct_id FROM chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cash';
  ELSE
    SELECT id INTO v_cash_acct_id FROM chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'bank';
  END IF;

  SELECT id INTO v_revenue_acct_id FROM chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_revenue';
  SELECT id INTO v_tax_acct_id FROM chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_tax_payable';
  SELECT id INTO v_cogs_acct_id FROM chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cogs';
  SELECT id INTO v_inv_acct_id FROM chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'inventory';

  IF v_cash_acct_id IS NULL OR v_revenue_acct_id IS NULL THEN
    RAISE EXCEPTION 'Required default accounts not found';
  END IF;

  -- Journal entry number
  SELECT count(*) INTO v_count
  FROM journal_entries
  WHERE organization_id = p_org_id
    AND created_at >= date_trunc('day', now())
    AND created_at < date_trunc('day', now() + interval '1 day');

  v_je_number := 'JE-' || v_today_str || '-' || lpad((v_count + 1)::text, 4, '0');

  INSERT INTO journal_entries (
    organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status
  ) VALUES (
    p_org_id, p_branch_id, v_je_number, current_date,
    'customer_invoice', v_invoice_id, 'قيد تلقائي لمبيعات الكاشير - فاتورة ' || v_invoice_number, 'posted'
  ) RETURNING id INTO v_je_id;

  -- Debit Cash/Bank
  INSERT INTO journal_lines (
    organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
  ) VALUES (
    p_org_id, v_je_id, v_cash_acct_id, p_branch_id, v_total, 0, 'تحصيل فاتورة ' || v_invoice_number
  );

  -- Credit Revenue
  INSERT INTO journal_lines (
    organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
  ) VALUES (
    p_org_id, v_je_id, v_revenue_acct_id, p_branch_id, 0, v_subtotal, 'مبيعات فاتورة ' || v_invoice_number
  );

  -- Credit Tax
  IF v_tax_total > 0 THEN
    IF v_tax_acct_id IS NULL THEN
      RAISE EXCEPTION 'Sales tax payable account not found';
    END IF;
    INSERT INTO journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_je_id, v_tax_acct_id, p_branch_id, 0, v_tax_total, 'ضريبة فاتورة ' || v_invoice_number
    );
  END IF;

  -- COGS & Inventory
  IF v_cost_total > 0 THEN
    IF v_cogs_acct_id IS NULL OR v_inv_acct_id IS NULL THEN
      RAISE EXCEPTION 'COGS or Inventory account not found';
    END IF;
    INSERT INTO journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_je_id, v_cogs_acct_id, p_branch_id, v_cost_total, 0, 'تكلفة مبيعات فاتورة ' || v_invoice_number
    );
    INSERT INTO journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_je_id, v_inv_acct_id, p_branch_id, 0, v_cost_total, 'خصم مخزون فاتورة ' || v_invoice_number
    );
  END IF;

  -- 10. Insert Kitchen Ticket
  INSERT INTO kitchen_tickets (
    organization_id, branch_id, customer_invoice_id, shift_id,
    invoice_number, customer_name, channel, status, notes
  ) VALUES (
    p_org_id, p_branch_id, v_invoice_id, v_shift_id,
    v_invoice_number, p_customer_name, 'pickup', 'pending', 'تذكرة مطبخ من جهاز الكاشير الذري'
  ) RETURNING id INTO v_ticket_id;

  -- Kitchen Ticket Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric)
  LOOP
    v_catalog_id := v_item.catalog_item_id;
    v_quantity := v_item.quantity;

    SELECT * INTO v_catalog FROM catalog_items WHERE id = v_catalog_id;

    INSERT INTO kitchen_ticket_items (
      organization_id, kitchen_ticket_id, menu_item_id, catalog_item_id, name, quantity
    ) VALUES (
      p_org_id, v_ticket_id, v_catalog.menu_item_id, v_catalog.id, v_catalog.name, v_quantity
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invoiceId', v_invoice_id,
    'invoiceNumber', v_invoice_number,
    'kitchenTicketId', v_ticket_id,
    'shiftId', v_shift_id,
    'total', v_total
  );
END;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 025_apply_stock_movement.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Canonical Atomic Stock Movement Database Function
-- This function adjusts branch stock and creates a stock movement record in a single transaction.

CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  p_org_id uuid,
  p_branch_id uuid,
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_unit_cost numeric,
  p_reference text,
  p_idempotency_key text,
  p_notes text,
  p_created_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_id uuid;
  v_current_qty numeric;
  v_new_qty numeric;
  v_movement_id uuid;
BEGIN
  -- 1. Check idempotency for stock_movements
  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM stock_movements
    WHERE organization_id = p_org_id
      AND idempotency_key = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  -- 2. Lock and fetch or insert branch_stock row
  SELECT id, quantity INTO v_stock_id, v_current_qty
  FROM branch_stock
  WHERE organization_id = p_org_id
    AND branch_id = p_branch_id
    AND item_id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity, created_by)
    VALUES (p_org_id, p_branch_id, p_item_id, 0, 0, p_created_by)
    RETURNING id, quantity INTO v_stock_id, v_current_qty;
  END IF;

  v_new_qty := v_current_qty + p_quantity;

  -- 3. Update branch_stock
  UPDATE branch_stock
  SET quantity = v_new_qty,
      updated_at = now()
  WHERE id = v_stock_id;

  -- 4. Insert stock movement
  INSERT INTO stock_movements (
    organization_id, branch_id, item_id, movement_type, quantity,
    unit_cost, total_cost, reference, idempotency_key, notes, created_by
  ) VALUES (
    p_org_id, p_branch_id, p_item_id, p_movement_type::stock_movement_type, p_quantity,
    p_unit_cost, p_quantity * p_unit_cost, p_reference, p_idempotency_key, p_notes, p_created_by
  ) RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object('success', true, 'new_quantity', v_new_qty, 'movement_id', v_movement_id);
END;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 026_composite_keys_and_sequences.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Composite foreign keys for multi-tenant matching integrity
-- and lock-safe document sequence generator.

-- 1. Ensure composite unique constraints on parent tables
ALTER TABLE customer_invoices ADD CONSTRAINT customer_invoices_org_id_unique UNIQUE (organization_id, id);
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_org_id_unique UNIQUE (organization_id, id);
ALTER TABLE transfers ADD CONSTRAINT transfers_org_id_unique UNIQUE (organization_id, id);
ALTER TABLE stock_counts ADD CONSTRAINT stock_counts_org_id_unique UNIQUE (organization_id, id);
ALTER TABLE kitchen_tickets ADD CONSTRAINT kitchen_tickets_org_id_unique UNIQUE (organization_id, id);

-- 2. Add composite foreign key constraints on child tables
ALTER TABLE customer_invoice_items DROP CONSTRAINT IF EXISTS customer_invoice_items_org_id_fk;
ALTER TABLE customer_invoice_items DROP CONSTRAINT IF EXISTS customer_invoice_items_customer_invoice_id_fkey;
ALTER TABLE customer_invoice_items ADD CONSTRAINT customer_invoice_items_org_id_fk
  FOREIGN KEY (organization_id, customer_invoice_id) REFERENCES customer_invoices(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS journal_lines_org_id_fk;
ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS journal_lines_journal_entry_id_fkey;
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_org_id_fk
  FOREIGN KEY (organization_id, journal_entry_id) REFERENCES journal_entries(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE transfer_items DROP CONSTRAINT IF EXISTS transfer_items_org_id_fk;
ALTER TABLE transfer_items DROP CONSTRAINT IF EXISTS transfer_items_transfer_id_fkey;
ALTER TABLE transfer_items ADD CONSTRAINT transfer_items_org_id_fk
  FOREIGN KEY (organization_id, transfer_id) REFERENCES transfers(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE stock_count_items DROP CONSTRAINT IF EXISTS stock_count_items_org_id_fk;
ALTER TABLE stock_count_items DROP CONSTRAINT IF EXISTS stock_count_items_stock_count_id_fkey;
ALTER TABLE stock_count_items ADD CONSTRAINT stock_count_items_org_id_fk
  FOREIGN KEY (organization_id, stock_count_id) REFERENCES stock_counts(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE kitchen_ticket_items DROP CONSTRAINT IF EXISTS kitchen_ticket_items_org_id_fk;
ALTER TABLE kitchen_ticket_items DROP CONSTRAINT IF EXISTS kitchen_ticket_items_kitchen_ticket_id_fkey;
ALTER TABLE kitchen_ticket_items ADD CONSTRAINT kitchen_ticket_items_org_id_fk
  FOREIGN KEY (organization_id, kitchen_ticket_id) REFERENCES kitchen_tickets(organization_id, id) ON DELETE RESTRICT;


-- 3. Document sequences table
CREATE TABLE IF NOT EXISTS public.document_sequences (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  document_type text NOT NULL, -- 'invoice', 'purchase_order', 'supply_invoice', etc.
  year integer NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  PRIMARY KEY (organization_id, branch_id, document_type, year)
);

-- Enable RLS for sequences
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for org members" ON public.document_sequences;
CREATE POLICY "Allow select for org members" ON public.document_sequences
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id)); -- fallback RLS

-- 4. Next sequence number function
CREATE OR REPLACE FUNCTION public.get_next_sequence_number(
  p_org_id uuid,
  p_branch_id uuid,
  p_doc_type text,
  p_prefix text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer;
  v_next_val integer;
  v_seq_row record;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::integer;

  -- Lock row or insert if not exists
  SELECT * INTO v_seq_row
  FROM document_sequences
  WHERE organization_id = p_org_id
    AND (branch_id = p_branch_id OR (branch_id IS NULL AND p_branch_id IS NULL))
    AND document_type = p_doc_type
    AND year = v_year
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Try to insert the sequence row
    INSERT INTO document_sequences (organization_id, branch_id, document_type, year, current_value)
    VALUES (p_org_id, p_branch_id, p_doc_type, v_year, 1)
    ON CONFLICT (organization_id, branch_id, document_type, year) DO UPDATE
      SET current_value = document_sequences.current_value + 1
    RETURNING current_value INTO v_next_val;
  ELSE
    v_next_val := v_seq_row.current_value + 1;
    UPDATE document_sequences
    SET current_value = v_next_val,
        updated_at = now()
    WHERE organization_id = p_org_id
      AND (branch_id = p_branch_id OR (branch_id IS NULL AND p_branch_id IS NULL))
      AND document_type = p_doc_type
      AND year = v_year;
  END IF;

  RETURN p_prefix || TO_CHAR(now(), 'YYYY') || '-' || LPAD(v_next_val::text, 6, '0');
END;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 027_balanced_journal_trigger.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Database-level Balance Enforcement for Journal Entries
-- This enforces that the sum of debits equals the sum of credits for any journal entry.

CREATE OR REPLACE FUNCTION public.verify_journal_entry_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debit_sum numeric;
  v_credit_sum numeric;
  v_je_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_je_id := OLD.journal_entry_id;
  ELSE
    v_je_id := NEW.journal_entry_id;
  END IF;

  -- Calculate the sums for this journal entry
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO v_debit_sum, v_credit_sum
  FROM journal_lines
  WHERE journal_entry_id = v_je_id;

  -- Enforce balance
  IF v_debit_sum <> v_credit_sum THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced: debits (%) must equal credits (%)',
      v_je_id, v_debit_sum, v_credit_sum;
  END IF;

  RETURN NULL;
END;
$$;

-- Create constraint trigger that fires at commit time (DEFERRED)
DROP TRIGGER IF EXISTS trg_verify_journal_entry_balance ON public.journal_lines;
CREATE CONSTRAINT TRIGGER trg_verify_journal_entry_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_journal_entry_balance();

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 028_audit_logs.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Unified Event Log / Audit Log for Critical Restaurant Actions

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid, -- Reference to the acting user
  action text NOT NULL, -- e.g., 'close_shift', 'invite_user', 'change_role', 'manual_stock_override', 'approve_request'
  entity_type text NOT NULL, -- e.g., 'sales_shift', 'user', 'branch_stock', 'account_request'
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow select for org members
DROP POLICY IF EXISTS "audit_logs org read" ON public.audit_logs;
CREATE POLICY "audit_logs org read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships WHERE user_id = auth.uid()
    )
  );

-- Allow insert by system / authenticated users
DROP POLICY IF EXISTS "audit_logs system insert" ON public.audit_logs;
CREATE POLICY "audit_logs system insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships WHERE user_id = auth.uid()
    )
  );

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 029_fix_pos_checkout_atomic_cogs.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Forward-fix POS checkout atomic workflow.
-- Replaces the earlier RPC with a schema-aligned version that calculates real COGS,
-- locks aggregate stock requirements, posts balanced journals, updates summaries,
-- and creates kitchen tickets in the same database transaction.

CREATE OR REPLACE FUNCTION public.pos_checkout_atomic(
  p_org_id uuid,
  p_branch_id uuid,
  p_device_key_id uuid,
  p_device_name text,
  p_customer_name text,
  p_payment_method text,
  p_idempotency_key text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_number text;
  v_shift_id uuid;
  v_ticket_id uuid;
  v_ticket_number text;
  v_item record;
  v_catalog catalog_items%rowtype;
  v_mapping record;
  v_ingredient record;
  v_inventory inventory_items%rowtype;
  v_quantity numeric(14,4);
  v_unit_price numeric(12,4);
  v_deduct_qty numeric(14,4);
  v_unit_cost numeric(12,4);
  v_line_subtotal numeric(12,4);
  v_line_tax numeric(12,4);
  v_line_cost numeric(12,4);
  v_subtotal numeric(12,4) := 0;
  v_tax_total numeric(12,4) := 0;
  v_total numeric(12,4) := 0;
  v_cost_total numeric(12,4) := 0;
  v_stock_qty numeric(14,4);
  v_stock_id uuid;
  v_je_id uuid;
  v_je_number text;
  v_cash_acct_id uuid;
  v_revenue_acct_id uuid;
  v_tax_acct_id uuid;
  v_cogs_acct_id uuid;
  v_inv_acct_id uuid;
  v_impact record;
  v_existing record;
  v_drawer_type text;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب لفواتير الكاشير';
  END IF;

  IF p_payment_method NOT IN ('cash', 'card') THEN
    RAISE EXCEPTION 'طريقة الدفع غير مدعومة في جهاز الكاشير: %', p_payment_method;
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'الفاتورة يجب أن تحتوي على صنف واحد على الأقل';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'pos_checkout:' || p_org_id::text || ':' || p_branch_id::text || ':' || COALESCE(p_device_key_id::text, 'no-device'),
      0
    )
  );

  SELECT id, invoice_number, total, cost_total, shift_id
  INTO v_existing
  FROM public.customer_invoices
  WHERE organization_id = p_org_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing.id IS NOT NULL THEN
    SELECT id INTO v_ticket_id
    FROM public.kitchen_tickets
    WHERE organization_id = p_org_id
      AND customer_invoice_id = v_existing.id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'invoiceId', v_existing.id,
      'invoiceNumber', v_existing.invoice_number,
      'kitchenTicketId', v_ticket_id,
      'shiftId', v_existing.shift_id,
      'total', v_existing.total,
      'costTotal', v_existing.cost_total
    );
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_checkout_lines;
  CREATE TEMP TABLE pg_temp.pos_checkout_lines (
    line_index integer generated always as identity,
    catalog_item_id uuid not null,
    menu_item_id uuid,
    name text not null,
    quantity numeric(14,4) not null,
    unit_price numeric(12,4) not null,
    unit_name text not null,
    tax_rate numeric(8,4) not null,
    line_subtotal numeric(12,4) not null,
    line_tax numeric(12,4) not null,
    line_cost numeric(12,4) not null default 0
  ) ON COMMIT DROP;

  DROP TABLE IF EXISTS pg_temp.pos_checkout_impacts;
  CREATE TEMP TABLE pg_temp.pos_checkout_impacts (
    item_id uuid primary key,
    quantity numeric(14,4) not null default 0,
    unit_cost numeric(12,4) not null default 0,
    total_cost numeric(12,4) not null default 0
  ) ON COMMIT DROP;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric)
  LOOP
    v_quantity := v_item.quantity;

    IF v_item.catalog_item_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'كمية أو صنف غير صالح في الفاتورة';
    END IF;

    SELECT *
    INTO v_catalog
    FROM public.catalog_items
    WHERE id = v_item.catalog_item_id
      AND organization_id = p_org_id
      AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الصنف غير موجود أو غير فعال: %', v_item.catalog_item_id;
    END IF;

    v_unit_price := COALESCE(v_catalog.retail_price, 0);
    v_line_subtotal := round((v_unit_price * v_quantity)::numeric, 4);
    v_line_tax := round((v_line_subtotal * COALESCE(v_catalog.tax_rate, 0) / 100)::numeric, 4);
    v_line_cost := 0;

    IF v_catalog.menu_item_id IS NOT NULL THEN
      FOR v_mapping IN
        SELECT *
        FROM public.menu_item_recipe_mapping
        WHERE organization_id = p_org_id
          AND menu_item_id = v_catalog.menu_item_id
      LOOP
        FOR v_ingredient IN
          SELECT *
          FROM public.recipe_ingredients
          WHERE organization_id = p_org_id
            AND recipe_id = v_mapping.recipe_id
        LOOP
          SELECT *
          INTO v_inventory
          FROM public.inventory_items
          WHERE id = v_ingredient.item_id
            AND organization_id = p_org_id
            AND status = 'active';

          IF NOT FOUND THEN
            RAISE EXCEPTION 'مادة وصفة غير موجودة أو غير فعالة: %', v_ingredient.item_id;
          END IF;

          v_deduct_qty :=
            (v_ingredient.quantity * COALESCE(v_mapping.portion_multiplier, 1) * v_quantity)
            / NULLIF(COALESCE(v_ingredient.yield_percent, 100) / 100, 0);
          v_unit_cost := COALESCE(NULLIF(v_ingredient.unit_cost, 0), NULLIF(v_inventory.average_cost, 0), v_inventory.last_purchase_price, 0);
          v_line_cost := v_line_cost + round((v_deduct_qty * v_unit_cost)::numeric, 4);

          INSERT INTO pg_temp.pos_checkout_impacts (item_id, quantity, unit_cost, total_cost)
          VALUES (
            v_ingredient.item_id,
            v_deduct_qty,
            v_unit_cost,
            round((v_deduct_qty * v_unit_cost)::numeric, 4)
          )
          ON CONFLICT (item_id) DO UPDATE
            SET quantity = pos_checkout_impacts.quantity + excluded.quantity,
                total_cost = pos_checkout_impacts.total_cost + excluded.total_cost,
                unit_cost = CASE
                  WHEN pos_checkout_impacts.quantity + excluded.quantity = 0 THEN excluded.unit_cost
                  ELSE round(
                    ((pos_checkout_impacts.total_cost + excluded.total_cost)
                      / NULLIF(pos_checkout_impacts.quantity + excluded.quantity, 0))::numeric,
                    4
                  )
                END;
        END LOOP;
      END LOOP;
    END IF;

    INSERT INTO pg_temp.pos_checkout_lines (
      catalog_item_id, menu_item_id, name, quantity, unit_price, unit_name,
      tax_rate, line_subtotal, line_tax, line_cost
    )
    VALUES (
      v_catalog.id,
      v_catalog.menu_item_id,
      v_catalog.name,
      v_quantity,
      v_unit_price,
      COALESCE(v_catalog.main_unit, 'قطعة'),
      COALESCE(v_catalog.tax_rate, 0),
      v_line_subtotal,
      v_line_tax,
      v_line_cost
    );

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax;
    v_cost_total := v_cost_total + v_line_cost;
  END LOOP;

  v_subtotal := round(v_subtotal, 4);
  v_tax_total := round(v_tax_total, 4);
  v_cost_total := round(v_cost_total, 4);
  v_total := v_subtotal + v_tax_total;

  FOR v_impact IN
    SELECT item_id, quantity, unit_cost, total_cost
    FROM pg_temp.pos_checkout_impacts
    WHERE quantity > 0
    ORDER BY item_id
  LOOP
    SELECT id, quantity
    INTO v_stock_id, v_stock_qty
    FROM public.branch_stock
    WHERE organization_id = p_org_id
      AND branch_id = p_branch_id
      AND item_id = v_impact.item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity)
      VALUES (p_org_id, p_branch_id, v_impact.item_id, 0, 0)
      RETURNING id, quantity INTO v_stock_id, v_stock_qty;
    END IF;

    IF v_stock_qty < v_impact.quantity THEN
      RAISE EXCEPTION 'لا توجد كمية كافية في المخزون للمادة %',
        (SELECT name FROM public.inventory_items WHERE id = v_impact.item_id);
    END IF;
  END LOOP;

  SELECT id
  INTO v_shift_id
  FROM public.sales_shifts
  WHERE organization_id = p_org_id
    AND branch_id = p_branch_id
    AND status = 'open'
    AND device_key_id = p_device_key_id
  ORDER BY opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_shift_id IS NULL THEN
    INSERT INTO public.sales_shifts (
      organization_id, branch_id, device_key_id, cashier_name, status, opening_cash, expected_cash
    )
    VALUES (
      p_org_id, p_branch_id, p_device_key_id, COALESCE(NULLIF(p_device_name, ''), 'كاشير'), 'open', 0, 0
    )
    RETURNING id INTO v_shift_id;

    INSERT INTO public.cash_drawer_entries (
      organization_id, branch_id, shift_id, entry_type, amount, memo
    )
    VALUES (
      p_org_id, p_branch_id, v_shift_id, 'opening', 0, 'رصيد افتتاحي تلقائي للوردية'
    );
  END IF;

  v_invoice_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'invoice', 'POS-');

  INSERT INTO public.customer_invoices (
    organization_id, branch_id, invoice_number, customer_name, status,
    payment_method, channel, subtotal, discount, tax_total, total,
    cost_total, gross_profit, idempotency_key, shift_id, notes
  )
  VALUES (
    p_org_id, p_branch_id, v_invoice_number, COALESCE(NULLIF(p_customer_name, ''), 'عميل سفري سريع'), 'paid',
    p_payment_method::payment_method, 'pickup', v_subtotal, 0, v_tax_total, v_total,
    v_cost_total, v_subtotal - v_cost_total, p_idempotency_key, v_shift_id,
    'فاتورة كاشير ذرية'
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.customer_invoice_items (
    organization_id, customer_invoice_id, catalog_item_id, menu_item_id,
    name, quantity, unit_price, unit_name, unit_factor, discount,
    tax_rate, cost_total, gross_profit
  )
  SELECT
    p_org_id, v_invoice_id, catalog_item_id, menu_item_id,
    name, quantity, unit_price, unit_name, 1, 0,
    tax_rate, line_cost, line_subtotal - line_cost
  FROM pg_temp.pos_checkout_lines
  ORDER BY line_index;

  FOR v_impact IN
    SELECT item_id, quantity, unit_cost, total_cost
    FROM pg_temp.pos_checkout_impacts
    WHERE quantity > 0
    ORDER BY item_id
  LOOP
    UPDATE public.branch_stock
    SET quantity = quantity - v_impact.quantity,
        updated_at = now()
    WHERE organization_id = p_org_id
      AND branch_id = p_branch_id
      AND item_id = v_impact.item_id;

    INSERT INTO public.stock_movements (
      organization_id, branch_id, item_id, movement_type, quantity,
      unit_cost, source_doc_type, source_doc_id, idempotency_key, notes
    )
    VALUES (
      p_org_id, p_branch_id, v_impact.item_id, 'sale_usage', -v_impact.quantity,
      v_impact.unit_cost, 'customer_invoice', v_invoice_id,
      v_invoice_id::text || ':' || v_impact.item_id::text || ':sale_usage',
      'خصم تلقائي للمبيعات الذرية - فاتورة ' || v_invoice_number
    );
  END LOOP;

  INSERT INTO public.customer_invoice_payments (
    organization_id, customer_invoice_id, payment_method, amount
  )
  VALUES (
    p_org_id, v_invoice_id, p_payment_method::payment_method, v_total
  );

  v_drawer_type := CASE WHEN p_payment_method = 'cash' THEN 'cash_sale' ELSE 'card_sale' END;

  INSERT INTO public.cash_drawer_entries (
    organization_id, branch_id, shift_id, entry_type, amount,
    reference_doc_type, reference_doc_id, memo
  )
  VALUES (
    p_org_id, p_branch_id, v_shift_id, v_drawer_type, v_total,
    'customer_invoice', v_invoice_id, 'تحصيل تلقائي للمبيعات الذرية'
  );

  UPDATE public.sales_shifts
  SET cash_sales = cash_sales + CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END,
      card_sales = card_sales + CASE WHEN p_payment_method = 'card' THEN v_total ELSE 0 END,
      expected_cash = expected_cash + CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END,
      updated_at = now()
  WHERE id = v_shift_id
    AND organization_id = p_org_id;

  INSERT INTO public.sales_daily_summaries (
    organization_id, branch_id, summary_date, channel,
    orders_count, sales_total, ingredient_cost_total
  )
  VALUES (
    p_org_id, p_branch_id, current_date, 'pickup',
    1, v_total, v_cost_total
  )
  ON CONFLICT (organization_id, branch_id, summary_date, channel) DO UPDATE
    SET orders_count = public.sales_daily_summaries.orders_count + 1,
        sales_total = public.sales_daily_summaries.sales_total + excluded.sales_total,
        ingredient_cost_total = public.sales_daily_summaries.ingredient_cost_total + excluded.ingredient_cost_total,
        updated_at = now();

  PERFORM public.ensure_default_chart_accounts(p_org_id);

  SELECT id INTO v_cash_acct_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id
    AND system_key = CASE WHEN p_payment_method = 'cash' THEN 'cash' ELSE 'bank' END
    AND is_active = true;

  SELECT id INTO v_revenue_acct_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id
    AND system_key = 'sales_revenue'
    AND is_active = true;

  SELECT id INTO v_tax_acct_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id
    AND system_key = 'sales_tax_payable'
    AND is_active = true;

  SELECT id INTO v_cogs_acct_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id
    AND system_key = 'cogs'
    AND is_active = true;

  SELECT id INTO v_inv_acct_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id
    AND system_key = 'inventory'
    AND is_active = true;

  IF v_cash_acct_id IS NULL OR v_revenue_acct_id IS NULL THEN
    RAISE EXCEPTION 'Required POS revenue or cash account not found';
  END IF;

  IF v_cost_total > 0 AND (v_cogs_acct_id IS NULL OR v_inv_acct_id IS NULL) THEN
    RAISE EXCEPTION 'COGS or inventory account not found';
  END IF;

  v_je_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'journal_entry', 'JE-');

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status
  )
  VALUES (
    p_org_id, p_branch_id, v_je_number, current_date,
    'customer_invoice', v_invoice_id, 'قيد تلقائي لمبيعات الكاشير - فاتورة ' || v_invoice_number, 'posted'
  )
  RETURNING id INTO v_je_id;

  INSERT INTO public.journal_lines (
    organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
  )
  VALUES
    (p_org_id, v_je_id, v_cash_acct_id, p_branch_id, v_total, 0, 'تحصيل فاتورة ' || v_invoice_number),
    (p_org_id, v_je_id, v_revenue_acct_id, p_branch_id, 0, v_subtotal, 'مبيعات فاتورة ' || v_invoice_number);

  IF v_tax_total > 0 THEN
    IF v_tax_acct_id IS NULL THEN
      RAISE EXCEPTION 'Sales tax payable account not found';
    END IF;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    )
    VALUES (
      p_org_id, v_je_id, v_tax_acct_id, p_branch_id, 0, v_tax_total, 'ضريبة فاتورة ' || v_invoice_number
    );
  END IF;

  IF v_cost_total > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    )
    VALUES
      (p_org_id, v_je_id, v_cogs_acct_id, p_branch_id, v_cost_total, 0, 'تكلفة مبيعات فاتورة ' || v_invoice_number),
      (p_org_id, v_je_id, v_inv_acct_id, p_branch_id, 0, v_cost_total, 'خصم مخزون فاتورة ' || v_invoice_number);
  END IF;

  v_ticket_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'kitchen_ticket', 'KOT-');

  INSERT INTO public.kitchen_tickets (
    organization_id, branch_id, customer_invoice_id, shift_id,
    ticket_number, customer_name, channel, status, notes
  )
  VALUES (
    p_org_id, p_branch_id, v_invoice_id, v_shift_id,
    v_ticket_number, COALESCE(NULLIF(p_customer_name, ''), 'عميل سفري سريع'), 'pickup', 'pending',
    'تذكرة مطبخ من جهاز الكاشير الذري - فاتورة ' || v_invoice_number
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.kitchen_ticket_items (
    organization_id, kitchen_ticket_id, menu_item_id, catalog_item_id, name, quantity
  )
  SELECT
    p_org_id, v_ticket_id, menu_item_id, catalog_item_id, name, quantity
  FROM pg_temp.pos_checkout_lines
  WHERE menu_item_id IS NOT NULL
  ORDER BY line_index;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'invoiceId', v_invoice_id,
    'invoiceNumber', v_invoice_number,
    'kitchenTicketId', v_ticket_id,
    'shiftId', v_shift_id,
    'total', v_total,
    'costTotal', v_cost_total
  );
END;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 030_block_destructive_financial_inventory_deletes.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Block destructive deletes for financial and inventory history at the final
-- migration position. Operational corrections must be represented by
-- archive/void/reversal/update workflows, not by physical row removal.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'branch_stock',
    'stock_movements',
    'stock_counts',
    'stock_count_items',
    'waste_logs',
    'transfers',
    'transfer_items',
    'purchase_orders',
    'purchase_order_items',
    'invoices',
    'invoice_items',
    'customer_invoices',
    'customer_invoice_items',
    'customer_invoice_payments',
    'supplier_price_history',
    'sales_shifts',
    'cash_drawer_entries',
    'chart_of_accounts',
    'journal_entries',
    'journal_lines',
    'kitchen_tickets',
    'kitchen_ticket_items',
    'production_orders',
    'production_order_materials'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('drop policy if exists %I on public.%I', target_table || ' org delete', target_table);
      execute format('drop policy if exists %I on public.%I', target_table || ' branch delete', target_table);
      execute format('drop policy if exists %I on public.%I', target_table || ' org scoped', target_table);
    end if;
  end loop;
end $$;

drop policy if exists "sales shifts owner write" on public.sales_shifts;
drop policy if exists "cash drawer owner write" on public.cash_drawer_entries;
drop policy if exists "kitchen tickets kitchen write" on public.kitchen_tickets;
drop policy if exists "kitchen ticket items kitchen write" on public.kitchen_ticket_items;
drop policy if exists "production orders kitchen write" on public.production_orders;
drop policy if exists "production materials kitchen write" on public.production_order_materials;

create policy "sales shifts owner insert" on public.sales_shifts
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[])
    or public.is_super_admin()
  );

create policy "sales shifts owner update" on public.sales_shifts
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[])
    or public.is_super_admin()
  );

create policy "cash drawer owner insert" on public.cash_drawer_entries
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[])
    or public.is_super_admin()
  );

create policy "cash drawer owner update" on public.cash_drawer_entries
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[])
    or public.is_super_admin()
  );

create policy "production orders kitchen insert" on public.production_orders
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[])
    or public.is_super_admin()
  );

create policy "production orders kitchen update" on public.production_orders
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[])
    or public.is_super_admin()
  );

create policy "kitchen tickets kitchen insert" on public.kitchen_tickets
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[])
    or public.is_super_admin()
  );

create policy "kitchen tickets kitchen update" on public.kitchen_tickets
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[])
    or public.is_super_admin()
  );

create policy "kitchen ticket items kitchen insert" on public.kitchen_ticket_items
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[])
    or public.is_super_admin()
  );

create policy "kitchen ticket items kitchen update" on public.kitchen_ticket_items
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[])
    or public.is_super_admin()
  );

create policy "production materials kitchen insert" on public.production_order_materials
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[])
    or public.is_super_admin()
  );

create policy "production materials kitchen update" on public.production_order_materials
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[])
    or public.is_super_admin()
  );

alter table public.customer_invoice_items
  drop constraint if exists customer_invoice_items_customer_invoice_id_fkey,
  drop constraint if exists customer_invoice_items_org_id_fk,
  add constraint customer_invoice_items_org_id_fk
    foreign key (organization_id, customer_invoice_id)
    references public.customer_invoices(organization_id, id)
    on delete restrict;

alter table public.customer_invoice_payments
  drop constraint if exists customer_invoice_payments_customer_invoice_id_fkey,
  drop constraint if exists customer_invoice_payments_org_id_fk,
  add constraint customer_invoice_payments_org_id_fk
    foreign key (organization_id, customer_invoice_id)
    references public.customer_invoices(organization_id, id)
    on delete restrict;

alter table public.invoice_items
  drop constraint if exists invoice_items_invoice_id_fkey,
  add constraint invoice_items_invoice_id_fkey
    foreign key (invoice_id)
    references public.invoices(id)
    on delete restrict;

alter table public.journal_lines
  drop constraint if exists journal_lines_journal_entry_id_fkey,
  drop constraint if exists journal_lines_org_id_fk,
  add constraint journal_lines_org_id_fk
    foreign key (organization_id, journal_entry_id)
    references public.journal_entries(organization_id, id)
    on delete restrict;

alter table public.transfer_items
  drop constraint if exists transfer_items_transfer_id_fkey,
  drop constraint if exists transfer_items_org_id_fk,
  add constraint transfer_items_org_id_fk
    foreign key (organization_id, transfer_id)
    references public.transfers(organization_id, id)
    on delete restrict;

alter table public.stock_count_items
  drop constraint if exists stock_count_items_stock_count_id_fkey,
  drop constraint if exists stock_count_items_org_id_fk,
  add constraint stock_count_items_org_id_fk
    foreign key (organization_id, stock_count_id)
    references public.stock_counts(organization_id, id)
    on delete restrict;

alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_purchase_order_id_fkey,
  add constraint purchase_order_items_purchase_order_id_fkey
    foreign key (purchase_order_id)
    references public.purchase_orders(id)
    on delete restrict;

alter table public.cash_drawer_entries
  drop constraint if exists cash_drawer_entries_shift_id_fkey,
  add constraint cash_drawer_entries_shift_id_fkey
    foreign key (shift_id)
    references public.sales_shifts(id)
    on delete restrict;

alter table public.kitchen_tickets
  drop constraint if exists kitchen_tickets_customer_invoice_id_fkey,
  add constraint kitchen_tickets_customer_invoice_id_fkey
    foreign key (customer_invoice_id)
    references public.customer_invoices(id)
    on delete set null;

alter table public.kitchen_ticket_items
  drop constraint if exists kitchen_ticket_items_kitchen_ticket_id_fkey,
  drop constraint if exists kitchen_ticket_items_org_id_fk,
  add constraint kitchen_ticket_items_org_id_fk
    foreign key (organization_id, kitchen_ticket_id)
    references public.kitchen_tickets(organization_id, id)
    on delete restrict;

alter table public.production_order_materials
  drop constraint if exists production_order_materials_production_order_id_fkey,
  add constraint production_order_materials_production_order_id_fkey
    foreign key (production_order_id)
    references public.production_orders(id)
    on delete restrict;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 031_invoice_counters_and_rls.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 1. Tighten catalog_items write permissions
DROP POLICY IF EXISTS "catalog_items org write" ON catalog_items;
CREATE POLICY "catalog_items org write" ON catalog_items
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','accountant']::app_role[]))
  WITH CHECK (public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','accountant']::app_role[]));

-- 2. Create invoice_counters for concurrency-safe invoice numbers
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  last_invoice_number integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (organization_id, branch_id)
);

-- Enable RLS
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

-- Allow read for org members
DROP POLICY IF EXISTS "invoice_counters org read" ON invoice_counters;
CREATE POLICY "invoice_counters org read" ON invoice_counters
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

-- Allow write for system/authenticated users within org
DROP POLICY IF EXISTS "invoice_counters org write" ON invoice_counters;
CREATE POLICY "invoice_counters org write" ON invoice_counters
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','inventory_manager']::app_role[]))
  WITH CHECK (public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','inventory_manager']::app_role[]));

-- Function to safely get next invoice number
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_org_id uuid, p_branch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_num integer;
BEGIN
  INSERT INTO public.invoice_counters (organization_id, branch_id, last_invoice_number)
  VALUES (p_org_id, p_branch_id, 1)
  ON CONFLICT (organization_id, branch_id)
  DO UPDATE SET
    last_invoice_number = public.invoice_counters.last_invoice_number + 1,
    updated_at = now()
  RETURNING last_invoice_number INTO v_next_num;

  RETURN v_next_num;
END;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 032_pos_settings_and_catalog_stock.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 032_pos_settings_and_catalog_stock.sql
-- إعدادات نقطة البيع (POS) + عمود صورة الأصناف
-- المبدأ: الكاشير يبيع فقط؛ الإرجاع والخصم للمدير.

-- ═══════════════════════════════════════════════════════
-- 1) جدول إعدادات نقطة البيع لكل منظمة
-- ═══════════════════════════════════════════════════════
create table if not exists public.pos_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  currency text not null default 'ILS',
  tax_rate numeric(8,4) not null default 0,
  receipt_header text,
  receipt_footer text not null default 'شكراً لتعاملكم معنا',
  max_cashier_discount numeric(5,2) not null default 0,
  allow_cashier_refund boolean not null default false,
  require_shift boolean not null default true,
  print_on_checkout boolean not null default true,
  receipt_width text not null default '80mm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pos_settings is
  'إعدادات نقطة البيع لكل منظمة: العملة، الضريبة، نص الإيصال، حد خصم الكاشير، صلاحية الإرجاع، إلزام الوردية.';

-- تفعيل RLS
alter table public.pos_settings enable row level security;

drop policy if exists "pos_settings org read" on public.pos_settings;
create policy "pos_settings org read" on public.pos_settings
  for select to authenticated
  using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "pos_settings owner write" on public.pos_settings;
create policy "pos_settings owner write" on public.pos_settings
  for all to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[])
    or public.is_super_admin()
  );

-- ═══════════════════════════════════════════════════════
-- 2) عمود صورة الأصناف في catalog_items
-- ═══════════════════════════════════════════════════════
alter table public.catalog_items
  add column if not exists image_url text;

comment on column public.catalog_items.image_url is
  'رابط صورة الصنف لعرضها في نقطة البيع (بديل مكمل لـ image_path).';

-- ═══════════════════════════════════════════════════════
-- 3) تحديث updated_at تلقائياً
-- ═══════════════════════════════════════════════════════
drop trigger if exists trg_pos_settings_updated_at on public.pos_settings;
create trigger trg_pos_settings_updated_at
  before update on public.pos_settings
  for each row execute function set_updated_at();

-- ملاحظة: عكس المخزون عند الإرجاع وتعديل pos_checkout_atomic لدعم الخصم
-- على مستوى الفاتورة مؤجلان لمرحلة لاحقة (يحتاجان RPC عكسي/تعديل).

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 033_erp_accounting_expansion.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 034_fix_accounting_erp_and_pos.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Extend payment_method enum values
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'receivable';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'wallet';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'gift_card';

-- Rename existing system keys safely
UPDATE public.chart_of_accounts SET system_key = 'cash_on_hand' WHERE system_key = 'cash';
UPDATE public.chart_of_accounts SET system_key = 'bank_card' WHERE system_key = 'bank';
UPDATE public.chart_of_accounts SET system_key = 'output_tax_payable' WHERE system_key = 'sales_tax_payable';
UPDATE public.chart_of_accounts SET system_key = 'operating_expense_other' WHERE system_key = 'operating_expense';

-- Add new columns for tracking provisional COGS and negative stock
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS is_negative_stock boolean NOT NULL DEFAULT false;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS is_provisional_cost boolean NOT NULL DEFAULT false;
ALTER TABLE public.journal_lines ADD COLUMN IF NOT EXISTS is_provisional_cost boolean NOT NULL DEFAULT false;
ALTER TABLE public.customer_invoices ADD COLUMN IF NOT EXISTS is_provisional_cogs boolean NOT NULL DEFAULT false;

-- Add inventory costing policy to accounting settings
ALTER TABLE public.accounting_settings ADD COLUMN IF NOT EXISTS inventory_costing_policy text NOT NULL DEFAULT 'strict_no_negative' CHECK (inventory_costing_policy IN ('strict_no_negative', 'allow_negative_with_last_cost', 'allow_negative_with_provisional_adjustment'));

-- Cleanup historical journal lines where cost_center_id was incorrectly applied to balance sheet accounts
UPDATE public.journal_lines jl
SET cost_center_id = NULL
FROM public.chart_of_accounts coa
WHERE jl.account_id = coa.id
  AND coa.account_type IN ('asset', 'liability', 'equity');

-- Extend default chart of accounts function
CREATE OR REPLACE FUNCTION public.ensure_default_chart_accounts(target_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chart_of_accounts (organization_id, code, name, account_type, normal_balance, system_key)
  VALUES
    (target_org_id, '1010', 'الصندوق', 'asset', 'debit', 'cash_on_hand'),
    (target_org_id, '1020', 'البنك / بطاقات', 'asset', 'debit', 'bank_card'),
    (target_org_id, '1150', 'ذمم العملاء', 'asset', 'debit', 'accounts_receivable'),
    (target_org_id, '1200', 'ضريبة القيمة المضافة - مدخلات', 'asset', 'debit', 'input_tax_receivable'),
    (target_org_id, '1300', 'المخزون', 'asset', 'debit', 'inventory'),
    (target_org_id, '2100', 'ضريبة القيمة المضافة - مخرجات', 'liability', 'credit', 'output_tax_payable'),
    (target_org_id, '2200', 'ذمم الموردين', 'liability', 'credit', 'accounts_payable'),
    (target_org_id, '2250', 'بضاعة مستلمة غير مفوترة', 'liability', 'credit', 'goods_received_not_invoiced'),
    (target_org_id, '3000', 'رأس المال', 'equity', 'credit', 'owner_equity'),
    (target_org_id, '4100', 'مبيعات المطعم', 'revenue', 'credit', 'sales_revenue'),
    (target_org_id, '4150', 'خصم مسموح به (خصومات المبيعات)', 'revenue', 'debit', 'sales_discounts'),
    (target_org_id, '4190', 'مرتجعات المبيعات', 'revenue', 'debit', 'sales_returns'),
    (target_org_id, '4210', 'إيرادات رسوم الخدمة', 'revenue', 'credit', 'service_fee_revenue'),
    (target_org_id, '4220', 'إيرادات رسوم التوصيل', 'revenue', 'credit', 'delivery_revenue'),
    (target_org_id, '5100', 'تكلفة البضاعة المباعة', 'cogs', 'debit', 'cogs'),
    (target_org_id, '5150', 'فروقات جرد المخزون', 'cogs', 'debit', 'inventory_variance'),
    (target_org_id, '5900', 'فروقات الصندوق', 'expense', 'debit', 'cash_over_short'),
    (target_org_id, '6110', 'مصروف إيجار', 'expense', 'debit', 'rent_expense'),
    (target_org_id, '6120', 'مصروف رواتب وأجور', 'expense', 'debit', 'salaries_expense'),
    (target_org_id, '6130', 'مصروف كهرباء ومياه وهاتف', 'expense', 'debit', 'utilities_expense'),
    (target_org_id, '6140', 'مصروف صيانة وإصلاح', 'expense', 'debit', 'maintenance_expense'),
    (target_org_id, '6150', 'مصروف تسويق وإعلان', 'expense', 'debit', 'marketing_expense'),
    (target_org_id, '6160', 'مصروف عمولات منصات التوصيل', 'expense', 'debit', 'delivery_platform_commission_expense'),
    (target_org_id, '6170', 'مصروف أدوات ومواد تنظيف', 'expense', 'debit', 'cleaning_supplies_expense'),
    (target_org_id, '6190', 'مصروفات تشغيلية أخرى', 'expense', 'debit', 'operating_expense_other')
  ON CONFLICT (organization_id, system_key) DO UPDATE
    SET name = excluded.name,
        code = excluded.code,
        account_type = excluded.account_type,
        normal_balance = excluded.normal_balance,
        is_active = true,
        updated_at = now();
END;
$$;

-- Atomic POS checkout function
CREATE OR REPLACE FUNCTION public.pos_checkout_atomic(
  p_org_id uuid,
  p_branch_id uuid,
  p_device_key_id uuid,
  p_device_name text,
  p_customer_name text,
  p_payment_method text,
  p_idempotency_key text,
  p_items jsonb,
  p_discount numeric DEFAULT 0,
  p_service_fee numeric DEFAULT 0,
  p_delivery_fee numeric DEFAULT 0,
  p_payments jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_number text;
  v_shift_id uuid;
  v_ticket_id uuid;
  v_ticket_number text;
  v_item record;
  v_catalog catalog_items%rowtype;
  v_mapping record;
  v_ingredient record;
  v_inventory inventory_items%rowtype;
  v_quantity numeric(14,4);
  v_unit_price numeric(12,4);
  v_deduct_qty numeric(14,4);
  v_unit_cost numeric(12,4);
  v_line_subtotal numeric(12,4);
  v_line_tax numeric(12,4);
  v_line_cost numeric(12,4);
  v_subtotal numeric(12,4) := 0;
  v_tax_total numeric(12,4) := 0;
  v_total numeric(12,4) := 0;
  v_cost_total numeric(12,4) := 0;
  v_stock_qty numeric(14,4);
  v_stock_id uuid;
  v_je_id uuid;
  v_je_number text;
  v_acct_id uuid;
  
  -- Account IDs
  v_cash_acct_id uuid;
  v_card_acct_id uuid;
  v_receivable_acct_id uuid;
  v_revenue_acct_id uuid;
  v_discount_acct_id uuid;
  v_tax_acct_id uuid;
  v_service_acct_id uuid;
  v_delivery_acct_id uuid;
  v_cogs_acct_id uuid;
  v_inv_acct_id uuid;

  v_impact record;
  v_existing record;
  v_drawer_type text;
  v_pay_line record;
  v_payment_sum numeric(12,4) := 0;

  -- Costing Policy variables
  v_policy text;
  v_allow_negative boolean;
  v_is_negative_stock boolean := false;
  v_is_provisional_cost boolean := false;
  v_any_provisional boolean := false;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب لفواتير الكاشير';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'الفاتورة يجب أن تحتوي على صنف واحد على الأقل';
  END IF;

  -- Load costing policy
  SELECT allow_negative_stock, COALESCE(inventory_costing_policy, 'strict_no_negative')
  INTO v_allow_negative, v_policy
  FROM public.accounting_settings
  WHERE organization_id = p_org_id;

  IF v_policy IS NULL THEN
    v_allow_negative := false;
    v_policy := 'strict_no_negative';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'pos_checkout:' || p_org_id::text || ':' || p_branch_id::text || ':' || COALESCE(p_device_key_id::text, 'no-device'),
      0
    )
  );

  SELECT id, invoice_number, total, cost_total, shift_id
  INTO v_existing
  FROM public.customer_invoices
  WHERE organization_id = p_org_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing.id IS NOT NULL THEN
    SELECT id INTO v_ticket_id
    FROM public.kitchen_tickets
    WHERE organization_id = p_org_id
      AND customer_invoice_id = v_existing.id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'invoiceId', v_existing.id,
      'invoiceNumber', v_existing.invoice_number,
      'kitchenTicketId', v_ticket_id,
      'shiftId', v_existing.shift_id,
      'total', v_existing.total,
      'costTotal', v_existing.cost_total
    );
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_checkout_lines;
  CREATE TEMP TABLE pg_temp.pos_checkout_lines (
    line_index integer generated always as identity,
    catalog_item_id uuid not null,
    menu_item_id uuid,
    name text not null,
    quantity numeric(14,4) not null,
    unit_price numeric(12,4) not null,
    unit_name text not null,
    tax_rate numeric(8,4) not null,
    line_subtotal numeric(12,4) not null,
    line_tax numeric(12,4) not null,
    line_cost numeric(12,4) not null default 0
  ) ON COMMIT DROP;

  DROP TABLE IF EXISTS pg_temp.pos_checkout_impacts;
  CREATE TEMP TABLE pg_temp.pos_checkout_impacts (
    item_id uuid primary key,
    quantity numeric(14,4) not null default 0,
    unit_cost numeric(12,4) not null default 0,
    total_cost numeric(12,4) not null default 0,
    is_negative_stock boolean not null default false,
    is_provisional_cost boolean not null default false
  ) ON COMMIT DROP;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric)
  LOOP
    v_quantity := v_item.quantity;

    IF v_item.catalog_item_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'كمية أو صنف غير صالح في الفاتورة';
    END IF;

    SELECT *
    INTO v_catalog
    FROM public.catalog_items
    WHERE id = v_item.catalog_item_id
      AND organization_id = p_org_id
      AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الصنف غير موجود أو غير فعال: %', v_item.catalog_item_id;
    END IF;

    v_unit_price := COALESCE(v_catalog.retail_price, 0);
    v_line_subtotal := round((v_unit_price * v_quantity)::numeric, 4);
    v_line_tax := round((v_line_subtotal * COALESCE(v_catalog.tax_rate, 0) / 100)::numeric, 4);
    v_line_cost := 0;

    IF v_catalog.menu_item_id IS NOT NULL THEN
      FOR v_mapping IN
        SELECT *
        FROM public.menu_item_recipe_mapping
        WHERE organization_id = p_org_id
          AND menu_item_id = v_catalog.menu_item_id
      LOOP
        FOR v_ingredient IN
          SELECT *
          FROM public.recipe_ingredients
          WHERE organization_id = p_org_id
            AND recipe_id = v_mapping.recipe_id
        LOOP
          SELECT *
          INTO v_inventory
          FROM public.inventory_items
          WHERE id = v_ingredient.item_id
            AND organization_id = p_org_id
            AND status = 'active';

          IF NOT FOUND THEN
            RAISE EXCEPTION 'مادة وصفة غير موجودة أو غير فعالة: %', v_ingredient.item_id;
          END IF;

          v_deduct_qty :=
            (v_ingredient.quantity * COALESCE(v_mapping.portion_multiplier, 1) * v_quantity)
            / NULLIF(COALESCE(v_ingredient.yield_percent, 100) / 100, 0);
          
          -- Base Costing
          v_unit_cost := COALESCE(NULLIF(v_ingredient.unit_cost, 0), NULLIF(v_inventory.average_cost, 0), v_inventory.last_purchase_price, 0);
          
          -- Flag if cost is missing (truly zero or provisional fallback)
          v_is_provisional_cost := false;
          IF v_unit_cost = 0 THEN
            v_unit_cost := 0.1; -- fallback recipe cost
            v_is_provisional_cost := true;
          END IF;

          -- Check stock availability
          SELECT quantity INTO v_stock_qty
          FROM public.branch_stock
          WHERE organization_id = p_org_id
            AND branch_id = p_branch_id
            AND item_id = v_ingredient.item_id;

          IF NOT FOUND THEN
            v_stock_qty := 0;
          END IF;

          v_is_negative_stock := false;
          IF v_stock_qty < v_deduct_qty THEN
            v_is_negative_stock := true;
            v_is_provisional_cost := true;
            v_any_provisional := true;
          END IF;

          v_line_cost := v_line_cost + round((v_deduct_qty * v_unit_cost)::numeric, 4);

          INSERT INTO pg_temp.pos_checkout_impacts (item_id, quantity, unit_cost, total_cost, is_negative_stock, is_provisional_cost)
          VALUES (
            v_ingredient.item_id,
            v_deduct_qty,
            v_unit_cost,
            round((v_deduct_qty * v_unit_cost)::numeric, 4),
            v_is_negative_stock,
            v_is_provisional_cost
          )
          ON CONFLICT (item_id) DO UPDATE
            SET quantity = pos_checkout_impacts.quantity + excluded.quantity,
                total_cost = pos_checkout_impacts.total_cost + excluded.total_cost,
                is_negative_stock = pos_checkout_impacts.is_negative_stock OR excluded.is_negative_stock,
                is_provisional_cost = pos_checkout_impacts.is_provisional_cost OR excluded.is_provisional_cost,
                unit_cost = CASE
                  WHEN pos_checkout_impacts.quantity + excluded.quantity = 0 THEN excluded.unit_cost
                  ELSE round(
                    ((pos_checkout_impacts.total_cost + excluded.total_cost)
                      / NULLIF(pos_checkout_impacts.quantity + excluded.quantity, 0))::numeric,
                    4
                  )
                END;
        END LOOP;
      END LOOP;
    END IF;

    INSERT INTO pg_temp.pos_checkout_lines (
      catalog_item_id, menu_item_id, name, quantity, unit_price, unit_name,
      tax_rate, line_subtotal, line_tax, line_cost
    )
    VALUES (
      v_catalog.id,
      v_catalog.menu_item_id,
      v_catalog.name,
      v_quantity,
      v_unit_price,
      COALESCE(v_catalog.main_unit, 'قطعة'),
      COALESCE(v_catalog.tax_rate, 0),
      v_line_subtotal,
      v_line_tax,
      v_line_cost
    );

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax;
    v_cost_total := v_cost_total + v_line_cost;
  END LOOP;

  v_subtotal := round(v_subtotal, 4);
  v_tax_total := round(v_tax_total, 4);
  v_cost_total := round(v_cost_total, 4);
  
  -- Calculate total using formula: Subtotal - Discount + Tax + ServiceFee + DeliveryFee
  v_total := round(v_subtotal - COALESCE(p_discount, 0) + v_tax_total + COALESCE(p_service_fee, 0) + COALESCE(p_delivery_fee, 0), 4);
  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  -- Validate stock constraints under costing policy
  FOR v_impact IN
    SELECT * FROM pg_temp.pos_checkout_impacts
  LOOP
    SELECT quantity INTO v_stock_qty
    FROM public.branch_stock
    WHERE organization_id = p_org_id
      AND branch_id = p_branch_id
      AND item_id = v_impact.item_id;

    IF NOT FOUND THEN
      v_stock_qty := 0;
    END IF;

    IF v_stock_qty < v_impact.quantity THEN
      IF NOT v_allow_negative OR v_policy = 'strict_no_negative' THEN
        RAISE EXCEPTION 'لا توجد كمية كافية في المخزون للمادة %',
          (SELECT name FROM public.inventory_items WHERE id = v_impact.item_id);
      END IF;
    END IF;
  END LOOP;

  -- Validate payments
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    SELECT sum(round((val->>'amount')::numeric, 4))
    INTO v_payment_sum
    FROM jsonb_array_elements(p_payments) AS val;

    IF ABS(v_payment_sum - v_total) > 0.01 THEN
      RAISE EXCEPTION 'مجموع المدفوعات (%) لا يساوي إجمالي الفاتورة (%)', v_payment_sum, v_total;
    END IF;
  END IF;

  -- Open shift or fetch shift
  SELECT id INTO v_shift_id
  FROM public.sales_shifts
  WHERE organization_id = p_org_id
    AND branch_id = p_branch_id
    AND status = 'open'
    AND device_key_id = p_device_key_id
  ORDER BY opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_shift_id IS NULL THEN
    INSERT INTO public.sales_shifts (
      organization_id, branch_id, device_key_id, cashier_name, status, opening_cash, expected_cash
    )
    VALUES (
      p_org_id, p_branch_id, p_device_key_id, COALESCE(NULLIF(p_device_name, ''), 'كاشير'), 'open', 0, 0
    )
    RETURNING id INTO v_shift_id;

    INSERT INTO public.cash_drawer_entries (
      organization_id, branch_id, shift_id, entry_type, amount, memo
    )
    VALUES (
      p_org_id, p_branch_id, v_shift_id, 'opening', 0, 'رصيد افتتاحي تلقائي للوردية'
    );
  END IF;

  v_invoice_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'invoice', 'POS-');

  -- Insert Customer Invoice
  INSERT INTO public.customer_invoices (
    organization_id, branch_id, invoice_number, customer_name, status,
    payment_method, channel, subtotal, discount, tax_total, total,
    cost_total, gross_profit, idempotency_key, shift_id, notes, is_provisional_cogs
  )
  VALUES (
    p_org_id, p_branch_id, v_invoice_number, COALESCE(NULLIF(p_customer_name, ''), 'عميل سفري سريع'), 'paid',
    COALESCE(p_payment_method, 'cash')::payment_method, 'pickup', v_subtotal, COALESCE(p_discount, 0), v_tax_total, v_total,
    v_cost_total, v_total - v_cost_total, p_idempotency_key, v_shift_id, 'فاتورة كاشير ذرية', v_any_provisional
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.customer_invoice_items (
    organization_id, customer_invoice_id, catalog_item_id, menu_item_id,
    name, quantity, unit_price, unit_name, unit_factor, discount,
    tax_rate, cost_total, gross_profit
  )
  SELECT
    p_org_id, v_invoice_id, catalog_item_id, menu_item_id,
    name, quantity, unit_price, unit_name, 1, 0,
    tax_rate, line_cost, line_subtotal - line_cost
  FROM pg_temp.pos_checkout_lines
  ORDER BY line_index;

  -- Apply stock deductions and movements
  FOR v_impact IN
    SELECT * FROM pg_temp.pos_checkout_impacts
  LOOP
    SELECT id INTO v_stock_id
    FROM public.branch_stock
    WHERE organization_id = p_org_id
      AND branch_id = p_branch_id
      AND item_id = v_impact.item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity)
      VALUES (p_org_id, p_branch_id, v_impact.item_id, -v_impact.quantity, 0);
    ELSE
      UPDATE public.branch_stock
      SET quantity = quantity - v_impact.quantity,
          updated_at = now()
      WHERE id = v_stock_id;
    END IF;

    INSERT INTO public.stock_movements (
      organization_id, branch_id, item_id, movement_type, quantity,
      unit_cost, source_doc_type, source_doc_id, idempotency_key, notes,
      is_negative_stock, is_provisional_cost
    )
    VALUES (
      p_org_id, p_branch_id, v_impact.item_id, 'sale_usage', -v_impact.quantity,
      v_impact.unit_cost, 'customer_invoice', v_invoice_id,
      v_invoice_id::text || ':' || v_impact.item_id::text || ':sale_usage',
      'خصم تلقائي للمبيعات الذرية - فاتورة ' || v_invoice_number,
      v_impact.is_negative_stock, v_impact.is_provisional_cost
    );
  END LOOP;

  -- Register payments
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    FOR v_pay_line IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(method text, amount numeric) LOOP
      IF round(v_pay_line.amount, 4) > 0 THEN
        INSERT INTO public.customer_invoice_payments (
          organization_id, customer_invoice_id, payment_method, amount
        )
        VALUES (
          p_org_id, v_invoice_id, v_pay_line.method::payment_method, round(v_pay_line.amount, 4)
        );

        -- Update shift metrics
        UPDATE public.sales_shifts
        SET cash_sales = cash_sales + CASE WHEN v_pay_line.method = 'cash' THEN round(v_pay_line.amount, 4) ELSE 0 END,
            card_sales = card_sales + CASE WHEN v_pay_line.method = 'card' THEN round(v_pay_line.amount, 4) ELSE 0 END,
            expected_cash = expected_cash + CASE WHEN v_pay_line.method = 'cash' THEN round(v_pay_line.amount, 4) ELSE 0 END,
            updated_at = now()
        WHERE id = v_shift_id;

        IF v_pay_line.method = 'cash' OR v_pay_line.method = 'card' THEN
          INSERT INTO public.cash_drawer_entries (
            organization_id, branch_id, shift_id, entry_type, amount,
            reference_doc_type, reference_doc_id, memo
          )
          VALUES (
            p_org_id, p_branch_id, v_shift_id,
            CASE WHEN v_pay_line.method = 'cash' THEN 'cash_sale' ELSE 'card_sale' END,
            round(v_pay_line.amount, 4),
            'customer_invoice', v_invoice_id, 'تحصيل تلقائي للمبيعات الذرية'
          );
        END IF;
      END IF;
    END LOOP;
  ELSE
    INSERT INTO public.customer_invoice_payments (
      organization_id, customer_invoice_id, payment_method, amount
    )
    VALUES (
      p_org_id, v_invoice_id, COALESCE(p_payment_method, 'cash')::payment_method, v_total
    );

    v_drawer_type := CASE WHEN p_payment_method = 'cash' THEN 'cash_sale' ELSE 'card_sale' END;

    IF p_payment_method = 'cash' OR p_payment_method = 'card' THEN
      INSERT INTO public.cash_drawer_entries (
        organization_id, branch_id, shift_id, entry_type, amount,
        reference_doc_type, reference_doc_id, memo
      )
      VALUES (
        p_org_id, p_branch_id, v_shift_id, v_drawer_type, v_total,
        'customer_invoice', v_invoice_id, 'تحصيل تلقائي للمبيعات الذرية'
      );
    END IF;

    UPDATE public.sales_shifts
    SET cash_sales = cash_sales + CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END,
        card_sales = card_sales + CASE WHEN p_payment_method = 'card' THEN v_total ELSE 0 END,
        expected_cash = expected_cash + CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END,
        updated_at = now()
    WHERE id = v_shift_id;
  END IF;

  -- Daily summary update
  INSERT INTO public.sales_daily_summaries (
    organization_id, branch_id, summary_date, channel,
    orders_count, sales_total, ingredient_cost_total
  )
  VALUES (
    p_org_id, p_branch_id, current_date, 'pickup',
    1, v_total, v_cost_total
  )
  ON CONFLICT (organization_id, branch_id, summary_date, channel) DO UPDATE
    SET orders_count = public.sales_daily_summaries.orders_count + 1,
        sales_total = public.sales_daily_summaries.sales_total + excluded.sales_total,
        ingredient_cost_total = public.sales_daily_summaries.ingredient_cost_total + excluded.ingredient_cost_total,
        updated_at = now();

  -- Seeding and posting balanced journal entries
  PERFORM public.ensure_default_chart_accounts(p_org_id);

  SELECT id INTO v_cash_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cash_on_hand' AND is_active = true;
  SELECT id INTO v_card_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'bank_card' AND is_active = true;
  SELECT id INTO v_receivable_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'accounts_receivable' AND is_active = true;
  SELECT id INTO v_revenue_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_revenue' AND is_active = true;
  SELECT id INTO v_discount_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_discounts' AND is_active = true;
  SELECT id INTO v_tax_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'output_tax_payable' AND is_active = true;
  SELECT id INTO v_service_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'service_fee_revenue' AND is_active = true;
  SELECT id INTO v_delivery_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'delivery_revenue' AND is_active = true;
  SELECT id INTO v_cogs_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cogs' AND is_active = true;
  SELECT id INTO v_inv_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'inventory' AND is_active = true;

  v_je_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'journal_entry', 'JE-');

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status
  )
  VALUES (
    p_org_id, p_branch_id, v_je_number, current_date,
    'customer_invoice', v_invoice_id, 'قيد تلقائي لمبيعات الكاشير - فاتورة ' || v_invoice_number, 'posted'
  )
  RETURNING id INTO v_je_id;

  -- 1. Payments debit lines
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    FOR v_pay_line IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(method text, amount numeric) LOOP
      IF round(v_pay_line.amount, 4) > 0 THEN
        v_acct_id := CASE
          WHEN v_pay_line.method = 'cash' THEN v_cash_acct_id
          WHEN v_pay_line.method = 'card' THEN v_card_acct_id
          WHEN v_pay_line.method = 'bank_transfer' THEN v_card_acct_id
          WHEN v_pay_line.method = 'delivery_app' THEN v_card_acct_id
          WHEN v_pay_line.method = 'receivable' THEN v_receivable_acct_id
          WHEN v_pay_line.method = 'wallet' THEN v_card_acct_id
          WHEN v_pay_line.method = 'gift_card' THEN v_card_acct_id
          ELSE v_cash_acct_id
        END;

        INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
        VALUES (p_org_id, v_je_id, v_acct_id, p_branch_id, round(v_pay_line.amount, 4), 0, 'تحصيل دفعة ' || v_pay_line.method || ' فاتورة ' || v_invoice_number);
      END IF;
    END LOOP;
  ELSE
    IF v_total > 0 THEN
      v_acct_id := CASE WHEN p_payment_method = 'cash' THEN v_cash_acct_id ELSE v_card_acct_id END;
      INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
      VALUES (p_org_id, v_je_id, v_acct_id, p_branch_id, v_total, 0, 'تحصيل فاتورة ' || v_invoice_number);
    END IF;
  END IF;

  -- 2. Sales Discounts (debit) line
  IF p_discount > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_discount_acct_id, p_branch_id, round(p_discount, 4), 0, 'خصم مسموح به فاتورة ' || v_invoice_number);
  END IF;

  -- 3. Sales Revenue (credit) line
  IF v_subtotal > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_revenue_acct_id, p_branch_id, 0, v_subtotal, 'مبيعات فاتورة ' || v_invoice_number);
  END IF;

  -- 4. Output Tax (credit) line
  IF v_tax_total > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_tax_acct_id, p_branch_id, 0, v_tax_total, 'ضريبة فاتورة ' || v_invoice_number);
  END IF;

  -- 5. Service Fee Revenue (credit) line
  IF p_service_fee > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_service_acct_id, p_branch_id, 0, round(p_service_fee, 4), 'رسوم خدمة فاتورة ' || v_invoice_number);
  END IF;

  -- 6. Delivery Revenue (credit) line
  IF p_delivery_fee > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_delivery_acct_id, p_branch_id, 0, round(p_delivery_fee, 4), 'رسوم توصيل فاتورة ' || v_invoice_number);
  END IF;

  -- 7. COGS & Inventory lines
  IF v_cost_total > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo, is_provisional_cost)
    VALUES
      (p_org_id, v_je_id, v_cogs_acct_id, p_branch_id, v_cost_total, 0, 'تكلفة مبيعات فاتورة ' || v_invoice_number, v_any_provisional),
      (p_org_id, v_je_id, v_inv_acct_id, p_branch_id, 0, v_cost_total, 'خصم مخزون فاتورة ' || v_invoice_number, v_any_provisional);
  END IF;

  -- Kitchen ticket generation
  v_ticket_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'kitchen_ticket', 'KOT-');

  INSERT INTO public.kitchen_tickets (
    organization_id, branch_id, customer_invoice_id, shift_id,
    ticket_number, customer_name, channel, status, notes
  )
  VALUES (
    p_org_id, p_branch_id, v_invoice_id, v_shift_id,
    v_ticket_number, COALESCE(NULLIF(p_customer_name, ''), 'عميل سفري سريع'), 'pickup', 'pending',
    'تذكرة مطبخ من جهاز الكاشير الذري - فاتورة ' || v_invoice_number
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.kitchen_ticket_items (
    organization_id, kitchen_ticket_id, menu_item_id, catalog_item_id, name, quantity
  )
  SELECT
    p_org_id, v_ticket_id, menu_item_id, catalog_item_id, name, quantity
  FROM pg_temp.pos_checkout_lines
  WHERE menu_item_id IS NOT NULL
  ORDER BY line_index;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'invoiceId', v_invoice_id,
    'invoiceNumber', v_invoice_number,
    'kitchenTicketId', v_ticket_id,
    'shiftId', v_shift_id,
    'total', v_total,
    'costTotal', v_cost_total
  );
END;
$$;

-- Atomic POS refund function
CREATE OR REPLACE FUNCTION public.pos_refund_atomic(
  p_org_id uuid,
  p_branch_id uuid,
  p_invoice_id uuid,
  p_reason text,
  p_user_id uuid,
  p_items jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_refund_id uuid;
  v_refund_number text;
  v_je_id uuid;
  v_je_number text;
  
  v_cash_acct_id uuid;
  v_card_acct_id uuid;
  v_receivable_acct_id uuid;
  v_revenue_acct_id uuid;
  v_discount_acct_id uuid;
  v_tax_acct_id uuid;
  v_service_acct_id uuid;
  v_delivery_acct_id uuid;
  v_cogs_acct_id uuid;
  v_inv_acct_id uuid;
  v_acct_id uuid;
  
  -- Totals for returned items
  v_returned_subtotal numeric(12,4) := 0;
  v_returned_tax numeric(12,4) := 0;
  v_returned_cost numeric(12,4) := 0;
  v_returned_total numeric(12,4) := 0;
  v_returned_discount numeric(12,4) := 0;
  v_returned_service_fee numeric(12,4) := 0;
  v_returned_delivery_fee numeric(12,4) := 0;

  v_item record;
  v_invoice_item record;
  v_catalog record;
  v_mapping record;
  v_ingredient record;
  v_inventory record;
  v_stock_id uuid;
  v_stock_qty numeric(14,4);
  v_deduct_qty numeric(14,4);
  v_unit_cost numeric(12,4);
  v_pay_record record;
  v_proportional_factor numeric;
  v_remaining_payment numeric;
  v_refund_amt numeric;
  v_shift_id uuid;
BEGIN
  -- 1. Check invoice
  SELECT * INTO v_invoice
  FROM public.customer_invoices
  WHERE id = p_invoice_id AND organization_id = p_org_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الفاتورة غير موجودة';
  END IF;

  IF v_invoice.status = 'refunded' THEN
    RAISE EXCEPTION 'هذه الفاتورة تم إرجاعها بالكامل مسبقاً';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'pos_refund:' || p_org_id::text || ':' || p_branch_id::text || ':' || p_invoice_id::text,
      0
    )
  );

  -- 2. Calculate return amounts
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    -- Full refund
    v_returned_subtotal := v_invoice.subtotal;
    v_returned_tax := v_invoice.tax_total;
    v_returned_cost := v_invoice.cost_total;
    v_returned_discount := v_invoice.discount;
    v_returned_service_fee := v_invoice.service_fee;
    v_returned_delivery_fee := v_invoice.delivery_fee;
    v_returned_total := v_invoice.total;
  ELSE
    -- Partial refund
    FOR v_item IN
      SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric)
    LOOP
      SELECT * INTO v_invoice_item
      FROM public.customer_invoice_items
      WHERE customer_invoice_id = p_invoice_id
        AND catalog_item_id = v_item.catalog_item_id
        AND organization_id = p_org_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'الصنف % غير موجود في هذه الفاتورة', v_item.catalog_item_id;
      END IF;

      IF v_item.quantity <= 0 OR v_item.quantity > v_invoice_item.quantity THEN
        RAISE EXCEPTION 'كمية المرتجع غير صالحة للصنف %', v_invoice_item.name;
      END IF;

      v_returned_subtotal := v_returned_subtotal + round((v_invoice_item.unit_price * v_item.quantity)::numeric, 4);
      v_returned_tax := v_returned_tax + round((v_invoice_item.unit_price * v_item.quantity * v_invoice_item.tax_rate / 100)::numeric, 4);
      v_returned_cost := v_returned_cost + round((v_invoice_item.cost_total / v_invoice_item.quantity * v_item.quantity)::numeric, 4);
    END LOOP;

    IF v_invoice.subtotal > 0 THEN
      v_proportional_factor := v_returned_subtotal / v_invoice.subtotal;
      v_returned_discount := round((v_invoice.discount * v_proportional_factor)::numeric, 4);
      v_returned_service_fee := round((v_invoice.service_fee * v_proportional_factor)::numeric, 4);
      v_returned_delivery_fee := round((v_invoice.delivery_fee * v_proportional_factor)::numeric, 4);
    END IF;

    v_returned_total := round(v_returned_subtotal - v_returned_discount + v_returned_tax + v_returned_service_fee + v_returned_delivery_fee, 4);
  END IF;

  -- 3. Return stock to branch stock
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    FOR v_item IN
      SELECT * FROM public.stock_movements
      WHERE source_doc_type = 'customer_invoice' AND source_doc_id = p_invoice_id AND organization_id = p_org_id
    LOOP
      SELECT id, quantity INTO v_stock_id, v_stock_qty
      FROM public.branch_stock
      WHERE organization_id = p_org_id AND branch_id = p_branch_id AND item_id = v_item.item_id FOR UPDATE;

      IF FOUND THEN
        UPDATE public.branch_stock
        SET quantity = quantity + ABS(v_item.quantity),
            updated_at = now()
        WHERE id = v_stock_id;
      ELSE
        INSERT INTO public.branch_stock (organization_id, branch_id, item_id, quantity)
        VALUES (p_org_id, p_branch_id, v_item.item_id, ABS(v_item.quantity));
      END IF;

      INSERT INTO public.stock_movements (
        organization_id, branch_id, item_id, movement_type, quantity,
        unit_cost, source_doc_type, source_doc_id, notes
      )
      VALUES (
        p_org_id, p_branch_id, v_item.item_id, 'customer_return', ABS(v_item.quantity),
        v_item.unit_cost, 'customer_invoice', p_invoice_id,
        'إرجاع مبيعات - فاتورة ' || v_invoice.invoice_number
      );
    END LOOP;
  ELSE
    FOR v_item IN
      SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric)
    LOOP
      SELECT * INTO v_invoice_item
      FROM public.customer_invoice_items
      WHERE customer_invoice_id = p_invoice_id AND catalog_item_id = v_item.catalog_item_id AND organization_id = p_org_id;

      SELECT * INTO v_catalog FROM public.catalog_items WHERE id = v_invoice_item.catalog_item_id;
      IF FOUND AND v_catalog.menu_item_id IS NOT NULL THEN
        FOR v_mapping IN
          SELECT * FROM public.menu_item_recipe_mapping WHERE organization_id = p_org_id AND menu_item_id = v_catalog.menu_item_id
        LOOP
          FOR v_ingredient IN
            SELECT * FROM public.recipe_ingredients WHERE organization_id = p_org_id AND recipe_id = v_mapping.recipe_id
          LOOP
            v_deduct_qty := (v_ingredient.quantity * COALESCE(v_mapping.portion_multiplier, 1) * v_item.quantity)
                            / NULLIF(COALESCE(v_ingredient.yield_percent, 100) / 100, 0);

            SELECT * INTO v_inventory FROM public.inventory_items WHERE id = v_ingredient.item_id AND organization_id = p_org_id;

            SELECT id, quantity INTO v_stock_id, v_stock_qty
            FROM public.branch_stock
            WHERE organization_id = p_org_id AND branch_id = p_branch_id AND item_id = v_ingredient.item_id FOR UPDATE;

            v_unit_cost := COALESCE(NULLIF(v_ingredient.unit_cost, 0), NULLIF(v_inventory.average_cost, 0), v_inventory.last_purchase_price, 0);

            IF FOUND THEN
              UPDATE public.branch_stock
              SET quantity = quantity + v_deduct_qty,
                  updated_at = now()
              WHERE id = v_stock_id;
            ELSE
              INSERT INTO public.branch_stock (organization_id, branch_id, item_id, quantity)
              VALUES (p_org_id, p_branch_id, v_ingredient.item_id, v_deduct_qty);
            END IF;

            INSERT INTO public.stock_movements (
              organization_id, branch_id, item_id, movement_type, quantity,
              unit_cost, source_doc_type, source_doc_id, notes
            )
            VALUES (
              p_org_id, p_branch_id, v_ingredient.item_id, 'customer_return', v_deduct_qty,
              v_unit_cost, 'customer_invoice', p_invoice_id,
              'إرجاع جزئي مبيعات - صنف ' || v_invoice_item.name || ' - فاتورة ' || v_invoice.invoice_number
            );
          END LOOP;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 4. Post Reversing Journal Entry
  PERFORM public.ensure_default_chart_accounts(p_org_id);
  
  SELECT id INTO v_cash_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cash_on_hand' AND is_active = true;
  SELECT id INTO v_card_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'bank_card' AND is_active = true;
  SELECT id INTO v_receivable_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'accounts_receivable' AND is_active = true;
  SELECT id INTO v_revenue_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_revenue' AND is_active = true;
  SELECT id INTO v_discount_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_discounts' AND is_active = true;
  SELECT id INTO v_tax_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'output_tax_payable' AND is_active = true;
  SELECT id INTO v_service_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'service_fee_revenue' AND is_active = true;
  SELECT id INTO v_delivery_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'delivery_revenue' AND is_active = true;
  SELECT id INTO v_cogs_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cogs' AND is_active = true;
  SELECT id INTO v_inv_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'inventory' AND is_active = true;

  v_refund_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'refund', 'RFD-');
  v_je_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'journal_entry', 'JE-');

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status, created_by
  )
  VALUES (
    p_org_id, p_branch_id, v_je_number, current_date,
    'refund', p_invoice_id, 'قيد إرجاع مبيعات - رقم ' || v_refund_number || ' - فاتورة ' || v_invoice.invoice_number, 'posted', p_user_id
  )
  RETURNING id INTO v_je_id;

  -- Debits (opposite of checkout credits)
  IF v_returned_subtotal > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_revenue_acct_id, p_branch_id, v_returned_subtotal, 0, 'إرجاع مبيعات فاتورة ' || v_invoice.invoice_number);
  END IF;

  IF v_returned_tax > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_tax_acct_id, p_branch_id, v_returned_tax, 0, 'إرجاع ضريبة فاتورة ' || v_invoice.invoice_number);
  END IF;

  IF v_returned_service_fee > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_service_acct_id, p_branch_id, v_returned_service_fee, 0, 'إرجاع رسوم خدمة فاتورة ' || v_invoice.invoice_number);
  END IF;

  IF v_returned_delivery_fee > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_delivery_acct_id, p_branch_id, v_returned_delivery_fee, 0, 'إرجاع رسوم توصيل فاتورة ' || v_invoice.invoice_number);
  END IF;

  -- Credits (opposite of checkout debits)
  v_remaining_payment := v_returned_total;
  FOR v_pay_record IN
    SELECT * FROM public.customer_invoice_payments
    WHERE customer_invoice_id = p_invoice_id AND organization_id = p_org_id
  LOOP
    IF v_remaining_payment <= 0 THEN
      EXIT;
    END IF;

    v_acct_id := CASE
      WHEN v_pay_record.payment_method = 'cash' THEN v_cash_acct_id
      WHEN v_pay_record.payment_method = 'card' THEN v_card_acct_id
      WHEN v_pay_record.payment_method = 'bank_transfer' THEN v_card_acct_id
      WHEN v_pay_record.payment_method = 'delivery_app' THEN v_card_acct_id
      WHEN v_pay_record.payment_method = 'receivable' THEN v_receivable_acct_id
      WHEN v_pay_record.payment_method = 'wallet' THEN v_card_acct_id
      WHEN v_pay_record.payment_method = 'gift_card' THEN v_card_acct_id
      ELSE v_cash_acct_id
    END;

    v_refund_amt := LEAST(v_pay_record.amount, v_remaining_payment);

    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_acct_id, p_branch_id, 0, v_refund_amt, 'إرجاع دفعة ' || v_pay_record.payment_method || ' فاتورة ' || v_invoice.invoice_number);

    -- Update shift cash sales
    SELECT id INTO v_shift_id
    FROM public.sales_shifts
    WHERE organization_id = p_org_id AND branch_id = p_branch_id AND status = 'open'
    ORDER BY opened_at DESC LIMIT 1;

    IF v_shift_id IS NOT NULL THEN
      UPDATE public.sales_shifts
      SET cash_sales = cash_sales - CASE WHEN v_pay_record.payment_method = 'cash' THEN v_refund_amt ELSE 0 END,
          card_sales = card_sales - CASE WHEN v_pay_record.payment_method = 'card' THEN v_refund_amt ELSE 0 END,
          expected_cash = expected_cash - CASE WHEN v_pay_record.payment_method = 'cash' THEN v_refund_amt ELSE 0 END,
          updated_at = now()
      WHERE id = v_shift_id;

      IF v_pay_record.payment_method = 'cash' OR v_pay_record.payment_method = 'card' THEN
        INSERT INTO public.cash_drawer_entries (
          organization_id, branch_id, shift_id, entry_type, amount,
          reference_doc_type, reference_doc_id, memo
        )
        VALUES (
          p_org_id, p_branch_id, v_shift_id,
          CASE WHEN v_pay_record.payment_method = 'cash' THEN 'withdrawal' ELSE 'card_sale' END,
          -v_refund_amt,
          'customer_invoice', p_invoice_id, 'عكس تحصيل تلقائي للمرتجع'
        );
      END IF;
    END IF;

    v_remaining_payment := v_remaining_payment - v_refund_amt;
  END LOOP;

  IF v_returned_discount > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_discount_acct_id, p_branch_id, 0, v_returned_discount, 'عكس خصم مسموح به فاتورة ' || v_invoice.invoice_number);
  END IF;

  -- Re-add inventory: Debit Inventory, Credit COGS
  IF v_returned_cost > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES
      (p_org_id, v_je_id, v_inv_acct_id, p_branch_id, v_returned_cost, 0, 'إرجاع مخزون مرتجع فاتورة ' || v_invoice.invoice_number),
      (p_org_id, v_je_id, v_cogs_acct_id, p_branch_id, 0, v_returned_cost, 'عكس تكلفة مبيعات مرتجع فاتورة ' || v_invoice.invoice_number);
  END IF;

  -- 5. Update invoice status
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    UPDATE public.customer_invoices
    SET status = 'refunded',
        updated_at = now()
    WHERE id = p_invoice_id;
  ELSE
    UPDATE public.customer_invoices
    SET status = 'partially_refunded',
        updated_at = now()
    WHERE id = p_invoice_id;
  END IF;

  -- Update daily summary
  INSERT INTO public.sales_daily_summaries (
    organization_id, branch_id, summary_date, channel,
    orders_count, sales_total, ingredient_cost_total
  )
  VALUES (
    p_org_id, p_branch_id, current_date, 'pickup',
    0, -v_returned_total, -v_returned_cost
  )
  ON CONFLICT (organization_id, branch_id, summary_date, channel) DO UPDATE
    SET sales_total = public.sales_daily_summaries.sales_total + excluded.sales_total,
        ingredient_cost_total = public.sales_daily_summaries.ingredient_cost_total + excluded.ingredient_cost_total,
        updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'refundNumber', v_refund_number,
    'invoiceId', p_invoice_id,
    'refundTotal', v_returned_total,
    'reason', p_reason
  );
END;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 035_modifiers.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 036_pos_checkout_modifiers.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Extend pos_checkout_atomic to accept per-line modifier selections and a
-- caller-provided unit price (base price + modifier deltas). Modifier info is
-- stored on the invoice line and the kitchen ticket line for display.
CREATE OR REPLACE FUNCTION public.pos_checkout_atomic(
  p_org_id uuid,
  p_branch_id uuid,
  p_device_key_id uuid,
  p_device_name text,
  p_customer_name text,
  p_payment_method text,
  p_idempotency_key text,
  p_items jsonb,
  p_discount numeric DEFAULT 0,
  p_service_fee numeric DEFAULT 0,
  p_delivery_fee numeric DEFAULT 0,
  p_payments jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_number text;
  v_shift_id uuid;
  v_ticket_id uuid;
  v_ticket_number text;
  v_item record;
  v_catalog catalog_items%rowtype;
  v_mapping record;
  v_ingredient record;
  v_inventory inventory_items%rowtype;
  v_quantity numeric(14,4);
  v_unit_price numeric(12,4);
  v_deduct_qty numeric(14,4);
  v_unit_cost numeric(12,4);
  v_line_subtotal numeric(12,4);
  v_line_tax numeric(12,4);
  v_line_cost numeric(12,4);
  v_subtotal numeric(12,4) := 0;
  v_tax_total numeric(12,4) := 0;
  v_total numeric(12,4) := 0;
  v_cost_total numeric(12,4) := 0;
  v_stock_qty numeric(14,4);
  v_stock_id uuid;
  v_je_id uuid;
  v_je_number text;
  v_acct_id uuid;

  -- Account IDs
  v_cash_acct_id uuid;
  v_card_acct_id uuid;
  v_receivable_acct_id uuid;
  v_revenue_acct_id uuid;
  v_discount_acct_id uuid;
  v_tax_acct_id uuid;
  v_service_acct_id uuid;
  v_delivery_acct_id uuid;
  v_cogs_acct_id uuid;
  v_inv_acct_id uuid;

  v_impact record;
  v_existing record;
  v_drawer_type text;
  v_pay_line record;
  v_payment_sum numeric(12,4) := 0;

  -- Costing Policy variables
  v_policy text;
  v_allow_negative boolean;
  v_is_negative_stock boolean := false;
  v_is_provisional_cost boolean := false;
  v_any_provisional boolean := false;

  -- Modifier selections (display only; price already folded into unit_price)
  v_modifier_option_ids jsonb := NULL;
  v_modifier_summary text := '';
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب لفواتير الكاشير';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'الفاتورة يجب أن تحتوي على صنف واحد على الأقل';
  END IF;

  -- Load costing policy
  SELECT allow_negative_stock, COALESCE(inventory_costing_policy, 'strict_no_negative')
  INTO v_allow_negative, v_policy
  FROM public.accounting_settings
  WHERE organization_id = p_org_id;

  IF v_policy IS NULL THEN
    v_allow_negative := false;
    v_policy := 'strict_no_negative';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'pos_checkout:' || p_org_id::text || ':' || p_branch_id::text || ':' || COALESCE(p_device_key_id::text, 'no-device'),
      0
    )
  );

  SELECT id, invoice_number, total, cost_total, shift_id
  INTO v_existing
  FROM public.customer_invoices
  WHERE organization_id = p_org_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing.id IS NOT NULL THEN
    SELECT id INTO v_ticket_id
    FROM public.kitchen_tickets
    WHERE organization_id = p_org_id
      AND customer_invoice_id = v_existing.id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'invoiceId', v_existing.id,
      'invoiceNumber', v_existing.invoice_number,
      'kitchenTicketId', v_ticket_id,
      'shiftId', v_existing.shift_id,
      'total', v_existing.total,
      'costTotal', v_existing.cost_total
    );
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_checkout_lines;
  CREATE TEMP TABLE pg_temp.pos_checkout_lines (
    line_index integer generated always as identity,
    catalog_item_id uuid not null,
    menu_item_id uuid,
    name text not null,
    quantity numeric(14,4) not null,
    unit_price numeric(12,4) not null,
    unit_name text not null,
    tax_rate numeric(8,4) not null,
    line_subtotal numeric(12,4) not null,
    line_tax numeric(12,4) not null,
    line_cost numeric(12,4) not null default 0,
    modifier_option_ids jsonb,
    modifier_summary text
  ) ON COMMIT DROP;

  DROP TABLE IF EXISTS pg_temp.pos_checkout_impacts;
  CREATE TEMP TABLE pg_temp.pos_checkout_impacts (
    item_id uuid primary key,
    quantity numeric(14,4) not null default 0,
    unit_cost numeric(12,4) not null default 0,
    total_cost numeric(12,4) not null default 0,
    is_negative_stock boolean not null default false,
    is_provisional_cost boolean not null default false
  ) ON COMMIT DROP;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric, unit_price numeric, modifier_option_ids jsonb, modifier_summary text)
  LOOP
    v_quantity := v_item.quantity;

    IF v_item.catalog_item_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'كمية أو صنف غير صالح في الفاتورة';
    END IF;

    SELECT *
    INTO v_catalog
    FROM public.catalog_items
    WHERE id = v_item.catalog_item_id
      AND organization_id = p_org_id
      AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الصنف غير موجود أو غير فعال: %', v_item.catalog_item_id;
    END IF;

    v_modifier_option_ids := v_item.modifier_option_ids;
    v_modifier_summary := COALESCE(v_item.modifier_summary, '');
    v_unit_price := COALESCE((v_item.unit_price)::numeric, v_catalog.retail_price, 0);
    v_line_subtotal := round((v_unit_price * v_quantity)::numeric, 4);
    v_line_tax := round((v_line_subtotal * COALESCE(v_catalog.tax_rate, 0) / 100)::numeric, 4);
    v_line_cost := 0;

    IF v_catalog.menu_item_id IS NOT NULL THEN
      FOR v_mapping IN
        SELECT *
        FROM public.menu_item_recipe_mapping
        WHERE organization_id = p_org_id
          AND menu_item_id = v_catalog.menu_item_id
      LOOP
        FOR v_ingredient IN
          SELECT *
          FROM public.recipe_ingredients
          WHERE organization_id = p_org_id
            AND recipe_id = v_mapping.recipe_id
        LOOP
          SELECT *
          INTO v_inventory
          FROM public.inventory_items
          WHERE id = v_ingredient.item_id
            AND organization_id = p_org_id
            AND status = 'active';

          IF NOT FOUND THEN
            RAISE EXCEPTION 'مادة وصفة غير موجودة أو غير فعالة: %', v_ingredient.item_id;
          END IF;

          v_deduct_qty :=
            (v_ingredient.quantity * COALESCE(v_mapping.portion_multiplier, 1) * v_quantity)
            / NULLIF(COALESCE(v_ingredient.yield_percent, 100) / 100, 0);

          -- Base Costing
          v_unit_cost := COALESCE(NULLIF(v_ingredient.unit_cost, 0), NULLIF(v_inventory.average_cost, 0), v_inventory.last_purchase_price, 0);

          -- Flag if cost is missing (truly zero or provisional fallback)
          v_is_provisional_cost := false;
          IF v_unit_cost = 0 THEN
            v_unit_cost := 0.1; -- fallback recipe cost
            v_is_provisional_cost := true;
          END IF;

          -- Check stock availability
          SELECT quantity INTO v_stock_qty
          FROM public.branch_stock
          WHERE organization_id = p_org_id
            AND branch_id = p_branch_id
            AND item_id = v_ingredient.item_id;

          IF NOT FOUND THEN
            v_stock_qty := 0;
          END IF;

          v_is_negative_stock := false;
          IF v_stock_qty < v_deduct_qty THEN
            v_is_negative_stock := true;
            v_is_provisional_cost := true;
            v_any_provisional := true;
          END IF;

          v_line_cost := v_line_cost + round((v_deduct_qty * v_unit_cost)::numeric, 4);

          INSERT INTO pg_temp.pos_checkout_impacts (item_id, quantity, unit_cost, total_cost, is_negative_stock, is_provisional_cost)
          VALUES (
            v_ingredient.item_id,
            v_deduct_qty,
            v_unit_cost,
            round((v_deduct_qty * v_unit_cost)::numeric, 4),
            v_is_negative_stock,
            v_is_provisional_cost
          )
          ON CONFLICT (item_id) DO UPDATE
            SET quantity = pos_checkout_impacts.quantity + excluded.quantity,
                total_cost = pos_checkout_impacts.total_cost + excluded.total_cost,
                is_negative_stock = pos_checkout_impacts.is_negative_stock OR excluded.is_negative_stock,
                is_provisional_cost = pos_checkout_impacts.is_provisional_cost OR excluded.is_provisional_cost,
                unit_cost = CASE
                  WHEN pos_checkout_impacts.quantity + excluded.quantity = 0 THEN excluded.unit_cost
                  ELSE round(
                    ((pos_checkout_impacts.total_cost + excluded.total_cost)
                      / NULLIF(pos_checkout_impacts.quantity + excluded.quantity, 0))::numeric,
                    4
                  )
                END;
        END LOOP;
      END LOOP;
    END IF;

    INSERT INTO pg_temp.pos_checkout_lines (
      catalog_item_id, menu_item_id, name, quantity, unit_price, unit_name,
      tax_rate, line_subtotal, line_tax, line_cost, modifier_option_ids, modifier_summary
    )
    VALUES (
      v_catalog.id,
      v_catalog.menu_item_id,
      v_catalog.name,
      v_quantity,
      v_unit_price,
      COALESCE(v_catalog.main_unit, 'قطعة'),
      COALESCE(v_catalog.tax_rate, 0),
      v_line_subtotal,
      v_line_tax,
      v_line_cost,
      v_modifier_option_ids,
      v_modifier_summary
    );

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax;
    v_cost_total := v_cost_total + v_line_cost;
  END LOOP;

  v_subtotal := round(v_subtotal, 4);
  v_tax_total := round(v_tax_total, 4);
  v_cost_total := round(v_cost_total, 4);

  -- Calculate total using formula: Subtotal - Discount + Tax + ServiceFee + DeliveryFee
  v_total := round(v_subtotal - COALESCE(p_discount, 0) + v_tax_total + COALESCE(p_service_fee, 0) + COALESCE(p_delivery_fee, 0), 4);
  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  -- Validate stock constraints under costing policy
  FOR v_impact IN
    SELECT * FROM pg_temp.pos_checkout_impacts
  LOOP
    SELECT quantity INTO v_stock_qty
    FROM public.branch_stock
    WHERE organization_id = p_org_id
      AND branch_id = p_branch_id
      AND item_id = v_impact.item_id;

    IF NOT FOUND THEN
      v_stock_qty := 0;
    END IF;

    IF v_stock_qty < v_impact.quantity THEN
      IF NOT v_allow_negative OR v_policy = 'strict_no_negative' THEN
        RAISE EXCEPTION 'لا توجد كمية كافية في المخزون للمادة %',
          (SELECT name FROM public.inventory_items WHERE id = v_impact.item_id);
      END IF;
    END IF;
  END LOOP;

  -- Validate payments
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    SELECT sum(round((val->>'amount')::numeric, 4))
    INTO v_payment_sum
    FROM jsonb_array_elements(p_payments) AS val;

    IF ABS(v_payment_sum - v_total) > 0.01 THEN
      RAISE EXCEPTION 'مجموع المدفوعات (%) لا يساوي إجمالي الفاتورة (%)', v_payment_sum, v_total;
    END IF;
  END IF;

  -- Open shift or fetch shift
  SELECT id INTO v_shift_id
  FROM public.sales_shifts
  WHERE organization_id = p_org_id
    AND branch_id = p_branch_id
    AND status = 'open'
    AND device_key_id = p_device_key_id
  ORDER BY opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_shift_id IS NULL THEN
    INSERT INTO public.sales_shifts (
      organization_id, branch_id, device_key_id, cashier_name, status, opening_cash, expected_cash
    )
    VALUES (
      p_org_id, p_branch_id, p_device_key_id, COALESCE(NULLIF(p_device_name, ''), 'كاشير'), 'open', 0, 0
    )
    RETURNING id INTO v_shift_id;

    INSERT INTO public.cash_drawer_entries (
      organization_id, branch_id, shift_id, entry_type, amount, memo
    )
    VALUES (
      p_org_id, p_branch_id, v_shift_id, 'opening', 0, 'رصيد افتتاحي تلقائي للوردية'
    );
  END IF;

  v_invoice_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'invoice', 'POS-');

  -- Insert Customer Invoice
  INSERT INTO public.customer_invoices (
    organization_id, branch_id, invoice_number, customer_name, status,
    payment_method, channel, subtotal, discount, tax_total, total,
    cost_total, gross_profit, idempotency_key, shift_id, notes, is_provisional_cogs
  )
  VALUES (
    p_org_id, p_branch_id, v_invoice_number, COALESCE(NULLIF(p_customer_name, ''), 'عميل سفري سريع'), 'paid',
    COALESCE(p_payment_method, 'cash')::payment_method, 'pickup', v_subtotal, COALESCE(p_discount, 0), v_tax_total, v_total,
    v_cost_total, v_total - v_cost_total, p_idempotency_key, v_shift_id, 'فاتورة كاشير ذرية', v_any_provisional
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.customer_invoice_items (
    organization_id, customer_invoice_id, catalog_item_id, menu_item_id,
    name, quantity, unit_price, unit_name, unit_factor, discount,
    tax_rate, cost_total, gross_profit, modifier_option_ids, modifier_summary
  )
  SELECT
    p_org_id, v_invoice_id, catalog_item_id, menu_item_id,
    name, quantity, unit_price, unit_name, 1, 0,
    tax_rate, line_cost, line_subtotal - line_cost, modifier_option_ids, modifier_summary
  FROM pg_temp.pos_checkout_lines
  ORDER BY line_index;

  -- Apply stock deductions and movements
  FOR v_impact IN
    SELECT * FROM pg_temp.pos_checkout_impacts
  LOOP
    SELECT id INTO v_stock_id
    FROM public.branch_stock
    WHERE organization_id = p_org_id
      AND branch_id = p_branch_id
      AND item_id = v_impact.item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity)
      VALUES (p_org_id, p_branch_id, v_impact.item_id, -v_impact.quantity, 0);
    ELSE
      UPDATE public.branch_stock
      SET quantity = quantity - v_impact.quantity,
          updated_at = now()
      WHERE id = v_stock_id;
    END IF;

    INSERT INTO public.stock_movements (
      organization_id, branch_id, item_id, movement_type, quantity,
      unit_cost, source_doc_type, source_doc_id, idempotency_key, notes,
      is_negative_stock, is_provisional_cost
    )
    VALUES (
      p_org_id, p_branch_id, v_impact.item_id, 'sale_usage', -v_impact.quantity,
      v_impact.unit_cost, 'customer_invoice', v_invoice_id,
      v_invoice_id::text || ':' || v_impact.item_id::text || ':sale_usage',
      'خصم تلقائي للمبيعات الذرية - فاتورة ' || v_invoice_number,
      v_impact.is_negative_stock, v_impact.is_provisional_cost
    );
  END LOOP;

  -- Register payments
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    FOR v_pay_line IN SELECT * FROM jsonb_array_elements(p_payments) AS x(method text, amount numeric) LOOP
      IF round(v_pay_line.amount, 4) > 0 THEN
        INSERT INTO public.customer_invoice_payments (
          organization_id, customer_invoice_id, payment_method, amount
        )
        VALUES (
          p_org_id, v_invoice_id, v_pay_line.method::payment_method, round(v_pay_line.amount, 4)
        );

        -- Update shift metrics
        UPDATE public.sales_shifts
        SET cash_sales = cash_sales + CASE WHEN v_pay_line.method = 'cash' THEN round(v_pay_line.amount, 4) ELSE 0 END,
            card_sales = card_sales + CASE WHEN v_pay_line.method = 'card' THEN round(v_pay_line.amount, 4) ELSE 0 END,
            expected_cash = expected_cash + CASE WHEN v_pay_line.method = 'cash' THEN round(v_pay_line.amount, 4) ELSE 0 END,
            updated_at = now()
        WHERE id = v_shift_id;

        IF v_pay_line.method = 'cash' OR v_pay_line.method = 'card' THEN
          INSERT INTO public.cash_drawer_entries (
            organization_id, branch_id, shift_id, entry_type, amount,
            reference_doc_type, reference_doc_id, memo
          )
          VALUES (
            p_org_id, p_branch_id, v_shift_id,
            CASE WHEN v_pay_line.method = 'cash' THEN 'cash_sale' ELSE 'card_sale' END,
            round(v_pay_line.amount, 4),
            'customer_invoice', v_invoice_id, 'تحصيل تلقائي للمبيعات الذرية'
          );
        END IF;
      END IF;
    END LOOP;
  ELSE
    INSERT INTO public.customer_invoice_payments (
      organization_id, customer_invoice_id, payment_method, amount
    )
    VALUES (
      p_org_id, v_invoice_id, COALESCE(p_payment_method, 'cash')::payment_method, v_total
    );

    v_drawer_type := CASE WHEN p_payment_method = 'cash' THEN 'cash_sale' ELSE 'card_sale' END;

    IF p_payment_method = 'cash' OR p_payment_method = 'card' THEN
      INSERT INTO public.cash_drawer_entries (
        organization_id, branch_id, shift_id, entry_type, amount,
        reference_doc_type, reference_doc_id, memo
      )
      VALUES (
        p_org_id, p_branch_id, v_shift_id, v_drawer_type, v_total,
        'customer_invoice', v_invoice_id, 'تحصيل تلقائي للمبيعات الذرية'
      );
    END IF;

    UPDATE public.sales_shifts
    SET cash_sales = cash_sales + CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END,
        card_sales = card_sales + CASE WHEN p_payment_method = 'card' THEN v_total ELSE 0 END,
        expected_cash = expected_cash + CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END,
        updated_at = now()
    WHERE id = v_shift_id;
  END IF;

  -- Daily summary update
  INSERT INTO public.sales_daily_summaries (
    organization_id, branch_id, summary_date, channel,
    orders_count, sales_total, ingredient_cost_total
  )
  VALUES (
    p_org_id, p_branch_id, current_date, 'pickup',
    1, v_total, v_cost_total
  )
  ON CONFLICT (organization_id, branch_id, summary_date, channel) DO UPDATE
    SET orders_count = public.sales_daily_summaries.orders_count + 1,
        sales_total = public.sales_daily_summaries.sales_total + excluded.sales_total,
        ingredient_cost_total = public.sales_daily_summaries.ingredient_cost_total + excluded.ingredient_cost_total,
        updated_at = now();

  -- Seeding and posting balanced journal entries
  PERFORM public.ensure_default_chart_accounts(p_org_id);

  SELECT id INTO v_cash_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cash_on_hand' AND is_active = true;
  SELECT id INTO v_card_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'bank_card' AND is_active = true;
  SELECT id INTO v_receivable_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'accounts_receivable' AND is_active = true;
  SELECT id INTO v_revenue_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_revenue' AND is_active = true;
  SELECT id INTO v_discount_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_discounts' AND is_active = true;
  SELECT id INTO v_tax_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'output_tax_payable' AND is_active = true;
  SELECT id INTO v_service_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'service_fee_revenue' AND is_active = true;
  SELECT id INTO v_delivery_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'delivery_revenue' AND is_active = true;
  SELECT id INTO v_cogs_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cogs' AND is_active = true;
  SELECT id INTO v_inv_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'inventory' AND is_active = true;

  v_je_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'journal_entry', 'JE-');

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status
  )
  VALUES (
    p_org_id, p_branch_id, v_je_number, current_date,
    'customer_invoice', v_invoice_id, 'قيد تلقائي لمبيعات الكاشير - فاتورة ' || v_invoice_number, 'posted'
  )
  RETURNING id INTO v_je_id;

  -- 1. Payments debit lines
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    FOR v_pay_line IN SELECT * FROM jsonb_array_elements(p_payments) AS x(method text, amount numeric) LOOP
      IF round(v_pay_line.amount, 4) > 0 THEN
        v_acct_id := CASE
          WHEN v_pay_line.method = 'cash' THEN v_cash_acct_id
          WHEN v_pay_line.method = 'card' THEN v_card_acct_id
          WHEN v_pay_line.method = 'bank_transfer' THEN v_card_acct_id
          WHEN v_pay_line.method = 'delivery_app' THEN v_card_acct_id
          WHEN v_pay_line.method = 'receivable' THEN v_receivable_acct_id
          WHEN v_pay_line.method = 'wallet' THEN v_card_acct_id
          WHEN v_pay_line.method = 'gift_card' THEN v_card_acct_id
          ELSE v_cash_acct_id
        END;

        INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
        VALUES (p_org_id, v_je_id, v_acct_id, p_branch_id, round(v_pay_line.amount, 4), 0, 'تحصيل دفعة ' || v_pay_line.method || ' فاتورة ' || v_invoice_number);
      END IF;
    END LOOP;
  ELSE
    IF v_total > 0 THEN
      v_acct_id := CASE WHEN p_payment_method = 'cash' THEN v_cash_acct_id ELSE v_card_acct_id END;
      INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
      VALUES (p_org_id, v_je_id, v_acct_id, p_branch_id, v_total, 0, 'تحصيل فاتورة ' || v_invoice_number);
    END IF;
  END IF;

  -- 2. Sales Discounts (debit) line
  IF p_discount > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_discount_acct_id, p_branch_id, round(p_discount, 4), 0, 'خصم مسموح به فاتورة ' || v_invoice_number);
  END IF;

  -- 3. Sales Revenue (credit) line
  IF v_subtotal > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_revenue_acct_id, p_branch_id, 0, v_subtotal, 'مبيعات فاتورة ' || v_invoice_number);
  END IF;

  -- 4. Output Tax (credit) line
  IF v_tax_total > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_tax_acct_id, p_branch_id, 0, v_tax_total, 'ضريبة فاتورة ' || v_invoice_number);
  END IF;

  -- 5. Service Fee Revenue (credit) line
  IF p_service_fee > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_service_acct_id, p_branch_id, 0, round(p_service_fee, 4), 'رسوم خدمة فاتورة ' || v_invoice_number);
  END IF;

  -- 6. Delivery Revenue (credit) line
  IF p_delivery_fee > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_delivery_acct_id, p_branch_id, 0, round(p_delivery_fee, 4), 'رسوم توصيل فاتورة ' || v_invoice_number);
  END IF;

  -- 7. COGS & Inventory lines
  IF v_cost_total > 0 THEN
    INSERT INTO public.journal_lines (organization_id, branch_id, journal_entry_id, account_id, debit, credit, memo, is_provisional_cost)
    VALUES
      (p_org_id, p_branch_id, v_je_id, v_cogs_acct_id, v_cost_total, 0, 'تكلفة مبيعات فاتورة ' || v_invoice_number, v_any_provisional),
      (p_org_id, p_branch_id, v_je_id, v_inv_acct_id, 0, v_cost_total, 'خصم مخزون فاتورة ' || v_invoice_number, v_any_provisional);
  END IF;

  -- Kitchen ticket generation
  v_ticket_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'kitchen_ticket', 'KOT-');

  INSERT INTO public.kitchen_tickets (
    organization_id, branch_id, customer_invoice_id, shift_id,
    ticket_number, customer_name, channel, status, notes
  )
  VALUES (
    p_org_id, p_branch_id, v_invoice_id, v_shift_id,
    v_ticket_number, COALESCE(NULLIF(p_customer_name, ''), 'عميل سفري سريع'), 'pickup', 'pending',
    'تذكرة مطبخ من جهاز الكاشير الذري - فاتورة ' || v_invoice_number
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.kitchen_ticket_items (
    organization_id, kitchen_ticket_id, menu_item_id, catalog_item_id, name, quantity, modifier_summary
  )
  SELECT
    p_org_id, v_ticket_id, menu_item_id, catalog_item_id, name, quantity, modifier_summary
  FROM pg_temp.pos_checkout_lines
  WHERE menu_item_id IS NOT NULL
  ORDER BY line_index;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'invoiceId', v_invoice_id,
    'invoiceNumber', v_invoice_number,
    'kitchenTicketId', v_ticket_id,
    'shiftId', v_shift_id,
    'total', v_total,
    'costTotal', v_cost_total
  );
END;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 037_supplier_invoice_payments.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- P0-4: Proper supplier-invoice lifecycle and payments
-- Extend invoice status enum (keep existing values for compatibility)
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'posted';
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'void';

-- Payment tracking columns on invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due numeric NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method text;

-- Supplier payments (separate from invoice creation)
CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers (id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches (id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL,
  payment_date date NOT NULL,
  reference text,
  journal_entry_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_org ON supplier_payments (organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_invoice ON supplier_payments (invoice_id);

ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_payments_select ON supplier_payments;
CREATE POLICY supplier_payments_select ON supplier_payments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS supplier_payments_write ON supplier_payments;
CREATE POLICY supplier_payments_write ON supplier_payments
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  );

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 038_goods_receipts.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- P0-5: Receipt documents with safe idempotency (check before stock change)
CREATE TABLE IF NOT EXISTS goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  purchase_order_id uuid REFERENCES purchase_orders (id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers (id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches (id) ON DELETE SET NULL,
  receipt_number text,
  idempotency_key text UNIQUE,
  received_at date NOT NULL DEFAULT current_date,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'posted',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  goods_receipt_id uuid NOT NULL REFERENCES goods_receipts (id) ON DELETE CASCADE,
  purchase_order_item_id uuid,
  item_id uuid REFERENCES inventory_items (id) ON DELETE SET NULL,
  quantity numeric NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goods_receipts_org ON goods_receipts (organization_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_po ON goods_receipts (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_receipt ON goods_receipt_items (goods_receipt_id);

ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goods_receipts_select ON goods_receipts;
CREATE POLICY goods_receipts_select ON goods_receipts
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS goods_receipts_write ON goods_receipts;
CREATE POLICY goods_receipts_write ON goods_receipts
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS goods_receipt_items_select ON goods_receipt_items;
CREATE POLICY goods_receipt_items_select ON goods_receipt_items
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS goods_receipt_items_write ON goods_receipt_items;
CREATE POLICY goods_receipt_items_write ON goods_receipt_items
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  );

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 039_expense_documents_and_settings.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Expense-cycle document fields + core accounting configuration
-- 1) Expenses become real vouchers: payee, reference number, and an explicit
--    posting account chosen from the chart of accounts (instead of relying on
--    keyword matching of a free-text category).
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payee text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference_no text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_account_id uuid REFERENCES chart_of_accounts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_expense_account ON expenses (expense_account_id);

-- 2) Core accounting configuration (fiscal year, valuation, basis) so the
--    settings page is a real source of truth, not only feature toggles.
ALTER TABLE accounting_settings ADD COLUMN IF NOT EXISTS fiscal_year_start_month int NOT NULL DEFAULT 1
  CHECK (fiscal_year_start_month BETWEEN 1 AND 12);
ALTER TABLE accounting_settings ADD COLUMN IF NOT EXISTS inventory_valuation text NOT NULL DEFAULT 'moving_average';
ALTER TABLE accounting_settings ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'accrual';

-- 3) Manual journal entries: allow a per-line cost center (column already
--    exists on journal_lines since 033; index it for cost-center reports).
CREATE INDEX IF NOT EXISTS idx_journal_lines_cost_center ON journal_lines (cost_center_id) WHERE cost_center_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_lines_org_account ON journal_lines (organization_id, account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_org_date ON journal_entries (organization_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_invoices_org_due_date ON invoices (organization_id, due_date);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 040_restaurant_tables_and_financial_calendar.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 041_protect_financial_calendar_records.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Financial calendar rows are accounting-report evidence. Corrections must be
-- represented by updated/reversal data, never by deleting historical rows.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'financial_calendar_days',
    'financial_calendar_sales',
    'financial_calendar_expenses'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', target_table || ' branch delete', target_table);
  end loop;
end $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 042_bill_payments_direct_debit_and_receipt_shares.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 043_concurrency_safe_pos_pricing_and_counters.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Migration 043: Concurrency-safe POS Pricing and Atomic Counters
-- 1. Redefine pos_checkout_atomic to enforce catalog pricing constraints and utilize invoice_counters table.

CREATE OR REPLACE FUNCTION public.pos_checkout_atomic(
  p_org_id uuid,
  p_branch_id uuid,
  p_device_key_id uuid,
  p_device_name text,
  p_customer_name text,
  p_payment_method text,
  p_idempotency_key text,
  p_items jsonb,
  p_discount numeric DEFAULT 0,
  p_service_fee numeric DEFAULT 0,
  p_delivery_fee numeric DEFAULT 0,
  p_payments jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_number text;
  v_shift_id uuid;
  v_ticket_id uuid;
  v_ticket_number text;
  v_item record;
  v_catalog catalog_items%rowtype;
  v_mapping record;
  v_ingredient record;
  v_inventory inventory_items%rowtype;
  v_quantity numeric(14,4);
  v_unit_price numeric(12,4);
  v_deduct_qty numeric(14,4);
  v_unit_cost numeric(12,4);
  v_line_subtotal numeric(12,4);
  v_line_tax numeric(12,4);
  v_line_cost numeric(12,4);
  v_subtotal numeric(12,4) := 0;
  v_tax_total numeric(12,4) := 0;
  v_total numeric(12,4) := 0;
  v_cost_total numeric(12,4) := 0;
  v_stock_qty numeric(14,4);
  v_stock_id uuid;
  v_je_id uuid;
  v_je_number text;
  v_acct_id uuid;

  -- Account IDs
  v_cash_acct_id uuid;
  v_card_acct_id uuid;
  v_receivable_acct_id uuid;
  v_revenue_acct_id uuid;
  v_discount_acct_id uuid;
  v_tax_acct_id uuid;
  v_service_acct_id uuid;
  v_delivery_acct_id uuid;
  v_cogs_acct_id uuid;
  v_inv_acct_id uuid;

  v_impact record;
  v_existing record;
  v_drawer_type text;
  v_pay_line record;
  v_payment_sum numeric(12,4) := 0;

  -- Costing Policy variables
  v_policy text;
  v_allow_negative boolean;
  v_is_negative_stock boolean := false;
  v_is_provisional_cost boolean := false;
  v_any_provisional boolean := false;

  -- Modifier selections (display only)
  v_modifier_option_ids jsonb := NULL;
  v_modifier_summary text := '';

  -- Concurrency-safe Invoice Number Counter
  v_next_invoice_num integer;
  
  -- Price validation
  v_modifiers_price_sum numeric(12,4) := 0;
  v_expected_unit_price numeric(12,4) := 0;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب لفواتير الكاشير';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'الفاتورة يجب أن تحتوي على صنف واحد على الأقل';
  END IF;

  -- Load costing policy
  SELECT allow_negative_stock, COALESCE(inventory_costing_policy, 'strict_no_negative')
  INTO v_allow_negative, v_policy
  FROM public.accounting_settings
  WHERE organization_id = p_org_id;

  IF v_policy IS NULL THEN
    v_allow_negative := false;
    v_policy := 'strict_no_negative';
  END IF;

  -- Lock device/checkout context to prevent concurrent overlapping executions
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'pos_checkout:' || p_org_id::text || ':' || p_branch_id::text || ':' || COALESCE(p_device_key_id::text, 'no-device'),
      0
    )
  );

  SELECT id, invoice_number, total, cost_total, shift_id
  INTO v_existing
  FROM public.customer_invoices
  WHERE organization_id = p_org_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing.id IS NOT NULL THEN
    SELECT id INTO v_ticket_id
    FROM public.kitchen_tickets
    WHERE organization_id = p_org_id
      AND customer_invoice_id = v_existing.id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'invoiceId', v_existing.id,
      'invoiceNumber', v_existing.invoice_number,
      'kitchenTicketId', v_ticket_id,
      'shiftId', v_existing.shift_id,
      'total', v_existing.total,
      'costTotal', v_existing.cost_total
    );
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_checkout_lines;
  CREATE TEMP TABLE pg_temp.pos_checkout_lines (
    line_index integer generated always as identity,
    catalog_item_id uuid not null,
    menu_item_id uuid,
    name text not null,
    quantity numeric(14,4) not null,
    unit_price numeric(12,4) not null,
    unit_name text not null,
    tax_rate numeric(8,4) not null,
    line_subtotal numeric(12,4) not null,
    line_tax numeric(12,4) not null,
    line_cost numeric(12,4) not null default 0,
    modifier_option_ids jsonb,
    modifier_summary text
  ) ON COMMIT DROP;

  DROP TABLE IF EXISTS pg_temp.pos_checkout_impacts;
  CREATE TEMP TABLE pg_temp.pos_checkout_impacts (
    item_id uuid primary key,
    quantity numeric(14,4) not null default 0,
    unit_cost numeric(12,4) not null default 0,
    total_cost numeric(12,4) not null default 0,
    is_negative_stock boolean not null default false,
    is_provisional_cost boolean not null default false
  ) ON COMMIT DROP;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric, unit_price numeric, modifier_option_ids jsonb, modifier_summary text)
  LOOP
    v_quantity := v_item.quantity;

    IF v_item.catalog_item_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'كمية أو صنف غير صالح في الفاتورة';
    END IF;

    SELECT *
    INTO v_catalog
    FROM public.catalog_items
    WHERE id = v_item.catalog_item_id
      AND organization_id = p_org_id
      AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الصنف غير موجود أو غير فعال: %', v_item.catalog_item_id;
    END IF;

    v_modifier_option_ids := v_item.modifier_option_ids;
    v_modifier_summary := COALESCE(v_item.modifier_summary, '');

    -- Calculate expected price (catalog retail price + sum of price_deltas of selected modifier options)
    v_modifiers_price_sum := 0;
    IF v_modifier_option_ids IS NOT NULL AND jsonb_typeof(v_modifier_option_ids) = 'array' AND jsonb_array_length(v_modifier_option_ids) > 0 THEN
      SELECT COALESCE(SUM(price_delta), 0)
      INTO v_modifiers_price_sum
      FROM public.modifier_options
      WHERE id IN (
        SELECT (opt.val)::uuid 
        FROM jsonb_array_elements_text(v_modifier_option_ids) AS opt(val)
      )
      AND organization_id = p_org_id;
    END IF;

    v_expected_unit_price := v_catalog.retail_price + v_modifiers_price_sum;

    -- Enforce catalog pricing constraints. Prevent cashier price manipulation.
    IF v_item.unit_price IS NOT NULL AND ABS(v_item.unit_price::numeric - v_expected_unit_price) > 0.01 THEN
      RAISE EXCEPTION 'سعر الصنف (%) غير مطابق للسعر المعتمد في الكتالوج مع الإضافات (%) لصنف: %', 
        v_item.unit_price, v_expected_unit_price, v_catalog.name;
    END IF;

    v_unit_price := v_expected_unit_price;
    v_line_subtotal := round((v_unit_price * v_quantity)::numeric, 4);
    v_line_tax := round((v_line_subtotal * COALESCE(v_catalog.tax_rate, 0) / 100)::numeric, 4);
    v_line_cost := 0;

    IF v_catalog.menu_item_id IS NOT NULL THEN
      FOR v_mapping IN
        SELECT *
        FROM public.menu_item_recipe_mapping
        WHERE organization_id = p_org_id
          AND menu_item_id = v_catalog.menu_item_id
      LOOP
        FOR v_ingredient IN
          SELECT *
          FROM public.recipe_ingredients
          WHERE organization_id = p_org_id
            AND recipe_id = v_mapping.recipe_id
        LOOP
          SELECT *
          INTO v_inventory
          FROM public.inventory_items
          WHERE id = v_ingredient.item_id
            AND organization_id = p_org_id
            AND status = 'active';

          IF NOT FOUND THEN
            RAISE EXCEPTION 'مادة وصفة غير موجودة أو غير فعالة: %', v_ingredient.item_id;
          END IF;

          v_deduct_qty :=
            (v_ingredient.quantity * COALESCE(v_mapping.portion_multiplier, 1) * v_quantity)
            / NULLIF(COALESCE(v_ingredient.yield_percent, 100) / 100, 0);

          -- Base Costing
          v_unit_cost := COALESCE(NULLIF(v_ingredient.unit_cost, 0), NULLIF(v_inventory.average_cost, 0), v_inventory.last_purchase_price, 0);

          -- Flag if cost is missing (truly zero or provisional fallback)
          v_is_provisional_cost := false;
          IF v_unit_cost = 0 THEN
            v_unit_cost := 0.1; -- fallback recipe cost
            v_is_provisional_cost := true;
          END IF;

          -- Check stock availability
          SELECT quantity INTO v_stock_qty
          FROM public.branch_stock
          WHERE organization_id = p_org_id
            AND branch_id = p_branch_id
            AND item_id = v_ingredient.item_id;

          IF NOT FOUND THEN
            v_stock_qty := 0;
          END IF;

          v_is_negative_stock := false;
          IF v_stock_qty < v_deduct_qty THEN
            v_is_negative_stock := true;
            v_is_provisional_cost := true;
            v_any_provisional := true;
          END IF;

          v_line_cost := v_line_cost + round((v_deduct_qty * v_unit_cost)::numeric, 4);

          INSERT INTO pg_temp.pos_checkout_impacts (item_id, quantity, unit_cost, total_cost, is_negative_stock, is_provisional_cost)
          VALUES (
            v_ingredient.item_id,
            v_deduct_qty,
            v_unit_cost,
            round((v_deduct_qty * v_unit_cost)::numeric, 4),
            v_is_negative_stock,
            v_is_provisional_cost
          )
          ON CONFLICT (item_id) DO UPDATE
            SET quantity = pos_checkout_impacts.quantity + excluded.quantity,
                total_cost = pos_checkout_impacts.total_cost + excluded.total_cost,
                is_negative_stock = pos_checkout_impacts.is_negative_stock OR excluded.is_negative_stock,
                is_provisional_cost = pos_checkout_impacts.is_provisional_cost OR excluded.is_provisional_cost,
                unit_cost = CASE
                  WHEN pos_checkout_impacts.quantity + excluded.quantity = 0 THEN excluded.unit_cost
                  ELSE round(
                    ((pos_checkout_impacts.total_cost + excluded.total_cost)
                      / NULLIF(pos_checkout_impacts.quantity + excluded.quantity, 0))::numeric,
                    4
                  )
                END;
        END LOOP;
      END LOOP;
    END IF;

    INSERT INTO pg_temp.pos_checkout_lines (
      catalog_item_id, menu_item_id, name, quantity, unit_price, unit_name,
      tax_rate, line_subtotal, line_tax, line_cost, modifier_option_ids, modifier_summary
    )
    VALUES (
      v_catalog.id,
      v_catalog.menu_item_id,
      v_catalog.name,
      v_quantity,
      v_unit_price,
      COALESCE(v_catalog.main_unit, 'قطعة'),
      COALESCE(v_catalog.tax_rate, 0),
      v_line_subtotal,
      v_line_tax,
      v_line_cost,
      v_modifier_option_ids,
      v_modifier_summary
    );

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax;
    v_cost_total := v_cost_total + v_line_cost;
  END LOOP;

  v_subtotal := round(v_subtotal, 4);
  v_tax_total := round(v_tax_total, 4);
  v_cost_total := round(v_cost_total, 4);

  -- Calculate total using formula: Subtotal - Discount + Tax + ServiceFee + DeliveryFee
  v_total := round(v_subtotal - COALESCE(p_discount, 0) + v_tax_total + COALESCE(p_service_fee, 0) + COALESCE(p_delivery_fee, 0), 4);
  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  -- Validate stock constraints under costing policy
  FOR v_impact IN
    SELECT * FROM pg_temp.pos_checkout_impacts
  LOOP
    SELECT quantity INTO v_stock_qty
    FROM public.branch_stock
    WHERE organization_id = p_org_id
      AND branch_id = p_branch_id
      AND item_id = v_impact.item_id;

    IF NOT FOUND THEN
      v_stock_qty := 0;
    END IF;

    IF v_stock_qty < v_impact.quantity THEN
      IF NOT v_allow_negative OR v_policy = 'strict_no_negative' THEN
        RAISE EXCEPTION 'لا توجد كمية كافية في المخزون للمادة %',
          (SELECT name FROM public.inventory_items WHERE id = v_impact.item_id);
      END IF;
    END IF;
  END LOOP;

  -- Validate payments
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    SELECT sum(round((val->>'amount')::numeric, 4))
    INTO v_payment_sum
    FROM jsonb_array_elements(p_payments) AS val;

    IF ABS(v_payment_sum - v_total) > 0.01 THEN
      RAISE EXCEPTION 'مجموع المدفوعات (%) لا يساوي إجمالي الفاتورة (%)', v_payment_sum, v_total;
    END IF;
  END IF;

  -- Open shift or fetch shift
  SELECT id INTO v_shift_id
  FROM public.sales_shifts
  WHERE organization_id = p_org_id
    AND branch_id = p_branch_id
    AND status = 'open'
    AND device_key_id = p_device_key_id
  ORDER BY opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_shift_id IS NULL THEN
    INSERT INTO public.sales_shifts (
      organization_id, branch_id, device_key_id, cashier_name, status, opening_cash, expected_cash
    )
    VALUES (
      p_org_id, p_branch_id, p_device_key_id, COALESCE(NULLIF(p_device_name, ''), 'كاشير'), 'open', 0, 0
    )
    RETURNING id INTO v_shift_id;

    INSERT INTO public.cash_drawer_entries (
      organization_id, branch_id, shift_id, entry_type, amount, memo
    )
    VALUES (
      p_org_id, p_branch_id, v_shift_id, 'opening', 0, 'رصيد افتتاحي تلقائي للوردية'
    );
  END IF;

  -- Atomic invoice numbering using invoice_counters
  v_next_invoice_num := public.get_next_invoice_number(p_org_id, p_branch_id);
  v_invoice_number := 'POS-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(v_next_invoice_num::text, 6, '0');

  -- Insert Customer Invoice
  INSERT INTO public.customer_invoices (
    organization_id, branch_id, invoice_number, customer_name, status,
    payment_method, channel, subtotal, discount, tax_total, total,
    cost_total, gross_profit, idempotency_key, shift_id, notes, is_provisional_cogs
  )
  VALUES (
    p_org_id, p_branch_id, v_invoice_number, COALESCE(NULLIF(p_customer_name, ''), 'عميل سفري سريع'), 'paid',
    COALESCE(p_payment_method, 'cash')::payment_method, 'pickup', v_subtotal, COALESCE(p_discount, 0), v_tax_total, v_total,
    v_cost_total, v_total - v_cost_total, p_idempotency_key, v_shift_id, 'فاتورة كاشير ذرية', v_any_provisional
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.customer_invoice_items (
    organization_id, customer_invoice_id, catalog_item_id, menu_item_id,
    name, quantity, unit_price, unit_name, unit_factor, discount,
    tax_rate, cost_total, gross_profit, modifier_option_ids, modifier_summary
  )
  SELECT
    p_org_id, v_invoice_id, catalog_item_id, menu_item_id,
    name, quantity, unit_price, unit_name, 1, 0,
    tax_rate, line_cost, line_subtotal - line_cost, modifier_option_ids, modifier_summary
  FROM pg_temp.pos_checkout_lines
  ORDER BY line_index;

  -- Apply stock deductions and movements
  FOR v_impact IN
    SELECT * FROM pg_temp.pos_checkout_impacts
  LOOP
    SELECT id INTO v_stock_id
    FROM public.branch_stock
    WHERE organization_id = p_org_id
      AND branch_id = p_branch_id
      AND item_id = v_impact.item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity)
      VALUES (p_org_id, p_branch_id, v_impact.item_id, -v_impact.quantity, 0);
    ELSE
      UPDATE public.branch_stock
      SET quantity = quantity - v_impact.quantity,
          updated_at = now()
      WHERE id = v_stock_id;
    END IF;

    INSERT INTO public.stock_movements (
      organization_id, branch_id, item_id, movement_type, quantity,
      unit_cost, source_doc_type, source_doc_id, idempotency_key, notes,
      is_negative_stock, is_provisional_cost
    )
    VALUES (
      p_org_id, p_branch_id, v_impact.item_id, 'sale_usage', -v_impact.quantity,
      v_impact.unit_cost, 'customer_invoice', v_invoice_id,
      v_invoice_id::text || ':' || v_impact.item_id::text || ':sale_usage',
      'خصم تلقائي للمبيعات الذرية - فاتورة ' || v_invoice_number,
      v_impact.is_negative_stock, v_impact.is_provisional_cost
    );
  END LOOP;

  -- Register payments
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    FOR v_pay_line IN SELECT * FROM jsonb_array_elements(p_payments) AS x(method text, amount numeric) LOOP
      IF round(v_pay_line.amount, 4) > 0 THEN
        INSERT INTO public.customer_invoice_payments (
          organization_id, customer_invoice_id, payment_method, amount
        )
        VALUES (
          p_org_id, v_invoice_id, v_pay_line.method::payment_method, round(v_pay_line.amount, 4)
        );

        -- Update shift metrics
        UPDATE public.sales_shifts
        SET cash_sales = cash_sales + CASE WHEN v_pay_line.method = 'cash' THEN round(v_pay_line.amount, 4) ELSE 0 END,
            card_sales = card_sales + CASE WHEN v_pay_line.method = 'card' THEN round(v_pay_line.amount, 4) ELSE 0 END,
            expected_cash = expected_cash + CASE WHEN v_pay_line.method = 'cash' THEN round(v_pay_line.amount, 4) ELSE 0 END,
            updated_at = now()
        WHERE id = v_shift_id;

        IF v_pay_line.method = 'cash' OR v_pay_line.method = 'card' THEN
          INSERT INTO public.cash_drawer_entries (
            organization_id, branch_id, shift_id, entry_type, amount,
            reference_doc_type, reference_doc_id, memo
          )
          VALUES (
            p_org_id, p_branch_id, v_shift_id,
            CASE WHEN v_pay_line.method = 'cash' THEN 'cash_sale' ELSE 'card_sale' END,
            round(v_pay_line.amount, 4),
            'customer_invoice', v_invoice_id, 'تحصيل تلقائي للمبيعات الذرية'
          );
        END IF;
      END IF;
    END LOOP;
  ELSE
    INSERT INTO public.customer_invoice_payments (
      organization_id, customer_invoice_id, payment_method, amount
    )
    VALUES (
      p_org_id, v_invoice_id, COALESCE(p_payment_method, 'cash')::payment_method, v_total
    );

    v_drawer_type := CASE WHEN p_payment_method = 'cash' THEN 'cash_sale' ELSE 'card_sale' END;

    IF p_payment_method = 'cash' OR p_payment_method = 'card' THEN
      INSERT INTO public.cash_drawer_entries (
        organization_id, branch_id, shift_id, entry_type, amount,
        reference_doc_type, reference_doc_id, memo
      )
      VALUES (
        p_org_id, p_branch_id, v_shift_id, v_drawer_type, v_total,
        'customer_invoice', v_invoice_id, 'تحصيل تلقائي للمبيعات الذرية'
      );
    END IF;

    UPDATE public.sales_shifts
    SET cash_sales = cash_sales + CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END,
        card_sales = card_sales + CASE WHEN p_payment_method = 'card' THEN v_total ELSE 0 END,
        expected_cash = expected_cash + CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END,
        updated_at = now()
    WHERE id = v_shift_id;
  END IF;

  -- Daily summary update
  INSERT INTO public.sales_daily_summaries (
    organization_id, branch_id, summary_date, channel,
    orders_count, sales_total, ingredient_cost_total
  )
  VALUES (
    p_org_id, p_branch_id, current_date, 'pickup',
    1, v_total, v_cost_total
  )
  ON CONFLICT (organization_id, branch_id, summary_date, channel) DO UPDATE
    SET orders_count = public.sales_daily_summaries.orders_count + 1,
        sales_total = public.sales_daily_summaries.sales_total + excluded.sales_total,
        ingredient_cost_total = public.sales_daily_summaries.ingredient_cost_total + excluded.ingredient_cost_total,
        updated_at = now();

  -- Seeding and posting balanced journal entries
  PERFORM public.ensure_default_chart_accounts(p_org_id);

  SELECT id INTO v_cash_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cash_on_hand' AND is_active = true;
  SELECT id INTO v_card_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'bank_card' AND is_active = true;
  SELECT id INTO v_receivable_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'accounts_receivable' AND is_active = true;
  SELECT id INTO v_revenue_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_revenue' AND is_active = true;
  SELECT id INTO v_discount_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_discounts' AND is_active = true;
  SELECT id INTO v_tax_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'output_tax_payable' AND is_active = true;
  SELECT id INTO v_service_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'service_fee_revenue' AND is_active = true;
  SELECT id INTO v_delivery_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'delivery_revenue' AND is_active = true;
  SELECT id INTO v_cogs_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cogs' AND is_active = true;
  SELECT id INTO v_inv_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'inventory' AND is_active = true;

  v_je_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'journal_entry', 'JE-');

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status
  )
  VALUES (
    p_org_id, p_branch_id, v_je_number, current_date,
    'customer_invoice', v_invoice_id, 'قيد تلقائي لمبيعات الكاشير - فاتورة ' || v_invoice_number, 'posted'
  )
  RETURNING id INTO v_je_id;

  -- 1. Payments debit lines
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    FOR v_pay_line IN SELECT * FROM jsonb_array_elements(p_payments) AS x(method text, amount numeric) LOOP
      IF round(v_pay_line.amount, 4) > 0 THEN
        v_acct_id := CASE
          WHEN v_pay_line.method = 'cash' THEN v_cash_acct_id
          WHEN v_pay_line.method = 'card' THEN v_card_acct_id
          WHEN v_pay_line.method = 'bank_transfer' THEN v_card_acct_id
          WHEN v_pay_line.method = 'delivery_app' THEN v_card_acct_id
          WHEN v_pay_line.method = 'receivable' THEN v_receivable_acct_id
          WHEN v_pay_line.method = 'wallet' THEN v_card_acct_id
          WHEN v_pay_line.method = 'gift_card' THEN v_card_acct_id
          ELSE v_cash_acct_id
        END;

        INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
        VALUES (p_org_id, v_je_id, v_acct_id, p_branch_id, round(v_pay_line.amount, 4), 0, 'تحصيل دفعة ' || v_pay_line.method || ' فاتورة ' || v_invoice_number);
      END IF;
    END LOOP;
  ELSE
    IF v_total > 0 THEN
      v_acct_id := CASE WHEN p_payment_method = 'cash' THEN v_cash_acct_id ELSE v_card_acct_id END;
      INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
      VALUES (p_org_id, v_je_id, v_acct_id, p_branch_id, v_total, 0, 'تحصيل فاتورة ' || v_invoice_number);
    END IF;
  END IF;

  -- 2. Sales Discounts (debit) line
  IF p_discount > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_discount_acct_id, p_branch_id, round(p_discount, 4), 0, 'خصم مسموح به فاتورة ' || v_invoice_number);
  END IF;

  -- 3. Sales Revenue (credit) line
  IF v_subtotal > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_revenue_acct_id, p_branch_id, 0, v_subtotal, 'مبيعات فاتورة ' || v_invoice_number);
  END IF;

  -- 4. Output Tax (credit) line
  IF v_tax_total > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_tax_acct_id, p_branch_id, 0, v_tax_total, 'ضريبة فاتورة ' || v_invoice_number);
  END IF;

  -- 5. Service Fee Revenue (credit) line
  IF p_service_fee > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_service_acct_id, p_branch_id, 0, round(p_service_fee, 4), 'رسوم خدمة فاتورة ' || v_invoice_number);
  END IF;

  -- 6. Delivery Revenue (credit) line
  IF p_delivery_fee > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_delivery_acct_id, p_branch_id, 0, round(p_delivery_fee, 4), 'رسوم توصيل فاتورة ' || v_invoice_number);
  END IF;

  -- 7. COGS & Inventory lines
  IF v_cost_total > 0 THEN
    INSERT INTO public.journal_lines (organization_id, branch_id, journal_entry_id, account_id, debit, credit, memo, is_provisional_cost)
    VALUES
      (p_org_id, p_branch_id, v_je_id, v_cogs_acct_id, v_cost_total, 0, 'تكلفة مبيعات فاتورة ' || v_invoice_number, v_any_provisional),
      (p_org_id, p_branch_id, v_je_id, v_inv_acct_id, 0, v_cost_total, 'خصم مخزون فاتورة ' || v_invoice_number, v_any_provisional);
  END IF;

  -- Kitchen ticket generation
  v_ticket_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'kitchen_ticket', 'KOT-');

  INSERT INTO public.kitchen_tickets (
    organization_id, branch_id, customer_invoice_id, shift_id,
    ticket_number, customer_name, channel, status, notes
  )
  VALUES (
    p_org_id, p_branch_id, v_invoice_id, v_shift_id,
    v_ticket_number, COALESCE(NULLIF(p_customer_name, ''), 'عميل سفري سريع'), 'pickup', 'pending',
    'تذكرة مطبخ من جهاز الكاشير الذري - فاتورة ' || v_invoice_number
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.kitchen_ticket_items (
    organization_id, kitchen_ticket_id, menu_item_id, catalog_item_id, name, quantity, modifier_summary
  )
  SELECT
    p_org_id, v_ticket_id, menu_item_id, catalog_item_id, name, quantity, modifier_summary
  FROM pg_temp.pos_checkout_lines
  WHERE menu_item_id IS NOT NULL
  ORDER BY line_index;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'invoiceId', v_invoice_id,
    'invoiceNumber', v_invoice_number,
    'kitchenTicketId', v_ticket_id,
    'shiftId', v_shift_id,
    'total', v_total,
    'costTotal', v_cost_total
  );
END;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 044_atomic_supplier_payments.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- P0 hardening: supplier payments must be atomic, idempotent, and linked to
-- the payment document, not the invoice. Do not apply to production before
-- reviewing the validation queries in docs/audits/REWAQ_AUDIT_REMEDIATION_PLAN_AR.md.

ALTER TABLE public.supplier_payments
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_payments_org_idempotency_unique
  ON public.supplier_payments (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS supplier_payments_journal_entry_idx
  ON public.supplier_payments (organization_id, journal_entry_id);

CREATE OR REPLACE FUNCTION public.record_supplier_payment_atomic(
  p_organization_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_reference text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_payment record;
  v_invoice record;
  v_supplier_name text;
  v_amount numeric(14,4);
  v_new_paid numeric(14,4);
  v_new_balance numeric(14,4);
  v_new_status text;
  v_payment_id uuid;
  v_journal_entry_id uuid;
  v_journal_number text;
  v_ap_account_id uuid;
  v_credit_account_id uuid;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى هذه المؤسسة.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'المبلغ يجب أن يكون أكبر من صفر.';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب.';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ الدفع مطلوب.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT sp.id, sp.invoice_id, sp.amount, sp.journal_entry_id
      INTO v_existing_payment
    FROM public.supplier_payments sp
    WHERE sp.organization_id = p_organization_id
      AND sp.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'duplicate', true,
        'payment_id', v_existing_payment.id,
        'invoice_id', v_existing_payment.invoice_id,
        'journal_entry_id', v_existing_payment.journal_entry_id
      );
    END IF;
  END IF;

  IF public.is_accounting_period_closed(p_organization_id, p_payment_date) THEN
    RAISE EXCEPTION 'هذه الفترة المحاسبية مقفلة. أعد فتح الفترة قبل تسجيل دفعة المورد.';
  END IF;

  SELECT i.id, i.invoice_number, i.supplier_id, i.branch_id, i.total,
         i.paid_amount, i.balance_due, i.status, i.payment_status
    INTO v_invoice
  FROM public.invoices i
  WHERE i.id = p_invoice_id
    AND i.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الفاتورة غير موجودة.';
  END IF;

  -- Recheck after the invoice lock so two concurrent retries with the same
  -- key return the first payment instead of racing into the unique index.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT sp.id, sp.invoice_id, sp.amount, sp.journal_entry_id
      INTO v_existing_payment
    FROM public.supplier_payments sp
    WHERE sp.organization_id = p_organization_id
      AND sp.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'duplicate', true,
        'payment_id', v_existing_payment.id,
        'invoice_id', v_existing_payment.invoice_id,
        'journal_entry_id', v_existing_payment.journal_entry_id
      );
    END IF;
  END IF;

  IF v_invoice.status = 'void' THEN
    RAISE EXCEPTION 'لا يمكن دفع فاتورة ملغاة.';
  END IF;

  v_amount := round(p_amount::numeric, 4);
  v_new_balance := round(COALESCE(v_invoice.balance_due, v_invoice.total, 0)::numeric - v_amount, 4);

  IF v_new_balance < -0.001 THEN
    RAISE EXCEPTION 'المبلغ أكبر من الرصيد المستحق.';
  END IF;

  v_new_balance := GREATEST(0, v_new_balance);
  v_new_paid := round(COALESCE(v_invoice.paid_amount, 0)::numeric + v_amount, 4);
  v_new_status := CASE WHEN v_new_balance <= 0.001 THEN 'paid' ELSE 'partially_paid' END;

  SELECT COALESCE(s.name, 'مورد')
    INTO v_supplier_name
  FROM public.suppliers s
  WHERE s.id = v_invoice.supplier_id
  LIMIT 1;

  v_supplier_name := COALESCE(v_supplier_name, 'مورد');

  PERFORM public.ensure_default_chart_accounts(p_organization_id);

  SELECT id INTO v_ap_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_organization_id
    AND system_key = 'accounts_payable'
    AND is_active = true
  LIMIT 1;

  SELECT id INTO v_credit_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_organization_id
    AND system_key = CASE WHEN p_payment_method = 'cash' THEN 'cash_on_hand' ELSE 'bank_card' END
    AND is_active = true
  LIMIT 1;

  IF v_ap_account_id IS NULL OR v_credit_account_id IS NULL THEN
    RAISE EXCEPTION 'حسابات الدفع المحاسبية غير مكتملة.';
  END IF;

  INSERT INTO public.supplier_payments (
    organization_id,
    invoice_id,
    supplier_id,
    branch_id,
    amount,
    payment_method,
    payment_date,
    reference,
    idempotency_key,
    created_by
  ) VALUES (
    p_organization_id,
    p_invoice_id,
    v_invoice.supplier_id,
    v_invoice.branch_id,
    v_amount,
    p_payment_method,
    p_payment_date,
    p_reference,
    p_idempotency_key,
    p_created_by
  )
  RETURNING id INTO v_payment_id;

  v_journal_number := 'JE-' || to_char(current_date, 'YYYYMMDD') || '-SUP-' || left(replace(v_payment_id::text, '-', ''), 8);

  INSERT INTO public.journal_entries (
    organization_id,
    branch_id,
    entry_number,
    entry_date,
    source_doc_type,
    source_doc_id,
    memo,
    status,
    created_by
  ) VALUES (
    p_organization_id,
    v_invoice.branch_id,
    v_journal_number,
    p_payment_date,
    'supplier_payment',
    v_payment_id,
    'دفع فاتورة مورد ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text) || ' - ' || v_supplier_name,
    'posted',
    p_created_by
  )
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO public.journal_lines (
    organization_id,
    journal_entry_id,
    account_id,
    branch_id,
    debit,
    credit,
    memo
  ) VALUES
    (
      p_organization_id,
      v_journal_entry_id,
      v_ap_account_id,
      v_invoice.branch_id,
      v_amount,
      0,
      'سداد ذمم مورد ' || v_supplier_name
    ),
    (
      p_organization_id,
      v_journal_entry_id,
      v_credit_account_id,
      v_invoice.branch_id,
      0,
      v_amount,
      'دفع نقدي/بنكي فاتورة مورد ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text)
    );

  UPDATE public.supplier_payments
  SET journal_entry_id = v_journal_entry_id
  WHERE id = v_payment_id
    AND organization_id = p_organization_id;

  UPDATE public.invoices
  SET paid_amount = v_new_paid,
      balance_due = v_new_balance,
      payment_status = v_new_status,
      status = v_new_status
  WHERE id = p_invoice_id
    AND organization_id = p_organization_id;

  INSERT INTO public.audit_logs (
    organization_id,
    branch_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) VALUES (
    p_organization_id,
    v_invoice.branch_id,
    p_created_by,
    'supplier_payment',
    'invoice',
    p_invoice_id,
    jsonb_build_object('balance_due', v_invoice.balance_due, 'paid_amount', v_invoice.paid_amount),
    jsonb_build_object('payment_id', v_payment_id, 'amount', v_amount, 'balance_due', v_new_balance, 'paid_amount', v_new_paid)
  );

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'payment_id', v_payment_id,
    'invoice_id', p_invoice_id,
    'journal_entry_id', v_journal_entry_id,
    'balance_due', v_new_balance,
    'paid_amount', v_new_paid,
    'payment_status', v_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_supplier_payment_atomic(uuid, uuid, numeric, text, date, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_supplier_payment_atomic(uuid, uuid, numeric, text, date, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_supplier_payment_atomic(uuid, uuid, numeric, text, date, text, text, uuid) TO service_role;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 045_atomic_purchasing_cycle.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- P0 hardening: purchase orders, goods receipts, and supplier invoices must
-- commit their document, stock, accounting, and audit effects together.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_org_idempotency_unique
  ON public.purchase_orders (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_org_idempotency_unique
  ON public.invoices (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_purchase_order_atomic(
  p_organization_id uuid,
  p_supplier_id uuid,
  p_branch_id uuid,
  p_item_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_order_date date,
  p_status public.purchase_order_status DEFAULT 'sent',
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_order_id uuid;
  v_total numeric(14,4);
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى هذه المؤسسة.';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب.';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'كمية أمر الشراء يجب أن تكون أكبر من صفر.';
  END IF;
  IF p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION 'سعر أمر الشراء غير صالح.';
  END IF;
  IF p_order_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ أمر الشراء مطلوب.';
  END IF;
  IF p_status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'يمكن إنشاء أمر الشراء بحالة مسودة أو مرسل فقط.';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.purchase_orders
  WHERE organization_id = p_organization_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'purchase_order_id', v_existing_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE id = p_supplier_id AND organization_id = p_organization_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'المورد غير موجود أو غير نشط.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_branch_id AND organization_id = p_organization_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'الفرع غير موجود أو غير نشط.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_items
    WHERE id = p_item_id AND organization_id = p_organization_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'صنف المخزون غير موجود أو غير نشط.';
  END IF;

  v_total := round(p_quantity::numeric * p_unit_price::numeric, 4);

  INSERT INTO public.purchase_orders (
    organization_id, supplier_id, branch_id, status, order_date, total,
    notes, idempotency_key, created_by
  ) VALUES (
    p_organization_id, p_supplier_id, p_branch_id, p_status, p_order_date,
    v_total, NULLIF(btrim(p_notes), ''), p_idempotency_key, p_created_by
  )
  ON CONFLICT (organization_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    SELECT id INTO v_existing_id
    FROM public.purchase_orders
    WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'purchase_order_id', v_existing_id);
  END IF;

  INSERT INTO public.purchase_order_items (
    organization_id, purchase_order_id, item_id, quantity,
    expected_unit_price, received_quantity, created_by
  ) VALUES (
    p_organization_id, v_order_id, p_item_id, round(p_quantity::numeric, 4),
    round(p_unit_price::numeric, 4), 0, p_created_by
  );

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) VALUES (
    p_organization_id, p_branch_id, p_created_by, 'purchase_order_created',
    'purchase_order', v_order_id,
    jsonb_build_object('supplier_id', p_supplier_id, 'item_id', p_item_id,
      'quantity', p_quantity, 'unit_price', p_unit_price, 'total', v_total, 'status', p_status)
  );

  RETURN jsonb_build_object(
    'success', true, 'duplicate', false, 'purchase_order_id', v_order_id, 'total', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_purchase_receipt_atomic(
  p_organization_id uuid,
  p_purchase_order_id uuid,
  p_received_at date,
  p_idempotency_key text,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_item record;
  v_existing_receipt record;
  v_receipt_id uuid;
  v_journal_entry_id uuid;
  v_inventory_account_id uuid;
  v_grni_account_id uuid;
  v_receipt_total numeric(14,4) := 0;
  v_quantity_to_receive numeric(14,4);
  v_line_total numeric(14,4);
  v_old_org_stock numeric(14,4);
  v_old_average_cost numeric(14,4);
  v_new_average_cost numeric(14,4);
  v_lines_count integer := 0;
  v_all_received boolean;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى هذه المؤسسة.';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب.';
  END IF;
  IF p_received_at IS NULL THEN
    RAISE EXCEPTION 'تاريخ الاستلام مطلوب.';
  END IF;

  SELECT id, purchase_order_id, total INTO v_existing_receipt
  FROM public.goods_receipts
  WHERE organization_id = p_organization_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'duplicate', true, 'receipt_id', v_existing_receipt.id,
      'purchase_order_id', v_existing_receipt.purchase_order_id, 'total', v_existing_receipt.total
    );
  END IF;

  SELECT po.id, po.supplier_id, po.branch_id, po.status
    INTO v_order
  FROM public.purchase_orders po
  WHERE po.id = p_purchase_order_id
    AND po.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'أمر الشراء غير موجود.';
  END IF;
  IF v_order.status IN ('draft', 'cancelled') THEN
    RAISE EXCEPTION 'يجب إرسال أمر الشراء قبل استلامه ولا يمكن استلام أمر ملغى.';
  END IF;

  SELECT id, purchase_order_id, total INTO v_existing_receipt
  FROM public.goods_receipts
  WHERE organization_id = p_organization_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'duplicate', true, 'receipt_id', v_existing_receipt.id,
      'purchase_order_id', v_existing_receipt.purchase_order_id, 'total', v_existing_receipt.total
    );
  END IF;

  IF public.is_accounting_period_closed(p_organization_id, p_received_at) THEN
    RAISE EXCEPTION 'هذه الفترة المحاسبية مقفلة. أعد فتحها قبل تسجيل الاستلام.';
  END IF;

  INSERT INTO public.goods_receipts (
    organization_id, purchase_order_id, supplier_id, branch_id, receipt_number,
    idempotency_key, received_at, total, status, created_by
  ) VALUES (
    p_organization_id, p_purchase_order_id, v_order.supplier_id, v_order.branch_id,
    'GR-' || to_char(p_received_at, 'YYYYMMDD') || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8),
    p_idempotency_key, p_received_at, 0, 'posted', p_created_by
  ) RETURNING id INTO v_receipt_id;

  FOR v_item IN
    SELECT poi.id, poi.item_id, poi.quantity, poi.received_quantity, poi.expected_unit_price
    FROM public.purchase_order_items poi
    WHERE poi.organization_id = p_organization_id
      AND poi.purchase_order_id = p_purchase_order_id
    ORDER BY poi.id
    FOR UPDATE
  LOOP
    v_quantity_to_receive := round(GREATEST(0,
      COALESCE(v_item.quantity, 0) - COALESCE(v_item.received_quantity, 0))::numeric, 4);
    IF v_quantity_to_receive <= 0 THEN
      CONTINUE;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || v_item.item_id::text, 0));

    SELECT COALESCE(sum(bs.quantity), 0), COALESCE(ii.average_cost, 0)
      INTO v_old_org_stock, v_old_average_cost
    FROM public.inventory_items ii
    LEFT JOIN public.branch_stock bs
      ON bs.organization_id = ii.organization_id AND bs.item_id = ii.id
    WHERE ii.id = v_item.item_id AND ii.organization_id = p_organization_id
    GROUP BY ii.average_cost;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'أحد أصناف أمر الشراء غير موجود.';
    END IF;

    INSERT INTO public.branch_stock (
      organization_id, branch_id, item_id, quantity, reserved_quantity, created_by
    ) VALUES (
      p_organization_id, v_order.branch_id, v_item.item_id, 0, 0, p_created_by
    ) ON CONFLICT (branch_id, item_id) DO NOTHING;

    PERFORM 1 FROM public.branch_stock
    WHERE organization_id = p_organization_id
      AND branch_id = v_order.branch_id
      AND item_id = v_item.item_id
    FOR UPDATE;

    UPDATE public.branch_stock
    SET quantity = quantity + v_quantity_to_receive, updated_at = now()
    WHERE organization_id = p_organization_id
      AND branch_id = v_order.branch_id
      AND item_id = v_item.item_id;

    v_line_total := round(v_quantity_to_receive * COALESCE(v_item.expected_unit_price, 0), 4);

    INSERT INTO public.stock_movements (
      organization_id, branch_id, item_id, movement_type, quantity, unit_cost,
      source_doc_type, source_doc_id, idempotency_key, notes, created_by
    ) VALUES (
      p_organization_id, v_order.branch_id, v_item.item_id, 'purchase',
      v_quantity_to_receive, COALESCE(v_item.expected_unit_price, 0),
      'goods_receipt', v_receipt_id, v_receipt_id::text || ':' || v_item.id::text,
      'استلام أمر شراء', p_created_by
    );

    INSERT INTO public.goods_receipt_items (
      organization_id, goods_receipt_id, purchase_order_item_id, item_id,
      quantity, unit_cost, total
    ) VALUES (
      p_organization_id, v_receipt_id, v_item.id, v_item.item_id,
      v_quantity_to_receive, COALESCE(v_item.expected_unit_price, 0), v_line_total
    );

    UPDATE public.purchase_order_items
    SET received_quantity = COALESCE(received_quantity, 0) + v_quantity_to_receive,
        updated_at = now()
    WHERE id = v_item.id AND organization_id = p_organization_id;

    INSERT INTO public.supplier_price_history (
      organization_id, supplier_id, item_id, unit_price,
      source_doc_type, source_doc_id, created_by
    )
    SELECT
      p_organization_id, v_order.supplier_id, v_item.item_id,
      COALESCE(v_item.expected_unit_price, 0), 'goods_receipt', v_receipt_id, p_created_by
    WHERE NOT EXISTS (
      SELECT 1 FROM public.supplier_price_history sph
      WHERE sph.organization_id = p_organization_id
        AND sph.source_doc_type = 'goods_receipt'
        AND sph.source_doc_id = v_receipt_id
        AND sph.item_id = v_item.item_id
    );

    v_new_average_cost := CASE
      WHEN v_old_org_stock + v_quantity_to_receive <= 0 THEN COALESCE(v_item.expected_unit_price, 0)
      ELSE round(((v_old_average_cost * v_old_org_stock) + v_line_total)
        / (v_old_org_stock + v_quantity_to_receive), 4)
    END;

    UPDATE public.inventory_items
    SET average_cost = v_new_average_cost,
        last_purchase_price = COALESCE(v_item.expected_unit_price, 0),
        updated_at = now()
    WHERE id = v_item.item_id AND organization_id = p_organization_id;

    v_receipt_total := v_receipt_total + v_line_total;
    v_lines_count := v_lines_count + 1;
  END LOOP;

  IF v_lines_count = 0 THEN
    RAISE EXCEPTION 'لا توجد كميات جديدة لاستلامها في هذا الأمر.';
  END IF;

  UPDATE public.goods_receipts
  SET total = round(v_receipt_total, 4)
  WHERE id = v_receipt_id AND organization_id = p_organization_id;

  SELECT bool_and(COALESCE(received_quantity, 0) >= quantity)
    INTO v_all_received
  FROM public.purchase_order_items
  WHERE organization_id = p_organization_id AND purchase_order_id = p_purchase_order_id;

  UPDATE public.purchase_orders
  SET status = CASE WHEN COALESCE(v_all_received, false) THEN 'received' ELSE 'partially_received' END,
      updated_at = now()
  WHERE id = p_purchase_order_id AND organization_id = p_organization_id;

  PERFORM public.ensure_default_chart_accounts(p_organization_id);
  SELECT id INTO v_inventory_account_id FROM public.chart_of_accounts
    WHERE organization_id = p_organization_id AND system_key = 'inventory' AND is_active LIMIT 1;
  SELECT id INTO v_grni_account_id FROM public.chart_of_accounts
    WHERE organization_id = p_organization_id AND system_key = 'goods_received_not_invoiced' AND is_active LIMIT 1;
  IF v_inventory_account_id IS NULL OR v_grni_account_id IS NULL THEN
    RAISE EXCEPTION 'حسابات استلام المخزون غير مكتملة.';
  END IF;

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_number, entry_date, source_doc_type,
    source_doc_id, memo, status, created_by
  ) VALUES (
    p_organization_id, v_order.branch_id,
    'JE-' || to_char(p_received_at, 'YYYYMMDD') || '-GR-' || left(replace(v_receipt_id::text, '-', ''), 8),
    p_received_at, 'purchase_receipt', v_receipt_id,
    'قيد استلام أمر شراء ' || p_purchase_order_id::text, 'posted', p_created_by
  ) RETURNING id INTO v_journal_entry_id;

  INSERT INTO public.journal_lines (
    organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
  ) VALUES
    (p_organization_id, v_journal_entry_id, v_inventory_account_id, v_order.branch_id,
      round(v_receipt_total, 4), 0, 'استلام مخزون أمر شراء'),
    (p_organization_id, v_journal_entry_id, v_grni_account_id, v_order.branch_id,
      0, round(v_receipt_total, 4), 'بضاعة مستلمة غير مفوترة');

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) VALUES (
    p_organization_id, v_order.branch_id, p_created_by, 'purchase_receipt_posted',
    'goods_receipt', v_receipt_id,
    jsonb_build_object('purchase_order_id', p_purchase_order_id, 'total', v_receipt_total,
      'lines_count', v_lines_count, 'journal_entry_id', v_journal_entry_id)
  );

  RETURN jsonb_build_object(
    'success', true, 'duplicate', false, 'receipt_id', v_receipt_id,
    'purchase_order_id', p_purchase_order_id, 'journal_entry_id', v_journal_entry_id,
    'total', round(v_receipt_total, 4), 'lines_count', v_lines_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_supplier_invoice_atomic(
  p_organization_id uuid,
  p_supplier_id uuid,
  p_branch_id uuid,
  p_invoice_number text,
  p_issued_at date,
  p_due_date date,
  p_item_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_purchase_order_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_expiry_date date DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_invoice record;
  v_order record;
  v_invoice_id uuid;
  v_journal_entry_id uuid;
  v_debit_account_id uuid;
  v_ap_account_id uuid;
  v_total numeric(14,4);
  v_received_quantity numeric(14,4);
  v_previously_invoiced_quantity numeric(14,4);
  v_old_org_stock numeric(14,4);
  v_old_average_cost numeric(14,4);
  v_new_average_cost numeric(14,4);
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى هذه المؤسسة.';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب.';
  END IF;
  IF p_invoice_number IS NULL OR btrim(p_invoice_number) = '' THEN
    RAISE EXCEPTION 'رقم فاتورة المورد مطلوب.';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION 'كمية أو سعر الفاتورة غير صالح.';
  END IF;
  IF p_issued_at IS NULL OR p_due_date IS NULL OR p_due_date < p_issued_at THEN
    RAISE EXCEPTION 'تواريخ الفاتورة أو الاستحقاق غير صالحة.';
  END IF;

  SELECT id, total INTO v_existing_invoice
  FROM public.invoices
  WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true,
      'invoice_id', v_existing_invoice.id, 'total', v_existing_invoice.total);
  END IF;

  IF public.is_accounting_period_closed(p_organization_id, p_issued_at) THEN
    RAISE EXCEPTION 'هذه الفترة المحاسبية مقفلة. أعد فتحها قبل تسجيل الفاتورة.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND organization_id = p_organization_id) THEN
    RAISE EXCEPTION 'المورد غير موجود.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id AND organization_id = p_organization_id) THEN
    RAISE EXCEPTION 'الفرع غير موجود.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE id = p_item_id AND organization_id = p_organization_id) THEN
    RAISE EXCEPTION 'صنف المخزون غير موجود.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE organization_id = p_organization_id
      AND supplier_id = p_supplier_id
      AND invoice_number = p_invoice_number
      AND status <> 'void'
  ) THEN
    RAISE EXCEPTION 'رقم فاتورة المورد مسجل مسبقاً لهذا المورد.';
  END IF;

  v_total := round(p_quantity::numeric * p_unit_price::numeric, 4);

  IF p_purchase_order_id IS NOT NULL THEN
    SELECT po.id, po.supplier_id, po.branch_id, po.status INTO v_order
    FROM public.purchase_orders po
    WHERE po.id = p_purchase_order_id AND po.organization_id = p_organization_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'أمر الشراء المرتبط غير موجود.';
    END IF;
    IF v_order.supplier_id <> p_supplier_id OR v_order.branch_id <> p_branch_id THEN
      RAISE EXCEPTION 'المورد أو الفرع لا يطابق أمر الشراء.';
    END IF;

    SELECT COALESCE(sum(poi.received_quantity), 0) INTO v_received_quantity
    FROM public.purchase_order_items poi
    WHERE poi.organization_id = p_organization_id
      AND poi.purchase_order_id = p_purchase_order_id
      AND poi.item_id = p_item_id;

    SELECT COALESCE(sum(ii.quantity), 0) INTO v_previously_invoiced_quantity
    FROM public.invoice_items ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    WHERE i.organization_id = p_organization_id
      AND i.purchase_order_id = p_purchase_order_id
      AND i.status <> 'void'
      AND ii.item_id = p_item_id;

    IF p_quantity > v_received_quantity - v_previously_invoiced_quantity + 0.0001 THEN
      RAISE EXCEPTION 'كمية الفاتورة تتجاوز الكمية المستلمة غير المفوترة لهذا الصنف.';
    END IF;
  END IF;

  INSERT INTO public.invoices (
    organization_id, supplier_id, branch_id, purchase_order_id, invoice_number,
    status, total, issued_at, due_date, payment_method, payment_status,
    paid_amount, balance_due, idempotency_key, created_by
  ) VALUES (
    p_organization_id, p_supplier_id, p_branch_id, p_purchase_order_id,
    btrim(p_invoice_number), 'posted', v_total, p_issued_at, p_due_date,
    p_payment_method, 'unpaid', 0, v_total, p_idempotency_key, p_created_by
  )
  ON CONFLICT (organization_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_invoice_id;

  IF v_invoice_id IS NULL THEN
    SELECT id, total INTO v_existing_invoice
    FROM public.invoices
    WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
    RETURN jsonb_build_object('success', true, 'duplicate', true,
      'invoice_id', v_existing_invoice.id, 'total', v_existing_invoice.total);
  END IF;

  INSERT INTO public.invoice_items (
    organization_id, invoice_id, item_id, quantity, unit_price, created_by
  ) VALUES (
    p_organization_id, v_invoice_id, p_item_id, round(p_quantity::numeric, 4),
    round(p_unit_price::numeric, 4), p_created_by
  );

  IF p_purchase_order_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_item_id::text, 0));
    SELECT COALESCE(sum(bs.quantity), 0), COALESCE(ii.average_cost, 0)
      INTO v_old_org_stock, v_old_average_cost
    FROM public.inventory_items ii
    LEFT JOIN public.branch_stock bs
      ON bs.organization_id = ii.organization_id AND bs.item_id = ii.id
    WHERE ii.id = p_item_id AND ii.organization_id = p_organization_id
    GROUP BY ii.average_cost;

    INSERT INTO public.branch_stock (
      organization_id, branch_id, item_id, quantity, reserved_quantity, created_by
    ) VALUES (p_organization_id, p_branch_id, p_item_id, 0, 0, p_created_by)
    ON CONFLICT (branch_id, item_id) DO NOTHING;

    PERFORM 1 FROM public.branch_stock
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND item_id = p_item_id
    FOR UPDATE;

    UPDATE public.branch_stock SET quantity = quantity + p_quantity, updated_at = now()
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND item_id = p_item_id;

    INSERT INTO public.stock_movements (
      organization_id, branch_id, item_id, movement_type, quantity, unit_cost,
      source_doc_type, source_doc_id, idempotency_key, notes, created_by
    ) VALUES (
      p_organization_id, p_branch_id, p_item_id, 'purchase', p_quantity, p_unit_price,
      'invoice', v_invoice_id, v_invoice_id::text || ':' || p_item_id::text || ':receive',
      'فاتورة توريد ' || btrim(p_invoice_number) ||
        CASE WHEN p_expiry_date IS NULL THEN '' ELSE ' - انتهاء: ' || p_expiry_date::text END,
      p_created_by
    );

    v_new_average_cost := CASE
      WHEN v_old_org_stock + p_quantity <= 0 THEN p_unit_price
      ELSE round(((v_old_average_cost * v_old_org_stock) + v_total) / (v_old_org_stock + p_quantity), 4)
    END;
    UPDATE public.inventory_items
    SET average_cost = v_new_average_cost, last_purchase_price = p_unit_price, updated_at = now()
    WHERE id = p_item_id AND organization_id = p_organization_id;
  END IF;

  INSERT INTO public.supplier_price_history (
    organization_id, supplier_id, item_id, unit_price, source_doc_type, source_doc_id, created_by
  )
  SELECT
    p_organization_id, p_supplier_id, p_item_id, p_unit_price, 'supplier_invoice', v_invoice_id, p_created_by
  WHERE NOT EXISTS (
    SELECT 1 FROM public.supplier_price_history sph
    WHERE sph.organization_id = p_organization_id
      AND sph.source_doc_type = 'supplier_invoice'
      AND sph.source_doc_id = v_invoice_id
      AND sph.item_id = p_item_id
  );

  PERFORM public.ensure_default_chart_accounts(p_organization_id);
  SELECT id INTO v_debit_account_id FROM public.chart_of_accounts
  WHERE organization_id = p_organization_id
    AND system_key = CASE WHEN p_purchase_order_id IS NULL THEN 'inventory' ELSE 'goods_received_not_invoiced' END
    AND is_active LIMIT 1;
  SELECT id INTO v_ap_account_id FROM public.chart_of_accounts
  WHERE organization_id = p_organization_id AND system_key = 'accounts_payable' AND is_active LIMIT 1;
  IF v_debit_account_id IS NULL OR v_ap_account_id IS NULL THEN
    RAISE EXCEPTION 'حسابات فاتورة المورد غير مكتملة.';
  END IF;

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_number, entry_date, source_doc_type,
    source_doc_id, memo, status, created_by
  ) VALUES (
    p_organization_id, p_branch_id,
    'JE-' || to_char(p_issued_at, 'YYYYMMDD') || '-INV-' || left(replace(v_invoice_id::text, '-', ''), 8),
    p_issued_at, 'supplier_invoice', v_invoice_id,
    'قيد تلقائي لفاتورة مورد ' || btrim(p_invoice_number), 'posted', p_created_by
  ) RETURNING id INTO v_journal_entry_id;

  INSERT INTO public.journal_lines (
    organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
  ) VALUES
    (p_organization_id, v_journal_entry_id, v_debit_account_id, p_branch_id,
      v_total, 0, CASE WHEN p_purchase_order_id IS NULL THEN 'إدخال مخزون فاتورة مورد' ELSE 'تسوية بضاعة مستلمة غير مفوترة' END),
    (p_organization_id, v_journal_entry_id, v_ap_account_id, p_branch_id,
      0, v_total, 'ذمم موردين فاتورة ' || btrim(p_invoice_number));

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) VALUES (
    p_organization_id, p_branch_id, p_created_by, 'supplier_invoice_posted',
    'invoice', v_invoice_id,
    jsonb_build_object('invoice_number', btrim(p_invoice_number), 'purchase_order_id', p_purchase_order_id,
      'item_id', p_item_id, 'quantity', p_quantity, 'unit_price', p_unit_price,
      'total', v_total, 'journal_entry_id', v_journal_entry_id)
  );

  RETURN jsonb_build_object(
    'success', true, 'duplicate', false, 'invoice_id', v_invoice_id,
    'journal_entry_id', v_journal_entry_id, 'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_purchase_order_atomic(
  uuid, uuid, uuid, uuid, numeric, numeric, date, public.purchase_order_status, text, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_purchase_order_atomic(
  uuid, uuid, uuid, uuid, numeric, numeric, date, public.purchase_order_status, text, text, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_order_atomic(
  uuid, uuid, uuid, uuid, numeric, numeric, date, public.purchase_order_status, text, text, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.record_purchase_receipt_atomic(
  uuid, uuid, date, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_purchase_receipt_atomic(
  uuid, uuid, date, text, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_purchase_receipt_atomic(
  uuid, uuid, date, text, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.create_supplier_invoice_atomic(
  uuid, uuid, uuid, text, date, date, uuid, numeric, numeric, uuid, text, date, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_supplier_invoice_atomic(
  uuid, uuid, uuid, text, date, date, uuid, numeric, numeric, uuid, text, date, text, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_invoice_atomic(
  uuid, uuid, uuid, text, date, date, uuid, numeric, numeric, uuid, text, date, text, uuid
) TO service_role;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 046_subscription_entitlements.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Rawaq commercial plans and server-enforced module entitlements.
-- Review this migration first. Do not apply it to production automatically.

alter table public.plans
  add column if not exists currency text not null default 'USD',
  add column if not exists limits jsonb not null default '{}'::jsonb;

alter table public.plans
  drop constraint if exists plans_currency_check;

alter table public.plans
  add constraint plans_currency_check check (currency = 'USD');

insert into public.plans (code, name, monthly_price, currency, features, limits, status)
values
  (
    'starter',
    'رواق تشغيل',
    150,
    'USD',
    '["dashboard","pos","shifts","tables","kitchen","expo","sales","customers","reports","administration"]'::jsonb,
    '{"maxBranches":1,"maxUsers":8,"maxDevices":4}'::jsonb,
    'active'
  ),
  (
    'growth',
    'رواق إدارة',
    250,
    'USD',
    '["dashboard","pos","shifts","tables","kitchen","expo","sales","customers","reports","administration","inventory","recipes","waste","purchasing","suppliers","transfers","production"]'::jsonb,
    '{"maxBranches":3,"maxUsers":25,"maxDevices":12}'::jsonb,
    'active'
  ),
  (
    'scale',
    'رواق متكامل',
    350,
    'USD',
    '["dashboard","pos","shifts","tables","kitchen","expo","sales","customers","inventory","recipes","waste","purchasing","suppliers","transfers","production","reports","accounting","financial_services","marketing","automation","administration"]'::jsonb,
    '{"maxBranches":null,"maxUsers":null,"maxDevices":null}'::jsonb,
    'active'
  )
on conflict (code) do update
set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  currency = excluded.currency,
  features = excluded.features,
  limits = excluded.limits,
  status = excluded.status,
  updated_at = now();

-- Subscription history is append-only. Parent rows use RESTRICT so deleting a
-- plan, organization, or subscription cannot erase its commercial history.
create table if not exists public.subscription_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null
    references public.subscriptions(id) on delete restrict,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  plan_id uuid references public.plans(id) on delete restrict,
  operation text not null check (operation in ('insert', 'update')),
  status text not null,
  current_period_start date,
  current_period_end date,
  old_data jsonb,
  new_data jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists subscription_history_subscription_changed_idx
  on public.subscription_history (subscription_id, changed_at desc);

create index if not exists subscription_history_organization_changed_idx
  on public.subscription_history (organization_id, changed_at desc);

alter table public.subscription_history enable row level security;

drop policy if exists "subscription history org read"
  on public.subscription_history;
create policy "subscription history org read"
  on public.subscription_history
  for select
  to authenticated
  using (
    public.is_super_admin()
    or public.is_org_member(organization_id)
  );

revoke all on table public.subscription_history from anon;
revoke insert, update, delete on table public.subscription_history
  from authenticated;
grant select on table public.subscription_history to authenticated;
grant select on table public.subscription_history to service_role;

create or replace function public.reject_subscription_history_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Subscription history is append-only and cannot be updated or deleted.';
end;
$$;

revoke all on function public.reject_subscription_history_mutation()
  from public;

drop trigger if exists reject_subscription_history_mutation
  on public.subscription_history;
create trigger reject_subscription_history_mutation
  before update or delete on public.subscription_history
  for each row
  execute function public.reject_subscription_history_mutation();

create or replace function public.capture_subscription_history_and_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  old_snapshot jsonb;
  new_snapshot jsonb := to_jsonb(new);
  audit_action text;
begin
  if tg_op = 'INSERT' then
    old_snapshot := null;
    audit_action := 'subscription_created';
  elsif tg_op = 'UPDATE' then
    old_snapshot := to_jsonb(old);
    audit_action := 'subscription_updated';
  else
    raise exception using
      errcode = '0A000',
      message = 'Unsupported subscription history operation.';
  end if;

  insert into public.subscription_history (
    subscription_id,
    organization_id,
    plan_id,
    operation,
    status,
    current_period_start,
    current_period_end,
    old_data,
    new_data,
    changed_by
  )
  values (
    new.id,
    new.organization_id,
    new.plan_id,
    lower(tg_op),
    new.status,
    new.current_period_start,
    new.current_period_end,
    old_snapshot,
    new_snapshot,
    actor_id
  );

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  )
  values (
    new.organization_id,
    actor_id,
    audit_action,
    'subscription',
    new.id,
    old_snapshot,
    new_snapshot
  );

  return new;
end;
$$;

revoke all on function public.capture_subscription_history_and_audit()
  from public;

drop trigger if exists capture_subscription_history_and_audit
  on public.subscriptions;
create trigger capture_subscription_history_and_audit
  after insert or update on public.subscriptions
  for each row
  execute function public.capture_subscription_history_and_audit();

create or replace function public.reject_subscription_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Subscriptions cannot be deleted. Change the status to cancelled instead.';
end;
$$;

revoke all on function public.reject_subscription_delete() from public;

drop trigger if exists reject_subscription_delete on public.subscriptions;
create trigger reject_subscription_delete
  before delete on public.subscriptions
  for each row
  execute function public.reject_subscription_delete();

-- Replace every legacy subscription policy. Members may read their own
-- organization, while only a super administrator may create or change plans.
alter table public.subscriptions enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
  loop
    execute format(
      'drop policy if exists %I on public.subscriptions',
      existing_policy.policyname
    );
  end loop;
end;
$$;

create policy "subscriptions org read"
  on public.subscriptions
  for select
  to authenticated
  using (
    public.is_super_admin()
    or public.is_org_member(organization_id)
  );

create policy "subscriptions super admin insert"
  on public.subscriptions
  for insert
  to authenticated
  with check (public.is_super_admin());

create policy "subscriptions super admin update"
  on public.subscriptions
  for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

revoke delete on table public.subscriptions from authenticated;

-- Keep the newest current subscription and cancel every older duplicate before
-- installing the invariant. The update is captured in history and audit_logs.
with ranked_current_subscriptions as (
  select
    id,
    row_number() over (
      partition by organization_id
      order by
        created_at desc nulls last,
        updated_at desc nulls last,
        id desc
    ) as current_rank
  from public.subscriptions
  where status in ('trial', 'active', 'past_due')
)
update public.subscriptions subscription
set
  status = 'cancelled',
  updated_at = now()
from ranked_current_subscriptions ranked
where subscription.id = ranked.id
  and ranked.current_rank > 1;

create unique index if not exists subscriptions_one_current_per_organization_uidx
  on public.subscriptions (organization_id)
  where status in ('trial', 'active', 'past_due');

create index if not exists subscriptions_organization_status_idx
  on public.subscriptions (organization_id, status, updated_at desc);

insert into public.subscriptions (
  organization_id,
  plan_id,
  status,
  current_period_start,
  current_period_end
)
select
  organization.id,
  plan.id,
  case
    when organization.status = 'active' then 'active'
    else 'trial'
  end,
  current_date,
  current_date + 30
from public.organizations organization
join public.plans plan
  on plan.code = case
    when organization.plan in ('starter', 'growth', 'scale') then organization.plan
    else 'starter'
  end
where not exists (
  select 1
  from public.subscriptions subscription
  where subscription.organization_id = organization.id
    and subscription.status in ('trial', 'active', 'past_due')
);

create or replace function public.organization_has_module(
  target_organization_id uuid,
  target_module text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    (
      public.is_super_admin()
      or public.is_org_member(target_organization_id)
    )
    and coalesce(
      (
        select plan.features ? target_module
        from public.subscriptions subscription
        join public.plans plan on plan.id = subscription.plan_id
        where subscription.organization_id = target_organization_id
          and subscription.status in ('trial', 'active')
        order by
          case subscription.status
            when 'active' then 1
            else 2
          end,
          subscription.updated_at desc
        limit 1
      ),
      false
    );
$$;

revoke all on function public.organization_has_module(uuid, text) from public;
grant execute on function public.organization_has_module(uuid, text) to authenticated;
grant execute on function public.organization_has_module(uuid, text) to service_role;

comment on function public.organization_has_module(uuid, text)
  is 'Checks a trial or active organization subscription before allowing a Rawaq module.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 047_restaurant_order_lifecycle.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 047: Independent restaurant order lifecycle with persisted kitchen routing.
-- Forward-only migration. Do not apply automatically to production.

create extension if not exists "pgcrypto";

-- Composite parent keys make cross-tenant and cross-branch references impossible
-- at the database boundary, not only inside application code.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'branches_org_id_unique') then
    alter table public.branches
      add constraint branches_org_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'restaurant_tables_org_branch_id_unique') then
    alter table public.restaurant_tables
      add constraint restaurant_tables_org_branch_id_unique unique (organization_id, branch_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'catalog_items_org_id_unique') then
    alter table public.catalog_items
      add constraint catalog_items_org_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'menu_items_org_id_unique') then
    alter table public.menu_items
      add constraint menu_items_org_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'customer_invoices_org_branch_id_unique') then
    alter table public.customer_invoices
      add constraint customer_invoices_org_branch_id_unique unique (organization_id, branch_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'department_api_keys_org_branch_id_unique') then
    alter table public.department_api_keys
      add constraint department_api_keys_org_branch_id_unique unique (organization_id, branch_id, id);
  end if;
end;
$$;

create table public.kitchen_stations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  code text not null,
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kitchen_stations_branch_fk
    foreign key (organization_id, branch_id)
    references public.branches(organization_id, id) on delete restrict,
  constraint kitchen_stations_code_not_blank check (btrim(code) <> '' and length(code) <= 64),
  constraint kitchen_stations_name_not_blank check (btrim(name) <> '' and length(name) <= 120),
  constraint kitchen_stations_org_branch_code_unique unique (organization_id, branch_id, code),
  constraint kitchen_stations_org_branch_id_unique unique (organization_id, branch_id, id)
);

create table public.kitchen_station_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  station_id uuid not null,
  device_id uuid not null,
  is_active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kitchen_station_devices_station_fk
    foreign key (organization_id, branch_id, station_id)
    references public.kitchen_stations(organization_id, branch_id, id) on delete restrict,
  constraint kitchen_station_devices_device_fk
    foreign key (organization_id, branch_id, device_id)
    references public.department_api_keys(organization_id, branch_id, id) on delete restrict,
  constraint kitchen_station_devices_unique unique (organization_id, branch_id, station_id, device_id)
);

create table public.restaurant_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  order_number text not null,
  idempotency_key text not null,
  status text not null default 'draft',
  restaurant_table_id uuid,
  waiter_user_id uuid references auth.users(id) on delete set null,
  waiter_name text,
  customer_name text,
  customer_phone text,
  channel public.sales_channel not null default 'dine_in',
  guest_count integer,
  priority text not null default 'normal',
  notes text,
  allergens text[] not null default '{}'::text[],
  currency text not null default 'JOD',
  subtotal numeric(14,4) not null default 0,
  item_discount_total numeric(14,4) not null default 0,
  order_discount numeric(14,4) not null default 0,
  discount_total numeric(14,4) not null default 0,
  tax_total numeric(14,4) not null default 0,
  service_fee numeric(14,4) not null default 0,
  delivery_fee numeric(14,4) not null default 0,
  total numeric(14,4) not null default 0,
  customer_invoice_id uuid,
  version bigint not null default 0,
  submitted_at timestamptz,
  accepted_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_device_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_orders_branch_fk
    foreign key (organization_id, branch_id)
    references public.branches(organization_id, id) on delete restrict,
  constraint restaurant_orders_table_fk
    foreign key (organization_id, branch_id, restaurant_table_id)
    references public.restaurant_tables(organization_id, branch_id, id) on delete restrict,
  constraint restaurant_orders_invoice_fk
    foreign key (organization_id, branch_id, customer_invoice_id)
    references public.customer_invoices(organization_id, branch_id, id) on delete restrict,
  constraint restaurant_orders_device_fk
    foreign key (organization_id, branch_id, created_by_device_id)
    references public.department_api_keys(organization_id, branch_id, id) on delete restrict,
  constraint restaurant_orders_number_not_blank check (btrim(order_number) <> ''),
  constraint restaurant_orders_idempotency_not_blank
    check (btrim(idempotency_key) <> '' and length(idempotency_key) <= 128),
  constraint restaurant_orders_status_check
    check (status in ('draft', 'submitted', 'accepted', 'preparing', 'ready', 'served', 'closed', 'cancelled')),
  constraint restaurant_orders_priority_check check (priority in ('normal', 'rush')),
  constraint restaurant_orders_guest_count_check check (guest_count is null or guest_count > 0),
  constraint restaurant_orders_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint restaurant_orders_amounts_nonnegative check (
    subtotal >= 0 and item_discount_total >= 0 and order_discount >= 0
    and discount_total >= 0 and tax_total >= 0 and service_fee >= 0
    and delivery_fee >= 0 and total >= 0
  ),
  constraint restaurant_orders_discount_components_check
    check (discount_total = round(item_discount_total + order_discount, 4)),
  constraint restaurant_orders_discount_limit_check check (discount_total <= subtotal),
  constraint restaurant_orders_total_check
    check (total = round(subtotal - discount_total + tax_total + service_fee + delivery_fee, 4)),
  constraint restaurant_orders_actor_check
    check (num_nonnulls(created_by_user_id, created_by_device_id) = 1),
  constraint restaurant_orders_cancel_check check (
    (status = 'cancelled' and cancelled_at is not null and nullif(btrim(cancel_reason), '') is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  ),
  constraint restaurant_orders_close_check check (
    (status = 'closed' and closed_at is not null) or status <> 'closed'
  ),
  constraint restaurant_orders_org_idempotency_unique unique (organization_id, idempotency_key),
  constraint restaurant_orders_org_branch_number_unique unique (organization_id, branch_id, order_number),
  constraint restaurant_orders_org_branch_id_unique unique (organization_id, branch_id, id)
);

create unique index restaurant_orders_invoice_unique
  on public.restaurant_orders (organization_id, customer_invoice_id)
  where customer_invoice_id is not null;

create table public.restaurant_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  order_id uuid not null,
  client_line_id text not null,
  station_id uuid not null,
  catalog_item_id uuid not null,
  menu_item_id uuid,
  item_name text not null,
  quantity numeric(14,4) not null,
  unit_price numeric(14,4) not null,
  line_subtotal numeric(14,4) not null,
  discount_amount numeric(14,4) not null default 0,
  tax_rate numeric(8,4) not null default 0,
  tax_amount numeric(14,4) not null default 0,
  line_total numeric(14,4) not null,
  status text not null default 'submitted',
  notes text,
  allergens text[] not null default '{}'::text[],
  modifiers jsonb not null default '[]'::jsonb,
  price_override_reason text,
  accepted_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_order_items_order_fk
    foreign key (organization_id, branch_id, order_id)
    references public.restaurant_orders(organization_id, branch_id, id) on delete restrict,
  constraint restaurant_order_items_station_fk
    foreign key (organization_id, branch_id, station_id)
    references public.kitchen_stations(organization_id, branch_id, id) on delete restrict,
  constraint restaurant_order_items_catalog_fk
    foreign key (organization_id, catalog_item_id)
    references public.catalog_items(organization_id, id) on delete restrict,
  constraint restaurant_order_items_menu_fk
    foreign key (organization_id, menu_item_id)
    references public.menu_items(organization_id, id) on delete restrict,
  constraint restaurant_order_items_client_line_not_blank
    check (btrim(client_line_id) <> '' and length(client_line_id) <= 128),
  constraint restaurant_order_items_name_not_blank check (btrim(item_name) <> ''),
  constraint restaurant_order_items_quantity_positive check (quantity > 0),
  constraint restaurant_order_items_amounts_check check (
    unit_price >= 0 and line_subtotal >= 0 and discount_amount >= 0
    and discount_amount <= line_subtotal and tax_rate >= 0 and tax_rate <= 100
    and tax_amount >= 0 and line_total >= 0
  ),
  constraint restaurant_order_items_subtotal_check
    check (line_subtotal = round(quantity * unit_price, 4)),
  constraint restaurant_order_items_total_check
    check (line_total = round(line_subtotal - discount_amount + tax_amount, 4)),
  constraint restaurant_order_items_status_check
    check (status in ('submitted', 'accepted', 'preparing', 'ready', 'served', 'cancelled')),
  constraint restaurant_order_items_cancel_check check (
    (status = 'cancelled' and cancelled_at is not null) or status <> 'cancelled'
  ),
  constraint restaurant_order_items_line_unique unique (organization_id, order_id, client_line_id),
  constraint restaurant_order_items_org_branch_order_id_unique
    unique (organization_id, branch_id, order_id, id)
);

create table public.restaurant_order_status_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid not null,
  order_id uuid not null,
  order_item_id uuid,
  station_id uuid,
  event_sequence bigint not null,
  event_scope text not null,
  event_type text not null,
  from_status text,
  to_status text not null,
  reason text,
  idempotency_key text not null,
  correlation_id text,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_device_id uuid,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint restaurant_order_events_order_fk
    foreign key (organization_id, branch_id, order_id)
    references public.restaurant_orders(organization_id, branch_id, id) on delete restrict,
  constraint restaurant_order_events_item_fk
    foreign key (organization_id, branch_id, order_id, order_item_id)
    references public.restaurant_order_items(organization_id, branch_id, order_id, id) on delete restrict,
  constraint restaurant_order_events_station_fk
    foreign key (organization_id, branch_id, station_id)
    references public.kitchen_stations(organization_id, branch_id, id) on delete restrict,
  constraint restaurant_order_events_device_fk
    foreign key (organization_id, branch_id, actor_device_id)
    references public.department_api_keys(organization_id, branch_id, id) on delete restrict,
  constraint restaurant_order_events_sequence_positive check (event_sequence > 0),
  constraint restaurant_order_events_scope_check check (event_scope in ('order', 'item', 'invoice_link')),
  constraint restaurant_order_events_item_scope_check check (
    (event_scope = 'item' and order_item_id is not null and station_id is not null)
    or (event_scope <> 'item' and order_item_id is null)
  ),
  constraint restaurant_order_events_type_not_blank check (btrim(event_type) <> ''),
  constraint restaurant_order_events_status_check check (
    (from_status is null or from_status in ('draft', 'submitted', 'accepted', 'preparing', 'ready', 'served', 'closed', 'cancelled'))
    and to_status in ('draft', 'submitted', 'accepted', 'preparing', 'ready', 'served', 'closed', 'cancelled')
  ),
  constraint restaurant_order_events_idempotency_not_blank
    check (btrim(idempotency_key) <> '' and length(idempotency_key) <= 200),
  constraint restaurant_order_events_actor_check
    check (num_nonnulls(actor_user_id, actor_device_id) = 1),
  constraint restaurant_order_events_sequence_unique
    unique (organization_id, order_id, event_sequence),
  constraint restaurant_order_events_idempotency_unique
    unique (organization_id, order_id, idempotency_key)
);

create index kitchen_stations_active_idx
  on public.kitchen_stations (organization_id, branch_id, is_active, display_order, name);
create index kitchen_station_devices_device_idx
  on public.kitchen_station_devices (organization_id, branch_id, device_id, is_active);
create index restaurant_orders_active_idx
  on public.restaurant_orders (organization_id, branch_id, status, submitted_at desc)
  where status not in ('closed', 'cancelled');
create index restaurant_orders_table_idx
  on public.restaurant_orders (organization_id, branch_id, restaurant_table_id, status)
  where restaurant_table_id is not null and status not in ('closed', 'cancelled');
create index restaurant_orders_waiter_idx
  on public.restaurant_orders (organization_id, branch_id, waiter_user_id, submitted_at desc)
  where waiter_user_id is not null;
create index restaurant_order_items_station_queue_idx
  on public.restaurant_order_items (organization_id, branch_id, station_id, status, created_at)
  where status not in ('served', 'cancelled');
create index restaurant_order_items_order_idx
  on public.restaurant_order_items (organization_id, branch_id, order_id, created_at);
create index restaurant_order_events_timeline_idx
  on public.restaurant_order_status_events (organization_id, branch_id, order_id, event_sequence);
create index restaurant_order_events_station_idx
  on public.restaurant_order_status_events (organization_id, branch_id, station_id, occurred_at desc)
  where station_id is not null;

-- Operational facts are corrected by new events/statuses, never hard-deleted.
create or replace function public.prevent_restaurant_order_hard_delete()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'لا يمكن حذف سجلات الطلبات أو المحطات. استخدم الإلغاء أو التعطيل.';
end;
$$;

create trigger prevent_kitchen_stations_delete
before delete on public.kitchen_stations
for each row execute function public.prevent_restaurant_order_hard_delete();
create trigger prevent_kitchen_station_devices_delete
before delete on public.kitchen_station_devices
for each row execute function public.prevent_restaurant_order_hard_delete();
create trigger prevent_restaurant_orders_delete
before delete on public.restaurant_orders
for each row execute function public.prevent_restaurant_order_hard_delete();
create trigger prevent_restaurant_order_items_delete
before delete on public.restaurant_order_items
for each row execute function public.prevent_restaurant_order_hard_delete();
create trigger prevent_restaurant_order_events_delete
before delete on public.restaurant_order_status_events
for each row execute function public.prevent_restaurant_order_hard_delete();

create or replace function public.protect_restaurant_order_event()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'سجل أحداث الطلب غير قابل للتعديل.';
end;
$$;

create trigger protect_restaurant_order_events_update
before update on public.restaurant_order_status_events
for each row execute function public.protect_restaurant_order_event();

create or replace function public.protect_restaurant_order_identity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if row(
    new.organization_id, new.branch_id, new.order_number, new.idempotency_key,
    new.restaurant_table_id, new.waiter_user_id, new.waiter_name,
    new.customer_name, new.customer_phone, new.channel, new.guest_count,
    new.priority, new.notes, new.allergens, new.currency,
    new.subtotal, new.item_discount_total, new.order_discount,
    new.discount_total, new.tax_total, new.service_fee, new.delivery_fee,
    new.total, new.created_by_user_id, new.created_by_device_id, new.created_at
  ) is distinct from row(
    old.organization_id, old.branch_id, old.order_number, old.idempotency_key,
    old.restaurant_table_id, old.waiter_user_id, old.waiter_name,
    old.customer_name, old.customer_phone, old.channel, old.guest_count,
    old.priority, old.notes, old.allergens, old.currency,
    old.subtotal, old.item_discount_total, old.order_discount,
    old.discount_total, old.tax_total, old.service_fee, old.delivery_fee,
    old.total, old.created_by_user_id, old.created_by_device_id, old.created_at
  ) then
    raise exception 'بيانات الطلب المثبتة لا تعدل بعد الإنشاء؛ استخدم حدث تصحيح.';
  end if;
  return new;
end;
$$;

create trigger protect_restaurant_order_identity_update
before update on public.restaurant_orders
for each row execute function public.protect_restaurant_order_identity();

create or replace function public.protect_restaurant_order_item_payload()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if row(
    new.organization_id, new.branch_id, new.order_id, new.client_line_id,
    new.station_id, new.catalog_item_id, new.menu_item_id, new.item_name,
    new.quantity, new.unit_price, new.line_subtotal, new.discount_amount,
    new.tax_rate, new.tax_amount, new.line_total, new.notes, new.allergens,
    new.modifiers, new.price_override_reason, new.created_at
  ) is distinct from row(
    old.organization_id, old.branch_id, old.order_id, old.client_line_id,
    old.station_id, old.catalog_item_id, old.menu_item_id, old.item_name,
    old.quantity, old.unit_price, old.line_subtotal, old.discount_amount,
    old.tax_rate, old.tax_amount, old.line_total, old.notes, old.allergens,
    old.modifiers, old.price_override_reason, old.created_at
  ) then
    raise exception 'بيانات عنصر الطلب المثبتة لا تعدل؛ استخدم الإلغاء وإضافة عنصر جديد.';
  end if;
  return new;
end;
$$;

create trigger protect_restaurant_order_item_payload_update
before update on public.restaurant_order_items
for each row execute function public.protect_restaurant_order_item_payload();

create trigger set_kitchen_stations_updated_at
before update on public.kitchen_stations
for each row execute function public.set_updated_at();
create trigger set_kitchen_station_devices_updated_at
before update on public.kitchen_station_devices
for each row execute function public.set_updated_at();

-- Resolve and authorize one actor. Authenticated callers may only represent
-- auth.uid(); department devices are accepted only behind the service-role API.
create or replace function public.assert_restaurant_order_actor(
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_user_id uuid,
  p_actor_device_id uuid,
  p_capability text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role text;
  v_modules text[];
begin
  if num_nonnulls(p_actor_user_id, p_actor_device_id) <> 1 then
    raise exception 'يجب تحديد مستخدم منفذ أو جهاز قسم واحد فقط.';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.organization_id = p_organization_id
      and b.status::text = 'active'
  ) then
    raise exception 'الفرع غير موجود داخل المؤسسة أو غير نشط.';
  end if;

  if p_actor_user_id is not null then
    if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_actor_user_id then
      raise exception 'لا يمكن للمستخدم تمثيل مستخدم آخر.';
    end if;

    select om.role::text into v_role
    from public.organization_memberships om
    where om.organization_id = p_organization_id
      and om.user_id = p_actor_user_id
      and (om.branch_id is null or om.branch_id = p_branch_id)
    limit 1;

    if v_role is null and exists (
      select 1 from public.organization_memberships om
      where om.user_id = p_actor_user_id and om.role::text = 'super_admin'
    ) then
      v_role := 'super_admin';
    end if;

    if v_role is null then
      raise exception 'المستخدم لا يملك وصولاً إلى هذا الفرع.';
    end if;
  else
    if coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'أجهزة الأقسام تستخدم واجهة الخادم الموثوقة فقط.';
    end if;

    select dak.role::text, dak.allowed_modules
      into v_role, v_modules
    from public.department_api_keys dak
    where dak.id = p_actor_device_id
      and dak.organization_id = p_organization_id
      and dak.branch_id = p_branch_id
      and dak.is_active = true
      and dak.key_hash is not null;

    if v_role is null then
      raise exception 'جهاز القسم غير نشط أو لا يتبع هذا الفرع.';
    end if;

    if p_capability = 'manage_station' then
      raise exception 'جهاز القسم لا يمكنه إدارة المحطات.';
    elsif p_capability = 'submit' and not coalesce(v_modules && array['pos','waiter','orders','tables'], false) then
      raise exception 'الجهاز لا يملك وحدة إرسال الطلبات.';
    elsif p_capability = 'kitchen' and not coalesce(v_modules && array['kitchen','kds','expo'], false) then
      raise exception 'الجهاز لا يملك وحدة المطبخ.';
    elsif p_capability = 'close' and not coalesce(v_modules && array['pos','waiter','tables'], false) then
      raise exception 'الجهاز لا يملك وحدة إغلاق الطلبات.';
    elsif p_capability = 'link_invoice' and not coalesce(v_modules && array['pos','accounting'], false) then
      raise exception 'الجهاز لا يملك وحدة ربط الفواتير.';
    end if;
  end if;

  if p_capability = 'manage_station' and v_role not in ('super_admin','organization_owner','branch_manager') then
    raise exception 'الدور لا يسمح بإدارة محطات المطبخ.';
  elsif p_capability = 'submit' and v_role not in ('super_admin','organization_owner','branch_manager','cashier','staff') then
    raise exception 'الدور لا يسمح بإرسال الطلبات.';
  elsif p_capability = 'kitchen' and v_role not in ('super_admin','organization_owner','branch_manager','chef','staff') then
    raise exception 'الدور لا يسمح بتحديث المطبخ.';
  elsif p_capability = 'close' and v_role not in ('super_admin','organization_owner','branch_manager','cashier','staff') then
    raise exception 'الدور لا يسمح بإغلاق أو إلغاء الطلب.';
  elsif p_capability = 'link_invoice' and v_role not in ('super_admin','organization_owner','branch_manager','cashier','accountant') then
    raise exception 'الدور لا يسمح بربط الفاتورة.';
  end if;

  return v_role;
end;
$$;

create or replace function public.upsert_kitchen_station_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_station_id uuid,
  p_code text,
  p_name text,
  p_display_order integer,
  p_is_active boolean,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_station_id uuid;
  v_old jsonb;
begin
  perform public.assert_restaurant_order_actor(
    p_organization_id, p_branch_id, p_actor_user_id, null, 'manage_station'
  );

  if nullif(btrim(p_code), '') is null or nullif(btrim(p_name), '') is null then
    raise exception 'رمز المحطة واسمها مطلوبان.';
  end if;

  if p_station_id is not null then
    select to_jsonb(ks) into v_old
    from public.kitchen_stations ks
    where ks.id = p_station_id
      and ks.organization_id = p_organization_id
      and ks.branch_id = p_branch_id
    for update;
    if v_old is null then
      raise exception 'المحطة غير موجودة في هذا الفرع.';
    end if;
  end if;

  if p_station_id is not null then
    update public.kitchen_stations
    set code = lower(btrim(p_code)),
        name = btrim(p_name),
        display_order = coalesce(p_display_order, 0),
        is_active = coalesce(p_is_active, true),
        updated_at = now()
    where id = p_station_id and organization_id = p_organization_id
      and branch_id = p_branch_id
    returning id into v_station_id;
  else
    insert into public.kitchen_stations (
      organization_id, branch_id, code, name, display_order,
      is_active, created_by_user_id
    ) values (
      p_organization_id, p_branch_id, lower(btrim(p_code)), btrim(p_name),
      coalesce(p_display_order, 0), coalesce(p_is_active, true), p_actor_user_id
    )
    on conflict (organization_id, branch_id, code) do update
      set name = excluded.name,
          display_order = excluded.display_order,
          is_active = excluded.is_active,
          updated_at = now()
    returning id into v_station_id;
  end if;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id, 'kitchen_station_upserted',
    'kitchen_station', v_station_id, v_old,
    jsonb_build_object('code', lower(btrim(p_code)), 'name', btrim(p_name), 'is_active', coalesce(p_is_active, true))
  );

  return jsonb_build_object('success', true, 'station_id', v_station_id);
end;
$$;

create or replace function public.assign_kitchen_station_device_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_station_id uuid,
  p_device_id uuid,
  p_is_active boolean,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_assignment_id uuid;
begin
  perform public.assert_restaurant_order_actor(
    p_organization_id, p_branch_id, p_actor_user_id, null, 'manage_station'
  );

  if not exists (
    select 1 from public.kitchen_stations ks
    where ks.id = p_station_id and ks.organization_id = p_organization_id
      and ks.branch_id = p_branch_id
  ) then
    raise exception 'المحطة لا تتبع هذا الفرع.';
  end if;

  if not exists (
    select 1 from public.department_api_keys dak
    where dak.id = p_device_id and dak.organization_id = p_organization_id
      and dak.branch_id = p_branch_id and dak.is_active = true
  ) then
    raise exception 'الجهاز لا يتبع هذا الفرع أو غير نشط.';
  end if;

  insert into public.kitchen_station_devices (
    organization_id, branch_id, station_id, device_id, is_active, created_by_user_id
  ) values (
    p_organization_id, p_branch_id, p_station_id, p_device_id,
    coalesce(p_is_active, true), p_actor_user_id
  )
  on conflict (organization_id, branch_id, station_id, device_id) do update
    set is_active = excluded.is_active, updated_at = now()
  returning id into v_assignment_id;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id, 'kitchen_station_device_assigned',
    'kitchen_station_device', v_assignment_id,
    jsonb_build_object('station_id', p_station_id, 'device_id', p_device_id, 'is_active', coalesce(p_is_active, true))
  );

  return jsonb_build_object('success', true, 'assignment_id', v_assignment_id);
end;
$$;

create or replace function public.submit_restaurant_order_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_idempotency_key text,
  p_items jsonb,
  p_restaurant_table_id uuid default null,
  p_waiter_user_id uuid default null,
  p_waiter_name text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_channel public.sales_channel default 'dine_in',
  p_guest_count integer default null,
  p_notes text default null,
  p_allergens text[] default '{}'::text[],
  p_currency text default 'JOD',
  p_order_discount numeric default 0,
  p_service_fee numeric default 0,
  p_delivery_fee numeric default 0,
  p_actor_user_id uuid default null,
  p_actor_device_id uuid default null,
  p_submitted_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_existing public.restaurant_orders%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_waiter_user_id uuid;
  v_line jsonb;
  v_catalog public.catalog_items%rowtype;
  v_station_id uuid;
  v_catalog_item_id uuid;
  v_quantity numeric(14,4);
  v_expected_price numeric(14,4);
  v_unit_price numeric(14,4);
  v_line_subtotal numeric(14,4);
  v_line_discount numeric(14,4);
  v_tax_rate numeric(8,4);
  v_tax_amount numeric(14,4);
  v_line_total numeric(14,4);
  v_subtotal numeric(14,4) := 0;
  v_item_discount_total numeric(14,4) := 0;
  v_tax_total numeric(14,4) := 0;
  v_total numeric(14,4);
  v_order_discount numeric(14,4) := round(coalesce(p_order_discount, 0), 4);
  v_service_fee numeric(14,4) := round(coalesce(p_service_fee, 0), 4);
  v_delivery_fee numeric(14,4) := round(coalesce(p_delivery_fee, 0), 4);
  v_override_reason text;
  v_line_allergens text[];
  v_modifiers jsonb;
  v_modifier_option_ids jsonb;
  v_modifier_summary text;
  v_modifier_price_sum numeric(14,4);
  v_modifier_count integer;
  v_line_count integer;
begin
  v_actor_role := public.assert_restaurant_order_actor(
    p_organization_id, p_branch_id, p_actor_user_id, p_actor_device_id, 'submit'
  );

  if nullif(btrim(p_idempotency_key), '') is null or length(p_idempotency_key) > 128 then
    raise exception 'مفتاح منع التكرار مطلوب وبحد أقصى 128 حرفاً.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || btrim(p_idempotency_key), 0));

  select * into v_existing
  from public.restaurant_orders ro
  where ro.organization_id = p_organization_id
    and ro.idempotency_key = btrim(p_idempotency_key)
  for update;

  if found then
    if v_existing.branch_id <> p_branch_id then
      raise exception 'مفتاح منع التكرار مستخدم في فرع آخر.';
    end if;
    return jsonb_build_object(
      'success', true, 'duplicate', true, 'order_id', v_existing.id,
      'order_number', v_existing.order_number, 'status', v_existing.status,
      'total', v_existing.total, 'version', v_existing.version
    );
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'عناصر الطلب يجب أن تكون مصفوفة JSON.';
  end if;
  v_line_count := jsonb_array_length(p_items);
  if v_line_count < 1 or v_line_count > 250 then
    raise exception 'يجب أن يحتوي الطلب على عنصر واحد إلى 250 عنصراً.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as lines(line_json)
    group by line_json->>'client_line_id'
    having nullif(btrim(line_json->>'client_line_id'), '') is null or count(*) > 1
  ) then
    raise exception 'كل عنصر يحتاج client_line_id فريداً وغير فارغ.';
  end if;

  if p_restaurant_table_id is not null and not exists (
    select 1 from public.restaurant_tables rt
    where rt.id = p_restaurant_table_id
      and rt.organization_id = p_organization_id and rt.branch_id = p_branch_id
  ) then
    raise exception 'الطاولة لا تتبع هذا الفرع.';
  end if;

  v_waiter_user_id := coalesce(p_waiter_user_id, p_actor_user_id);
  if v_waiter_user_id is not null and not exists (
    select 1 from public.organization_memberships om
    where om.organization_id = p_organization_id and om.user_id = v_waiter_user_id
      and (om.branch_id is null or om.branch_id = p_branch_id)
  ) then
    raise exception 'الجرسون لا يتبع هذا الفرع.';
  end if;

  if p_guest_count is not null and p_guest_count <= 0 then
    raise exception 'عدد الضيوف يجب أن يكون أكبر من صفر.';
  end if;
  if v_order_discount < 0 or v_service_fee < 0 or v_delivery_fee < 0 then
    raise exception 'الخصومات والرسوم لا تقبل قيماً سالبة.';
  end if;
  if v_order_discount > 0 and v_actor_role not in ('super_admin','organization_owner','branch_manager','cashier') then
    raise exception 'خصم الطلب يحتاج صلاحية كاشير أو مدير.';
  end if;
  if upper(coalesce(p_currency, '')) !~ '^[A-Z]{3}$' then
    raise exception 'رمز العملة يجب أن يتكون من ثلاثة أحرف.';
  end if;
  if p_channel is null then
    raise exception 'قناة الطلب مطلوبة.';
  end if;
  if p_submitted_at is null or p_submitted_at > now() + interval '5 minutes' then
    raise exception 'وقت إرسال الطلب لا يمكن أن يكون في المستقبل.';
  end if;

  -- First pass validates routing/pricing and computes server-side totals.
  for v_line in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_station_id := (v_line->>'station_id')::uuid;
      v_catalog_item_id := (v_line->>'catalog_item_id')::uuid;
      v_quantity := round((v_line->>'quantity')::numeric, 4);
      v_line_discount := round(coalesce(nullif(v_line->>'discount_amount', '')::numeric, 0), 4);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'معرف المحطة والصنف والكمية والأسعار يجب أن تكون بصيغة صحيحة.';
    end;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'كمية عنصر الطلب يجب أن تكون أكبر من صفر.';
    end if;

    if not exists (
      select 1 from public.kitchen_stations ks
      where ks.id = v_station_id and ks.organization_id = p_organization_id
        and ks.branch_id = p_branch_id and ks.is_active = true
    ) then
      raise exception 'محطة عنصر الطلب غير موجودة أو غير نشطة في هذا الفرع.';
    end if;

    select * into v_catalog
    from public.catalog_items ci
    where ci.id = v_catalog_item_id and ci.organization_id = p_organization_id
      and (ci.branch_id is null or ci.branch_id = p_branch_id)
      and ci.status::text = 'active';
    if not found then
      raise exception 'صنف الطلب غير موجود أو غير متاح في هذا الفرع.';
    end if;

    v_expected_price := round(coalesce(v_catalog.branch_price, v_catalog.retail_price), 4);
    begin
      v_unit_price := round(coalesce(nullif(v_line->>'unit_price', '')::numeric, v_expected_price), 4);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'سعر عنصر الطلب غير صالح.';
    end;
    if v_unit_price < 0 then
      raise exception 'سعر عنصر الطلب لا يقبل قيمة سالبة.';
    end if;

    v_override_reason := nullif(btrim(v_line->>'price_override_reason'), '');
    if v_unit_price <> v_expected_price then
      if v_actor_role not in ('super_admin','organization_owner','branch_manager','cashier') then
        raise exception 'تغيير السعر يحتاج صلاحية كاشير أو مدير.';
      end if;
      if v_override_reason is null then
        raise exception 'سبب تغيير السعر مطلوب.';
      end if;
    end if;

    v_line_subtotal := round(v_quantity * v_unit_price, 4);
    if v_line_discount < 0 or v_line_discount > v_line_subtotal then
      raise exception 'خصم العنصر خارج الحد المسموح.';
    end if;
    if v_line_discount > 0 and v_actor_role not in ('super_admin','organization_owner','branch_manager','cashier') then
      raise exception 'خصم العنصر يحتاج صلاحية كاشير أو مدير.';
    end if;

    v_tax_rate := round(coalesce(v_catalog.tax_rate, 0), 4);
    v_tax_amount := round((v_line_subtotal - v_line_discount) * v_tax_rate / 100, 4);
    v_line_total := round(v_line_subtotal - v_line_discount + v_tax_amount, 4);
    v_subtotal := round(v_subtotal + v_line_subtotal, 4);
    v_item_discount_total := round(v_item_discount_total + v_line_discount, 4);
    v_tax_total := round(v_tax_total + v_tax_amount, 4);
  end loop;

  if round(v_item_discount_total + v_order_discount, 4) > v_subtotal then
    raise exception 'إجمالي الخصم يتجاوز إجمالي أسعار العناصر.';
  end if;
  v_total := round(v_subtotal - v_item_discount_total - v_order_discount + v_tax_total + v_service_fee + v_delivery_fee, 4);

  v_order_number := public.get_next_sequence_number(
    p_organization_id, p_branch_id, 'restaurant_order', 'ORD-'
  );
  v_order_id := gen_random_uuid();

  insert into public.restaurant_orders (
    id, organization_id, branch_id, order_number, idempotency_key, status,
    restaurant_table_id, waiter_user_id, waiter_name, customer_name, customer_phone,
    channel, guest_count, notes, allergens, currency, subtotal,
    item_discount_total, order_discount, discount_total, tax_total,
    service_fee, delivery_fee, total, version,
    created_by_user_id, created_by_device_id, created_at, updated_at
  ) values (
    v_order_id, p_organization_id, p_branch_id, v_order_number, btrim(p_idempotency_key), 'draft',
    p_restaurant_table_id, v_waiter_user_id, nullif(btrim(p_waiter_name), ''),
    nullif(btrim(p_customer_name), ''), nullif(btrim(p_customer_phone), ''),
    p_channel, p_guest_count, nullif(btrim(p_notes), ''), coalesce(p_allergens, '{}'::text[]),
    upper(p_currency), v_subtotal, v_item_discount_total, v_order_discount,
    round(v_item_discount_total + v_order_discount, 4), v_tax_total,
    v_service_fee, v_delivery_fee, v_total, 1,
    p_actor_user_id, p_actor_device_id, p_submitted_at, p_submitted_at
  );

  insert into public.restaurant_order_status_events (
    organization_id, branch_id, order_id, event_sequence, event_scope, event_type,
    from_status, to_status, idempotency_key, correlation_id, metadata,
    actor_user_id, actor_device_id, occurred_at
  ) values (
    p_organization_id, p_branch_id, v_order_id, 1, 'order', 'order_created',
    null, 'draft', btrim(p_idempotency_key) || ':created', btrim(p_idempotency_key),
    jsonb_build_object('order_number', v_order_number, 'line_count', v_line_count),
    p_actor_user_id, p_actor_device_id, p_submitted_at
  );

  -- Second pass persists immutable item snapshots and explicit station routing.
  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_station_id := (v_line->>'station_id')::uuid;
    v_catalog_item_id := (v_line->>'catalog_item_id')::uuid;
    v_quantity := round((v_line->>'quantity')::numeric, 4);
    v_line_discount := round(coalesce(nullif(v_line->>'discount_amount', '')::numeric, 0), 4);

    select * into strict v_catalog
    from public.catalog_items ci
    where ci.id = v_catalog_item_id and ci.organization_id = p_organization_id
      and (ci.branch_id is null or ci.branch_id = p_branch_id)
      and ci.status::text = 'active';

    v_expected_price := round(coalesce(v_catalog.branch_price, v_catalog.retail_price), 4);
    v_unit_price := round(coalesce(nullif(v_line->>'unit_price', '')::numeric, v_expected_price), 4);
    v_line_subtotal := round(v_quantity * v_unit_price, 4);
    v_tax_rate := round(coalesce(v_catalog.tax_rate, 0), 4);
    v_tax_amount := round((v_line_subtotal - v_line_discount) * v_tax_rate / 100, 4);
    v_line_total := round(v_line_subtotal - v_line_discount + v_tax_amount, 4);
    v_override_reason := nullif(btrim(v_line->>'price_override_reason'), '');

    if coalesce(v_line->'allergens', '[]'::jsonb) = 'null'::jsonb then
      v_line_allergens := '{}'::text[];
    elsif jsonb_typeof(coalesce(v_line->'allergens', '[]'::jsonb)) <> 'array' then
      raise exception 'حقل allergens لكل عنصر يجب أن يكون مصفوفة.';
    else
      select coalesce(array_agg(value), '{}'::text[]) into v_line_allergens
      from jsonb_array_elements_text(coalesce(v_line->'allergens', '[]'::jsonb));
    end if;

    v_modifiers := coalesce(v_line->'modifiers', '[]'::jsonb);
    if jsonb_typeof(v_modifiers) not in ('array', 'object') then
      raise exception 'حقل modifiers يجب أن يكون مصفوفة أو كائناً.';
    end if;

    insert into public.restaurant_order_items (
      organization_id, branch_id, order_id, client_line_id, station_id,
      catalog_item_id, menu_item_id, item_name, quantity, unit_price,
      line_subtotal, discount_amount, tax_rate, tax_amount, line_total,
      status, notes, allergens, modifiers, price_override_reason,
      created_at, updated_at
    ) values (
      p_organization_id, p_branch_id, v_order_id, btrim(v_line->>'client_line_id'),
      v_station_id, v_catalog.id, v_catalog.menu_item_id, v_catalog.name,
      v_quantity, v_unit_price, v_line_subtotal, v_line_discount,
      v_tax_rate, v_tax_amount, v_line_total, 'submitted',
      nullif(btrim(v_line->>'notes'), ''), v_line_allergens,
      v_modifiers, case when v_unit_price <> v_expected_price then v_override_reason else null end,
      p_submitted_at, p_submitted_at
    );
  end loop;

  update public.restaurant_orders
  set status = 'submitted', submitted_at = p_submitted_at,
      version = 2, updated_at = p_submitted_at
  where id = v_order_id and organization_id = p_organization_id and branch_id = p_branch_id;

  insert into public.restaurant_order_status_events (
    organization_id, branch_id, order_id, event_sequence, event_scope, event_type,
    from_status, to_status, idempotency_key, correlation_id, metadata,
    actor_user_id, actor_device_id, occurred_at
  ) values (
    p_organization_id, p_branch_id, v_order_id, 2, 'order', 'order_submitted',
    'draft', 'submitted', btrim(p_idempotency_key) || ':submitted', btrim(p_idempotency_key),
    jsonb_build_object(
      'line_count', v_line_count, 'subtotal', v_subtotal,
      'discount_total', round(v_item_discount_total + v_order_discount, 4),
      'tax_total', v_tax_total, 'total', v_total,
      'station_ids', (select jsonb_agg(distinct roi.station_id) from public.restaurant_order_items roi where roi.order_id = v_order_id)
    ),
    p_actor_user_id, p_actor_device_id, p_submitted_at
  );

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id, 'restaurant_order_submitted',
    'restaurant_order', v_order_id,
    jsonb_build_object(
      'order_number', v_order_number, 'idempotency_key', btrim(p_idempotency_key),
      'actor_device_id', p_actor_device_id, 'table_id', p_restaurant_table_id,
      'line_count', v_line_count, 'total', v_total, 'status', 'submitted'
    )
  );

  return jsonb_build_object(
    'success', true, 'duplicate', false, 'order_id', v_order_id,
    'order_number', v_order_number, 'status', 'submitted',
    'total', v_total, 'version', 2
  );
end;
$$;

create or replace function public.transition_restaurant_order_item_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_order_id uuid,
  p_order_item_id uuid,
  p_to_status text,
  p_idempotency_key text,
  p_reason text default null,
  p_actor_user_id uuid default null,
  p_actor_device_id uuid default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.restaurant_orders%rowtype;
  v_item public.restaurant_order_items%rowtype;
  v_existing_event public.restaurant_order_status_events%rowtype;
  v_sequence bigint;
  v_aggregate_status text;
  v_old_order_status text;
  v_event_type text;
begin
  perform public.assert_restaurant_order_actor(
    p_organization_id, p_branch_id, p_actor_user_id, p_actor_device_id, 'kitchen'
  );

  if nullif(btrim(p_idempotency_key), '') is null or length(p_idempotency_key) > 128 then
    raise exception 'مفتاح منع التكرار مطلوب.';
  end if;
  if p_to_status not in ('accepted','preparing','ready','served','cancelled') then
    raise exception 'حالة عنصر الطلب غير مدعومة.';
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception 'وقت الحدث لا يمكن أن يكون في المستقبل.';
  end if;

  select * into v_order
  from public.restaurant_orders ro
  where ro.id = p_order_id and ro.organization_id = p_organization_id
    and ro.branch_id = p_branch_id
  for update;
  if not found then raise exception 'الطلب غير موجود في هذا الفرع.'; end if;
  if v_order.status in ('closed','cancelled') then
    raise exception 'لا يمكن تعديل طلب مغلق أو ملغي.';
  end if;

  select * into v_existing_event
  from public.restaurant_order_status_events ose
  where ose.organization_id = p_organization_id and ose.order_id = p_order_id
    and ose.idempotency_key = btrim(p_idempotency_key);
  if found then
    return jsonb_build_object(
      'success', true, 'duplicate', true, 'order_id', p_order_id,
      'item_id', p_order_item_id, 'item_status', v_existing_event.to_status,
      'order_status', v_order.status, 'version', v_order.version
    );
  end if;

  select * into v_item
  from public.restaurant_order_items roi
  where roi.id = p_order_item_id and roi.order_id = p_order_id
    and roi.organization_id = p_organization_id and roi.branch_id = p_branch_id
  for update;
  if not found then raise exception 'عنصر الطلب غير موجود في هذا الفرع.'; end if;

  if p_actor_device_id is not null and not exists (
    select 1 from public.kitchen_station_devices ksd
    where ksd.organization_id = p_organization_id and ksd.branch_id = p_branch_id
      and ksd.station_id = v_item.station_id and ksd.device_id = p_actor_device_id
      and ksd.is_active = true
  ) then
    raise exception 'الجهاز غير مرتبط بمحطة هذا العنصر.';
  end if;

  if not (
    (v_item.status = 'submitted' and p_to_status in ('accepted','cancelled'))
    or (v_item.status = 'accepted' and p_to_status in ('preparing','cancelled'))
    or (v_item.status = 'preparing' and p_to_status in ('ready','cancelled'))
    or (v_item.status = 'ready' and p_to_status in ('served','preparing','cancelled'))
  ) then
    raise exception 'انتقال حالة العنصر من % إلى % غير مسموح.', v_item.status, p_to_status;
  end if;

  if p_to_status = 'cancelled' and nullif(btrim(p_reason), '') is null then
    raise exception 'سبب إلغاء العنصر مطلوب.';
  end if;
  if v_item.status = 'ready' and p_to_status = 'preparing' and nullif(btrim(p_reason), '') is null then
    raise exception 'سبب إعادة التحضير مطلوب.';
  end if;

  v_event_type := case
    when v_item.status = 'ready' and p_to_status = 'preparing' then 'item_refired'
    when p_to_status = 'accepted' then 'item_accepted'
    when p_to_status = 'preparing' then 'item_preparing'
    when p_to_status = 'ready' then 'item_ready'
    when p_to_status = 'served' then 'item_served'
    else 'item_cancelled'
  end;

  update public.restaurant_orders
  set version = version + 1, updated_at = greatest(updated_at, p_occurred_at)
  where id = p_order_id and organization_id = p_organization_id and branch_id = p_branch_id
  returning version into v_sequence;

  update public.restaurant_order_items
  set status = p_to_status,
      accepted_at = case when p_to_status = 'accepted' then coalesce(accepted_at, p_occurred_at) else accepted_at end,
      preparing_at = case when p_to_status = 'preparing' then p_occurred_at else preparing_at end,
      ready_at = case when p_to_status = 'ready' then p_occurred_at else ready_at end,
      served_at = case when p_to_status = 'served' then p_occurred_at else served_at end,
      cancelled_at = case when p_to_status = 'cancelled' then p_occurred_at else cancelled_at end,
      updated_at = greatest(updated_at, p_occurred_at)
  where id = p_order_item_id and organization_id = p_organization_id
    and branch_id = p_branch_id and order_id = p_order_id;

  insert into public.restaurant_order_status_events (
    organization_id, branch_id, order_id, order_item_id, station_id,
    event_sequence, event_scope, event_type, from_status, to_status,
    reason, idempotency_key, correlation_id, metadata,
    actor_user_id, actor_device_id, occurred_at
  ) values (
    p_organization_id, p_branch_id, p_order_id, p_order_item_id, v_item.station_id,
    v_sequence, 'item', v_event_type, v_item.status, p_to_status,
    nullif(btrim(p_reason), ''), btrim(p_idempotency_key), btrim(p_idempotency_key),
    jsonb_build_object('client_line_id', v_item.client_line_id),
    p_actor_user_id, p_actor_device_id, p_occurred_at
  );

  select case
    when bool_and(status = 'cancelled') then 'cancelled'
    when bool_and(status in ('served','cancelled')) then 'served'
    when bool_and(status in ('ready','served','cancelled')) then 'ready'
    when count(*) filter (where status in ('preparing','ready','served')) > 0 then 'preparing'
    when bool_and(status in ('accepted','cancelled')) then 'accepted'
    else 'submitted'
  end into v_aggregate_status
  from public.restaurant_order_items roi
  where roi.organization_id = p_organization_id and roi.branch_id = p_branch_id
    and roi.order_id = p_order_id;

  v_old_order_status := v_order.status;
  if v_aggregate_status <> v_old_order_status then
    update public.restaurant_orders
    set status = v_aggregate_status,
        version = version + 1,
        accepted_at = case when v_aggregate_status = 'accepted' then coalesce(accepted_at, p_occurred_at) else accepted_at end,
        preparing_at = case when v_aggregate_status = 'preparing' then coalesce(preparing_at, p_occurred_at) else preparing_at end,
        ready_at = case when v_aggregate_status = 'ready' then p_occurred_at else ready_at end,
        served_at = case when v_aggregate_status = 'served' then p_occurred_at else served_at end,
        cancelled_at = case when v_aggregate_status = 'cancelled' then p_occurred_at else cancelled_at end,
        cancel_reason = case when v_aggregate_status = 'cancelled' then coalesce(nullif(btrim(p_reason), ''), 'ألغيت جميع العناصر') else cancel_reason end,
        updated_at = greatest(updated_at, p_occurred_at)
    where id = p_order_id and organization_id = p_organization_id and branch_id = p_branch_id
    returning version into v_sequence;

    insert into public.restaurant_order_status_events (
      organization_id, branch_id, order_id, event_sequence, event_scope,
      event_type, from_status, to_status, reason, idempotency_key,
      correlation_id, metadata, actor_user_id, actor_device_id, occurred_at
    ) values (
      p_organization_id, p_branch_id, p_order_id, v_sequence, 'order',
      'order_status_aggregated', v_old_order_status, v_aggregate_status,
      nullif(btrim(p_reason), ''), btrim(p_idempotency_key) || ':aggregate',
      btrim(p_idempotency_key), jsonb_build_object('changed_item_id', p_order_item_id),
      p_actor_user_id, p_actor_device_id, p_occurred_at
    );
  end if;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id, v_event_type,
    'restaurant_order_item', p_order_item_id,
    jsonb_build_object('status', v_item.status),
    jsonb_build_object(
      'status', p_to_status, 'order_status', v_aggregate_status,
      'order_id', p_order_id, 'station_id', v_item.station_id,
      'actor_device_id', p_actor_device_id, 'reason', nullif(btrim(p_reason), '')
    )
  );

  select * into v_order from public.restaurant_orders where id = p_order_id;
  return jsonb_build_object(
    'success', true, 'duplicate', false, 'order_id', p_order_id,
    'item_id', p_order_item_id, 'item_status', p_to_status,
    'order_status', v_order.status, 'version', v_order.version
  );
end;
$$;

create or replace function public.transition_restaurant_order_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_order_id uuid,
  p_to_status text,
  p_idempotency_key text,
  p_reason text default null,
  p_actor_user_id uuid default null,
  p_actor_device_id uuid default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.restaurant_orders%rowtype;
  v_item public.restaurant_order_items%rowtype;
  v_sequence bigint;
begin
  perform public.assert_restaurant_order_actor(
    p_organization_id, p_branch_id, p_actor_user_id, p_actor_device_id, 'close'
  );

  if p_to_status not in ('closed','cancelled') then
    raise exception 'تغيير حالة الطلب المباشر مسموح للإغلاق أو الإلغاء فقط؛ بقية الحالات تجمع من العناصر.';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null or length(p_idempotency_key) > 128 then
    raise exception 'مفتاح منع التكرار مطلوب.';
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception 'وقت الحدث لا يمكن أن يكون في المستقبل.';
  end if;

  select * into v_order
  from public.restaurant_orders ro
  where ro.id = p_order_id and ro.organization_id = p_organization_id
    and ro.branch_id = p_branch_id
  for update;
  if not found then raise exception 'الطلب غير موجود في هذا الفرع.'; end if;

  if exists (
    select 1 from public.restaurant_order_status_events ose
    where ose.organization_id = p_organization_id and ose.order_id = p_order_id
      and ose.idempotency_key = btrim(p_idempotency_key)
  ) then
    return jsonb_build_object(
      'success', true, 'duplicate', true, 'order_id', p_order_id,
      'status', v_order.status, 'version', v_order.version
    );
  end if;

  if p_to_status = 'closed' then
    if v_order.status <> 'served' then
      raise exception 'لا يغلق الطلب قبل تقديم جميع العناصر.';
    end if;

    update public.restaurant_orders
    set status = 'closed', closed_at = p_occurred_at,
        version = version + 1, updated_at = greatest(updated_at, p_occurred_at)
    where id = p_order_id and organization_id = p_organization_id and branch_id = p_branch_id
    returning version into v_sequence;
  else
    if v_order.status in ('served','closed','cancelled') then
      raise exception 'لا يمكن إلغاء طلب مقدم أو مغلق أو ملغي.';
    end if;
    if nullif(btrim(p_reason), '') is null then
      raise exception 'سبب إلغاء الطلب مطلوب.';
    end if;
    if exists (
      select 1 from public.restaurant_order_items roi
      where roi.order_id = p_order_id and roi.organization_id = p_organization_id
        and roi.branch_id = p_branch_id and roi.status = 'served'
    ) then
      raise exception 'لا يمكن إلغاء طلب يحتوي عنصراً مقدماً.';
    end if;

    for v_item in
      select * from public.restaurant_order_items roi
      where roi.order_id = p_order_id and roi.organization_id = p_organization_id
        and roi.branch_id = p_branch_id and roi.status <> 'cancelled'
      order by roi.created_at, roi.id
      for update
    loop
      update public.restaurant_orders
      set version = version + 1, updated_at = greatest(updated_at, p_occurred_at)
      where id = p_order_id and organization_id = p_organization_id and branch_id = p_branch_id
      returning version into v_sequence;

      update public.restaurant_order_items
      set status = 'cancelled', cancelled_at = p_occurred_at,
          updated_at = greatest(updated_at, p_occurred_at)
      where id = v_item.id and organization_id = p_organization_id and branch_id = p_branch_id;

      insert into public.restaurant_order_status_events (
        organization_id, branch_id, order_id, order_item_id, station_id,
        event_sequence, event_scope, event_type, from_status, to_status,
        reason, idempotency_key, correlation_id, metadata,
        actor_user_id, actor_device_id, occurred_at
      ) values (
        p_organization_id, p_branch_id, p_order_id, v_item.id, v_item.station_id,
        v_sequence, 'item', 'item_cancelled', v_item.status, 'cancelled',
        btrim(p_reason), btrim(p_idempotency_key) || ':item:' || v_item.id::text,
        btrim(p_idempotency_key), '{}'::jsonb,
        p_actor_user_id, p_actor_device_id, p_occurred_at
      );
    end loop;

    update public.restaurant_orders
    set status = 'cancelled', cancelled_at = p_occurred_at,
        cancel_reason = btrim(p_reason), version = version + 1,
        updated_at = greatest(updated_at, p_occurred_at)
    where id = p_order_id and organization_id = p_organization_id and branch_id = p_branch_id
    returning version into v_sequence;
  end if;

  insert into public.restaurant_order_status_events (
    organization_id, branch_id, order_id, event_sequence, event_scope,
    event_type, from_status, to_status, reason, idempotency_key,
    correlation_id, metadata, actor_user_id, actor_device_id, occurred_at
  ) values (
    p_organization_id, p_branch_id, p_order_id, v_sequence, 'order',
    case when p_to_status = 'closed' then 'order_closed' else 'order_cancelled' end,
    v_order.status, p_to_status, nullif(btrim(p_reason), ''),
    btrim(p_idempotency_key), btrim(p_idempotency_key), '{}'::jsonb,
    p_actor_user_id, p_actor_device_id, p_occurred_at
  );

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id,
    case when p_to_status = 'closed' then 'restaurant_order_closed' else 'restaurant_order_cancelled' end,
    'restaurant_order', p_order_id,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object(
      'status', p_to_status, 'reason', nullif(btrim(p_reason), ''),
      'actor_device_id', p_actor_device_id
    )
  );

  return jsonb_build_object(
    'success', true, 'duplicate', false, 'order_id', p_order_id,
    'status', p_to_status, 'version', v_sequence
  );
end;
$$;

create or replace function public.link_restaurant_order_invoice_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_order_id uuid,
  p_customer_invoice_id uuid,
  p_idempotency_key text,
  p_actor_user_id uuid default null,
  p_actor_device_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.restaurant_orders%rowtype;
  v_invoice public.customer_invoices%rowtype;
  v_sequence bigint;
begin
  perform public.assert_restaurant_order_actor(
    p_organization_id, p_branch_id, p_actor_user_id, p_actor_device_id, 'link_invoice'
  );

  if nullif(btrim(p_idempotency_key), '') is null or length(p_idempotency_key) > 128 then
    raise exception 'مفتاح منع التكرار مطلوب.';
  end if;

  select * into v_order
  from public.restaurant_orders ro
  where ro.id = p_order_id and ro.organization_id = p_organization_id
    and ro.branch_id = p_branch_id
  for update;
  if not found then raise exception 'الطلب غير موجود في هذا الفرع.'; end if;
  if v_order.status = 'cancelled' then raise exception 'لا تربط فاتورة بطلب ملغي.'; end if;

  if exists (
    select 1 from public.restaurant_order_status_events ose
    where ose.organization_id = p_organization_id and ose.order_id = p_order_id
      and ose.idempotency_key = btrim(p_idempotency_key)
  ) then
    return jsonb_build_object(
      'success', true, 'duplicate', true, 'order_id', p_order_id,
      'customer_invoice_id', v_order.customer_invoice_id, 'version', v_order.version
    );
  end if;

  select * into v_invoice
  from public.customer_invoices ci
  where ci.id = p_customer_invoice_id and ci.organization_id = p_organization_id
    and ci.branch_id = p_branch_id
  for update;
  if not found then raise exception 'الفاتورة لا تتبع المؤسسة والفرع المحددين.'; end if;
  if v_invoice.status::text = 'void' then raise exception 'لا يمكن ربط فاتورة ملغاة.'; end if;
  if round(v_invoice.total, 4) <> round(v_order.total, 4) then
    raise exception 'إجمالي الفاتورة لا يطابق إجمالي الطلب.';
  end if;
  if v_order.customer_invoice_id is not null and v_order.customer_invoice_id <> p_customer_invoice_id then
    raise exception 'الطلب مرتبط مسبقاً بفاتورة أخرى.';
  end if;
  if exists (
    select 1 from public.restaurant_orders ro
    where ro.organization_id = p_organization_id
      and ro.customer_invoice_id = p_customer_invoice_id and ro.id <> p_order_id
  ) then
    raise exception 'الفاتورة مرتبطة مسبقاً بطلب آخر.';
  end if;

  update public.restaurant_orders
  set customer_invoice_id = p_customer_invoice_id,
      version = version + 1, updated_at = now()
  where id = p_order_id and organization_id = p_organization_id and branch_id = p_branch_id
  returning version into v_sequence;

  insert into public.restaurant_order_status_events (
    organization_id, branch_id, order_id, event_sequence, event_scope,
    event_type, from_status, to_status, idempotency_key, correlation_id,
    metadata, actor_user_id, actor_device_id, occurred_at
  ) values (
    p_organization_id, p_branch_id, p_order_id, v_sequence, 'invoice_link',
    'invoice_linked', v_order.status, v_order.status, btrim(p_idempotency_key),
    btrim(p_idempotency_key), jsonb_build_object('customer_invoice_id', p_customer_invoice_id),
    p_actor_user_id, p_actor_device_id, now()
  );

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id, 'restaurant_order_invoice_linked',
    'restaurant_order', p_order_id,
    jsonb_build_object('customer_invoice_id', v_order.customer_invoice_id),
    jsonb_build_object(
      'customer_invoice_id', p_customer_invoice_id,
      'actor_device_id', p_actor_device_id,
      'payment_created', false
    )
  );

  return jsonb_build_object(
    'success', true, 'duplicate', false, 'order_id', p_order_id,
    'customer_invoice_id', p_customer_invoice_id, 'payment_created', false,
    'version', v_sequence
  );
end;
$$;

alter table public.kitchen_stations enable row level security;
alter table public.kitchen_station_devices enable row level security;
alter table public.restaurant_orders enable row level security;
alter table public.restaurant_order_items enable row level security;
alter table public.restaurant_order_status_events enable row level security;

create policy "kitchen_stations_branch_read" on public.kitchen_stations
  for select to authenticated
  using (public.can_access_branch(organization_id, branch_id));
create policy "kitchen_station_devices_branch_read" on public.kitchen_station_devices
  for select to authenticated
  using (public.can_access_branch(organization_id, branch_id));
create policy "restaurant_orders_branch_read" on public.restaurant_orders
  for select to authenticated
  using (public.can_access_branch(organization_id, branch_id));
create policy "restaurant_order_items_branch_read" on public.restaurant_order_items
  for select to authenticated
  using (public.can_access_branch(organization_id, branch_id));
create policy "restaurant_order_events_branch_read" on public.restaurant_order_status_events
  for select to authenticated
  using (public.can_access_branch(organization_id, branch_id));

-- No INSERT/UPDATE/DELETE policies are created. Table writes are private to the
-- function owner; API roles receive only SELECT plus narrowly scoped RPC access.
revoke all on table public.kitchen_stations from anon, authenticated, service_role;
revoke all on table public.kitchen_station_devices from anon, authenticated, service_role;
revoke all on table public.restaurant_orders from anon, authenticated, service_role;
revoke all on table public.restaurant_order_items from anon, authenticated, service_role;
revoke all on table public.restaurant_order_status_events from anon, authenticated, service_role;

grant select on table public.kitchen_stations to authenticated, service_role;
grant select on table public.kitchen_station_devices to authenticated, service_role;
grant select on table public.restaurant_orders to authenticated, service_role;
grant select on table public.restaurant_order_items to authenticated, service_role;
grant select on table public.restaurant_order_status_events to authenticated, service_role;

revoke all on function public.prevent_restaurant_order_hard_delete() from public, anon, authenticated, service_role;
revoke all on function public.protect_restaurant_order_event() from public, anon, authenticated, service_role;
revoke all on function public.protect_restaurant_order_identity() from public, anon, authenticated, service_role;
revoke all on function public.protect_restaurant_order_item_payload() from public, anon, authenticated, service_role;
revoke all on function public.assert_restaurant_order_actor(uuid, uuid, uuid, uuid, text) from public, anon, authenticated, service_role;

revoke all on function public.upsert_kitchen_station_atomic(uuid, uuid, uuid, text, text, integer, boolean, uuid) from public, anon;
grant execute on function public.upsert_kitchen_station_atomic(uuid, uuid, uuid, text, text, integer, boolean, uuid) to authenticated, service_role;

revoke all on function public.assign_kitchen_station_device_atomic(uuid, uuid, uuid, uuid, boolean, uuid) from public, anon;
grant execute on function public.assign_kitchen_station_device_atomic(uuid, uuid, uuid, uuid, boolean, uuid) to authenticated, service_role;

revoke all on function public.submit_restaurant_order_atomic(
  uuid, uuid, text, jsonb, uuid, uuid, text, text, text, public.sales_channel,
  integer, text, text[], text, numeric, numeric, numeric, uuid, uuid, timestamptz
) from public, anon;
grant execute on function public.submit_restaurant_order_atomic(
  uuid, uuid, text, jsonb, uuid, uuid, text, text, text, public.sales_channel,
  integer, text, text[], text, numeric, numeric, numeric, uuid, uuid, timestamptz
) to authenticated, service_role;

revoke all on function public.transition_restaurant_order_item_atomic(
  uuid, uuid, uuid, uuid, text, text, text, uuid, uuid, timestamptz
) from public, anon;
grant execute on function public.transition_restaurant_order_item_atomic(
  uuid, uuid, uuid, uuid, text, text, text, uuid, uuid, timestamptz
) to authenticated, service_role;

revoke all on function public.transition_restaurant_order_atomic(
  uuid, uuid, uuid, text, text, text, uuid, uuid, timestamptz
) from public, anon;
grant execute on function public.transition_restaurant_order_atomic(
  uuid, uuid, uuid, text, text, text, uuid, uuid, timestamptz
) to authenticated, service_role;

revoke all on function public.link_restaurant_order_invoice_atomic(
  uuid, uuid, uuid, uuid, text, uuid, uuid
) from public, anon;
grant execute on function public.link_restaurant_order_invoice_atomic(
  uuid, uuid, uuid, uuid, text, uuid, uuid
) to authenticated, service_role;

comment on table public.kitchen_stations is
  'Explicit branch-scoped KDS routing stations. Items persist station_id; routing never infers from names.';
comment on table public.restaurant_orders is
  'Operational restaurant orders independent from customer invoices and payments.';
comment on table public.restaurant_order_items is
  'Immutable submitted item snapshots with persisted station, decimal-safe price, tax, modifiers and allergens.';
comment on table public.restaurant_order_status_events is
  'Append-only order/item lifecycle event stream with actor and idempotency evidence.';
comment on function public.link_restaurant_order_invoice_atomic(uuid, uuid, uuid, uuid, text, uuid, uuid) is
  'Links an existing order and invoice after validating tenant, branch and total. It never creates a payment.';

-- Pre-apply validation queries (run read-only):
-- 1) Devices with NULL branch cannot use this workflow; list them for review:
-- SELECT id, organization_id, name FROM public.department_api_keys
-- WHERE branch_id IS NULL AND is_active = true;
--
-- 2) Branches referenced by active tables must be active:
-- SELECT rt.id, rt.branch_id FROM public.restaurant_tables rt
-- LEFT JOIN public.branches b ON b.id = rt.branch_id
-- WHERE b.id IS NULL OR b.status <> 'active';
--
-- Post-apply validation queries (run after staging smoke tests):
-- 1) Order totals must match their item snapshots:
-- SELECT ro.id, ro.total, sum(roi.total) AS items_total
-- FROM public.restaurant_orders ro
-- JOIN public.restaurant_order_items roi ON roi.order_id = ro.id
-- GROUP BY ro.id, ro.total
-- HAVING abs(ro.total - sum(roi.total)) > 0.0001;
--
-- 2) No order may link to an invoice of another organization or branch:
-- SELECT ro.id FROM public.restaurant_orders ro
-- JOIN public.customer_invoices ci ON ci.id = ro.customer_invoice_id
-- WHERE ci.organization_id <> ro.organization_id OR ci.branch_id <> ro.branch_id;
--
-- Forward-correction plan: never delete submitted orders, item snapshots, or
-- status events. Fix defects with a follow-up migration; cancel orders through
-- transition_restaurant_order_atomic so the event stream stays append-only.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 048_pos_refund_integrity.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- POS refund integrity hardening.
-- Forward-only migration: do not apply to production before reviewing the
-- validation queries and forward-correction notes at the end of this file.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Values used by the existing POS refund route/RPC were missing from the
-- original enums. Function bodies below are compiled when invoked, after this
-- migration has committed.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.customer_invoice_status ADD VALUE IF NOT EXISTS 'partially_refunded';
ALTER TYPE public.customer_invoice_status ADD VALUE IF NOT EXISTS 'refunded';
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'customer_return';

CREATE TABLE IF NOT EXISTS public.pos_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  customer_invoice_id uuid NOT NULL REFERENCES public.customer_invoices(id) ON DELETE RESTRICT,
  refund_number text NOT NULL,
  refund_date date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'posted' CHECK (status = 'posted'),
  is_full_refund boolean NOT NULL DEFAULT false,
  subtotal numeric(14,4) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount numeric(14,4) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_total numeric(14,4) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  service_fee numeric(14,4) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
  delivery_fee numeric(14,4) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total numeric(14,4) NOT NULL DEFAULT 0 CHECK (total >= 0),
  cost_total numeric(14,4) NOT NULL DEFAULT 0 CHECK (cost_total >= 0),
  payment_allocations jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(payment_allocations) = 'array'),
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 120),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  actor_device_id uuid REFERENCES public.department_api_keys(id) ON DELETE RESTRICT,
  journal_entry_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_refunds_actor_required CHECK (actor_user_id IS NOT NULL OR actor_device_id IS NOT NULL),
  CONSTRAINT pos_refunds_total_formula CHECK (
    abs(total - round((subtotal - discount + tax_total + service_fee + delivery_fee)::numeric, 4)) <= 0.0001
  ),
  CONSTRAINT pos_refunds_org_number_unique UNIQUE (organization_id, refund_number),
  CONSTRAINT pos_refunds_org_idempotency_unique UNIQUE (organization_id, idempotency_key),
  CONSTRAINT pos_refunds_org_id_unique UNIQUE (organization_id, id),
  CONSTRAINT pos_refunds_journal_unique UNIQUE (organization_id, journal_entry_id),
  CONSTRAINT pos_refunds_invoice_org_fk
    FOREIGN KEY (organization_id, customer_invoice_id)
    REFERENCES public.customer_invoices(organization_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT pos_refunds_journal_org_fk
    FOREIGN KEY (organization_id, journal_entry_id)
    REFERENCES public.journal_entries(organization_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

-- A composite unique index is required for tenant-safe invoice-item foreign
-- keys. It does not change or delete any historical invoice line.
CREATE UNIQUE INDEX IF NOT EXISTS customer_invoice_items_org_id_unique
  ON public.customer_invoice_items (organization_id, id);

CREATE TABLE IF NOT EXISTS public.pos_refund_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  refund_id uuid NOT NULL,
  invoice_item_id uuid NOT NULL,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  item_name text NOT NULL,
  quantity numeric(14,4) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,4) NOT NULL CHECK (unit_price >= 0),
  tax_rate numeric(8,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  subtotal numeric(14,4) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount numeric(14,4) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_total numeric(14,4) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  service_fee numeric(14,4) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
  delivery_fee numeric(14,4) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total numeric(14,4) NOT NULL DEFAULT 0 CHECK (total >= 0),
  cost_total numeric(14,4) NOT NULL DEFAULT 0 CHECK (cost_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_refund_items_refund_invoice_item_unique UNIQUE (refund_id, invoice_item_id),
  CONSTRAINT pos_refund_items_refund_org_fk
    FOREIGN KEY (organization_id, refund_id)
    REFERENCES public.pos_refunds(organization_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT pos_refund_items_invoice_item_org_fk
    FOREIGN KEY (organization_id, invoice_item_id)
    REFERENCES public.customer_invoice_items(organization_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT pos_refund_items_total_formula CHECK (
    abs(total - round((subtotal - discount + tax_total + service_fee + delivery_fee)::numeric, 4)) <= 0.0001
  )
);

CREATE INDEX IF NOT EXISTS pos_refunds_invoice_date_idx
  ON public.pos_refunds (organization_id, customer_invoice_id, refund_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS pos_refunds_branch_date_idx
  ON public.pos_refunds (organization_id, branch_id, refund_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS pos_refund_items_invoice_item_idx
  ON public.pos_refund_items (organization_id, invoice_item_id);

ALTER TABLE public.pos_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_refund_items ENABLE ROW LEVEL SECURITY;

-- Branch-scoped reads, matching customer_invoices/stock_movements: a user
-- restricted to one branch must not read another branch's refund documents.
DROP POLICY IF EXISTS "pos refunds org read" ON public.pos_refunds;
CREATE POLICY "pos refunds org read" ON public.pos_refunds
  FOR SELECT TO authenticated
  USING (public.can_access_branch(organization_id, branch_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "pos refund items org read" ON public.pos_refund_items;
CREATE POLICY "pos refund items org read" ON public.pos_refund_items
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.pos_refunds pr
      WHERE pr.organization_id = pos_refund_items.organization_id
        AND pr.id = pos_refund_items.refund_id
        AND public.can_access_branch(pr.organization_id, pr.branch_id)
    )
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pos_refunds FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pos_refund_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pos_refunds TO authenticated;
GRANT SELECT ON public.pos_refund_items TO authenticated;

CREATE OR REPLACE FUNCTION public.block_pos_refund_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'مستندات المرتجعات وآثارها غير قابلة للتعديل أو الحذف. استخدم مستند تصحيح مستقل.';
END;
$$;

DROP TRIGGER IF EXISTS pos_refunds_immutable_rows ON public.pos_refunds;
CREATE TRIGGER pos_refunds_immutable_rows
  BEFORE UPDATE OR DELETE ON public.pos_refunds
  FOR EACH ROW EXECUTE FUNCTION public.block_pos_refund_mutation();

DROP TRIGGER IF EXISTS pos_refunds_immutable_truncate ON public.pos_refunds;
CREATE TRIGGER pos_refunds_immutable_truncate
  BEFORE TRUNCATE ON public.pos_refunds
  FOR EACH STATEMENT EXECUTE FUNCTION public.block_pos_refund_mutation();

DROP TRIGGER IF EXISTS pos_refund_items_immutable_rows ON public.pos_refund_items;
CREATE TRIGGER pos_refund_items_immutable_rows
  BEFORE UPDATE OR DELETE ON public.pos_refund_items
  FOR EACH ROW EXECUTE FUNCTION public.block_pos_refund_mutation();

DROP TRIGGER IF EXISTS pos_refund_items_immutable_truncate ON public.pos_refund_items;
CREATE TRIGGER pos_refund_items_immutable_truncate
  BEFORE TRUNCATE ON public.pos_refund_items
  FOR EACH STATEMENT EXECUTE FUNCTION public.block_pos_refund_mutation();

CREATE OR REPLACE FUNCTION public.pos_refund_v2_atomic(
  p_org_id uuid,
  p_branch_id uuid,
  p_invoice_id uuid,
  p_reason text,
  p_refund_date date,
  p_idempotency_key text,
  p_actor_user_id uuid DEFAULT NULL,
  p_actor_device_id uuid DEFAULT NULL,
  p_items jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_invoice public.customer_invoices%ROWTYPE;
  v_existing public.pos_refunds%ROWTYPE;
  v_request_fingerprint text;
  v_normalized_items jsonb := '[]'::jsonb;
  v_is_full_request boolean := false;
  v_is_final_refund boolean := false;
  v_refund_id uuid := gen_random_uuid();
  v_journal_entry_id uuid := gen_random_uuid();
  v_refund_number text;
  v_journal_number text;
  v_new_invoice_status text;
  v_actor_valid boolean := false;
  v_requested record;
  v_invoice_line record;
  v_mapping record;
  v_ingredient record;
  v_payment record;
  v_impact record;
  v_take_quantity numeric(14,4);
  v_quantity_to_allocate numeric(14,4);
  v_available_quantity numeric(14,4);
  v_remaining_quantity_before numeric(18,4) := 0;
  v_remaining_quantity_after numeric(18,4) := 0;
  v_requested_quantity numeric(18,4) := 0;
  v_previous_subtotal numeric(14,4) := 0;
  v_previous_discount numeric(14,4) := 0;
  v_previous_tax numeric(14,4) := 0;
  v_previous_service_fee numeric(14,4) := 0;
  v_previous_delivery_fee numeric(14,4) := 0;
  v_previous_total numeric(14,4) := 0;
  v_previous_cost numeric(14,4) := 0;
  v_returned_subtotal numeric(14,4) := 0;
  v_returned_discount numeric(14,4) := 0;
  v_returned_tax numeric(14,4) := 0;
  v_returned_service_fee numeric(14,4) := 0;
  v_returned_delivery_fee numeric(14,4) := 0;
  v_returned_total numeric(14,4) := 0;
  v_returned_cost numeric(14,4) := 0;
  v_raw_subtotal numeric(14,4) := 0;
  v_raw_tax numeric(14,4) := 0;
  v_expected_line_cost numeric(14,4) := 0;
  v_payment_offset numeric(14,4) := 0;
  v_payment_remaining numeric(14,4) := 0;
  v_payment_capacity numeric(14,4) := 0;
  v_payment_amount numeric(14,4) := 0;
  v_payment_allocations jsonb := '[]'::jsonb;
  v_shift_id uuid;
  v_cash_refund numeric(14,4) := 0;
  v_card_refund numeric(14,4) := 0;
  v_cash_account_id uuid;
  v_card_account_id uuid;
  v_receivable_account_id uuid;
  v_sales_return_account_id uuid;
  v_discount_account_id uuid;
  v_tax_account_id uuid;
  v_service_account_id uuid;
  v_delivery_account_id uuid;
  v_cogs_account_id uuid;
  v_inventory_account_id uuid;
  v_payment_account_id uuid;
  v_debit_total numeric(18,4) := 0;
  v_credit_total numeric(18,4) := 0;
  v_last_line_id uuid;
  v_difference numeric(14,4);
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'تنفيذ مرتجع نقطة البيع مسموح من خادم رواق فقط.';
  END IF;

  IF p_org_id IS NULL OR p_branch_id IS NULL OR p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'المؤسسة والفرع والفاتورة مطلوبة.';
  END IF;

  IF p_refund_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ المرتجع مطلوب.';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < 2 THEN
    RAISE EXCEPTION 'سبب المرتجع مطلوب.';
  END IF;

  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) NOT BETWEEN 8 AND 120 THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب وطوله بين 8 و120 حرفاً.';
  END IF;

  IF p_actor_user_id IS NULL AND p_actor_device_id IS NULL THEN
    RAISE EXCEPTION 'هوية منفذ المرتجع مطلوبة.';
  END IF;

  IF p_actor_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.organization_id = p_org_id
        AND om.user_id = p_actor_user_id
        AND om.role::text IN ('organization_owner', 'branch_manager', 'accountant', 'cashier', 'super_admin')
        AND (om.branch_id IS NULL OR om.branch_id = p_branch_id)
    ) INTO v_actor_valid;

    IF NOT v_actor_valid THEN
      RAISE EXCEPTION 'المستخدم غير مخول بتنفيذ مرتجع لهذه المؤسسة.';
    END IF;
  END IF;

  IF p_actor_device_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.department_api_keys dak
      WHERE dak.id = p_actor_device_id
        AND dak.organization_id = p_org_id
        AND dak.branch_id = p_branch_id
        AND dak.is_active = true
        AND dak.role::text IN ('manager', 'branch_manager', 'organization_owner', 'accountant')
        AND 'pos' = ANY(dak.allowed_modules)
    ) INTO v_actor_valid;

    IF NOT v_actor_valid THEN
      RAISE EXCEPTION 'جهاز نقطة البيع غير مخول بتنفيذ مرتجع لهذا الفرع.';
    END IF;
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_refund_requested;
  CREATE TEMP TABLE pg_temp.pos_refund_requested (
    catalog_item_id uuid PRIMARY KEY,
    quantity numeric(14,4) NOT NULL CHECK (quantity > 0)
  ) ON COMMIT DROP;

  IF p_items IS NULL OR p_items = 'null'::jsonb THEN
    v_is_full_request := true;
  ELSIF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'بنود المرتجع يجب أن تكون مصفوفة.';
  ELSIF jsonb_array_length(p_items) = 0 THEN
    v_is_full_request := true;
  ELSE
    BEGIN
      INSERT INTO pg_temp.pos_refund_requested (catalog_item_id, quantity)
      SELECT
        (item ->> 'catalog_item_id')::uuid,
        round(sum((item ->> 'quantity')::numeric), 4)
      FROM jsonb_array_elements(p_items) AS item
      GROUP BY (item ->> 'catalog_item_id')::uuid;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'أحد بنود المرتجع يحتوي معرفاً أو كمية غير صالحة.';
    END;

    IF EXISTS (
      SELECT 1 FROM pg_temp.pos_refund_requested
      WHERE catalog_item_id IS NULL OR quantity <= 0
    ) THEN
      RAISE EXCEPTION 'كل صنف مرتجع يحتاج معرفاً وكمية موجبة.';
    END IF;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('catalog_item_id', catalog_item_id, 'quantity', quantity)
        ORDER BY catalog_item_id
      ),
      '[]'::jsonb
    )
    INTO v_normalized_items
    FROM pg_temp.pos_refund_requested;
  END IF;

  v_request_fingerprint := encode(
    public.digest(
      convert_to(
        concat_ws(
          '|',
          p_org_id::text,
          p_branch_id::text,
          p_invoice_id::text,
          p_refund_date::text,
          btrim(p_reason),
          v_is_full_request::text,
          v_normalized_items::text
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  SELECT * INTO v_existing
  FROM public.pos_refunds pr
  WHERE pr.organization_id = p_org_id
    AND pr.idempotency_key = btrim(p_idempotency_key)
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.request_fingerprint <> v_request_fingerprint THEN
      RAISE EXCEPTION 'مفتاح منع التكرار مستخدم لطلب مرتجع مختلف.';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'refundId', v_existing.id,
      'refundNumber', v_existing.refund_number,
      'invoiceId', v_existing.customer_invoice_id,
      'refundDate', v_existing.refund_date,
      'refundTotal', v_existing.total,
      'costTotal', v_existing.cost_total,
      'reason', v_existing.reason,
      'journalEntryId', v_existing.journal_entry_id
    );
  END IF;

  -- The row lock serializes all refunds for one invoice. The advisory lock is
  -- retained as a second guard for callers using different execution plans.
  SELECT * INTO v_invoice
  FROM public.customer_invoices ci
  WHERE ci.id = p_invoice_id
    AND ci.organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الفاتورة غير موجودة.';
  END IF;

  IF v_invoice.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'الفاتورة لا تتبع الفرع المطلوب.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('pos_refund_v2:' || p_org_id::text || ':' || p_invoice_id::text, 0)
  );

  -- Recheck after locking so concurrent retries return the first committed
  -- document instead of surfacing a unique-index race.
  SELECT * INTO v_existing
  FROM public.pos_refunds pr
  WHERE pr.organization_id = p_org_id
    AND pr.idempotency_key = btrim(p_idempotency_key)
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.request_fingerprint <> v_request_fingerprint THEN
      RAISE EXCEPTION 'مفتاح منع التكرار مستخدم لطلب مرتجع مختلف.';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'refundId', v_existing.id,
      'refundNumber', v_existing.refund_number,
      'invoiceId', v_existing.customer_invoice_id,
      'refundDate', v_existing.refund_date,
      'refundTotal', v_existing.total,
      'costTotal', v_existing.cost_total,
      'reason', v_existing.reason,
      'journalEntryId', v_existing.journal_entry_id
    );
  END IF;

  IF public.is_accounting_period_closed(p_org_id, p_refund_date) THEN
    RAISE EXCEPTION 'الفترة المحاسبية لتاريخ المرتجع مقفلة.';
  END IF;

  IF v_invoice.status::text NOT IN ('paid', 'partially_refunded') THEN
    RAISE EXCEPTION 'لا يمكن إرجاع فاتورة بحالتها الحالية: %', v_invoice.status;
  END IF;

  -- Legacy refunds from migration 034 did not create an item-level refund
  -- document. Further automatic partial refunds would be unsafe until those
  -- invoices are reconciled and backfilled explicitly.
  IF EXISTS (
    SELECT 1
    FROM public.journal_entries je
    WHERE je.organization_id = p_org_id
      AND je.source_doc_type = 'refund'
      AND je.source_doc_id = p_invoice_id
      AND je.status = 'posted'
  ) THEN
    RAISE EXCEPTION 'توجد عملية مرتجع قديمة لهذه الفاتورة بلا مستند تفصيلي؛ يلزم تصحيحها قبل مرتجع جديد.';
  END IF;

  SELECT
    COALESCE(sum(pr.subtotal), 0),
    COALESCE(sum(pr.discount), 0),
    COALESCE(sum(pr.tax_total), 0),
    COALESCE(sum(pr.service_fee), 0),
    COALESCE(sum(pr.delivery_fee), 0),
    COALESCE(sum(pr.total), 0),
    COALESCE(sum(pr.cost_total), 0)
  INTO
    v_previous_subtotal,
    v_previous_discount,
    v_previous_tax,
    v_previous_service_fee,
    v_previous_delivery_fee,
    v_previous_total,
    v_previous_cost
  FROM public.pos_refunds pr
  WHERE pr.organization_id = p_org_id
    AND pr.customer_invoice_id = p_invoice_id
    AND pr.status = 'posted';

  IF v_previous_subtotal > v_invoice.subtotal + 0.0001
     OR v_previous_tax > v_invoice.tax_total + 0.0001
     OR v_previous_total > v_invoice.total + 0.0001
     OR v_previous_cost > v_invoice.cost_total + 0.01 THEN
    RAISE EXCEPTION 'إجماليات المرتجعات السابقة تتجاوز الفاتورة وتحتاج مراجعة.';
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_refund_lines;
  CREATE TEMP TABLE pg_temp.pos_refund_lines (
    invoice_item_id uuid PRIMARY KEY,
    catalog_item_id uuid,
    menu_item_id uuid,
    item_name text NOT NULL,
    original_quantity numeric(14,4) NOT NULL,
    quantity numeric(14,4) NOT NULL CHECK (quantity > 0),
    unit_price numeric(14,4) NOT NULL,
    tax_rate numeric(8,4) NOT NULL,
    subtotal numeric(14,4) NOT NULL DEFAULT 0,
    discount numeric(14,4) NOT NULL DEFAULT 0,
    tax_total numeric(14,4) NOT NULL DEFAULT 0,
    service_fee numeric(14,4) NOT NULL DEFAULT 0,
    delivery_fee numeric(14,4) NOT NULL DEFAULT 0,
    total numeric(14,4) NOT NULL DEFAULT 0,
    expected_cost numeric(14,4) NOT NULL DEFAULT 0,
    cost_total numeric(14,4) NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  WITH returned AS (
    SELECT pri.invoice_item_id, sum(pri.quantity) AS quantity
    FROM public.pos_refund_items pri
    JOIN public.pos_refunds pr
      ON pr.organization_id = pri.organization_id
     AND pr.id = pri.refund_id
    WHERE pri.organization_id = p_org_id
      AND pr.customer_invoice_id = p_invoice_id
      AND pr.status = 'posted'
    GROUP BY pri.invoice_item_id
  )
  SELECT COALESCE(sum(cii.quantity - COALESCE(returned.quantity, 0)), 0)
  INTO v_remaining_quantity_before
  FROM public.customer_invoice_items cii
  LEFT JOIN returned ON returned.invoice_item_id = cii.id
  WHERE cii.organization_id = p_org_id
    AND cii.customer_invoice_id = p_invoice_id;

  IF v_remaining_quantity_before <= 0.0001 THEN
    RAISE EXCEPTION 'تم إرجاع جميع بنود الفاتورة مسبقاً.';
  END IF;

  IF v_is_full_request THEN
    INSERT INTO pg_temp.pos_refund_lines (
      invoice_item_id, catalog_item_id, menu_item_id, item_name,
      original_quantity, quantity, unit_price, tax_rate,
      subtotal, tax_total, expected_cost
    )
    SELECT
      cii.id,
      cii.catalog_item_id,
      cii.menu_item_id,
      cii.name,
      cii.quantity,
      round((cii.quantity - COALESCE(returned.quantity, 0))::numeric, 4),
      round(cii.unit_price::numeric, 4),
      round(COALESCE(cii.tax_rate, 0)::numeric, 4),
      round((cii.unit_price * (cii.quantity - COALESCE(returned.quantity, 0)))::numeric, 4),
      round((cii.unit_price * (cii.quantity - COALESCE(returned.quantity, 0)) * COALESCE(cii.tax_rate, 0) / 100)::numeric, 4),
      CASE
        WHEN cii.quantity > 0
          THEN round((cii.cost_total / cii.quantity * (cii.quantity - COALESCE(returned.quantity, 0)))::numeric, 4)
        ELSE 0
      END
    FROM public.customer_invoice_items cii
    LEFT JOIN (
      SELECT pri.invoice_item_id, sum(pri.quantity) AS quantity
      FROM public.pos_refund_items pri
      JOIN public.pos_refunds pr
        ON pr.organization_id = pri.organization_id
       AND pr.id = pri.refund_id
      WHERE pri.organization_id = p_org_id
        AND pr.customer_invoice_id = p_invoice_id
        AND pr.status = 'posted'
      GROUP BY pri.invoice_item_id
    ) returned ON returned.invoice_item_id = cii.id
    WHERE cii.organization_id = p_org_id
      AND cii.customer_invoice_id = p_invoice_id
      AND cii.quantity - COALESCE(returned.quantity, 0) > 0.0001;
  ELSE
    FOR v_requested IN
      SELECT catalog_item_id, quantity
      FROM pg_temp.pos_refund_requested
      ORDER BY catalog_item_id
    LOOP
      SELECT COALESCE(sum(cii.quantity - COALESCE(returned.quantity, 0)), 0)
      INTO v_available_quantity
      FROM public.customer_invoice_items cii
      LEFT JOIN (
        SELECT pri.invoice_item_id, sum(pri.quantity) AS quantity
        FROM public.pos_refund_items pri
        JOIN public.pos_refunds pr
          ON pr.organization_id = pri.organization_id
         AND pr.id = pri.refund_id
        WHERE pri.organization_id = p_org_id
          AND pr.customer_invoice_id = p_invoice_id
          AND pr.status = 'posted'
        GROUP BY pri.invoice_item_id
      ) returned ON returned.invoice_item_id = cii.id
      WHERE cii.organization_id = p_org_id
        AND cii.customer_invoice_id = p_invoice_id
        AND cii.catalog_item_id = v_requested.catalog_item_id;

      IF v_available_quantity <= 0.0001 THEN
        RAISE EXCEPTION 'الصنف % غير موجود أو تم إرجاعه بالكامل.', v_requested.catalog_item_id;
      END IF;

      IF v_requested.quantity > v_available_quantity + 0.0001 THEN
        RAISE EXCEPTION 'كمية المرتجع للصنف % تتجاوز الكمية المتبقية (%).',
          v_requested.catalog_item_id, v_available_quantity;
      END IF;

      v_quantity_to_allocate := v_requested.quantity;

      FOR v_invoice_line IN
        SELECT
          cii.*,
          round((cii.quantity - COALESCE(returned.quantity, 0))::numeric, 4) AS remaining_quantity
        FROM public.customer_invoice_items cii
        LEFT JOIN (
          SELECT pri.invoice_item_id, sum(pri.quantity) AS quantity
          FROM public.pos_refund_items pri
          JOIN public.pos_refunds pr
            ON pr.organization_id = pri.organization_id
           AND pr.id = pri.refund_id
          WHERE pri.organization_id = p_org_id
            AND pr.customer_invoice_id = p_invoice_id
            AND pr.status = 'posted'
          GROUP BY pri.invoice_item_id
        ) returned ON returned.invoice_item_id = cii.id
        WHERE cii.organization_id = p_org_id
          AND cii.customer_invoice_id = p_invoice_id
          AND cii.catalog_item_id = v_requested.catalog_item_id
          AND cii.quantity - COALESCE(returned.quantity, 0) > 0.0001
        ORDER BY cii.created_at, cii.id
      LOOP
        EXIT WHEN v_quantity_to_allocate <= 0.0001;

        v_take_quantity := round(LEAST(v_quantity_to_allocate, v_invoice_line.remaining_quantity)::numeric, 4);

        INSERT INTO pg_temp.pos_refund_lines (
          invoice_item_id, catalog_item_id, menu_item_id, item_name,
          original_quantity, quantity, unit_price, tax_rate,
          subtotal, tax_total, expected_cost
        ) VALUES (
          v_invoice_line.id,
          v_invoice_line.catalog_item_id,
          v_invoice_line.menu_item_id,
          v_invoice_line.name,
          v_invoice_line.quantity,
          v_take_quantity,
          round(v_invoice_line.unit_price::numeric, 4),
          round(COALESCE(v_invoice_line.tax_rate, 0)::numeric, 4),
          round((v_invoice_line.unit_price * v_take_quantity)::numeric, 4),
          round((v_invoice_line.unit_price * v_take_quantity * COALESCE(v_invoice_line.tax_rate, 0) / 100)::numeric, 4),
          CASE
            WHEN v_invoice_line.quantity > 0
              THEN round((v_invoice_line.cost_total / v_invoice_line.quantity * v_take_quantity)::numeric, 4)
            ELSE 0
          END
        );

        v_quantity_to_allocate := round((v_quantity_to_allocate - v_take_quantity)::numeric, 4);
      END LOOP;

      IF v_quantity_to_allocate > 0.0001 THEN
        RAISE EXCEPTION 'تعذر توزيع كامل كمية المرتجع للصنف %.', v_requested.catalog_item_id;
      END IF;
    END LOOP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_temp.pos_refund_lines) THEN
    RAISE EXCEPTION 'لا توجد بنود صالحة للإرجاع.';
  END IF;

  SELECT COALESCE(sum(quantity), 0), COALESCE(sum(subtotal), 0),
         COALESCE(sum(tax_total), 0), COALESCE(sum(expected_cost), 0)
  INTO v_requested_quantity, v_raw_subtotal, v_raw_tax, v_expected_line_cost
  FROM pg_temp.pos_refund_lines;

  v_is_final_refund := abs(v_remaining_quantity_before - v_requested_quantity) <= 0.0001;

  IF v_is_final_refund THEN
    v_returned_subtotal := round(GREATEST(v_invoice.subtotal - v_previous_subtotal, 0)::numeric, 4);
    v_returned_discount := round(GREATEST(v_invoice.discount - v_previous_discount, 0)::numeric, 4);
    v_returned_tax := round(GREATEST(v_invoice.tax_total - v_previous_tax, 0)::numeric, 4);
    v_returned_service_fee := round(GREATEST(v_invoice.service_fee - v_previous_service_fee, 0)::numeric, 4);
    v_returned_delivery_fee := round(GREATEST(v_invoice.delivery_fee - v_previous_delivery_fee, 0)::numeric, 4);
    v_returned_total := round(GREATEST(v_invoice.total - v_previous_total, 0)::numeric, 4);
  ELSE
    v_returned_subtotal := round(LEAST(v_raw_subtotal, GREATEST(v_invoice.subtotal - v_previous_subtotal, 0))::numeric, 4);
    v_returned_tax := round(LEAST(v_raw_tax, GREATEST(v_invoice.tax_total - v_previous_tax, 0))::numeric, 4);

    IF v_invoice.subtotal > 0 THEN
      v_returned_discount := round(LEAST(
        v_invoice.discount * v_returned_subtotal / v_invoice.subtotal,
        GREATEST(v_invoice.discount - v_previous_discount, 0)
      )::numeric, 4);
      v_returned_service_fee := round(LEAST(
        v_invoice.service_fee * v_returned_subtotal / v_invoice.subtotal,
        GREATEST(v_invoice.service_fee - v_previous_service_fee, 0)
      )::numeric, 4);
      v_returned_delivery_fee := round(LEAST(
        v_invoice.delivery_fee * v_returned_subtotal / v_invoice.subtotal,
        GREATEST(v_invoice.delivery_fee - v_previous_delivery_fee, 0)
      )::numeric, 4);
    END IF;

    v_returned_total := round((
      v_returned_subtotal - v_returned_discount + v_returned_tax
      + v_returned_service_fee + v_returned_delivery_fee
    )::numeric, 4);

    IF v_returned_total > GREATEST(v_invoice.total - v_previous_total, 0) + 0.0001 THEN
      RAISE EXCEPTION 'إجمالي المرتجع المحسوب يتجاوز رصيد الفاتورة.';
    END IF;
  END IF;

  IF v_returned_total < 0 THEN
    RAISE EXCEPTION 'إجمالي المرتجع المحسوب غير صالح.';
  END IF;

  -- Reconcile the final line so item totals exactly equal the immutable header.
  SELECT invoice_item_id INTO v_last_line_id
  FROM pg_temp.pos_refund_lines
  ORDER BY invoice_item_id DESC
  LIMIT 1;

  v_difference := round((v_returned_subtotal - v_raw_subtotal)::numeric, 4);
  UPDATE pg_temp.pos_refund_lines
  SET subtotal = round((subtotal + v_difference)::numeric, 4)
  WHERE invoice_item_id = v_last_line_id;

  v_difference := round((v_returned_tax - v_raw_tax)::numeric, 4);
  UPDATE pg_temp.pos_refund_lines
  SET tax_total = round((tax_total + v_difference)::numeric, 4)
  WHERE invoice_item_id = v_last_line_id;

  IF EXISTS (SELECT 1 FROM pg_temp.pos_refund_lines WHERE subtotal < 0 OR tax_total < 0) THEN
    RAISE EXCEPTION 'تعذر توزيع فروقات التقريب على بنود المرتجع بأمان.';
  END IF;

  UPDATE pg_temp.pos_refund_lines
  SET
    discount = CASE WHEN v_returned_subtotal > 0
      THEN round((v_returned_discount * subtotal / v_returned_subtotal)::numeric, 4) ELSE 0 END,
    service_fee = CASE WHEN v_returned_subtotal > 0
      THEN round((v_returned_service_fee * subtotal / v_returned_subtotal)::numeric, 4) ELSE 0 END,
    delivery_fee = CASE WHEN v_returned_subtotal > 0
      THEN round((v_returned_delivery_fee * subtotal / v_returned_subtotal)::numeric, 4) ELSE 0 END;

  SELECT round((v_returned_discount - COALESCE(sum(discount), 0))::numeric, 4)
  INTO v_difference FROM pg_temp.pos_refund_lines;
  UPDATE pg_temp.pos_refund_lines SET discount = discount + v_difference
  WHERE invoice_item_id = v_last_line_id;

  SELECT round((v_returned_service_fee - COALESCE(sum(service_fee), 0))::numeric, 4)
  INTO v_difference FROM pg_temp.pos_refund_lines;
  UPDATE pg_temp.pos_refund_lines SET service_fee = service_fee + v_difference
  WHERE invoice_item_id = v_last_line_id;

  SELECT round((v_returned_delivery_fee - COALESCE(sum(delivery_fee), 0))::numeric, 4)
  INTO v_difference FROM pg_temp.pos_refund_lines;
  UPDATE pg_temp.pos_refund_lines SET delivery_fee = delivery_fee + v_difference
  WHERE invoice_item_id = v_last_line_id;

  UPDATE pg_temp.pos_refund_lines
  SET total = round((subtotal - discount + tax_total + service_fee + delivery_fee)::numeric, 4);

  SELECT round((v_returned_total - COALESCE(sum(total), 0))::numeric, 4)
  INTO v_difference FROM pg_temp.pos_refund_lines;
  UPDATE pg_temp.pos_refund_lines SET total = total + v_difference
  WHERE invoice_item_id = v_last_line_id;

  IF EXISTS (
    SELECT 1 FROM pg_temp.pos_refund_lines
    WHERE discount < 0 OR service_fee < 0 OR delivery_fee < 0 OR total < 0
  ) THEN
    RAISE EXCEPTION 'توزيع إجمالي المرتجع على البنود غير صالح.';
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_refund_raw_impacts;
  CREATE TEMP TABLE pg_temp.pos_refund_raw_impacts (
    item_id uuid PRIMARY KEY,
    quantity numeric(14,4) NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  DROP TABLE IF EXISTS pg_temp.pos_refund_stock_impacts;
  CREATE TEMP TABLE pg_temp.pos_refund_stock_impacts (
    item_id uuid PRIMARY KEY,
    quantity numeric(14,4) NOT NULL CHECK (quantity > 0),
    unit_cost numeric(14,4) NOT NULL CHECK (unit_cost >= 0),
    is_provisional_cost boolean NOT NULL DEFAULT false
  ) ON COMMIT DROP;

  IF v_is_final_refund THEN
    WITH original AS (
      SELECT
        sm.item_id,
        round(sum(abs(sm.quantity))::numeric, 4) AS quantity,
        round((sum(abs(sm.quantity) * sm.unit_cost) / NULLIF(sum(abs(sm.quantity)), 0))::numeric, 4) AS unit_cost,
        bool_or(COALESCE(sm.is_provisional_cost, false)) AS is_provisional_cost
      FROM public.stock_movements sm
      WHERE sm.organization_id = p_org_id
        AND sm.branch_id = p_branch_id
        AND sm.source_doc_type = 'customer_invoice'
        AND sm.source_doc_id = p_invoice_id
        AND sm.movement_type = 'sale_usage'
      GROUP BY sm.item_id
    ), returned AS (
      SELECT sm.item_id, round(sum(sm.quantity)::numeric, 4) AS quantity
      FROM public.stock_movements sm
      JOIN public.pos_refunds pr
        ON pr.organization_id = sm.organization_id
       AND pr.id = sm.source_doc_id
      WHERE sm.organization_id = p_org_id
        AND pr.customer_invoice_id = p_invoice_id
        AND sm.source_doc_type = 'pos_refund'
        AND sm.movement_type = 'customer_return'
      GROUP BY sm.item_id
    )
    INSERT INTO pg_temp.pos_refund_stock_impacts (item_id, quantity, unit_cost, is_provisional_cost)
    SELECT
      original.item_id,
      round((original.quantity - COALESCE(returned.quantity, 0))::numeric, 4),
      original.unit_cost,
      original.is_provisional_cost
    FROM original
    LEFT JOIN returned ON returned.item_id = original.item_id
    WHERE original.quantity - COALESCE(returned.quantity, 0) > 0.0001;
  ELSE
    FOR v_invoice_line IN
      SELECT * FROM pg_temp.pos_refund_lines ORDER BY invoice_item_id
    LOOP
      FOR v_mapping IN
        SELECT *
        FROM public.menu_item_recipe_mapping mirm
        WHERE mirm.organization_id = p_org_id
          AND mirm.menu_item_id = v_invoice_line.menu_item_id
      LOOP
        FOR v_ingredient IN
          SELECT *
          FROM public.recipe_ingredients ri
          WHERE ri.organization_id = p_org_id
            AND ri.recipe_id = v_mapping.recipe_id
        LOOP
          v_take_quantity := round((
            v_ingredient.quantity
            * COALESCE(v_mapping.portion_multiplier, 1)
            * v_invoice_line.quantity
            / NULLIF(COALESCE(v_ingredient.yield_percent, 100) / 100, 0)
          )::numeric, 4);

          IF v_take_quantity > 0 THEN
            INSERT INTO pg_temp.pos_refund_raw_impacts (item_id, quantity)
            VALUES (v_ingredient.item_id, v_take_quantity)
            ON CONFLICT (item_id) DO UPDATE
              SET quantity = round((pos_refund_raw_impacts.quantity + excluded.quantity)::numeric, 4);
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;

    WITH original AS (
      SELECT
        sm.item_id,
        round(sum(abs(sm.quantity))::numeric, 4) AS quantity,
        round((sum(abs(sm.quantity) * sm.unit_cost) / NULLIF(sum(abs(sm.quantity)), 0))::numeric, 4) AS unit_cost,
        bool_or(COALESCE(sm.is_provisional_cost, false)) AS is_provisional_cost
      FROM public.stock_movements sm
      WHERE sm.organization_id = p_org_id
        AND sm.branch_id = p_branch_id
        AND sm.source_doc_type = 'customer_invoice'
        AND sm.source_doc_id = p_invoice_id
        AND sm.movement_type = 'sale_usage'
      GROUP BY sm.item_id
    ), returned AS (
      SELECT sm.item_id, round(sum(sm.quantity)::numeric, 4) AS quantity
      FROM public.stock_movements sm
      JOIN public.pos_refunds pr
        ON pr.organization_id = sm.organization_id
       AND pr.id = sm.source_doc_id
      WHERE sm.organization_id = p_org_id
        AND pr.customer_invoice_id = p_invoice_id
        AND sm.source_doc_type = 'pos_refund'
        AND sm.movement_type = 'customer_return'
      GROUP BY sm.item_id
    )
    INSERT INTO pg_temp.pos_refund_stock_impacts (item_id, quantity, unit_cost, is_provisional_cost)
    SELECT
      raw.item_id,
      round(LEAST(raw.quantity, original.quantity - COALESCE(returned.quantity, 0))::numeric, 4),
      original.unit_cost,
      original.is_provisional_cost
    FROM pg_temp.pos_refund_raw_impacts raw
    JOIN original ON original.item_id = raw.item_id
    LEFT JOIN returned ON returned.item_id = raw.item_id
    WHERE original.quantity - COALESCE(returned.quantity, 0) > 0.0001;

    SELECT round(COALESCE(sum(quantity * unit_cost), 0)::numeric, 4)
    INTO v_returned_cost
    FROM pg_temp.pos_refund_stock_impacts;

    IF abs(v_returned_cost - v_expected_line_cost) > 0.02 THEN
      RAISE EXCEPTION 'تغيرت وصفة أو تكلفة أحد الأصناف منذ البيع؛ يلزم مرتجع كامل أو تسوية مخزون معتمدة.';
    END IF;
  END IF;

  SELECT round(COALESCE(sum(quantity * unit_cost), 0)::numeric, 4)
  INTO v_returned_cost
  FROM pg_temp.pos_refund_stock_impacts;

  UPDATE pg_temp.pos_refund_lines
  SET cost_total = CASE
    WHEN v_expected_line_cost > 0
      THEN round((v_returned_cost * expected_cost / v_expected_line_cost)::numeric, 4)
    ELSE 0
  END;

  SELECT round((v_returned_cost - COALESCE(sum(cost_total), 0))::numeric, 4)
  INTO v_difference FROM pg_temp.pos_refund_lines;
  UPDATE pg_temp.pos_refund_lines SET cost_total = cost_total + v_difference
  WHERE invoice_item_id = v_last_line_id;

  IF EXISTS (SELECT 1 FROM pg_temp.pos_refund_lines WHERE cost_total < 0) THEN
    RAISE EXCEPTION 'تعذر توزيع تكلفة المرتجع على البنود بأمان.';
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_refund_original_payments;
  CREATE TEMP TABLE pg_temp.pos_refund_original_payments (
    line_index integer GENERATED ALWAYS AS IDENTITY,
    payment_method text NOT NULL,
    amount numeric(14,4) NOT NULL CHECK (amount > 0)
  ) ON COMMIT DROP;

  INSERT INTO pg_temp.pos_refund_original_payments (payment_method, amount)
  SELECT cip.payment_method::text, round(cip.amount::numeric, 4)
  FROM public.customer_invoice_payments cip
  WHERE cip.organization_id = p_org_id
    AND cip.customer_invoice_id = p_invoice_id
    AND cip.amount > 0
  ORDER BY cip.created_at, cip.id;

  IF NOT EXISTS (SELECT 1 FROM pg_temp.pos_refund_original_payments) AND v_invoice.total > 0 THEN
    INSERT INTO pg_temp.pos_refund_original_payments (payment_method, amount)
    VALUES (v_invoice.payment_method::text, round(v_invoice.total::numeric, 4));
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_refund_payment_allocations;
  CREATE TEMP TABLE pg_temp.pos_refund_payment_allocations (
    line_index integer GENERATED ALWAYS AS IDENTITY,
    payment_method text NOT NULL,
    amount numeric(14,4) NOT NULL CHECK (amount > 0)
  ) ON COMMIT DROP;

  v_payment_offset := v_previous_total;
  v_payment_remaining := v_returned_total;

  FOR v_payment IN
    SELECT payment_method, amount
    FROM pg_temp.pos_refund_original_payments
    ORDER BY line_index
  LOOP
    EXIT WHEN v_payment_remaining <= 0.0001;

    IF v_payment_offset >= v_payment.amount - 0.0001 THEN
      v_payment_offset := round(GREATEST(v_payment_offset - v_payment.amount, 0)::numeric, 4);
      CONTINUE;
    END IF;

    v_payment_capacity := round((v_payment.amount - v_payment_offset)::numeric, 4);
    v_payment_offset := 0;
    v_payment_amount := round(LEAST(v_payment_capacity, v_payment_remaining)::numeric, 4);

    IF v_payment_amount > 0 THEN
      INSERT INTO pg_temp.pos_refund_payment_allocations (payment_method, amount)
      VALUES (v_payment.payment_method, v_payment_amount);
      v_payment_remaining := round((v_payment_remaining - v_payment_amount)::numeric, 4);
    END IF;
  END LOOP;

  IF v_payment_remaining > 0.0001 THEN
    RAISE EXCEPTION 'دفعات الفاتورة الأصلية لا تغطي مبلغ المرتجع؛ يلزم تصحيح تسوية الفاتورة.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('method', payment_method, 'amount', amount)
      ORDER BY line_index
    ),
    '[]'::jsonb
  )
  INTO v_payment_allocations
  FROM pg_temp.pos_refund_payment_allocations;

  SELECT
    COALESCE(sum(amount) FILTER (WHERE payment_method = 'cash'), 0),
    COALESCE(sum(amount) FILTER (WHERE payment_method = 'card'), 0)
  INTO v_cash_refund, v_card_refund
  FROM pg_temp.pos_refund_payment_allocations;

  IF v_cash_refund > 0 OR v_card_refund > 0 THEN
    SELECT ss.id INTO v_shift_id
    FROM public.sales_shifts ss
    WHERE ss.organization_id = p_org_id
      AND ss.branch_id = p_branch_id
      AND ss.status = 'open'
      AND (p_actor_device_id IS NULL OR ss.device_key_id = p_actor_device_id)
    ORDER BY ss.opened_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_shift_id IS NULL THEN
      RAISE EXCEPTION 'يجب فتح وردية على الجهاز قبل تنفيذ مرتجع نقدي أو بطاقة.';
    END IF;
  END IF;

  v_refund_number := 'RFD-' || to_char(p_refund_date, 'YYYYMMDD') || '-' ||
    upper(left(replace(v_refund_id::text, '-', ''), 8));
  v_journal_number := 'JE-' || to_char(p_refund_date, 'YYYYMMDD') || '-RFD-' ||
    upper(left(replace(v_journal_entry_id::text, '-', ''), 8));

  -- The immutable source document is inserted before stock, shift, summary,
  -- invoice-status, audit, or journal effects. Its journal FK is deferred;
  -- any later failure rolls back this row and every effect in the same RPC.
  INSERT INTO public.pos_refunds (
    id, organization_id, branch_id, customer_invoice_id,
    refund_number, refund_date, reason, status, is_full_refund,
    subtotal, discount, tax_total, service_fee, delivery_fee, total, cost_total,
    payment_allocations, idempotency_key, request_fingerprint,
    actor_user_id, actor_device_id, journal_entry_id
  ) VALUES (
    v_refund_id, p_org_id, p_branch_id, p_invoice_id,
    v_refund_number, p_refund_date, btrim(p_reason), 'posted', v_is_final_refund,
    v_returned_subtotal, v_returned_discount, v_returned_tax,
    v_returned_service_fee, v_returned_delivery_fee, v_returned_total, v_returned_cost,
    v_payment_allocations, btrim(p_idempotency_key), v_request_fingerprint,
    p_actor_user_id, p_actor_device_id, v_journal_entry_id
  );

  INSERT INTO public.pos_refund_items (
    organization_id, refund_id, invoice_item_id, catalog_item_id,
    item_name, quantity, unit_price, tax_rate,
    subtotal, discount, tax_total, service_fee, delivery_fee, total, cost_total
  )
  SELECT
    p_org_id, v_refund_id, invoice_item_id, catalog_item_id,
    item_name, quantity, unit_price, tax_rate,
    subtotal, discount, tax_total, service_fee, delivery_fee, total, cost_total
  FROM pg_temp.pos_refund_lines
  ORDER BY invoice_item_id;

  FOR v_impact IN
    SELECT * FROM pg_temp.pos_refund_stock_impacts ORDER BY item_id
  LOOP
    INSERT INTO public.branch_stock (
      organization_id, branch_id, item_id, quantity, reserved_quantity
    ) VALUES (
      p_org_id, p_branch_id, v_impact.item_id, v_impact.quantity, 0
    )
    ON CONFLICT (branch_id, item_id) DO UPDATE
      SET quantity = round((public.branch_stock.quantity + excluded.quantity)::numeric, 4),
          updated_at = now();

    INSERT INTO public.stock_movements (
      organization_id, branch_id, item_id, movement_type, quantity,
      unit_cost, source_doc_type, source_doc_id, idempotency_key, notes,
      created_by, is_negative_stock, is_provisional_cost
    ) VALUES (
      p_org_id, p_branch_id, v_impact.item_id, 'customer_return', v_impact.quantity,
      v_impact.unit_cost, 'pos_refund', v_refund_id,
      v_refund_id::text || ':' || v_impact.item_id::text || ':customer_return',
      'استعادة مخزون مرتجع ' || v_refund_number || ' للفاتورة ' || v_invoice.invoice_number,
      p_actor_user_id, false, v_impact.is_provisional_cost
    );
  END LOOP;

  PERFORM public.ensure_default_chart_accounts(p_org_id);

  SELECT id INTO v_cash_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'cash_on_hand' AND is_active = true LIMIT 1;
  SELECT id INTO v_card_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'bank_card' AND is_active = true LIMIT 1;
  SELECT id INTO v_receivable_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'accounts_receivable' AND is_active = true LIMIT 1;
  SELECT id INTO v_sales_return_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key IN ('sales_returns', 'sales_revenue') AND is_active = true
  ORDER BY CASE WHEN system_key = 'sales_returns' THEN 0 ELSE 1 END LIMIT 1;
  SELECT id INTO v_discount_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'sales_discounts' AND is_active = true LIMIT 1;
  SELECT id INTO v_tax_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'output_tax_payable' AND is_active = true LIMIT 1;
  SELECT id INTO v_service_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'service_fee_revenue' AND is_active = true LIMIT 1;
  SELECT id INTO v_delivery_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'delivery_revenue' AND is_active = true LIMIT 1;
  SELECT id INTO v_cogs_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'cogs' AND is_active = true LIMIT 1;
  SELECT id INTO v_inventory_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'inventory' AND is_active = true LIMIT 1;

  IF v_sales_return_account_id IS NULL
     OR (v_returned_discount > 0 AND v_discount_account_id IS NULL)
     OR (v_returned_tax > 0 AND v_tax_account_id IS NULL)
     OR (v_returned_service_fee > 0 AND v_service_account_id IS NULL)
     OR (v_returned_delivery_fee > 0 AND v_delivery_account_id IS NULL)
     OR (v_returned_cost > 0 AND (v_cogs_account_id IS NULL OR v_inventory_account_id IS NULL)) THEN
    RAISE EXCEPTION 'حسابات مرتجع المبيعات غير مكتملة في دليل الحسابات.';
  END IF;

  INSERT INTO public.journal_entries (
    id, organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status, created_by
  ) VALUES (
    v_journal_entry_id, p_org_id, p_branch_id, v_journal_number, p_refund_date,
    'pos_refund', v_refund_id,
    'قيد مرتجع مبيعات ' || v_refund_number || ' للفاتورة ' || v_invoice.invoice_number,
    'draft', p_actor_user_id
  );

  IF v_returned_subtotal > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_journal_entry_id, v_sales_return_account_id, p_branch_id,
      v_returned_subtotal, 0, 'مرتجع مبيعات ' || v_refund_number
    );
  END IF;

  IF v_returned_tax > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_journal_entry_id, v_tax_account_id, p_branch_id,
      v_returned_tax, 0, 'عكس ضريبة مخرجات ' || v_refund_number
    );
  END IF;

  IF v_returned_service_fee > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_journal_entry_id, v_service_account_id, p_branch_id,
      v_returned_service_fee, 0, 'عكس إيراد خدمة ' || v_refund_number
    );
  END IF;

  IF v_returned_delivery_fee > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_journal_entry_id, v_delivery_account_id, p_branch_id,
      v_returned_delivery_fee, 0, 'عكس إيراد توصيل ' || v_refund_number
    );
  END IF;

  FOR v_payment IN
    SELECT payment_method, amount
    FROM pg_temp.pos_refund_payment_allocations
    ORDER BY line_index
  LOOP
    v_payment_account_id := CASE v_payment.payment_method
      WHEN 'cash' THEN v_cash_account_id
      WHEN 'receivable' THEN v_receivable_account_id
      ELSE v_card_account_id
    END;

    IF v_payment_account_id IS NULL THEN
      RAISE EXCEPTION 'حساب وسيلة الدفع % غير معرف.', v_payment.payment_method;
    END IF;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_journal_entry_id, v_payment_account_id, p_branch_id,
      0, v_payment.amount, 'تسوية مرتجع عبر ' || v_payment.payment_method || ' - ' || v_refund_number
    );
  END LOOP;

  IF v_returned_discount > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_journal_entry_id, v_discount_account_id, p_branch_id,
      0, v_returned_discount, 'عكس خصم مبيعات ' || v_refund_number
    );
  END IF;

  IF v_returned_cost > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo,
      is_provisional_cost
    ) VALUES
      (
        p_org_id, v_journal_entry_id, v_inventory_account_id, p_branch_id,
        v_returned_cost, 0, 'استعادة مخزون ' || v_refund_number,
        EXISTS (SELECT 1 FROM pg_temp.pos_refund_stock_impacts WHERE is_provisional_cost)
      ),
      (
        p_org_id, v_journal_entry_id, v_cogs_account_id, p_branch_id,
        0, v_returned_cost, 'عكس تكلفة مبيعات ' || v_refund_number,
        EXISTS (SELECT 1 FROM pg_temp.pos_refund_stock_impacts WHERE is_provisional_cost)
      );
  END IF;

  SELECT
    round(COALESCE(sum(jl.debit), 0)::numeric, 4),
    round(COALESCE(sum(jl.credit), 0)::numeric, 4)
  INTO v_debit_total, v_credit_total
  FROM public.journal_lines jl
  WHERE jl.organization_id = p_org_id
    AND jl.journal_entry_id = v_journal_entry_id;

  IF abs(v_debit_total - v_credit_total) > 0.0001 THEN
    RAISE EXCEPTION 'قيد المرتجع غير متوازن: مدين % ودائن %.', v_debit_total, v_credit_total;
  END IF;

  UPDATE public.journal_entries
  SET status = 'posted'
  WHERE organization_id = p_org_id
    AND id = v_journal_entry_id
    AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'تعذر ترحيل قيد المرتجع من مسودة إلى مرحل.';
  END IF;

  IF v_shift_id IS NOT NULL THEN
    UPDATE public.sales_shifts
    SET cash_sales = round((cash_sales - v_cash_refund)::numeric, 4),
        card_sales = round((card_sales - v_card_refund)::numeric, 4),
        expected_cash = round((expected_cash - v_cash_refund)::numeric, 4),
        updated_at = now()
    WHERE id = v_shift_id
      AND organization_id = p_org_id
      AND status = 'open';

    IF v_cash_refund > 0 THEN
      INSERT INTO public.cash_drawer_entries (
        organization_id, branch_id, shift_id, entry_type, amount,
        reference_doc_type, reference_doc_id, memo, created_by
      ) VALUES (
        p_org_id, p_branch_id, v_shift_id, 'withdrawal', -v_cash_refund,
        'pos_refund', v_refund_id, 'دفع مرتجع نقدي ' || v_refund_number, p_actor_user_id
      );
    END IF;

    IF v_card_refund > 0 THEN
      INSERT INTO public.cash_drawer_entries (
        organization_id, branch_id, shift_id, entry_type, amount,
        reference_doc_type, reference_doc_id, memo, created_by
      ) VALUES (
        p_org_id, p_branch_id, v_shift_id, 'card_sale', -v_card_refund,
        'pos_refund', v_refund_id, 'عكس تحصيل بطاقة ' || v_refund_number, p_actor_user_id
      );
    END IF;
  END IF;

  INSERT INTO public.sales_daily_summaries (
    organization_id, branch_id, summary_date, channel,
    orders_count, sales_total, ingredient_cost_total
  ) VALUES (
    p_org_id, p_branch_id, p_refund_date, v_invoice.channel,
    0, -v_returned_total, -v_returned_cost
  )
  ON CONFLICT (organization_id, branch_id, summary_date, channel) DO UPDATE
    SET sales_total = round((public.sales_daily_summaries.sales_total + excluded.sales_total)::numeric, 4),
        ingredient_cost_total = round((public.sales_daily_summaries.ingredient_cost_total + excluded.ingredient_cost_total)::numeric, 4),
        updated_at = now();

  SELECT COALESCE(sum(GREATEST(cii.quantity - COALESCE(returned.quantity, 0), 0)), 0)
  INTO v_remaining_quantity_after
  FROM public.customer_invoice_items cii
  LEFT JOIN (
    SELECT pri.invoice_item_id, sum(pri.quantity) AS quantity
    FROM public.pos_refund_items pri
    JOIN public.pos_refunds pr
      ON pr.organization_id = pri.organization_id
     AND pr.id = pri.refund_id
    WHERE pri.organization_id = p_org_id
      AND pr.customer_invoice_id = p_invoice_id
      AND pr.status = 'posted'
    GROUP BY pri.invoice_item_id
  ) returned ON returned.invoice_item_id = cii.id
  WHERE cii.organization_id = p_org_id
    AND cii.customer_invoice_id = p_invoice_id;

  v_new_invoice_status := CASE
    WHEN v_remaining_quantity_after <= 0.0001 THEN 'refunded'
    ELSE 'partially_refunded'
  END;

  UPDATE public.customer_invoices
  SET status = v_new_invoice_status::public.customer_invoice_status,
      updated_at = now()
  WHERE organization_id = p_org_id
    AND id = p_invoice_id;

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, action,
    entity_type, entity_id, old_data, new_data
  ) VALUES (
    p_org_id, p_branch_id, p_actor_user_id, 'pos_refund_posted',
    'pos_refund', v_refund_id,
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'invoice_status', v_invoice.status,
      'remaining_item_quantity', v_remaining_quantity_before
    ),
    jsonb_build_object(
      'refund_number', v_refund_number,
      'refund_date', p_refund_date,
      'refund_total', v_returned_total,
      'cost_total', v_returned_cost,
      'journal_entry_id', v_journal_entry_id,
      'invoice_status', v_new_invoice_status,
      'remaining_item_quantity', v_remaining_quantity_after,
      'actor_device_id', p_actor_device_id,
      'idempotency_key', btrim(p_idempotency_key)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'refundId', v_refund_id,
    'refundNumber', v_refund_number,
    'invoiceId', p_invoice_id,
    'refundDate', p_refund_date,
    'refundTotal', v_returned_total,
    'costTotal', v_returned_cost,
    'reason', btrim(p_reason),
    'journalEntryId', v_journal_entry_id,
    'invoiceStatus', v_new_invoice_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_refund_v2_atomic(
  uuid, uuid, uuid, text, date, text, uuid, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_refund_v2_atomic(
  uuid, uuid, uuid, text, date, text, uuid, uuid, jsonb
) TO service_role;

-- Retire the legacy refund path from migration 034. It has no tenant/role
-- authorization, no idempotency, no balance re-check, and defaults to PUBLIC
-- EXECUTE as SECURITY DEFINER. Historical journal/stock rows it produced are
-- kept untouched (forward-only); only the callable function is removed.
REVOKE ALL ON FUNCTION public.pos_refund_atomic(
  uuid, uuid, uuid, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.pos_refund_atomic(uuid, uuid, uuid, text, uuid, jsonb);

COMMENT ON TABLE public.pos_refunds IS
  'Immutable POS refund source documents. Corrections require a new compensating document.';
COMMENT ON TABLE public.pos_refund_items IS
  'Immutable item-level quantities and rounded values for each POS refund.';
COMMENT ON FUNCTION public.pos_refund_v2_atomic(uuid, uuid, uuid, text, date, text, uuid, uuid, jsonb) IS
  'Creates an idempotent POS refund document and atomically restores stock, posts a balanced journal, updates shift/summary, and derives invoice refund status.';

-- Pre-apply validation queries (run read-only):
-- 1) Legacy refunds that must be reconciled before another partial refund:
-- SELECT organization_id, source_doc_id AS invoice_id, count(*)
-- FROM public.journal_entries
-- WHERE source_doc_type = 'refund' AND status = 'posted'
-- GROUP BY organization_id, source_doc_id;
--
-- 2) Invoice items with invalid quantities/costs:
-- SELECT organization_id, customer_invoice_id, id, quantity, cost_total
-- FROM public.customer_invoice_items
-- WHERE quantity <= 0 OR cost_total < 0;
--
-- Post-apply validation queries (run after staging smoke tests):
-- SELECT pr.id, pr.refund_number,
--        sum(jl.debit) AS debit_total, sum(jl.credit) AS credit_total
-- FROM public.pos_refunds pr
-- JOIN public.journal_entries je ON je.id = pr.journal_entry_id
-- JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
-- GROUP BY pr.id, pr.refund_number
-- HAVING abs(sum(jl.debit) - sum(jl.credit)) > 0.0001;
--
-- SELECT pri.invoice_item_id, sum(pri.quantity) AS refunded, cii.quantity AS invoiced
-- FROM public.pos_refund_items pri
-- JOIN public.customer_invoice_items cii ON cii.id = pri.invoice_item_id
-- GROUP BY pri.invoice_item_id, cii.quantity
-- HAVING sum(pri.quantity) > cii.quantity + 0.0001;
--
-- SELECT sm.id, sm.source_doc_id
-- FROM public.stock_movements sm
-- LEFT JOIN public.pos_refunds pr
--   ON pr.organization_id = sm.organization_id AND pr.id = sm.source_doc_id
-- WHERE sm.source_doc_type = 'pos_refund' AND pr.id IS NULL;
--
-- Forward-correction plan: revoke EXECUTE on pos_refund_v2_atomic first, then
-- deploy a new migration that fixes data/functions in place. Never delete or
-- roll back posted refund, stock, journal, cash-drawer, summary, or audit rows.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 049_password_and_employee_code_login.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Password-only owner login and employee invite-code acceptance hardening.
-- Review on staging first. Do not apply automatically to production.

alter table public.team_invites
  add column if not exists accepted_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists last_used_at timestamptz,
  add column if not exists revoked_at timestamptz;

create index if not exists team_invites_accepted_user_idx
  on public.team_invites (accepted_user_id)
  where accepted_user_id is not null;

create index if not exists team_invites_login_lookup_idx
  on public.team_invites (invite_code, status, expires_at)
  where revoked_at is null;

-- Invitations are security records. Owners may create and revoke them, but
-- historical invitation rows are never deleted.
drop policy if exists "team_invites owner write" on public.team_invites;
drop policy if exists "team_invites owner insert" on public.team_invites;
drop policy if exists "team_invites owner update" on public.team_invites;
drop policy if exists "team_invites owner delete" on public.team_invites;

create policy "team_invites owner insert"
  on public.team_invites
  for insert
  to authenticated
  with check (
    public.has_org_role(
      organization_id,
      array['organization_owner','branch_manager']::public.app_role[]
    )
  );

create policy "team_invites owner update"
  on public.team_invites
  for update
  to authenticated
  using (
    public.has_org_role(
      organization_id,
      array['organization_owner','branch_manager']::public.app_role[]
    )
  )
  with check (
    public.has_org_role(
      organization_id,
      array['organization_owner','branch_manager']::public.app_role[]
    )
  );

revoke delete on table public.team_invites from authenticated;

create or replace function public.reject_team_invite_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Team invitations are audit records and cannot be deleted. Revoke instead.';
end;
$$;

revoke all on function public.reject_team_invite_delete() from public;

drop trigger if exists reject_team_invite_delete on public.team_invites;
create trigger reject_team_invite_delete
  before delete on public.team_invites
  for each row execute function public.reject_team_invite_delete();

create or replace function public.accept_team_invite_by_code(
  p_invite_code text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invite_record public.team_invites%rowtype;
  user_email text;
  existing_role public.app_role;
begin
  if p_user_id is null or nullif(btrim(p_invite_code), '') is null then
    raise exception 'Invalid employee login request.';
  end if;

  select *
    into invite_record
  from public.team_invites
  where invite_code = upper(btrim(p_invite_code))
  for update;

  if not found
    or invite_record.revoked_at is not null
    or invite_record.status not in ('pending', 'accepted') then
    raise exception 'Invalid employee login request.';
  end if;

  if invite_record.status = 'pending'
    and invite_record.expires_at <= now() then
    raise exception 'Invalid employee login request.';
  end if;

  select lower(email)
    into user_email
  from auth.users
  where id = p_user_id;

  if user_email is null or user_email <> lower(invite_record.email) then
    raise exception 'Invalid employee login request.';
  end if;

  if invite_record.branch_id is not null and not exists (
    select 1
    from public.branches branch
    where branch.id = invite_record.branch_id
      and branch.organization_id = invite_record.organization_id
      and branch.status = 'active'
  ) then
    raise exception 'Invalid employee branch.';
  end if;

  if exists (
    select 1
    from public.organization_memberships membership
    where membership.user_id = p_user_id
      and membership.organization_id <> invite_record.organization_id
  ) then
    raise exception 'Employee is already assigned to another organization.';
  end if;

  select role
    into existing_role
  from public.organization_memberships
  where organization_id = invite_record.organization_id
    and user_id = p_user_id
  for update;

  if existing_role in ('organization_owner', 'super_admin') then
    raise exception 'Owner roles cannot be changed by an employee invitation.';
  end if;

  if invite_record.status = 'accepted'
    and invite_record.accepted_user_id is distinct from p_user_id then
    raise exception 'Invalid employee login request.';
  end if;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    branch_id,
    created_by
  ) values (
    invite_record.organization_id,
    p_user_id,
    invite_record.role,
    invite_record.branch_id,
    invite_record.created_by
  )
  on conflict (organization_id, user_id) do update
  set role = excluded.role,
      branch_id = excluded.branch_id,
      updated_at = now();

  update public.profiles
  set email = user_email,
      status = 'approved',
      approved_at = coalesce(approved_at, now()),
      updated_at = now()
  where id = p_user_id;

  update public.team_invites
  set status = 'accepted',
      accepted_user_id = p_user_id,
      accepted_at = coalesce(accepted_at, now()),
      last_used_at = now()
  where id = invite_record.id;

  insert into public.audit_logs (
    organization_id,
    branch_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) values (
    invite_record.organization_id,
    invite_record.branch_id,
    p_user_id,
    case when invite_record.status = 'pending'
      then 'team_invite_accepted'
      else 'employee_code_login'
    end,
    'team_invite',
    invite_record.id,
    jsonb_build_object('status', invite_record.status),
    jsonb_build_object(
      'status', 'accepted',
      'role', invite_record.role,
      'branch_id', invite_record.branch_id,
      'accepted_user_id', p_user_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'organization_id', invite_record.organization_id,
    'branch_id', invite_record.branch_id,
    'role', invite_record.role
  );
end;
$$;

revoke all on function public.accept_team_invite_by_code(text, uuid) from public;
revoke all on function public.accept_team_invite_by_code(text, uuid) from anon;
revoke all on function public.accept_team_invite_by_code(text, uuid) from authenticated;
grant execute on function public.accept_team_invite_by_code(text, uuid) to service_role;

comment on function public.accept_team_invite_by_code(text, uuid)
  is 'Atomically accepts or reuses an employee invite after server-side password authentication.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 050_plan_selection_and_tier_entitlements.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- First-login plan selection and the 150/250/350 entitlement matrix.
-- Review in staging before production. This migration is intentionally
-- forward-only: subscription and audit history remain immutable.

alter table public.organizations
  add column if not exists plan_selected_at timestamptz,
  add column if not exists plan_selected_by uuid references auth.users(id) on delete set null;

comment on column public.organizations.plan_selected_at
  is 'Timestamp of the one-time onboarding plan choice. Null means the owner must choose a plan.';

comment on column public.organizations.plan_selected_by
  is 'Owner or super administrator who made the onboarding plan choice.';

-- Existing organizations keep their current plan and are not interrupted by
-- the new onboarding screen. Organizations created after this migration start
-- with a null selection and must choose on first entry.
update public.organizations
set
  plan_selected_at = coalesce(updated_at, created_at, now()),
  plan_selected_by = created_by
where plan_selected_at is null;

create or replace function public.protect_organization_plan_columns()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.plan <> 'starter'
      or new.plan_selected_at is not null
      or new.plan_selected_by is not null
    then
      raise exception using
        errcode = '42501',
        message = 'Plan selection must use the protected billing workflow.';
    end if;
  elsif new.plan is distinct from old.plan
    or new.plan_selected_at is distinct from old.plan_selected_at
    or new.plan_selected_by is distinct from old.plan_selected_by
  then
    raise exception using
      errcode = '42501',
      message = 'Plan changes must use the protected billing workflow.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_organization_plan_columns() from public;

drop trigger if exists protect_organization_plan_columns on public.organizations;
create trigger protect_organization_plan_columns
  before insert or update of plan, plan_selected_at, plan_selected_by
  on public.organizations
  for each row
  execute function public.protect_organization_plan_columns();

insert into public.plans (code, name, monthly_price, currency, features, limits, status)
values
  (
    'starter',
    'رواق للمطعم الصغير',
    150,
    'USD',
    '["dashboard","pos","shifts","sales","customers","reports","administration"]'::jsonb,
    '{"maxBranches":1,"maxUsers":8,"maxDevices":4}'::jsonb,
    'active'
  ),
  (
    'growth',
    'رواق للمطعم المتوسط',
    250,
    'USD',
    '["dashboard","pos","shifts","sales","customers","reports","administration","tables","kitchen","expo","restaurant_workflow","digital_presence","inventory","recipes","waste","purchasing","suppliers","transfers","production"]'::jsonb,
    '{"maxBranches":3,"maxUsers":25,"maxDevices":12}'::jsonb,
    'active'
  ),
  (
    'scale',
    'رواق للمطعم الكبير',
    350,
    'USD',
    '["dashboard","pos","shifts","tables","kitchen","expo","restaurant_workflow","digital_presence","sales","customers","inventory","recipes","waste","purchasing","suppliers","transfers","production","reports","accounting","financial_services","marketing","automation","administration"]'::jsonb,
    '{"maxBranches":null,"maxUsers":null,"maxDevices":null}'::jsonb,
    'active'
  )
on conflict (code) do update
set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  currency = excluded.currency,
  features = excluded.features,
  limits = excluded.limits,
  status = excluded.status,
  updated_at = now();

create or replace function public.select_trial_plan_atomic(
  p_organization_id uuid,
  p_plan_code text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  selected_organization public.organizations%rowtype;
  selected_plan public.plans%rowtype;
  current_subscription public.subscriptions%rowtype;
  actor_role text;
  previous_plan text;
begin
  if p_organization_id is null or p_actor_user_id is null then
    raise exception using
      errcode = '22004',
      message = 'Organization and actor are required.';
  end if;

  if p_plan_code not in ('starter', 'growth', 'scale') then
    raise exception using
      errcode = '22023',
      message = 'Unknown Rawaq plan code.';
  end if;

  select organization.*
  into selected_organization
  from public.organizations organization
  where organization.id = p_organization_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Organization was not found.';
  end if;

  previous_plan := selected_organization.plan;

  select membership.role::text
  into actor_role
  from public.organization_memberships membership
  where membership.organization_id = p_organization_id
    and membership.user_id = p_actor_user_id
  limit 1;

  if actor_role is null or actor_role not in ('organization_owner', 'super_admin') then
    raise exception using
      errcode = '42501',
      message = 'Only the organization owner may select the onboarding plan.';
  end if;

  select plan.*
  into selected_plan
  from public.plans plan
  where plan.code = p_plan_code
    and plan.status = 'active'
  limit 1;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The selected plan is unavailable.';
  end if;

  select subscription.*
  into current_subscription
  from public.subscriptions subscription
  where subscription.organization_id = p_organization_id
    and subscription.status in ('trial', 'active', 'past_due', 'paused')
  order by subscription.updated_at desc, subscription.id desc
  limit 1
  for update;

  -- A repeated request for the already selected plan is safe and returns the
  -- same result without creating another subscription or audit event.
  if selected_organization.plan_selected_at is not null then
    if selected_organization.plan = p_plan_code then
      return jsonb_build_object(
        'organizationId', selected_organization.id,
        'planCode', selected_organization.plan,
        'subscriptionId', current_subscription.id,
        'selectedAt', selected_organization.plan_selected_at,
        'idempotent', true
      );
    end if;

    raise exception using
      errcode = '55000',
      message = 'The onboarding plan was already selected. Use the billing workflow to change it.';
  end if;

  if current_subscription.id is not null and current_subscription.status <> 'trial' then
    raise exception using
      errcode = '55000',
      message = 'A non-trial subscription already exists. Use the billing workflow to change it.';
  end if;

  if current_subscription.id is null then
    insert into public.subscriptions (
      organization_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      created_by
    )
    values (
      p_organization_id,
      selected_plan.id,
      'trial',
      current_date,
      current_date + 30,
      p_actor_user_id
    )
    returning * into current_subscription;
  else
    update public.subscriptions subscription
    set
      plan_id = selected_plan.id,
      current_period_start = coalesce(subscription.current_period_start, current_date),
      current_period_end = coalesce(subscription.current_period_end, current_date + 30),
      updated_at = now()
    where subscription.id = current_subscription.id
    returning * into current_subscription;
  end if;

  update public.organizations organization
  set
    plan = selected_plan.code,
    plan_selected_at = now(),
    plan_selected_by = p_actor_user_id,
    updated_at = now()
  where organization.id = p_organization_id
  returning * into selected_organization;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  )
  values (
    p_organization_id,
    p_actor_user_id,
    'trial_plan_selected',
    'organization',
    p_organization_id,
    jsonb_build_object(
      'plan', previous_plan,
      'planSelectedAt', null
    ),
    jsonb_build_object(
      'plan', selected_plan.code,
      'planSelectedAt', selected_organization.plan_selected_at,
      'subscriptionId', current_subscription.id,
      'monthlyPriceUsd', selected_plan.monthly_price
    )
  );

  return jsonb_build_object(
    'organizationId', selected_organization.id,
    'planCode', selected_plan.code,
    'subscriptionId', current_subscription.id,
    'selectedAt', selected_organization.plan_selected_at,
    'idempotent', false
  );
end;
$$;

revoke all on function public.select_trial_plan_atomic(uuid, text, uuid) from public;
grant execute on function public.select_trial_plan_atomic(uuid, text, uuid) to service_role;

comment on function public.select_trial_plan_atomic(uuid, text, uuid)
  is 'Atomically records the owner onboarding choice, opens one trial subscription, and writes immutable history/audit records.';

-- Staging validation queries (run manually after applying):
-- select code, name, monthly_price, currency, features, limits from public.plans order by monthly_price;
-- select id, plan, plan_selected_at, plan_selected_by from public.organizations order by created_at desc;
-- select organization_id, count(*) from public.subscriptions where status in ('trial','active','past_due') group by organization_id having count(*) > 1;
-- select action, entity_type, entity_id, new_data from public.audit_logs where action = 'trial_plan_selected' order by created_at desc;
-- select operation, status, new_data from public.subscription_history order by changed_at desc limit 20;

-- Forward-correction plan:
-- Keep these columns and immutable history if application rollback is needed.
-- Correct a mistaken choice through the reviewed billing change workflow; do
-- not delete the subscription, subscription_history, or audit_logs records.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 051_restaurant_workflow_integration.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Secure integration layer for the waiter -> KDS -> Expo workflow.
-- This migration intentionally builds on 047_restaurant_order_lifecycle.sql.
-- It does not create a parallel order store and never deletes operational facts.

-- Pre-deployment validation (must return zero rows):
-- select organization_id, branch_id, restaurant_table_id, count(*)
-- from public.restaurant_orders
-- where restaurant_table_id is not null and status not in ('closed', 'cancelled')
-- group by organization_id, branch_id, restaurant_table_id
-- having count(*) > 1;

do $$
begin
  if exists (
    select 1
    from public.restaurant_orders ro
    where ro.restaurant_table_id is not null
      and ro.status not in ('closed', 'cancelled')
    group by ro.organization_id, ro.branch_id, ro.restaurant_table_id
    having count(*) > 1
  ) then
    raise exception using
      message = 'تعذر حماية دورة الطاولة: توجد أكثر من فاتورة تشغيلية نشطة على الطاولة نفسها.',
      hint = 'صحح البيانات بأحداث إغلاق أو إلغاء معتمدة، ثم أعد تشغيل migration 051. لا تحذف الطلبات.';
  end if;
end;
$$;

create unique index if not exists restaurant_orders_one_active_table_idx
  on public.restaurant_orders (organization_id, branch_id, restaurant_table_id)
  where restaurant_table_id is not null and status not in ('closed', 'cancelled');

-- Priority is operational state. All other submitted identity and monetary fields
-- remain immutable and priority can only be changed through the audited RPC below.
create or replace function public.protect_restaurant_order_identity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if row(
    new.organization_id, new.branch_id, new.order_number, new.idempotency_key,
    new.restaurant_table_id, new.waiter_user_id, new.waiter_name,
    new.customer_name, new.customer_phone, new.channel, new.guest_count,
    new.notes, new.allergens, new.currency,
    new.subtotal, new.item_discount_total, new.order_discount,
    new.discount_total, new.tax_total, new.service_fee, new.delivery_fee,
    new.total, new.created_by_user_id, new.created_by_device_id, new.created_at
  ) is distinct from row(
    old.organization_id, old.branch_id, old.order_number, old.idempotency_key,
    old.restaurant_table_id, old.waiter_user_id, old.waiter_name,
    old.customer_name, old.customer_phone, old.channel, old.guest_count,
    old.notes, old.allergens, old.currency,
    old.subtotal, old.item_discount_total, old.order_discount,
    old.discount_total, old.tax_total, old.service_fee, old.delivery_fee,
    old.total, old.created_by_user_id, old.created_by_device_id, old.created_at
  ) then
    raise exception 'بيانات الطلب المثبتة لا تعدل بعد الإنشاء؛ استخدم حدث تصحيح.';
  end if;
  return new;
end;
$$;

create or replace function public.set_restaurant_order_priority_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_order_id uuid,
  p_priority text,
  p_idempotency_key text,
  p_actor_user_id uuid default null,
  p_actor_device_id uuid default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.restaurant_orders%rowtype;
  v_sequence bigint;
  v_priority text := lower(btrim(coalesce(p_priority, 'normal')));
begin
  perform public.assert_restaurant_order_actor(
    p_organization_id, p_branch_id, p_actor_user_id, p_actor_device_id, 'submit'
  );

  if v_priority not in ('normal', 'rush') then
    raise exception 'أولوية الطلب يجب أن تكون normal أو rush.';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null or length(p_idempotency_key) > 180 then
    raise exception 'مفتاح منع التكرار مطلوب وبحد أقصى 180 حرفاً.';
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception 'وقت الحدث لا يمكن أن يكون في المستقبل.';
  end if;

  select * into v_order
  from public.restaurant_orders ro
  where ro.id = p_order_id and ro.organization_id = p_organization_id
    and ro.branch_id = p_branch_id
  for update;
  if not found then raise exception 'الطلب غير موجود في هذا الفرع.'; end if;

  if exists (
    select 1 from public.restaurant_order_status_events ose
    where ose.organization_id = p_organization_id and ose.order_id = p_order_id
      and ose.idempotency_key = btrim(p_idempotency_key)
  ) then
    return jsonb_build_object(
      'success', true, 'duplicate', true, 'order_id', p_order_id,
      'priority', v_order.priority, 'version', v_order.version
    );
  end if;

  if v_order.status in ('closed', 'cancelled') then
    raise exception 'لا يمكن تغيير أولوية طلب مغلق أو ملغي.';
  end if;

  update public.restaurant_orders
  set priority = v_priority, version = version + 1,
      updated_at = greatest(updated_at, p_occurred_at)
  where id = p_order_id and organization_id = p_organization_id and branch_id = p_branch_id
  returning version into v_sequence;

  insert into public.restaurant_order_status_events (
    organization_id, branch_id, order_id, event_sequence, event_scope,
    event_type, from_status, to_status, idempotency_key, correlation_id,
    metadata, actor_user_id, actor_device_id, occurred_at
  ) values (
    p_organization_id, p_branch_id, p_order_id, v_sequence, 'order',
    'order_priority_set', v_order.status, v_order.status, btrim(p_idempotency_key),
    btrim(p_idempotency_key),
    jsonb_build_object('old_priority', v_order.priority, 'priority', v_priority),
    p_actor_user_id, p_actor_device_id, p_occurred_at
  );

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id, 'restaurant_order_priority_set',
    'restaurant_order', p_order_id,
    jsonb_build_object('priority', v_order.priority),
    jsonb_build_object('priority', v_priority, 'actor_device_id', p_actor_device_id)
  );

  return jsonb_build_object(
    'success', true, 'duplicate', false, 'order_id', p_order_id,
    'priority', v_priority, 'version', v_sequence
  );
end;
$$;

create or replace function public.submit_restaurant_order_with_priority_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_idempotency_key text,
  p_items jsonb,
  p_restaurant_table_id uuid default null,
  p_waiter_user_id uuid default null,
  p_waiter_name text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_channel public.sales_channel default 'dine_in',
  p_guest_count integer default null,
  p_priority text default 'normal',
  p_notes text default null,
  p_allergens text[] default '{}'::text[],
  p_currency text default 'JOD',
  p_order_discount numeric default 0,
  p_service_fee numeric default 0,
  p_delivery_fee numeric default 0,
  p_actor_user_id uuid default null,
  p_actor_device_id uuid default null,
  p_submitted_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
  v_priority_result jsonb;
  v_requested_priority text := lower(btrim(coalesce(p_priority, 'normal')));
  v_existing_priority text;
begin
  if v_requested_priority not in ('normal', 'rush') then
    raise exception 'أولوية الطلب يجب أن تكون normal أو rush.';
  end if;

  v_result := public.submit_restaurant_order_atomic(
    p_organization_id => p_organization_id,
    p_branch_id => p_branch_id,
    p_idempotency_key => p_idempotency_key,
    p_items => p_items,
    p_restaurant_table_id => p_restaurant_table_id,
    p_waiter_user_id => p_waiter_user_id,
    p_waiter_name => p_waiter_name,
    p_customer_name => p_customer_name,
    p_customer_phone => p_customer_phone,
    p_channel => p_channel,
    p_guest_count => p_guest_count,
    p_notes => p_notes,
    p_allergens => p_allergens,
    p_currency => p_currency,
    p_order_discount => p_order_discount,
    p_service_fee => p_service_fee,
    p_delivery_fee => p_delivery_fee,
    p_actor_user_id => p_actor_user_id,
    p_actor_device_id => p_actor_device_id,
    p_submitted_at => p_submitted_at
  );

  select ro.priority into v_existing_priority
  from public.restaurant_orders ro
  where ro.id = (v_result->>'order_id')::uuid and ro.organization_id = p_organization_id
    and ro.branch_id = p_branch_id;

  if coalesce((v_result->>'duplicate')::boolean, false) then
    if v_existing_priority is distinct from v_requested_priority then
      raise exception 'أعيد استخدام مفتاح منع التكرار بحمولة أولوية مختلفة.';
    end if;
  elsif v_requested_priority = 'rush' then
    v_priority_result := public.set_restaurant_order_priority_atomic(
      p_organization_id => p_organization_id,
      p_branch_id => p_branch_id,
      p_order_id => (v_result->>'order_id')::uuid,
      p_priority => v_requested_priority,
      p_idempotency_key => btrim(p_idempotency_key) || ':priority',
      p_actor_user_id => p_actor_user_id,
      p_actor_device_id => p_actor_device_id,
      p_occurred_at => p_submitted_at
    );
    v_result := jsonb_set(v_result, '{version}', v_priority_result->'version', true);
  end if;

  return jsonb_set(v_result, '{priority}', to_jsonb(v_requested_priority), true);
end;
$$;

create or replace function public.transition_restaurant_order_items_bulk_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_order_id uuid,
  p_order_item_ids uuid[],
  p_to_status text,
  p_idempotency_key text,
  p_actor_user_id uuid default null,
  p_actor_device_id uuid default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item_id uuid;
  v_item_status text;
  v_result jsonb;
  v_count integer;
  v_order public.restaurant_orders%rowtype;
begin
  if p_to_status not in ('preparing', 'ready', 'served') then
    raise exception 'الانتقال الجماعي يدعم preparing أو ready أو served فقط.';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null or length(p_idempotency_key) > 48 then
    raise exception 'مفتاح منع التكرار مطلوب وبحد أقصى 48 حرفاً.';
  end if;

  v_count := coalesce(cardinality(p_order_item_ids), 0);
  if v_count < 1 or v_count > 250 then
    raise exception 'يجب تحديد عنصر واحد إلى 250 عنصراً.';
  end if;
  if (select count(distinct item_id) from unnest(p_order_item_ids) as ids(item_id)) <> v_count then
    raise exception 'قائمة عناصر الطلب تحتوي قيماً مكررة.';
  end if;

  select * into v_order
  from public.restaurant_orders ro
  where ro.id = p_order_id and ro.organization_id = p_organization_id
    and ro.branch_id = p_branch_id
  for update;
  if not found then raise exception 'الطلب غير موجود في هذا الفرع.'; end if;

  foreach v_item_id in array p_order_item_ids
  loop
    select roi.status into v_item_status
    from public.restaurant_order_items roi
    where roi.id = v_item_id and roi.order_id = p_order_id
      and roi.organization_id = p_organization_id and roi.branch_id = p_branch_id
    for update;
    if not found then raise exception 'أحد عناصر الطلب غير موجود في هذا الفرع.'; end if;
    if v_item_status = 'cancelled' then raise exception 'لا يمكن تحريك عنصر ملغي.'; end if;

    if v_item_status = 'submitted' and p_to_status in ('preparing', 'ready', 'served') then
      v_result := public.transition_restaurant_order_item_atomic(
        p_organization_id, p_branch_id, p_order_id, v_item_id, 'accepted',
        btrim(p_idempotency_key) || ':' || v_item_id::text || ':a', null,
        p_actor_user_id, p_actor_device_id, p_occurred_at
      );
      v_item_status := 'accepted';
    end if;
    if v_item_status = 'accepted' and p_to_status in ('preparing', 'ready', 'served') then
      v_result := public.transition_restaurant_order_item_atomic(
        p_organization_id, p_branch_id, p_order_id, v_item_id, 'preparing',
        btrim(p_idempotency_key) || ':' || v_item_id::text || ':p', null,
        p_actor_user_id, p_actor_device_id, p_occurred_at
      );
      v_item_status := 'preparing';
    end if;
    if v_item_status = 'preparing' and p_to_status in ('ready', 'served') then
      v_result := public.transition_restaurant_order_item_atomic(
        p_organization_id, p_branch_id, p_order_id, v_item_id, 'ready',
        btrim(p_idempotency_key) || ':' || v_item_id::text || ':r', null,
        p_actor_user_id, p_actor_device_id, p_occurred_at
      );
      v_item_status := 'ready';
    end if;
    if v_item_status = 'ready' and p_to_status = 'served' then
      v_result := public.transition_restaurant_order_item_atomic(
        p_organization_id, p_branch_id, p_order_id, v_item_id, 'served',
        btrim(p_idempotency_key) || ':' || v_item_id::text || ':s', null,
        p_actor_user_id, p_actor_device_id, p_occurred_at
      );
      v_item_status := 'served';
    end if;

    if v_item_status is distinct from p_to_status then
      raise exception 'لا يمكن إعادة عنصر حالته % إلى الحالة %.', v_item_status, p_to_status;
    end if;
  end loop;

  select * into v_order
  from public.restaurant_orders ro
  where ro.id = p_order_id and ro.organization_id = p_organization_id
    and ro.branch_id = p_branch_id;

  return jsonb_build_object(
    'success', true, 'order_id', p_order_id, 'status', v_order.status,
    'target_item_status', p_to_status, 'item_count', v_count, 'version', v_order.version
  );
end;
$$;

create or replace function public.sync_restaurant_table_from_order()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_table public.restaurant_tables%rowtype;
  v_new_status text;
begin
  if new.restaurant_table_id is null or new.status is not distinct from old.status then
    return new;
  end if;

  select * into v_table
  from public.restaurant_tables rt
  where rt.id = new.restaurant_table_id and rt.organization_id = new.organization_id
    and rt.branch_id = new.branch_id
  for update;
  if not found then raise exception 'طاولة الطلب لم تعد موجودة داخل الفرع.'; end if;

  if new.status in ('closed', 'cancelled') then
    if not exists (
      select 1 from public.restaurant_orders ro
      where ro.organization_id = new.organization_id and ro.branch_id = new.branch_id
        and ro.restaurant_table_id = new.restaurant_table_id and ro.id <> new.id
        and ro.status not in ('closed', 'cancelled')
    ) then
      v_new_status := 'needs_cleaning';
      update public.restaurant_tables
      set status = v_new_status, current_total = 0, updated_at = now()
      where id = new.restaurant_table_id and organization_id = new.organization_id
        and branch_id = new.branch_id;
    else
      return new;
    end if;
  else
    v_new_status := 'occupied';
    update public.restaurant_tables
    set status = v_new_status,
        waiter_name = coalesce(new.waiter_name, waiter_name),
        guests = coalesce(new.guest_count, guests),
        opened_at = coalesce(opened_at, new.submitted_at, new.created_at),
        current_total = new.total,
        updated_at = now()
    where id = new.restaurant_table_id and organization_id = new.organization_id
      and branch_id = new.branch_id;
  end if;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    new.organization_id, new.branch_id, null,
    'restaurant_table_synced_from_order', 'restaurant_table', new.restaurant_table_id,
    jsonb_build_object('status', v_table.status, 'current_total', v_table.current_total),
    jsonb_build_object(
      'status', v_new_status, 'current_total', case when v_new_status = 'occupied' then new.total else 0 end,
      'restaurant_order_id', new.id, 'order_status', new.status,
      'order_version', new.version, 'derived_change', true
    )
  );

  return new;
end;
$$;

drop trigger if exists sync_restaurant_table_from_order_status on public.restaurant_orders;
create trigger sync_restaurant_table_from_order_status
after update of status on public.restaurant_orders
for each row execute function public.sync_restaurant_table_from_order();

revoke all on function public.set_restaurant_order_priority_atomic(
  uuid, uuid, uuid, text, text, uuid, uuid, timestamptz
) from public, anon;
grant execute on function public.set_restaurant_order_priority_atomic(
  uuid, uuid, uuid, text, text, uuid, uuid, timestamptz
) to authenticated, service_role;

revoke all on function public.submit_restaurant_order_with_priority_atomic(
  uuid, uuid, text, jsonb, uuid, uuid, text, text, text, public.sales_channel,
  integer, text, text, text[], text, numeric, numeric, numeric, uuid, uuid, timestamptz
) from public, anon;
grant execute on function public.submit_restaurant_order_with_priority_atomic(
  uuid, uuid, text, jsonb, uuid, uuid, text, text, text, public.sales_channel,
  integer, text, text, text[], text, numeric, numeric, numeric, uuid, uuid, timestamptz
) to authenticated, service_role;

revoke all on function public.transition_restaurant_order_items_bulk_atomic(
  uuid, uuid, uuid, uuid[], text, text, uuid, uuid, timestamptz
) from public, anon;
grant execute on function public.transition_restaurant_order_items_bulk_atomic(
  uuid, uuid, uuid, uuid[], text, text, uuid, uuid, timestamptz
) to authenticated, service_role;

comment on function public.submit_restaurant_order_with_priority_atomic(
  uuid, uuid, text, jsonb, uuid, uuid, text, text, text, public.sales_channel,
  integer, text, text, text[], text, numeric, numeric, numeric, uuid, uuid, timestamptz
) is 'Atomic waiter submission with immutable snapshots, explicit station routing, idempotency and audited priority.';

-- Forward-correction plan:
-- 1. Disable only sync_restaurant_table_from_order_status if table synchronization is wrong.
-- 2. Correct table status through the existing audited table workflow; never delete orders/events.
-- 3. Replace RPCs with corrected versions in a later migration; do not edit applied migrations.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 052_restaurant_workflow_device_provisioning.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Atomically provisions a waiter/KDS/Expo device and its explicit kitchen station.
-- The raw device key never enters PostgreSQL; only its SHA-256 hash is persisted.

create or replace function public.provision_restaurant_workflow_device_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_device_name text,
  p_key_hash text,
  p_role public.app_role,
  p_allowed_modules text[],
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_device public.department_api_keys%rowtype;
  v_station_result jsonb;
  v_station_id uuid;
  v_modules text[];
begin
  perform public.assert_restaurant_order_actor(
    p_organization_id, p_branch_id, p_actor_user_id, null, 'manage_station'
  );

  if nullif(btrim(p_device_name), '') is null or length(btrim(p_device_name)) > 120 then
    raise exception 'اسم الجهاز مطلوب وبحد أقصى 120 حرفاً.';
  end if;
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'بصمة مفتاح الجهاز غير صالحة.';
  end if;
  if p_role::text not in ('chef', 'staff') then
    raise exception 'أجهزة دورة المطعم تستخدم دور chef أو staff فقط.';
  end if;

  select coalesce(array_agg(distinct module_name order by module_name), '{}'::text[])
    into v_modules
  from unnest(coalesce(p_allowed_modules, '{}'::text[])) as modules(module_name)
  where module_name in ('waiter', 'kitchen', 'expo');

  if cardinality(v_modules) = 0 then
    raise exception 'يجب اختيار waiter أو kitchen أو expo للجهاز.';
  end if;
  if p_role::text = 'chef' and v_modules && array['waiter']::text[] then
    raise exception 'دور الشيف لا يملك شاشة النادل.';
  end if;

  v_station_result := public.upsert_kitchen_station_atomic(
    p_organization_id, p_branch_id, null, 'main', 'المطبخ الرئيسي', 0, true, p_actor_user_id
  );
  v_station_id := (v_station_result->>'station_id')::uuid;

  insert into public.department_api_keys (
    organization_id, branch_id, device_name, key_hash, role,
    allowed_modules, is_active, created_by
  ) values (
    p_organization_id, p_branch_id, btrim(p_device_name), p_key_hash, p_role,
    v_modules, true, p_actor_user_id
  ) returning * into v_device;

  if v_modules && array['kitchen', 'expo']::text[] then
    perform public.assign_kitchen_station_device_atomic(
      p_organization_id, p_branch_id, v_station_id, v_device.id, true, p_actor_user_id
    );
  end if;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id,
    'restaurant_workflow_device_provisioned', 'department_api_key', v_device.id,
    jsonb_build_object(
      'device_name', v_device.device_name, 'role', v_device.role,
      'allowed_modules', v_device.allowed_modules,
      'station_id', case when v_modules && array['kitchen', 'expo']::text[] then v_station_id else null end
    )
  );

  return jsonb_build_object(
    'success', true,
    'device', jsonb_build_object(
      'id', v_device.id, 'device_name', v_device.device_name,
      'role', v_device.role, 'allowed_modules', v_device.allowed_modules,
      'is_active', v_device.is_active, 'created_at', v_device.created_at
    ),
    'station_id', case when v_modules && array['kitchen', 'expo']::text[] then v_station_id else null end
  );
end;
$$;

revoke all on function public.provision_restaurant_workflow_device_atomic(
  uuid, uuid, text, text, public.app_role, text[], uuid
) from public, anon;
grant execute on function public.provision_restaurant_workflow_device_atomic(
  uuid, uuid, text, text, public.app_role, text[], uuid
) to authenticated, service_role;

comment on function public.provision_restaurant_workflow_device_atomic(
  uuid, uuid, text, text, public.app_role, text[], uuid
) is 'Atomic audited provisioning for the growth-tier waiter/KDS/Expo workflow with explicit station assignment.';

-- Pre-deployment validation:
-- select id, organization_id, branch_id, role, allowed_modules
-- from public.department_api_keys
-- where allowed_modules && array['waiter','kitchen','expo']::text[]
--   and (branch_id is null or key_hash is null);

-- Forward correction: deactivate a wrongly provisioned device through the existing
-- revoke workflow and provision a replacement. Never delete its audit history.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 053_digital_menu_and_restaurant_site.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- One digital presence source: the public website renders operational menu_items.
-- Publication rows store presentation only; names, status and prices stay linked.

create table public.restaurant_sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  slug text not null,
  display_name text not null,
  tagline text,
  description text,
  logo_url text,
  cover_url text,
  primary_color text not null default '#0f766e',
  contact_phone text,
  whatsapp_phone text,
  address text,
  status text not null default 'draft',
  published_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_sites_branch_fk
    foreign key (organization_id, branch_id)
    references public.branches(organization_id, id) on delete restrict,
  constraint restaurant_sites_org_unique unique (organization_id),
  constraint restaurant_sites_slug_unique unique (slug),
  constraint restaurant_sites_slug_check check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 80
  ),
  constraint restaurant_sites_name_check check (btrim(display_name) <> '' and length(display_name) <= 160),
  constraint restaurant_sites_color_check check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint restaurant_sites_status_check check (status in ('draft', 'published', 'archived')),
  constraint restaurant_sites_publish_check check (
    (status = 'published' and published_at is not null) or status <> 'published'
  ),
  constraint restaurant_sites_org_id_unique unique (organization_id, id)
);

create table public.restaurant_site_menu_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null,
  menu_item_id uuid not null,
  category_name text not null default 'القائمة',
  public_description text,
  image_url text,
  display_order integer not null default 0,
  is_featured boolean not null default false,
  is_visible boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_site_menu_site_fk
    foreign key (organization_id, site_id)
    references public.restaurant_sites(organization_id, id) on delete restrict,
  constraint restaurant_site_menu_item_fk
    foreign key (organization_id, menu_item_id)
    references public.menu_items(organization_id, id) on delete restrict,
  constraint restaurant_site_menu_category_check check (
    btrim(category_name) <> '' and length(category_name) <= 100
  ),
  constraint restaurant_site_menu_unique unique (organization_id, site_id, menu_item_id)
);

create index restaurant_site_menu_visible_idx
  on public.restaurant_site_menu_items (organization_id, site_id, is_visible, display_order);

create trigger set_restaurant_sites_updated_at
before update on public.restaurant_sites
for each row execute function public.set_updated_at();
create trigger set_restaurant_site_menu_items_updated_at
before update on public.restaurant_site_menu_items
for each row execute function public.set_updated_at();

create or replace function public.prevent_digital_presence_hard_delete()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'لا تحذف سجل الموقع أو نشر المنيو؛ استخدم الأرشفة أو إخفاء الصنف.';
end;
$$;

create trigger prevent_restaurant_sites_delete
before delete on public.restaurant_sites
for each row execute function public.prevent_digital_presence_hard_delete();
create trigger prevent_restaurant_site_menu_items_delete
before delete on public.restaurant_site_menu_items
for each row execute function public.prevent_digital_presence_hard_delete();

create or replace function public.assert_digital_presence_actor(
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role text;
begin
  if p_actor_user_id is null then raise exception 'المستخدم المنفذ مطلوب.'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_actor_user_id then
    raise exception 'لا يمكن للمستخدم تمثيل مستخدم آخر.';
  end if;

  select om.role::text into v_role
  from public.organization_memberships om
  where om.organization_id = p_organization_id and om.user_id = p_actor_user_id
  order by case when om.branch_id is null then 0 else 1 end
  limit 1;

  if v_role is null and exists (
    select 1 from public.organization_memberships om
    where om.user_id = p_actor_user_id and om.role::text = 'super_admin'
  ) then
    v_role := 'super_admin';
  end if;
  if v_role not in ('super_admin', 'organization_owner', 'branch_manager', 'marketing_manager') then
    raise exception 'الدور لا يسمح بإدارة الموقع والمنيو الإلكتروني.';
  end if;
  return v_role;
end;
$$;

create or replace function public.save_restaurant_site_atomic(
  p_organization_id uuid,
  p_site_id uuid,
  p_branch_id uuid,
  p_slug text,
  p_display_name text,
  p_tagline text,
  p_description text,
  p_logo_url text,
  p_cover_url text,
  p_primary_color text,
  p_contact_phone text,
  p_whatsapp_phone text,
  p_address text,
  p_status text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_site public.restaurant_sites%rowtype;
  v_old jsonb;
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_status text := lower(btrim(coalesce(p_status, 'draft')));
begin
  perform public.assert_digital_presence_actor(p_organization_id, p_actor_user_id);
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) not between 3 and 80 then
    raise exception 'رابط الموقع يقبل أحرفاً إنجليزية صغيرة وأرقاماً وشرطات فقط.';
  end if;
  if nullif(btrim(p_display_name), '') is null or length(btrim(p_display_name)) > 160 then
    raise exception 'اسم المطعم مطلوب وبحد أقصى 160 حرفاً.';
  end if;
  if coalesce(p_primary_color, '') !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'اللون الرئيسي يجب أن يكون بصيغة #RRGGBB.';
  end if;
  if v_status not in ('draft', 'published', 'archived') then
    raise exception 'حالة الموقع غير صالحة.';
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.organization_id = p_organization_id
  ) then
    raise exception 'الفرع لا يتبع هذه المؤسسة.';
  end if;

  select * into v_site
  from public.restaurant_sites rs
  where rs.organization_id = p_organization_id
  for update;
  if found then
    if p_site_id is not null and p_site_id <> v_site.id then
      raise exception 'معرف الموقع لا يطابق موقع المؤسسة.';
    end if;
    v_old := to_jsonb(v_site);
  elsif p_site_id is not null then
    raise exception 'الموقع المحدد غير موجود.';
  end if;

  if v_status = 'published' and not exists (
    select 1 from public.restaurant_site_menu_items rsmi
    where rsmi.organization_id = p_organization_id
      and rsmi.site_id = v_site.id and rsmi.is_visible = true
  ) then
    raise exception 'أضف صنفاً ظاهراً واحداً على الأقل قبل نشر الموقع.';
  end if;

  if v_site.id is null then
    insert into public.restaurant_sites (
      organization_id, branch_id, slug, display_name, tagline, description,
      logo_url, cover_url, primary_color, contact_phone, whatsapp_phone,
      address, status, published_at, created_by_user_id
    ) values (
      p_organization_id, p_branch_id, v_slug, btrim(p_display_name),
      nullif(btrim(p_tagline), ''), nullif(btrim(p_description), ''),
      nullif(btrim(p_logo_url), ''), nullif(btrim(p_cover_url), ''),
      lower(p_primary_color), nullif(btrim(p_contact_phone), ''),
      nullif(btrim(p_whatsapp_phone), ''), nullif(btrim(p_address), ''),
      v_status, case when v_status = 'published' then now() else null end,
      p_actor_user_id
    ) returning * into v_site;
  else
    update public.restaurant_sites
    set branch_id = p_branch_id,
        slug = v_slug,
        display_name = btrim(p_display_name),
        tagline = nullif(btrim(p_tagline), ''),
        description = nullif(btrim(p_description), ''),
        logo_url = nullif(btrim(p_logo_url), ''),
        cover_url = nullif(btrim(p_cover_url), ''),
        primary_color = lower(p_primary_color),
        contact_phone = nullif(btrim(p_contact_phone), ''),
        whatsapp_phone = nullif(btrim(p_whatsapp_phone), ''),
        address = nullif(btrim(p_address), ''),
        status = v_status,
        published_at = case when v_status = 'published' then coalesce(published_at, now()) else published_at end
    where id = v_site.id and organization_id = p_organization_id
    returning * into v_site;
  end if;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id,
    case when v_old is null then 'restaurant_site_created' else 'restaurant_site_updated' end,
    'restaurant_site', v_site.id, v_old,
    jsonb_build_object('slug', v_site.slug, 'status', v_site.status, 'display_name', v_site.display_name)
  );

  return jsonb_build_object(
    'success', true, 'site_id', v_site.id, 'slug', v_site.slug,
    'status', v_site.status, 'published_at', v_site.published_at
  );
end;
$$;

create or replace function public.set_restaurant_site_menu_item_atomic(
  p_organization_id uuid,
  p_site_id uuid,
  p_menu_item_id uuid,
  p_category_name text,
  p_public_description text,
  p_image_url text,
  p_display_order integer,
  p_is_featured boolean,
  p_is_visible boolean,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_site public.restaurant_sites%rowtype;
  v_menu public.menu_items%rowtype;
  v_publication public.restaurant_site_menu_items%rowtype;
  v_old jsonb;
begin
  perform public.assert_digital_presence_actor(p_organization_id, p_actor_user_id);
  select * into v_site from public.restaurant_sites rs
  where rs.id = p_site_id and rs.organization_id = p_organization_id for update;
  if not found then raise exception 'موقع المؤسسة غير موجود.'; end if;

  select * into v_menu from public.menu_items mi
  where mi.id = p_menu_item_id and mi.organization_id = p_organization_id;
  if not found then raise exception 'صنف المنيو لا يتبع المؤسسة.'; end if;
  if p_is_visible and v_menu.status::text <> 'active' then
    raise exception 'لا يمكن نشر صنف متوقف أو مؤرشف.';
  end if;
  if v_site.branch_id is not null and v_menu.branch_id is not null and v_menu.branch_id <> v_site.branch_id then
    raise exception 'صنف المنيو يتبع فرعاً مختلفاً عن الموقع.';
  end if;
  if nullif(btrim(p_category_name), '') is null or length(btrim(p_category_name)) > 100 then
    raise exception 'تصنيف المنيو مطلوب وبحد أقصى 100 حرف.';
  end if;

  select to_jsonb(rsmi) into v_old
  from public.restaurant_site_menu_items rsmi
  where rsmi.organization_id = p_organization_id and rsmi.site_id = p_site_id
    and rsmi.menu_item_id = p_menu_item_id
  for update;

  insert into public.restaurant_site_menu_items (
    organization_id, site_id, menu_item_id, category_name, public_description,
    image_url, display_order, is_featured, is_visible, created_by_user_id
  ) values (
    p_organization_id, p_site_id, p_menu_item_id, btrim(p_category_name),
    nullif(btrim(p_public_description), ''), nullif(btrim(p_image_url), ''),
    coalesce(p_display_order, 0), coalesce(p_is_featured, false),
    coalesce(p_is_visible, true), p_actor_user_id
  )
  on conflict (organization_id, site_id, menu_item_id) do update
  set category_name = excluded.category_name,
      public_description = excluded.public_description,
      image_url = excluded.image_url,
      display_order = excluded.display_order,
      is_featured = excluded.is_featured,
      is_visible = excluded.is_visible,
      updated_at = now()
  returning * into v_publication;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    p_organization_id, v_site.branch_id, p_actor_user_id,
    'restaurant_site_menu_item_set', 'restaurant_site_menu_item', v_publication.id,
    v_old,
    jsonb_build_object(
      'site_id', p_site_id, 'menu_item_id', p_menu_item_id,
      'is_visible', v_publication.is_visible, 'is_featured', v_publication.is_featured,
      'display_order', v_publication.display_order
    )
  );

  return jsonb_build_object(
    'success', true, 'publication_id', v_publication.id,
    'menu_item_id', p_menu_item_id, 'is_visible', v_publication.is_visible
  );
end;
$$;

create or replace function public.get_public_restaurant_site(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_site public.restaurant_sites%rowtype;
  v_items jsonb;
begin
  select * into v_site from public.restaurant_sites rs
  where rs.slug = lower(btrim(p_slug)) and rs.status = 'published';
  if not found then return null; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', mi.id,
      'name', mi.name,
      'selling_price', mi.selling_price,
      'image_url', coalesce(rsmi.image_url, mi.image_path),
      'category_name', rsmi.category_name,
      'description', rsmi.public_description,
      'is_featured', rsmi.is_featured,
      'display_order', rsmi.display_order
    ) order by rsmi.category_name, rsmi.display_order, mi.name
  ), '[]'::jsonb) into v_items
  from public.restaurant_site_menu_items rsmi
  join public.menu_items mi
    on mi.organization_id = rsmi.organization_id and mi.id = rsmi.menu_item_id
  where rsmi.organization_id = v_site.organization_id
    and rsmi.site_id = v_site.id
    and rsmi.is_visible = true
    and mi.status::text = 'active'
    and (v_site.branch_id is null or mi.branch_id is null or mi.branch_id = v_site.branch_id);

  return jsonb_build_object(
    'id', v_site.id,
    'slug', v_site.slug,
    'display_name', v_site.display_name,
    'tagline', v_site.tagline,
    'description', v_site.description,
    'logo_url', v_site.logo_url,
    'cover_url', v_site.cover_url,
    'primary_color', v_site.primary_color,
    'contact_phone', v_site.contact_phone,
    'whatsapp_phone', v_site.whatsapp_phone,
    'address', v_site.address,
    'items', v_items
  );
end;
$$;

alter table public.restaurant_sites enable row level security;
alter table public.restaurant_site_menu_items enable row level security;

create policy restaurant_sites_org_read on public.restaurant_sites
for select to authenticated
using (
  organization_id in (
    select om.organization_id from public.organization_memberships om where om.user_id = auth.uid()
  )
);
create policy restaurant_sites_privileged_write on public.restaurant_sites
for all to authenticated
using (
  exists (
    select 1 from public.organization_memberships om
    where om.organization_id = restaurant_sites.organization_id and om.user_id = auth.uid()
      and om.role::text in ('super_admin','organization_owner','branch_manager','marketing_manager')
  )
)
with check (
  exists (
    select 1 from public.organization_memberships om
    where om.organization_id = restaurant_sites.organization_id and om.user_id = auth.uid()
      and om.role::text in ('super_admin','organization_owner','branch_manager','marketing_manager')
  )
);
create policy restaurant_site_menu_org_read on public.restaurant_site_menu_items
for select to authenticated
using (
  organization_id in (
    select om.organization_id from public.organization_memberships om where om.user_id = auth.uid()
  )
);
create policy restaurant_site_menu_privileged_write on public.restaurant_site_menu_items
for all to authenticated
using (
  exists (
    select 1 from public.organization_memberships om
    where om.organization_id = restaurant_site_menu_items.organization_id and om.user_id = auth.uid()
      and om.role::text in ('super_admin','organization_owner','branch_manager','marketing_manager')
  )
)
with check (
  exists (
    select 1 from public.organization_memberships om
    where om.organization_id = restaurant_site_menu_items.organization_id and om.user_id = auth.uid()
      and om.role::text in ('super_admin','organization_owner','branch_manager','marketing_manager')
  )
);

revoke all on table public.restaurant_sites from anon;
revoke all on table public.restaurant_site_menu_items from anon;
revoke all on function public.save_restaurant_site_atomic(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, uuid
) from public, anon;
grant execute on function public.save_restaurant_site_atomic(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, uuid
) to authenticated, service_role;
revoke all on function public.set_restaurant_site_menu_item_atomic(
  uuid, uuid, uuid, text, text, text, integer, boolean, boolean, uuid
) from public, anon;
grant execute on function public.set_restaurant_site_menu_item_atomic(
  uuid, uuid, uuid, text, text, text, integer, boolean, boolean, uuid
) to authenticated, service_role;
revoke all on function public.get_public_restaurant_site(text) from public;
grant execute on function public.get_public_restaurant_site(text) to anon, authenticated, service_role;

-- Validation before production push:
-- select slug, count(*) from public.restaurant_sites group by slug having count(*) > 1;
-- select rsmi.* from public.restaurant_site_menu_items rsmi
-- left join public.menu_items mi on mi.organization_id = rsmi.organization_id and mi.id = rsmi.menu_item_id
-- where mi.id is null;

-- Forward correction: archive a wrong site or hide a publication through the RPCs.
-- Never delete site/publication history after go-live.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 054_atomic_journal_posting_and_reversal.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- P0 accounting integrity: all journal postings and reversals become atomic.
-- Posted journals/lines are immutable. Corrections are reversal entries only.

alter table public.journal_entries
  add column if not exists posting_fingerprint text;

create or replace function public.protect_journal_entry_history()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'لا يمكن حذف قيد يومية. استخدم قيداً عكسياً.';
  end if;
  if old.status = 'posted' then
    raise exception 'القيد المرحل غير قابل للتعديل. استخدم قيداً عكسياً.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_journal_line_history()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_entry_status text;
  v_entry_id uuid := case when tg_op = 'DELETE' then old.journal_entry_id else new.journal_entry_id end;
begin
  if tg_op = 'DELETE' then
    raise exception 'لا يمكن حذف سطر قيد يومية. استخدم قيداً عكسياً.';
  end if;
  select je.status into v_entry_status
  from public.journal_entries je
  where je.id = v_entry_id;
  if v_entry_status = 'posted' then
    raise exception 'سطور القيد المرحل غير قابلة للإضافة أو التعديل.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_journal_entry_history_trigger on public.journal_entries;
create trigger protect_journal_entry_history_trigger
before update or delete on public.journal_entries
for each row execute function public.protect_journal_entry_history();

drop trigger if exists protect_journal_line_history_trigger on public.journal_lines;
create trigger protect_journal_line_history_trigger
before insert or update or delete on public.journal_lines
for each row execute function public.protect_journal_line_history();

create or replace function public.post_balanced_journal_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_source_doc_type text,
  p_source_doc_id uuid,
  p_memo text,
  p_entry_date date,
  p_lines jsonb,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.journal_entries%rowtype;
  v_entry_id uuid;
  v_entry_number text;
  v_line jsonb;
  v_account_id uuid;
  v_cost_center_id uuid;
  v_debit numeric(14,4);
  v_credit numeric(14,4);
  v_debit_total numeric(18,4) := 0;
  v_credit_total numeric(18,4) := 0;
  v_fingerprint text;
  v_line_count integer;
  v_daily_sequence integer;
begin
  if nullif(btrim(p_source_doc_type), '') is null or p_source_doc_id is null then
    raise exception 'نوع ومعرف المستند المصدر مطلوبان.';
  end if;
  if p_entry_date is null then raise exception 'تاريخ القيد مطلوب.'; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'سطور القيد يجب أن تكون مصفوفة JSON.'; end if;
  v_line_count := jsonb_array_length(p_lines);
  if v_line_count < 2 or v_line_count > 500 then
    raise exception 'القيد يحتاج سطرين إلى 500 سطر.';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception 'المؤسسة غير موجودة.';
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches b where b.id = p_branch_id and b.organization_id = p_organization_id
  ) then
    raise exception 'الفرع لا يتبع المؤسسة.';
  end if;
  if public.is_accounting_period_closed(p_organization_id, p_entry_date) then
    raise exception 'هذه الفترة المحاسبية مقفلة.';
  end if;

  v_fingerprint := encode(digest(
    concat_ws('|', p_organization_id::text, coalesce(p_branch_id::text, ''),
      btrim(p_source_doc_type), p_source_doc_id::text, coalesce(p_memo, ''),
      p_entry_date::text, p_lines::text),
    'sha256'
  ), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':' || btrim(p_source_doc_type) || ':' || p_source_doc_id::text, 0
  ));

  select * into v_existing
  from public.journal_entries je
  where je.organization_id = p_organization_id
    and je.source_doc_type = btrim(p_source_doc_type)
    and je.source_doc_id = p_source_doc_id
  for update;
  if found then
    if v_existing.status = 'draft' then
      raise exception using
        message = 'يوجد قيد draft قديم غير مكتمل لهذا المستند.',
        hint = 'راجعه وابطله بإجراء تصحيح موثق؛ لا تحذف سطوره.';
    end if;
    if v_existing.status <> 'posted' then
      raise exception 'قيد المستند موجود بحالة % ولا يمكن إعادة ترحيله.', v_existing.status;
    end if;
    if v_existing.posting_fingerprint is not null
       and v_existing.posting_fingerprint <> v_fingerprint then
      raise exception 'أعيد استخدام مستند المصدر بحمولة محاسبية مختلفة.';
    end if;
    return jsonb_build_object(
      'success', true, 'duplicate', true, 'entry_id', v_existing.id,
      'entry_number', v_existing.entry_number, 'status', v_existing.status
    );
  end if;

  perform public.ensure_default_chart_accounts(p_organization_id);

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    begin
      v_debit := round(coalesce(nullif(v_line->>'debit', '')::numeric, 0), 4);
      v_credit := round(coalesce(nullif(v_line->>'credit', '')::numeric, 0), 4);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'قيمة مدين أو دائن غير صالحة.';
    end;
    if not ((v_debit > 0 and v_credit = 0) or (v_credit > 0 and v_debit = 0)) then
      raise exception 'كل سطر يجب أن يحتوي قيمة موجبة في المدين أو الدائن فقط.';
    end if;
    if nullif(btrim(v_line->>'memo'), '') is null then
      raise exception 'وصف سطر القيد مطلوب.';
    end if;
    v_debit_total := round(v_debit_total + v_debit, 4);
    v_credit_total := round(v_credit_total + v_credit, 4);
  end loop;
  if v_debit_total <= 0 or v_debit_total <> v_credit_total then
    raise exception 'القيد غير متوازن: مدين % ودائن %.', v_debit_total, v_credit_total;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':journal:' || p_entry_date::text, 0
  ));
  select count(*)::integer + 1 into v_daily_sequence
  from public.journal_entries je
  where je.organization_id = p_organization_id and je.entry_date = p_entry_date;
  v_entry_number := 'JE-' || to_char(p_entry_date, 'YYYYMMDD') || '-' || lpad(v_daily_sequence::text, 4, '0');
  v_entry_id := gen_random_uuid();

  insert into public.journal_entries (
    id, organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status, created_by, posting_fingerprint
  ) values (
    v_entry_id, p_organization_id, p_branch_id, v_entry_number, p_entry_date,
    btrim(p_source_doc_type), p_source_doc_id, nullif(btrim(p_memo), ''),
    'draft', p_created_by, v_fingerprint
  );

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_account_id := null;
    if nullif(v_line->>'account_id', '') is not null then
      begin v_account_id := (v_line->>'account_id')::uuid;
      exception when invalid_text_representation then raise exception 'معرف حساب غير صالح.';
      end;
      if not exists (
        select 1 from public.chart_of_accounts coa
        where coa.id = v_account_id and coa.organization_id = p_organization_id and coa.is_active = true
      ) then
        raise exception 'الحساب المحدد غير نشط أو لا يتبع المؤسسة.';
      end if;
    elsif nullif(btrim(v_line->>'system_key'), '') is not null then
      select coa.id into v_account_id
      from public.chart_of_accounts coa
      where coa.organization_id = p_organization_id
        and coa.system_key = btrim(v_line->>'system_key') and coa.is_active = true;
      if not found then raise exception 'الحساب المحاسبي غير موجود: %.', v_line->>'system_key'; end if;
    else
      raise exception 'سطر قيد بدون حساب محاسبي.';
    end if;

    v_cost_center_id := null;
    if nullif(v_line->>'cost_center_id', '') is not null then
      begin v_cost_center_id := (v_line->>'cost_center_id')::uuid;
      exception when invalid_text_representation then raise exception 'معرف مركز تكلفة غير صالح.';
      end;
      if not exists (
        select 1 from public.cost_centers cc
        where cc.id = v_cost_center_id and cc.organization_id = p_organization_id
      ) then
        raise exception 'مركز التكلفة لا يتبع المؤسسة.';
      end if;
    end if;

    v_debit := round(coalesce(nullif(v_line->>'debit', '')::numeric, 0), 4);
    v_credit := round(coalesce(nullif(v_line->>'credit', '')::numeric, 0), 4);
    insert into public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id,
      debit, credit, memo, cost_center_id
    ) values (
      p_organization_id, v_entry_id, v_account_id, p_branch_id,
      v_debit, v_credit, btrim(v_line->>'memo'), v_cost_center_id
    );
  end loop;

  update public.journal_entries
  set status = 'posted'
  where id = v_entry_id and organization_id = p_organization_id;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, p_branch_id, p_created_by, 'journal_entry_posted_atomic',
    'journal_entry', v_entry_id,
    jsonb_build_object(
      'entry_number', v_entry_number, 'entry_date', p_entry_date,
      'source_doc_type', btrim(p_source_doc_type), 'source_doc_id', p_source_doc_id,
      'debit_total', v_debit_total, 'credit_total', v_credit_total,
      'line_count', v_line_count, 'posting_fingerprint', v_fingerprint
    )
  );

  return jsonb_build_object(
    'success', true, 'duplicate', false, 'entry_id', v_entry_id,
    'entry_number', v_entry_number, 'status', 'posted'
  );
end;
$$;

create or replace function public.reverse_journal_entry_atomic(
  p_organization_id uuid,
  p_entry_id uuid,
  p_reason text,
  p_reversal_date date,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_original public.journal_entries%rowtype;
  v_existing public.journal_entries%rowtype;
  v_reversal_id uuid;
  v_entry_number text;
  v_daily_sequence integer;
  v_line_count integer;
  v_fingerprint text;
begin
  if nullif(btrim(p_reason), '') is null or length(btrim(p_reason)) < 3 then
    raise exception 'سبب العكس مطلوب (3 أحرف على الأقل).';
  end if;
  if p_reversal_date is null then raise exception 'تاريخ القيد العكسي مطلوب.'; end if;
  if public.is_accounting_period_closed(p_organization_id, p_reversal_date) then
    raise exception 'فترة القيد العكسي مقفلة.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':journal-reversal:' || p_entry_id::text, 0
  ));
  select * into v_original
  from public.journal_entries je
  where je.id = p_entry_id and je.organization_id = p_organization_id
  for update;
  if not found then raise exception 'القيد المطلوب عكسه غير موجود.'; end if;
  if v_original.status <> 'posted' then raise exception 'لا يعكس إلا قيد مرحل.'; end if;
  if v_original.reversal_of_entry_id is not null or v_original.source_doc_type = 'journal_reversal' then
    raise exception 'لا يمكن عكس قيد عكسي.';
  end if;

  select * into v_existing
  from public.journal_entries je
  where je.organization_id = p_organization_id
    and je.source_doc_type = 'journal_reversal' and je.source_doc_id = p_entry_id
  for update;
  if found then
    if v_existing.status = 'draft' then
      raise exception using
        message = 'يوجد قيد عكسي draft قديم غير مكتمل.',
        hint = 'راجعه وابطله بإجراء تصحيح موثق؛ لا تحذف سطوره.';
    end if;
    return jsonb_build_object(
      'success', true, 'duplicate', true,
      'entry_id', v_existing.id, 'entry_number', v_existing.entry_number
    );
  end if;

  select count(*) into v_line_count
  from public.journal_lines jl
  where jl.organization_id = p_organization_id and jl.journal_entry_id = p_entry_id;
  if v_line_count < 2 then raise exception 'القيد الأصلي لا يحتوي سطوراً مكتملة.'; end if;

  v_fingerprint := encode(digest(
    concat_ws('|', p_organization_id::text, p_entry_id::text, btrim(p_reason), p_reversal_date::text),
    'sha256'
  ), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':journal:' || p_reversal_date::text, 0
  ));
  select count(*)::integer + 1 into v_daily_sequence
  from public.journal_entries je
  where je.organization_id = p_organization_id and je.entry_date = p_reversal_date;
  v_entry_number := 'JE-' || to_char(p_reversal_date, 'YYYYMMDD') || '-' || lpad(v_daily_sequence::text, 4, '0');
  v_reversal_id := gen_random_uuid();

  insert into public.journal_entries (
    id, organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status, reversal_of_entry_id,
    created_by, posting_fingerprint
  ) values (
    v_reversal_id, p_organization_id, v_original.branch_id, v_entry_number, p_reversal_date,
    'journal_reversal', p_entry_id,
    'عكس قيد ' || v_original.entry_number || ': ' || btrim(p_reason),
    'draft', p_entry_id, p_created_by, v_fingerprint
  );

  insert into public.journal_lines (
    organization_id, journal_entry_id, account_id, branch_id,
    debit, credit, memo, cost_center_id
  )
  select jl.organization_id, v_reversal_id, jl.account_id, jl.branch_id,
         jl.credit, jl.debit,
         case when jl.memo is null then 'عكس قيد ' || v_original.entry_number else 'عكس: ' || jl.memo end,
         jl.cost_center_id
  from public.journal_lines jl
  where jl.organization_id = p_organization_id and jl.journal_entry_id = p_entry_id
  order by jl.created_at, jl.id;

  update public.journal_entries set status = 'posted'
  where id = v_reversal_id and organization_id = p_organization_id;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, v_original.branch_id, p_created_by,
    'journal_entry_reversed_atomic', 'journal_entry', p_entry_id,
    jsonb_build_object(
      'reversal_entry_id', v_reversal_id, 'reversal_entry_number', v_entry_number,
      'reversal_date', p_reversal_date, 'reason', btrim(p_reason), 'line_count', v_line_count
    )
  );

  return jsonb_build_object(
    'success', true, 'duplicate', false,
    'entry_id', v_reversal_id, 'entry_number', v_entry_number
  );
end;
$$;

drop policy if exists "journal entries accountant write" on public.journal_entries;
drop policy if exists "journal lines accountant write" on public.journal_lines;

revoke all on function public.post_balanced_journal_atomic(
  uuid, uuid, text, uuid, text, date, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.post_balanced_journal_atomic(
  uuid, uuid, text, uuid, text, date, jsonb, uuid
) to service_role;
revoke all on function public.reverse_journal_entry_atomic(
  uuid, uuid, text, date, uuid
) from public, anon, authenticated;
grant execute on function public.reverse_journal_entry_atomic(
  uuid, uuid, text, date, uuid
) to service_role;

-- Pre-deployment validation (review every returned row; do not delete it):
-- select je.id, je.organization_id, je.entry_number, je.source_doc_type, je.source_doc_id,
--        je.created_at, count(jl.id) as line_count,
--        coalesce(sum(jl.debit),0) as debits, coalesce(sum(jl.credit),0) as credits
-- from public.journal_entries je
-- left join public.journal_lines jl on jl.organization_id = je.organization_id and jl.journal_entry_id = je.id
-- where je.status = 'draft'
-- group by je.id;

-- Forward correction: replace either RPC in a later migration. Posted rows remain
-- immutable; any accounting correction must be a new reversal/adjustment entry.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ MIGRATION: 055_recipe_versions_and_cost_snapshots.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Restaurant costing integrity: immutable recipe versions and sales cost snapshots.
-- This migration is prepared for review only. Do not apply to production automatically.

create table if not exists public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  activation_key text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  servings numeric(14,4) not null check (servings > 0),
  preparation text,
  target_food_cost_percent numeric(7,4) not null check (target_food_cost_percent > 0 and target_food_cost_percent < 100),
  labor_cost_per_batch numeric(16,4) not null default 0 check (labor_cost_per_batch >= 0),
  overhead_cost_per_batch numeric(16,4) not null default 0 check (overhead_cost_per_batch >= 0),
  material_cost numeric(16,4) not null default 0 check (material_cost >= 0),
  total_cost numeric(16,4) not null default 0 check (total_cost >= 0),
  cost_per_serving numeric(16,4) not null default 0 check (cost_per_serving >= 0),
  activated_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, recipe_id, version_number),
  unique (organization_id, activation_key)
);

create unique index if not exists recipe_versions_one_active_idx
  on public.recipe_versions (organization_id, recipe_id)
  where status = 'active';

create table if not exists public.recipe_version_ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  recipe_version_id uuid not null references public.recipe_versions(id) on delete restrict,
  item_id uuid references public.inventory_items(id) on delete restrict,
  subrecipe_version_id uuid references public.recipe_versions(id) on delete restrict,
  unit_id uuid references public.units(id) on delete restrict,
  item_name_snapshot text not null,
  unit_name_snapshot text,
  quantity numeric(16,6) not null check (quantity > 0),
  yield_percent numeric(7,4) not null check (yield_percent > 0 and yield_percent <= 100),
  unit_cost_snapshot numeric(16,6) not null check (unit_cost_snapshot >= 0),
  extended_cost numeric(18,4) generated always as (
    round(quantity * unit_cost_snapshot / nullif(yield_percent / 100, 0), 4)
  ) stored,
  created_at timestamptz not null default now(),
  check ((item_id is not null)::integer + (subrecipe_version_id is not null)::integer = 1)
);

create index if not exists recipe_version_ingredients_version_idx
  on public.recipe_version_ingredients (organization_id, recipe_version_id);

create table if not exists public.menu_item_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  triggered_by_recipe_version_id uuid not null references public.recipe_versions(id) on delete restrict,
  selling_price_snapshot numeric(16,4) not null check (selling_price_snapshot >= 0),
  material_cost_per_unit numeric(16,4) not null check (material_cost_per_unit >= 0),
  labor_cost_per_unit numeric(16,4) not null check (labor_cost_per_unit >= 0),
  overhead_cost_per_unit numeric(16,4) not null check (overhead_cost_per_unit >= 0),
  total_cost_per_unit numeric(16,4) not null check (total_cost_per_unit >= 0),
  food_cost_percent numeric(9,4),
  contribution_margin numeric(16,4) not null,
  components jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists menu_item_cost_snapshots_latest_idx
  on public.menu_item_cost_snapshots (organization_id, menu_item_id, created_at desc);

create table if not exists public.customer_invoice_item_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  customer_invoice_id uuid not null references public.customer_invoices(id) on delete restrict,
  customer_invoice_item_id uuid not null references public.customer_invoice_items(id) on delete restrict,
  menu_item_id uuid references public.menu_items(id) on delete restrict,
  menu_item_cost_snapshot_id uuid references public.menu_item_cost_snapshots(id) on delete restrict,
  sold_at timestamptz not null,
  quantity numeric(16,4) not null check (quantity > 0),
  net_sales_amount numeric(16,4) not null,
  theoretical_material_cost numeric(16,4) not null check (theoretical_material_cost >= 0),
  full_cost numeric(16,4),
  gross_profit numeric(16,4) not null,
  snapshot_status text not null check (snapshot_status in ('complete', 'material_only', 'unmapped')),
  components jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, customer_invoice_item_id)
);

create index if not exists customer_invoice_item_cost_snapshots_period_idx
  on public.customer_invoice_item_cost_snapshots (organization_id, branch_id, sold_at desc);

alter table public.recipe_versions enable row level security;
alter table public.recipe_version_ingredients enable row level security;
alter table public.menu_item_cost_snapshots enable row level security;
alter table public.customer_invoice_item_cost_snapshots enable row level security;

create or replace function public.can_read_restaurant_costs(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_super_admin() or public.has_org_role(
    p_organization_id,
    array['organization_owner','accountant']::public.app_role[]
  );
$$;

drop policy if exists "recipe versions cost read" on public.recipe_versions;
create policy "recipe versions cost read" on public.recipe_versions
  for select to authenticated using (public.can_read_restaurant_costs(organization_id));
drop policy if exists "recipe version ingredients cost read" on public.recipe_version_ingredients;
create policy "recipe version ingredients cost read" on public.recipe_version_ingredients
  for select to authenticated using (public.can_read_restaurant_costs(organization_id));
drop policy if exists "menu item cost snapshots read" on public.menu_item_cost_snapshots;
create policy "menu item cost snapshots read" on public.menu_item_cost_snapshots
  for select to authenticated using (public.can_read_restaurant_costs(organization_id));
drop policy if exists "invoice item cost snapshots read" on public.customer_invoice_item_cost_snapshots;
create policy "invoice item cost snapshots read" on public.customer_invoice_item_cost_snapshots
  for select to authenticated using (public.can_read_restaurant_costs(organization_id));

create or replace function public.protect_recipe_version_history()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'لا يمكن حذف إصدار وصفة؛ أنشئ إصداراً جديداً.';
  end if;
  if old.status <> 'draft' then
    if old.status = 'active' and new.status = 'retired'
       and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
      return new;
    end if;
    raise exception 'إصدار الوصفة المفعّل غير قابل للتعديل.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_cost_snapshot_history()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'لقطة التكلفة غير قابلة للتعديل أو الحذف.';
end;
$$;

drop trigger if exists protect_recipe_version_history_trigger on public.recipe_versions;
create trigger protect_recipe_version_history_trigger
before update or delete on public.recipe_versions
for each row execute function public.protect_recipe_version_history();

drop trigger if exists protect_recipe_version_ingredients_trigger on public.recipe_version_ingredients;
create trigger protect_recipe_version_ingredients_trigger
before update or delete on public.recipe_version_ingredients
for each row execute function public.protect_cost_snapshot_history();
drop trigger if exists protect_menu_item_cost_snapshots_trigger on public.menu_item_cost_snapshots;
create trigger protect_menu_item_cost_snapshots_trigger
before update or delete on public.menu_item_cost_snapshots
for each row execute function public.protect_cost_snapshot_history();
drop trigger if exists protect_customer_invoice_item_cost_snapshots_trigger on public.customer_invoice_item_cost_snapshots;
create trigger protect_customer_invoice_item_cost_snapshots_trigger
before update or delete on public.customer_invoice_item_cost_snapshots
for each row execute function public.protect_cost_snapshot_history();

create or replace function public.assert_costing_actor(
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role text;
begin
  if p_actor_user_id is null then raise exception 'المستخدم المنفذ مطلوب.'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_actor_user_id then
    raise exception 'لا يمكن للمستخدم تمثيل مستخدم آخر.';
  end if;
  select om.role::text into v_role
  from public.organization_memberships om
  where om.organization_id = p_organization_id and om.user_id = p_actor_user_id
  order by case when om.branch_id is null then 0 else 1 end
  limit 1;
  if v_role is null and exists (
    select 1 from public.organization_memberships om
    where om.user_id = p_actor_user_id and om.role::text = 'super_admin'
  ) then
    v_role := 'super_admin';
  end if;
  if v_role not in ('super_admin', 'organization_owner', 'accountant') then
    raise exception 'الدور لا يسمح برؤية التكلفة واعتماد إصدار الوصفة.';
  end if;
  return v_role;
end;
$$;

create or replace function public.activate_recipe_version_atomic(
  p_organization_id uuid,
  p_recipe_id uuid,
  p_name text,
  p_category text,
  p_servings numeric,
  p_preparation text,
  p_target_food_cost_percent numeric,
  p_labor_cost_per_batch numeric,
  p_overhead_cost_per_batch numeric,
  p_ingredients jsonb,
  p_activation_key text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_recipe_id uuid := p_recipe_id;
  v_version_id uuid;
  v_version_number integer;
  v_ingredient jsonb;
  v_item public.inventory_items%rowtype;
  v_subversion public.recipe_versions%rowtype;
  v_unit_name text;
  v_quantity numeric(16,6);
  v_yield numeric(7,4);
  v_material_cost numeric(16,4);
  v_total_cost numeric(16,4);
  v_cost_per_serving numeric(16,4);
  v_menu record;
  v_material_per_unit numeric(16,4);
  v_labor_per_unit numeric(16,4);
  v_overhead_per_unit numeric(16,4);
  v_menu_total numeric(16,4);
  v_components jsonb;
begin
  perform public.assert_costing_actor(p_organization_id, p_actor_user_id);
  if nullif(btrim(p_name), '') is null or nullif(btrim(p_category), '') is null then
    raise exception 'اسم وتصنيف الوصفة مطلوبان.';
  end if;
  if p_servings is null or p_servings <= 0 then raise exception 'عدد الحصص يجب أن يكون موجباً.'; end if;
  if p_target_food_cost_percent is null or p_target_food_cost_percent <= 0 or p_target_food_cost_percent >= 100 then
    raise exception 'نسبة تكلفة الطعام المستهدفة يجب أن تكون بين 0 و100.';
  end if;
  if coalesce(p_labor_cost_per_batch, 0) < 0 or coalesce(p_overhead_cost_per_batch, 0) < 0 then
    raise exception 'تكلفة العمل والتحميل لا يمكن أن تكون سالبة.';
  end if;
  if jsonb_typeof(p_ingredients) <> 'array' or jsonb_array_length(p_ingredients) not between 1 and 200 then
    raise exception 'الوصفة تحتاج من مكوّن واحد إلى 200 مكوّن.';
  end if;
  if nullif(btrim(p_activation_key), '') is null or length(btrim(p_activation_key)) < 8 then
    raise exception 'مفتاح منع التكرار مطلوب (8 أحرف على الأقل).';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':recipe-version:' || coalesce(v_recipe_id::text, lower(btrim(p_name))), 0
  ));
  select rv.id into v_version_id
  from public.recipe_versions rv
  where rv.organization_id = p_organization_id and rv.activation_key = btrim(p_activation_key);
  if found then
    return jsonb_build_object('success', true, 'duplicate', true, 'recipe_version_id', v_version_id);
  end if;

  if v_recipe_id is null then
    insert into public.recipes (
      organization_id, name, category, servings, preparation,
      total_cost, cost_per_serving, status, created_by
    ) values (
      p_organization_id, btrim(p_name), btrim(p_category), p_servings, nullif(btrim(p_preparation), ''),
      0, 0, 'active', p_actor_user_id
    ) returning id into v_recipe_id;
  else
    perform 1 from public.recipes r
    where r.id = v_recipe_id and r.organization_id = p_organization_id for update;
    if not found then raise exception 'الوصفة لا تتبع المؤسسة.'; end if;
  end if;

  select coalesce(max(rv.version_number), 0) + 1 into v_version_number
  from public.recipe_versions rv
  where rv.organization_id = p_organization_id and rv.recipe_id = v_recipe_id;
  v_version_id := gen_random_uuid();
  insert into public.recipe_versions (
    id, organization_id, recipe_id, version_number, activation_key, status,
    servings, preparation, target_food_cost_percent,
    labor_cost_per_batch, overhead_cost_per_batch, created_by
  ) values (
    v_version_id, p_organization_id, v_recipe_id, v_version_number,
    btrim(p_activation_key), 'draft', p_servings, nullif(btrim(p_preparation), ''),
    round(p_target_food_cost_percent, 4), round(coalesce(p_labor_cost_per_batch, 0), 4),
    round(coalesce(p_overhead_cost_per_batch, 0), 4), p_actor_user_id
  );

  for v_ingredient in select value from jsonb_array_elements(p_ingredients)
  loop
    begin
      v_quantity := round((v_ingredient->>'quantity')::numeric, 6);
      v_yield := round(coalesce(nullif(v_ingredient->>'yield_percent', '')::numeric, 100), 4);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'كمية أو نسبة تصافي غير صالحة.';
    end;
    if v_quantity <= 0 or v_yield <= 0 or v_yield > 100 then
      raise exception 'كمية المكوّن ونسبة التصافي غير صالحتين.';
    end if;
    if (nullif(v_ingredient->>'item_id', '') is null) = (nullif(v_ingredient->>'subrecipe_version_id', '') is null) then
      raise exception 'حدد مادة مخزون أو إصدار وصفة فرعية واحداً فقط.';
    end if;

    if nullif(v_ingredient->>'item_id', '') is not null then
      select * into v_item from public.inventory_items i
      where i.id = (v_ingredient->>'item_id')::uuid and i.organization_id = p_organization_id and i.status = 'active';
      if not found then raise exception 'مادة مخزون غير نشطة أو لا تتبع المؤسسة.'; end if;
      if nullif(v_ingredient->>'unit_id', '') is not null and not exists (
        select 1 from public.units u
        where u.id = (v_ingredient->>'unit_id')::uuid and u.organization_id = p_organization_id
      ) then raise exception 'وحدة القياس لا تتبع المؤسسة.'; end if;
      select u.name into v_unit_name from public.units u where u.id = nullif(v_ingredient->>'unit_id', '')::uuid;
      insert into public.recipe_version_ingredients (
        organization_id, recipe_version_id, item_id, unit_id,
        item_name_snapshot, unit_name_snapshot, quantity, yield_percent, unit_cost_snapshot
      ) values (
        p_organization_id, v_version_id, v_item.id, nullif(v_ingredient->>'unit_id', '')::uuid,
        v_item.name, v_unit_name, v_quantity, v_yield, round(coalesce(v_item.average_cost, 0), 6)
      );
    else
      select * into v_subversion from public.recipe_versions rv
      where rv.id = (v_ingredient->>'subrecipe_version_id')::uuid
        and rv.organization_id = p_organization_id and rv.status = 'active';
      if not found then raise exception 'إصدار الوصفة الفرعية غير مفعّل أو لا يتبع المؤسسة.'; end if;
      if v_subversion.recipe_id = v_recipe_id then raise exception 'لا يمكن للوصفة أن تحتوي نفسها.'; end if;
      if exists (
        with recursive dependencies(version_id, subrecipe_version_id, path) as (
          select rvi.recipe_version_id, rvi.subrecipe_version_id, array[rvi.recipe_version_id]
          from public.recipe_version_ingredients rvi
          where rvi.recipe_version_id = v_subversion.id and rvi.subrecipe_version_id is not null
          union all
          select rvi.recipe_version_id, rvi.subrecipe_version_id, d.path || rvi.recipe_version_id
          from dependencies d
          join public.recipe_version_ingredients rvi on rvi.recipe_version_id = d.subrecipe_version_id
          where rvi.subrecipe_version_id is not null and not rvi.recipe_version_id = any(d.path)
        )
        select 1 from dependencies d
        join public.recipe_versions rv on rv.id = d.subrecipe_version_id
        where rv.recipe_id = v_recipe_id
      ) then raise exception 'تم اكتشاف دورة بين الوصفات الفرعية.'; end if;
      insert into public.recipe_version_ingredients (
        organization_id, recipe_version_id, subrecipe_version_id,
        item_name_snapshot, unit_name_snapshot, quantity, yield_percent, unit_cost_snapshot
      ) select
        p_organization_id, v_version_id, v_subversion.id,
        r.name, 'حصة', v_quantity, v_yield, v_subversion.cost_per_serving
      from public.recipes r where r.id = v_subversion.recipe_id;
    end if;
  end loop;

  select round(coalesce(sum(rvi.extended_cost), 0), 4) into v_material_cost
  from public.recipe_version_ingredients rvi
  where rvi.organization_id = p_organization_id and rvi.recipe_version_id = v_version_id;
  v_total_cost := round(v_material_cost + coalesce(p_labor_cost_per_batch, 0) + coalesce(p_overhead_cost_per_batch, 0), 4);
  v_cost_per_serving := round(v_total_cost / p_servings, 4);

  update public.recipe_versions set
    material_cost = v_material_cost, total_cost = v_total_cost,
    cost_per_serving = v_cost_per_serving, status = 'active', activated_at = now()
  where id = v_version_id and status = 'draft';
  update public.recipe_versions set status = 'retired'
  where organization_id = p_organization_id and recipe_id = v_recipe_id
    and id <> v_version_id and status = 'active';

  update public.recipes set
    name = btrim(p_name), category = btrim(p_category), servings = p_servings,
    preparation = nullif(btrim(p_preparation), ''), total_cost = v_material_cost,
    cost_per_serving = round(v_material_cost / p_servings, 4), status = 'active', updated_at = now()
  where id = v_recipe_id and organization_id = p_organization_id;

  -- recipe_ingredients is the current POS/production projection. Historical
  -- components are retained immutably above before this projection is replaced.
  delete from public.recipe_ingredients ri
  where ri.organization_id = p_organization_id and ri.recipe_id = v_recipe_id;
  insert into public.recipe_ingredients (
    organization_id, recipe_id, item_id, quantity, unit_id,
    yield_percent, unit_cost, created_by
  )
  with recursive expanded as (
    select rvi.item_id, rvi.subrecipe_version_id, rvi.unit_id,
           rvi.quantity, rvi.yield_percent, 1::numeric as batch_multiplier,
           array[v_version_id]::uuid[] as path
    from public.recipe_version_ingredients rvi
    where rvi.recipe_version_id = v_version_id
    union all
    select child.item_id, child.subrecipe_version_id, child.unit_id,
           child.quantity, child.yield_percent,
           e.batch_multiplier * (e.quantity / nullif(e.yield_percent / 100, 0)) / parent.servings,
           e.path || parent.id
    from expanded e
    join public.recipe_versions parent on parent.id = e.subrecipe_version_id
    join public.recipe_version_ingredients child on child.recipe_version_id = parent.id
    where e.subrecipe_version_id is not null and not parent.id = any(e.path)
  ), material_rows as (
    select e.item_id, e.unit_id,
           round(sum(e.batch_multiplier * e.quantity / nullif(e.yield_percent / 100, 0)), 6) as gross_quantity
    from expanded e where e.item_id is not null
    group by e.item_id, e.unit_id
  )
  select p_organization_id, v_recipe_id, mr.item_id, mr.gross_quantity,
         mr.unit_id, 100, round(coalesce(i.average_cost, 0), 4), p_actor_user_id
  from material_rows mr
  join public.inventory_items i on i.id = mr.item_id and i.organization_id = p_organization_id;

  for v_menu in
    select distinct m.menu_item_id, mi.selling_price
    from public.menu_item_recipe_mapping m
    join public.menu_items mi on mi.id = m.menu_item_id and mi.organization_id = p_organization_id
    where m.organization_id = p_organization_id and m.recipe_id = v_recipe_id
  loop
    select
      round(coalesce(sum(rv.material_cost / rv.servings * m.portion_multiplier), 0), 4),
      round(coalesce(sum(rv.labor_cost_per_batch / rv.servings * m.portion_multiplier), 0), 4),
      round(coalesce(sum(rv.overhead_cost_per_batch / rv.servings * m.portion_multiplier), 0), 4),
      coalesce(jsonb_agg(jsonb_build_object(
        'recipe_id', m.recipe_id, 'recipe_version_id', rv.id,
        'portion_multiplier', m.portion_multiplier, 'cost_per_serving', rv.cost_per_serving
      ) order by m.recipe_id), '[]'::jsonb)
    into v_material_per_unit, v_labor_per_unit, v_overhead_per_unit, v_components
    from public.menu_item_recipe_mapping m
    join public.recipe_versions rv on rv.organization_id = p_organization_id
      and rv.recipe_id = m.recipe_id and rv.status = 'active'
    where m.organization_id = p_organization_id and m.menu_item_id = v_menu.menu_item_id;
    v_menu_total := round(v_material_per_unit + v_labor_per_unit + v_overhead_per_unit, 4);
    insert into public.menu_item_cost_snapshots (
      organization_id, menu_item_id, triggered_by_recipe_version_id,
      selling_price_snapshot, material_cost_per_unit, labor_cost_per_unit,
      overhead_cost_per_unit, total_cost_per_unit, food_cost_percent,
      contribution_margin, components, created_by
    ) values (
      p_organization_id, v_menu.menu_item_id, v_version_id,
      round(v_menu.selling_price, 4), v_material_per_unit, v_labor_per_unit,
      v_overhead_per_unit, v_menu_total,
      case when v_menu.selling_price > 0 then round(v_material_per_unit / v_menu.selling_price * 100, 4) end,
      round(v_menu.selling_price - v_menu_total, 4), v_components, p_actor_user_id
    );
  end loop;

  insert into public.audit_logs (
    organization_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, p_actor_user_id, 'recipe_version_activated',
    'recipe_version', v_version_id,
    jsonb_build_object(
      'recipe_id', v_recipe_id, 'version_number', v_version_number,
      'material_cost', v_material_cost, 'labor_cost', coalesce(p_labor_cost_per_batch, 0),
      'overhead_cost', coalesce(p_overhead_cost_per_batch, 0),
      'total_cost', v_total_cost, 'cost_per_serving', v_cost_per_serving,
      'target_food_cost_percent', p_target_food_cost_percent,
      'activation_key', btrim(p_activation_key)
    )
  );
  return jsonb_build_object(
    'success', true, 'duplicate', false, 'recipe_id', v_recipe_id,
    'recipe_version_id', v_version_id, 'version_number', v_version_number,
    'material_cost', v_material_cost, 'total_cost', v_total_cost,
    'cost_per_serving', v_cost_per_serving
  );
end;
$$;

create or replace function public.capture_customer_invoice_item_cost_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_invoice public.customer_invoices%rowtype;
  v_menu_snapshot public.menu_item_cost_snapshots%rowtype;
  v_full_cost numeric(16,4);
  v_status text;
begin
  select * into v_invoice from public.customer_invoices ci
  where ci.id = new.customer_invoice_id and ci.organization_id = new.organization_id;
  if not found then raise exception 'تعذر ربط لقطة التكلفة بالفاتورة.'; end if;

  if new.menu_item_id is not null then
    select * into v_menu_snapshot
    from public.menu_item_cost_snapshots mics
    where mics.organization_id = new.organization_id and mics.menu_item_id = new.menu_item_id
      and mics.created_at <= v_invoice.issued_at
    order by mics.created_at desc limit 1;
  end if;
  if v_menu_snapshot.id is not null then
    v_full_cost := round(v_menu_snapshot.total_cost_per_unit * new.quantity, 4);
    v_status := 'complete';
  elsif new.menu_item_id is not null then
    v_full_cost := null;
    v_status := 'material_only';
  else
    v_full_cost := null;
    v_status := 'unmapped';
  end if;

  insert into public.customer_invoice_item_cost_snapshots (
    organization_id, branch_id, customer_invoice_id, customer_invoice_item_id,
    menu_item_id, menu_item_cost_snapshot_id, sold_at, quantity,
    net_sales_amount, theoretical_material_cost, full_cost, gross_profit,
    snapshot_status, components
  ) values (
    new.organization_id, v_invoice.branch_id, new.customer_invoice_id, new.id,
    new.menu_item_id, v_menu_snapshot.id, v_invoice.issued_at, new.quantity,
    round(coalesce(new.cost_total, 0) + coalesce(new.gross_profit, 0), 4),
    round(coalesce(new.cost_total, 0), 4), v_full_cost,
    round(coalesce(new.gross_profit, 0), 4), v_status,
    coalesce(v_menu_snapshot.components, '[]'::jsonb)
  ) on conflict (organization_id, customer_invoice_item_id) do nothing;
  return new;
end;
$$;

drop trigger if exists capture_customer_invoice_item_cost_snapshot_trigger on public.customer_invoice_items;
create trigger capture_customer_invoice_item_cost_snapshot_trigger
after insert on public.customer_invoice_items
for each row execute function public.capture_customer_invoice_item_cost_snapshot();

revoke all on function public.activate_recipe_version_atomic(
  uuid, uuid, text, text, numeric, text, numeric, numeric, numeric, jsonb, text, uuid
) from public, anon, authenticated;
grant execute on function public.activate_recipe_version_atomic(
  uuid, uuid, text, text, numeric, text, numeric, numeric, numeric, jsonb, text, uuid
) to service_role;

-- Pre-deployment validation: review every zero-cost active item and unmapped menu item.
-- select id, organization_id, name from public.inventory_items where status = 'active' and average_cost <= 0;
-- select mi.id, mi.organization_id, mi.name from public.menu_items mi
-- left join public.menu_item_recipe_mapping m on m.menu_item_id = mi.id and m.organization_id = mi.organization_id
-- where mi.status = 'active' group by mi.id having count(m.id) = 0;
-- Existing invoices are intentionally not backfilled: a historical cost without a contemporaneous
-- snapshot would be an estimate. The trigger records exact snapshots for invoices created after rollout.

-- Forward correction only: replace RPC/trigger definitions in a later migration.
-- Never delete or rewrite an activated version or a cost snapshot.
