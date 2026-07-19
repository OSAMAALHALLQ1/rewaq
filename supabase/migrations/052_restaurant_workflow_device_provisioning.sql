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
