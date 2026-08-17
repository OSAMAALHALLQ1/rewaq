-- Forward corrections found by `supabase db lint` after migration 061.

create or replace function public.apply_stock_movement(
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
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_stock_id uuid;
  v_current_qty numeric;
  v_new_qty numeric;
  v_movement_id uuid;
begin
  if p_idempotency_key is not null and exists (
    select 1 from public.stock_movements
    where organization_id=p_org_id and idempotency_key=p_idempotency_key
  ) then
    return jsonb_build_object('success',true,'duplicate',true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text||':'||p_branch_id::text||':'||p_item_id::text,0));
  select id,quantity into v_stock_id,v_current_qty from public.branch_stock
  where organization_id=p_org_id and branch_id=p_branch_id and item_id=p_item_id for update;
  if not found then
    insert into public.branch_stock (organization_id,branch_id,item_id,quantity,reserved_quantity,created_by)
    values (p_org_id,p_branch_id,p_item_id,0,0,p_created_by)
    returning id,quantity into v_stock_id,v_current_qty;
  end if;
  v_new_qty:=v_current_qty+p_quantity;
  update public.branch_stock set quantity=v_new_qty,updated_at=now() where id=v_stock_id;
  insert into public.stock_movements (
    organization_id,branch_id,item_id,movement_type,quantity,unit_cost,
    source_doc_type,idempotency_key,notes,created_by
  ) values (
    p_org_id,p_branch_id,p_item_id,p_movement_type::public.stock_movement_type,p_quantity,p_unit_cost,
    coalesce(nullif(btrim(p_reference),''),'manual_adjustment'),p_idempotency_key,p_notes,p_created_by
  ) returning id into v_movement_id;
  return jsonb_build_object('success',true,'duplicate',false,'new_quantity',v_new_qty,'movement_id',v_movement_id);
end;
$$;

revoke all on function public.apply_stock_movement(uuid,uuid,uuid,text,numeric,numeric,text,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.apply_stock_movement(uuid,uuid,uuid,text,numeric,numeric,text,text,text,uuid)
  to service_role;

do $fix_receipt_status$
declare v_oid oid; v_definition text;
begin
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='record_purchase_receipt_atomic'
    and pg_get_function_identity_arguments(p.oid)=
      'p_organization_id uuid, p_purchase_order_id uuid, p_received_at date, p_lines jsonb, p_notes text, p_idempotency_key text, p_created_by uuid';
  if v_oid is null then raise exception 'record_purchase_receipt_atomic was not found'; end if;
  v_definition:=pg_get_functiondef(v_oid);
  v_definition:=regexp_replace(
    v_definition,
    '(\mstatus\M[[:space:]]*=[[:space:]]*)(case when coalesce\(v_all_received, false\) then ''received'' else ''partially_received'' end)',
    '\1(\2)::public.purchase_order_status',
    'g'
  );
  if position('::public.purchase_order_status' in v_definition)=0 then
    raise exception 'purchase receipt status cast patch did not match';
  end if;
  execute v_definition;
end;
$fix_receipt_status$;
