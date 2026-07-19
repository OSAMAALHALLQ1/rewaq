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
