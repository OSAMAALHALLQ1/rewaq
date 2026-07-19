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
