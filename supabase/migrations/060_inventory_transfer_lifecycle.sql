-- Inventory transfer lifecycle:
-- draft -> pending_approval -> approved -> in_transit -> received/variance_review -> closed.
-- Stock leaves the source only on ship and enters the destination only on receipt.

alter table public.transfers alter column status drop default;
alter table public.transfers alter column status type text using status::text;
alter table public.transfers alter column status set default 'draft';

alter table public.transfers
  add column if not exists transfer_number text,
  add column if not exists idempotency_key text,
  add column if not exists requested_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists shipped_at timestamptz,
  add column if not exists shipped_by uuid references auth.users(id) on delete set null,
  add column if not exists received_by uuid references auth.users(id) on delete set null,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text;

update public.transfers
set requested_at = coalesce(requested_at, created_at),
    transfer_number = coalesce(transfer_number, 'TR-' || upper(left(id::text, 8))),
    status = case when status = 'sent' then 'in_transit' else status end
where requested_at is null or transfer_number is null;

alter table public.transfers
  drop constraint if exists transfers_status_check,
  add constraint transfers_status_check check (
    status in ('draft', 'pending_approval', 'approved', 'in_transit', 'received', 'variance_review', 'closed', 'cancelled')
  ) not valid;
alter table public.transfers validate constraint transfers_status_check;

create unique index if not exists transfers_org_number_unique
  on public.transfers (organization_id, transfer_number) where transfer_number is not null;
create unique index if not exists transfers_org_idempotency_unique
  on public.transfers (organization_id, idempotency_key) where idempotency_key is not null;
create index if not exists transfers_org_status_created_idx
  on public.transfers (organization_id, status, created_at desc);

alter table public.transfer_items
  rename column quantity to requested_quantity;

alter table public.transfer_items
  add column if not exists sent_quantity numeric(14,4) not null default 0,
  add column if not exists received_quantity numeric(14,4) not null default 0,
  add column if not exists variance_quantity numeric(14,4) not null default 0,
  add column if not exists variance_reason text,
  add column if not exists batch_number text,
  add column if not exists expiry_date date,
  add column if not exists source_warehouse text not null default 'general',
  add column if not exists source_location text,
  add column if not exists destination_warehouse text not null default 'general',
  add column if not exists destination_location text;

alter table public.transfer_items
  drop constraint if exists transfer_items_quantities_check,
  add constraint transfer_items_quantities_check check (
    requested_quantity > 0 and sent_quantity >= 0 and received_quantity >= 0
    and sent_quantity <= requested_quantity and received_quantity <= sent_quantity
    and variance_quantity = sent_quantity - received_quantity
  ) not valid;

update public.transfer_items ti
set sent_quantity = case when t.status in ('in_transit', 'received', 'variance_review', 'closed') then ti.requested_quantity else 0 end,
    received_quantity = case when t.status = 'received' then ti.requested_quantity else 0 end,
    variance_quantity = 0
from public.transfers t
where t.id = ti.transfer_id and t.organization_id = ti.organization_id;

alter table public.transfer_items validate constraint transfer_items_quantities_check;
create unique index if not exists transfer_items_org_transfer_item_unique
  on public.transfer_items (organization_id, transfer_id, item_id);

create or replace function public.assert_transfer_actor(
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_user_id uuid
) returns void
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_membership public.organization_memberships%rowtype;
begin
  select * into v_membership
  from public.organization_memberships om
  where om.organization_id = p_organization_id and om.user_id = p_actor_user_id;
  if not found then raise exception 'لا توجد عضوية فعالة في المؤسسة.'; end if;
  if v_membership.role not in ('super_admin', 'organization_owner', 'branch_manager', 'inventory_manager') then
    raise exception 'لا تملك صلاحية إدارة تحويلات المخزون.';
  end if;
  if v_membership.branch_id is not null and v_membership.branch_id <> p_branch_id then
    raise exception 'القسم خارج نطاق صلاحياتك.';
  end if;
end;
$$;

create or replace function public.create_inventory_transfer_atomic(
  p_organization_id uuid,
  p_from_branch_id uuid,
  p_to_branch_id uuid,
  p_lines jsonb,
  p_notes text,
  p_idempotency_key text,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_transfer_id uuid; v_number text; v_line record;
begin
  perform public.assert_transfer_actor(p_organization_id, p_from_branch_id, p_actor_user_id);
  if p_from_branch_id = p_to_branch_id then raise exception 'لا يمكن التحويل إلى القسم نفسه.'; end if;
  if coalesce(p_idempotency_key, '') = '' then raise exception 'مفتاح منع التكرار مطلوب.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'أضف مادة واحدة على الأقل.'; end if;
  if not exists (select 1 from public.branches where id = p_from_branch_id and organization_id = p_organization_id)
     or not exists (select 1 from public.branches where id = p_to_branch_id and organization_id = p_organization_id) then
    raise exception 'أحد القسمين غير تابع للمؤسسة.';
  end if;
  select id into v_transfer_id from public.transfers
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('success', true, 'duplicate', true, 'transfer_id', v_transfer_id); end if;

  v_transfer_id := gen_random_uuid();
  v_number := 'TR-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(left(v_transfer_id::text, 6));
  insert into public.transfers (
    id, organization_id, from_branch_id, to_branch_id, status, transfer_number,
    idempotency_key, requested_at, notes, created_by
  ) values (
    v_transfer_id, p_organization_id, p_from_branch_id, p_to_branch_id, 'draft', v_number,
    p_idempotency_key, now(), nullif(trim(p_notes), ''), p_actor_user_id
  );

  for v_line in select * from jsonb_to_recordset(p_lines) as x(
    item_id uuid, quantity numeric, source_warehouse text, source_location text,
    destination_warehouse text, destination_location text, batch_number text, expiry_date date
  ) loop
    if v_line.quantity is null or v_line.quantity <= 0 then raise exception 'كمية التحويل يجب أن تكون أكبر من صفر.'; end if;
    if not exists (select 1 from public.inventory_items where id = v_line.item_id and organization_id = p_organization_id) then
      raise exception 'مادة التحويل غير موجودة.';
    end if;
    insert into public.transfer_items (
      organization_id, transfer_id, item_id, requested_quantity, unit_cost,
      source_warehouse, source_location, destination_warehouse, destination_location,
      batch_number, expiry_date, created_by
    ) select
      p_organization_id, v_transfer_id, v_line.item_id, round(v_line.quantity, 4), coalesce(ii.average_cost, 0),
      coalesce(nullif(v_line.source_warehouse, ''), 'general'), nullif(v_line.source_location, ''),
      coalesce(nullif(v_line.destination_warehouse, ''), 'general'), nullif(v_line.destination_location, ''),
      nullif(v_line.batch_number, ''), v_line.expiry_date, p_actor_user_id
    from public.inventory_items ii where ii.id = v_line.item_id and ii.organization_id = p_organization_id;
  end loop;
  insert into public.audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, new_data)
  values (p_organization_id, p_from_branch_id, p_actor_user_id, 'inventory_transfer_created', 'transfer', v_transfer_id,
    jsonb_build_object('number', v_number, 'to_branch_id', p_to_branch_id, 'line_count', jsonb_array_length(p_lines)));
  return jsonb_build_object('success', true, 'duplicate', false, 'transfer_id', v_transfer_id, 'transfer_number', v_number);
end;
$$;

create or replace function public.transition_inventory_transfer_atomic(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_action text,
  p_reason text,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_transfer public.transfers%rowtype; v_line record; v_stock numeric(14,4);
begin
  select * into v_transfer from public.transfers
  where id = p_transfer_id and organization_id = p_organization_id for update;
  if not found then raise exception 'التحويل غير موجود.'; end if;

  if p_action in ('receive', 'close') then
    perform public.assert_transfer_actor(p_organization_id, v_transfer.to_branch_id, p_actor_user_id);
  else
    perform public.assert_transfer_actor(p_organization_id, v_transfer.from_branch_id, p_actor_user_id);
  end if;

  if p_action = 'submit' then
    if v_transfer.status <> 'draft' then raise exception 'يمكن إرسال المسودة فقط.'; end if;
    update public.transfers set status='pending_approval', submitted_at=now(), submitted_by=p_actor_user_id, updated_at=now()
    where id=p_transfer_id;
  elsif p_action = 'approve' then
    if v_transfer.status <> 'pending_approval' then raise exception 'التحويل ليس بانتظار الاعتماد.'; end if;
    if v_transfer.created_by = p_actor_user_id or v_transfer.submitted_by = p_actor_user_id then
      raise exception 'لا يجوز لمنشئ التحويل أو مرسله اعتماده.';
    end if;
    update public.transfers set status='approved', approved_at=now(), approved_by=p_actor_user_id, updated_at=now()
    where id=p_transfer_id;
  elsif p_action = 'ship' then
    if v_transfer.status = 'in_transit' then return jsonb_build_object('success', true, 'duplicate', true, 'status', v_transfer.status); end if;
    if v_transfer.status <> 'approved' then raise exception 'يجب اعتماد التحويل قبل الشحن.'; end if;
    for v_line in select * from public.transfer_items where transfer_id=p_transfer_id and organization_id=p_organization_id order by item_id loop
      perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || v_transfer.from_branch_id::text || ':' || v_line.item_id::text, 0));
      select quantity into v_stock from public.branch_stock
      where organization_id=p_organization_id and branch_id=v_transfer.from_branch_id and item_id=v_line.item_id for update;
      if coalesce(v_stock, 0) < v_line.requested_quantity then raise exception 'الرصيد غير كافٍ لشحن إحدى المواد.'; end if;
      update public.branch_stock set quantity=quantity-v_line.requested_quantity, updated_at=now()
      where organization_id=p_organization_id and branch_id=v_transfer.from_branch_id and item_id=v_line.item_id;
      update public.transfer_items set sent_quantity=requested_quantity, variance_quantity=requested_quantity, updated_at=now()
      where id=v_line.id;
      insert into public.stock_movements (
        organization_id, branch_id, item_id, movement_type, quantity, unit_cost,
        source_doc_type, source_doc_id, idempotency_key, notes, created_by
      ) values (
        p_organization_id, v_transfer.from_branch_id, v_line.item_id, 'transfer_out', -v_line.requested_quantity, v_line.unit_cost,
        'transfer', p_transfer_id, 'transfer:' || p_transfer_id::text || ':' || v_line.item_id::text || ':ship',
        'شحن تحويل ' || coalesce(v_transfer.transfer_number, p_transfer_id::text), p_actor_user_id
      ) on conflict (organization_id, idempotency_key) where idempotency_key is not null do nothing;
    end loop;
    update public.transfers set status='in_transit', sent_at=now(), shipped_at=now(), shipped_by=p_actor_user_id, updated_at=now()
    where id=p_transfer_id;
  elsif p_action = 'cancel' then
    if v_transfer.status not in ('draft','pending_approval','approved') then raise exception 'لا يمكن إلغاء تحويل بعد الشحن.'; end if;
    if coalesce(trim(p_reason),'')='' then raise exception 'سبب الإلغاء مطلوب.'; end if;
    update public.transfers set status='cancelled', cancelled_at=now(), cancelled_by=p_actor_user_id,
      cancellation_reason=trim(p_reason), updated_at=now() where id=p_transfer_id;
  elsif p_action = 'close' then
    if v_transfer.status not in ('received','variance_review') then raise exception 'يجب استلام التحويل قبل إغلاقه.'; end if;
    if exists (select 1 from public.transfer_items where transfer_id=p_transfer_id and variance_quantity<>0 and coalesce(trim(variance_reason),'')='') then
      raise exception 'سبب فرق الاستلام مطلوب لكل مادة مختلفة.';
    end if;
    update public.transfers set status='closed', closed_at=now(), closed_by=p_actor_user_id, updated_at=now()
    where id=p_transfer_id;
  else raise exception 'إجراء التحويل غير مدعوم.';
  end if;

  insert into public.audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (p_organization_id, v_transfer.from_branch_id, p_actor_user_id, 'inventory_transfer_' || p_action, 'transfer', p_transfer_id,
    jsonb_build_object('status',v_transfer.status), jsonb_build_object('reason',nullif(trim(p_reason),'')));
  return jsonb_build_object('success', true, 'duplicate', false, 'transfer_id', p_transfer_id);
end;
$$;

create or replace function public.receive_inventory_transfer_atomic(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_lines jsonb,
  p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_transfer public.transfers%rowtype; v_input record; v_item public.transfer_items%rowtype; v_has_variance boolean := false;
begin
  select * into v_transfer from public.transfers
  where id=p_transfer_id and organization_id=p_organization_id for update;
  if not found then raise exception 'التحويل غير موجود.'; end if;
  perform public.assert_transfer_actor(p_organization_id, v_transfer.to_branch_id, p_actor_user_id);
  if v_transfer.status in ('received','variance_review','closed') then
    return jsonb_build_object('success',true,'duplicate',true,'status',v_transfer.status);
  end if;
  if v_transfer.status <> 'in_transit' then raise exception 'التحويل ليس في الطريق.'; end if;
  if jsonb_typeof(p_lines)<>'array' then raise exception 'بيانات الاستلام غير صالحة.'; end if;

  for v_input in select * from jsonb_to_recordset(p_lines) as x(transfer_item_id uuid, received_quantity numeric, variance_reason text) loop
    select * into v_item from public.transfer_items
    where id=v_input.transfer_item_id and transfer_id=p_transfer_id and organization_id=p_organization_id for update;
    if not found then raise exception 'مادة التحويل غير موجودة.'; end if;
    if v_input.received_quantity is null or v_input.received_quantity<0 or v_input.received_quantity>v_item.sent_quantity then
      raise exception 'الكمية المستلمة غير صالحة.';
    end if;
    if v_input.received_quantity<>v_item.sent_quantity and coalesce(trim(v_input.variance_reason),'')='' then
      raise exception 'سبب فرق الاستلام مطلوب.';
    end if;
    if v_input.received_quantity<>v_item.sent_quantity then v_has_variance := true; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || v_transfer.to_branch_id::text || ':' || v_item.item_id::text, 0));
    insert into public.branch_stock (organization_id,branch_id,item_id,quantity,reserved_quantity,created_by)
    values (p_organization_id,v_transfer.to_branch_id,v_item.item_id,0,0,p_actor_user_id)
    on conflict (branch_id,item_id) do nothing;
    update public.branch_stock set quantity=quantity+v_input.received_quantity,updated_at=now()
    where organization_id=p_organization_id and branch_id=v_transfer.to_branch_id and item_id=v_item.item_id;
    if v_input.received_quantity>0 then
      insert into public.stock_movements (
        organization_id,branch_id,item_id,movement_type,quantity,unit_cost,source_doc_type,source_doc_id,idempotency_key,notes,created_by
      ) values (
        p_organization_id,v_transfer.to_branch_id,v_item.item_id,'transfer_in',v_input.received_quantity,v_item.unit_cost,
        'transfer',p_transfer_id,'transfer:'||p_transfer_id::text||':'||v_item.item_id::text||':receive',
        'استلام تحويل '||coalesce(v_transfer.transfer_number,p_transfer_id::text),p_actor_user_id
      ) on conflict (organization_id,idempotency_key) where idempotency_key is not null do nothing;
    end if;
    update public.transfer_items set received_quantity=v_input.received_quantity,
      variance_quantity=sent_quantity-v_input.received_quantity,variance_reason=nullif(trim(v_input.variance_reason),''),updated_at=now()
    where id=v_item.id;
  end loop;
  if exists(select 1 from public.transfer_items where transfer_id=p_transfer_id and received_quantity=0 and sent_quantity>0
    and id not in (select (x->>'transfer_item_id')::uuid from jsonb_array_elements(p_lines) x)) then
    raise exception 'يجب إدخال نتيجة استلام كل مواد التحويل.';
  end if;
  update public.transfers set status=case when v_has_variance then 'variance_review' else 'received' end,
    received_at=now(),received_by=p_actor_user_id,updated_at=now() where id=p_transfer_id;
  insert into public.audit_logs (organization_id,branch_id,user_id,action,entity_type,entity_id,new_data)
  values (p_organization_id,v_transfer.to_branch_id,p_actor_user_id,'inventory_transfer_received','transfer',p_transfer_id,
    jsonb_build_object('has_variance',v_has_variance));
  return jsonb_build_object('success',true,'duplicate',false,'transfer_id',p_transfer_id,'has_variance',v_has_variance);
end;
$$;

create or replace function public.prevent_transfer_delete() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin raise exception 'لا يمكن حذف تحويلات المخزون؛ استخدم الإلغاء قبل الشحن أو سجل تصحيح بعده.'; end;
$$;
drop trigger if exists transfers_prevent_delete on public.transfers;
create trigger transfers_prevent_delete before delete on public.transfers for each row execute function public.prevent_transfer_delete();
drop trigger if exists transfer_items_prevent_delete on public.transfer_items;
create trigger transfer_items_prevent_delete before delete on public.transfer_items for each row execute function public.prevent_transfer_delete();

revoke all on function public.assert_transfer_actor(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.create_inventory_transfer_atomic(uuid,uuid,uuid,jsonb,text,text,uuid) from public,anon,authenticated;
revoke all on function public.transition_inventory_transfer_atomic(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.receive_inventory_transfer_atomic(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.assert_transfer_actor(uuid,uuid,uuid) to service_role;
grant execute on function public.create_inventory_transfer_atomic(uuid,uuid,uuid,jsonb,text,text,uuid) to service_role;
grant execute on function public.transition_inventory_transfer_atomic(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.receive_inventory_transfer_atomic(uuid,uuid,jsonb,uuid) to service_role;
