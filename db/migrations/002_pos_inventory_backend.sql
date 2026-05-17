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
  add column if not exists idempotency_key text,
  add constraint customer_invoices_idempotency_key_unique unique (organization_id, idempotency_key);

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
  using (public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','staff']::app_role[]))
  with check (public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','staff']::app_role[]));

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

  if not public.has_org_role(p_organization_id, array['organization_owner','branch_manager','staff']::app_role[]) then
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

create or replace view public.amwali_daily_summary as
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
