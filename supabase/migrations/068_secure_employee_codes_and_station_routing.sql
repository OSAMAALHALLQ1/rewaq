-- Secure owner-visible employee codes, editable operational sections, and
-- explicit menu-item routing to KDS stations. Review on staging before
-- applying to production; this migration never deletes operational history.

alter table public.team_invites
  add column if not exists employee_code_ciphertext text;

comment on column public.team_invites.employee_code_ciphertext is
  'AES-256-GCM ciphertext for owner-only code recovery. The encryption key remains server-side and is never stored in PostgreSQL.';

create table if not exists public.catalog_item_kitchen_routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  catalog_item_id uuid not null,
  station_id uuid not null,
  is_active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_item_kitchen_routes_branch_fk
    foreign key (organization_id, branch_id)
    references public.branches(organization_id, id) on delete restrict,
  constraint catalog_item_kitchen_routes_catalog_fk
    foreign key (organization_id, catalog_item_id)
    references public.catalog_items(organization_id, id) on delete restrict,
  constraint catalog_item_kitchen_routes_station_fk
    foreign key (organization_id, branch_id, station_id)
    references public.kitchen_stations(organization_id, branch_id, id) on delete restrict,
  constraint catalog_item_kitchen_routes_unique
    unique (organization_id, branch_id, catalog_item_id)
);

create index if not exists catalog_item_kitchen_routes_station_idx
  on public.catalog_item_kitchen_routes (organization_id, branch_id, station_id)
  where is_active;

drop trigger if exists prevent_catalog_item_kitchen_routes_delete
  on public.catalog_item_kitchen_routes;
create trigger prevent_catalog_item_kitchen_routes_delete
before delete on public.catalog_item_kitchen_routes
for each row execute function public.prevent_restaurant_order_hard_delete();

drop trigger if exists set_catalog_item_kitchen_routes_updated_at
  on public.catalog_item_kitchen_routes;
create trigger set_catalog_item_kitchen_routes_updated_at
before update on public.catalog_item_kitchen_routes
for each row execute function public.set_updated_at();

alter table public.catalog_item_kitchen_routes enable row level security;

drop policy if exists "catalog_item_kitchen_routes_branch_read"
  on public.catalog_item_kitchen_routes;
create policy "catalog_item_kitchen_routes_branch_read"
on public.catalog_item_kitchen_routes for select to authenticated
using (public.can_access_branch(organization_id, branch_id));

revoke all on table public.catalog_item_kitchen_routes from anon, authenticated, service_role;
grant select on table public.catalog_item_kitchen_routes to authenticated, service_role;
grant insert, update on table public.catalog_item_kitchen_routes to service_role;

create or replace function public.upsert_catalog_item_kitchen_route_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_catalog_item_id uuid,
  p_station_id uuid,
  p_is_active boolean,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_route_id uuid;
  v_old jsonb;
begin
  perform public.assert_restaurant_order_actor(
    p_organization_id, p_branch_id, p_actor_user_id, null, 'manage_station'
  );

  if not exists (
    select 1 from public.catalog_items item
    where item.id = p_catalog_item_id
      and item.organization_id = p_organization_id
      and (item.branch_id is null or item.branch_id = p_branch_id)
      and item.status = 'active'
  ) then
    raise exception 'الصنف غير موجود أو غير متاح في هذا القسم.';
  end if;

  if not exists (
    select 1 from public.kitchen_stations station
    where station.id = p_station_id
      and station.organization_id = p_organization_id
      and station.branch_id = p_branch_id
      and station.is_active
  ) then
    raise exception 'قسم التحضير غير موجود أو غير نشط.';
  end if;

  select to_jsonb(route) into v_old
  from public.catalog_item_kitchen_routes route
  where route.organization_id = p_organization_id
    and route.branch_id = p_branch_id
    and route.catalog_item_id = p_catalog_item_id
  for update;

  insert into public.catalog_item_kitchen_routes (
    organization_id, branch_id, catalog_item_id, station_id,
    is_active, created_by_user_id
  ) values (
    p_organization_id, p_branch_id, p_catalog_item_id, p_station_id,
    coalesce(p_is_active, true), p_actor_user_id
  )
  on conflict (organization_id, branch_id, catalog_item_id) do update
    set station_id = excluded.station_id,
        is_active = excluded.is_active,
        updated_at = now()
  returning id into v_route_id;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type,
    entity_id, old_data, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id,
    'catalog_item_kitchen_route_upserted', 'catalog_item_kitchen_route',
    v_route_id, v_old,
    jsonb_build_object(
      'catalog_item_id', p_catalog_item_id,
      'station_id', p_station_id,
      'is_active', coalesce(p_is_active, true)
    )
  );

  return jsonb_build_object('success', true, 'route_id', v_route_id);
end;
$$;

revoke all on function public.upsert_catalog_item_kitchen_route_atomic(
  uuid, uuid, uuid, uuid, boolean, uuid
) from public, anon, authenticated;
grant execute on function public.upsert_catalog_item_kitchen_route_atomic(
  uuid, uuid, uuid, uuid, boolean, uuid
) to service_role;

create or replace function public.upsert_branch_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_name text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_branch_id uuid;
  v_old jsonb;
begin
  if not exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = p_actor_user_id
      and membership.is_active
      and (
        membership.role = 'super_admin'
        or (membership.organization_id = p_organization_id and membership.role = 'organization_owner')
      )
  ) then
    raise exception 'إدارة الأقسام متاحة لمالك المؤسسة فقط.';
  end if;

  if nullif(btrim(p_name), '') is null or char_length(btrim(p_name)) > 120 then
    raise exception 'اسم القسم مطلوب وبحد أقصى 120 حرفاً.';
  end if;

  if p_branch_id is null then
    insert into public.branches (organization_id, name, status, created_by)
    values (p_organization_id, btrim(p_name), 'active', p_actor_user_id)
    returning id into v_branch_id;
  else
    select to_jsonb(branch) into v_old
    from public.branches branch
    where branch.id = p_branch_id and branch.organization_id = p_organization_id
    for update;
    if v_old is null then
      raise exception 'القسم غير موجود داخل المؤسسة.';
    end if;

    update public.branches
       set name = btrim(p_name), updated_at = now()
     where id = p_branch_id and organization_id = p_organization_id
    returning id into v_branch_id;
  end if;

  insert into public.audit_logs (
    organization_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    p_organization_id, p_actor_user_id,
    case when p_branch_id is null then 'branch_created' else 'branch_updated' end,
    'branch', v_branch_id, v_old, jsonb_build_object('name', btrim(p_name))
  );

  return jsonb_build_object('success', true, 'branch_id', v_branch_id);
end;
$$;

revoke all on function public.upsert_branch_atomic(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.upsert_branch_atomic(uuid, uuid, text, uuid)
  to service_role;

-- Versioned workflow provisioning: KDS must select one explicit station;
-- waiter and Expo are branch-wide and intentionally receive no station row.
create or replace function public.provision_restaurant_workflow_device_v2_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_station_id uuid,
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
  v_modules text[];
begin
  perform public.assert_restaurant_order_actor(
    p_organization_id, p_branch_id, p_actor_user_id, null, 'manage_station'
  );

  if nullif(btrim(p_device_name), '') is null or char_length(btrim(p_device_name)) > 120 then
    raise exception 'اسم الجهاز مطلوب وبحد أقصى 120 حرفاً.';
  end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'بصمة مفتاح الجهاز غير صالحة.';
  end if;

  select coalesce(array_agg(distinct module_name order by module_name), '{}'::text[])
    into v_modules
  from unnest(coalesce(p_allowed_modules, '{}'::text[])) as modules(module_name)
  where module_name in ('waiter', 'kitchen', 'expo');

  if cardinality(v_modules) <> 1 then
    raise exception 'اختر واجهة تشغيل واحدة فقط للجهاز.';
  end if;
  if v_modules = array['kitchen']::text[] and p_role::text <> 'chef' then
    raise exception 'شاشة KDS تستخدم دور الشيف.';
  end if;
  if v_modules <> array['kitchen']::text[] and p_role::text <> 'staff' then
    raise exception 'شاشة النادل أو Expo تستخدم دور الموظف.';
  end if;
  if v_modules = array['kitchen']::text[] then
    if p_station_id is null or not exists (
      select 1 from public.kitchen_stations station
      where station.id = p_station_id
        and station.organization_id = p_organization_id
        and station.branch_id = p_branch_id
        and station.is_active
    ) then
      raise exception 'اختر قسم تحضير نشطاً لشاشة KDS.';
    end if;
  elsif p_station_id is not null then
    raise exception 'محطة التحضير تخصص لشاشة KDS فقط.';
  end if;

  insert into public.department_api_keys (
    organization_id, branch_id, device_name, key_hash, role,
    allowed_modules, is_active, created_by
  ) values (
    p_organization_id, p_branch_id, btrim(p_device_name), p_key_hash, p_role,
    v_modules, true, p_actor_user_id
  ) returning * into v_device;

  if v_modules = array['kitchen']::text[] then
    perform public.assign_kitchen_station_device_atomic(
      p_organization_id, p_branch_id, p_station_id, v_device.id, true, p_actor_user_id
    );
  end if;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id,
    'restaurant_workflow_device_provisioned', 'department_api_key', v_device.id,
    jsonb_build_object(
      'device_name', v_device.device_name,
      'role', v_device.role,
      'allowed_modules', v_device.allowed_modules,
      'station_id', p_station_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'device', jsonb_build_object(
      'id', v_device.id,
      'device_name', v_device.device_name,
      'role', v_device.role,
      'allowed_modules', v_device.allowed_modules
    ),
    'station_id', p_station_id
  );
end;
$$;

revoke all on function public.provision_restaurant_workflow_device_v2_atomic(
  uuid, uuid, uuid, text, text, public.app_role, text[], uuid
) from public, anon, authenticated;
grant execute on function public.provision_restaurant_workflow_device_v2_atomic(
  uuid, uuid, uuid, text, text, public.app_role, text[], uuid
) to service_role;

revoke all on function public.provision_restaurant_workflow_device_atomic(
  uuid, uuid, text, text, public.app_role, text[], uuid
) from authenticated;

-- General devices may omit branch only for the central accountant profile.
create or replace function public.provision_department_device_atomic(
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
begin
  if not exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = p_actor_user_id
      and membership.is_active
      and (
        membership.role = 'super_admin'
        or (membership.organization_id = p_organization_id and membership.role = 'organization_owner')
      )
  ) then
    raise exception 'إدارة الأجهزة متاحة لمالك المؤسسة فقط.';
  end if;

  if p_role::text = 'accountant' then
    if p_allowed_modules <> array['accounting']::text[] then
      raise exception 'جهاز المحاسب مخصص للمحاسبة فقط.';
    end if;
  elsif p_branch_id is null then
    raise exception 'اختر نطاق التشغيل لهذا الجهاز.';
  end if;

  if p_branch_id is not null and not exists (
    select 1 from public.branches branch
    where branch.id = p_branch_id
      and branch.organization_id = p_organization_id
      and branch.status = 'active'
  ) then
    raise exception 'نطاق التشغيل غير موجود أو غير نشط.';
  end if;
  if nullif(btrim(p_device_name), '') is null or char_length(btrim(p_device_name)) > 120 then
    raise exception 'اسم الجهاز مطلوب وبحد أقصى 120 حرفاً.';
  end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'بصمة مفتاح الجهاز غير صالحة.';
  end if;

  insert into public.department_api_keys (
    organization_id, branch_id, device_name, key_hash, role,
    allowed_modules, is_active, created_by
  ) values (
    p_organization_id, p_branch_id, btrim(p_device_name), p_key_hash, p_role,
    p_allowed_modules, true, p_actor_user_id
  ) returning * into v_device;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id,
    'department_device_provisioned', 'department_api_key', v_device.id,
    jsonb_build_object(
      'device_name', v_device.device_name,
      'role', v_device.role,
      'allowed_modules', v_device.allowed_modules
    )
  );

  return jsonb_build_object(
    'success', true,
    'device', jsonb_build_object(
      'id', v_device.id,
      'device_name', v_device.device_name,
      'role', v_device.role,
      'allowed_modules', v_device.allowed_modules
    )
  );
end;
$$;

revoke all on function public.provision_department_device_atomic(
  uuid, uuid, text, text, public.app_role, text[], uuid
) from public, anon, authenticated;
grant execute on function public.provision_department_device_atomic(
  uuid, uuid, text, text, public.app_role, text[], uuid
) to service_role;

-- Validation (read-only):
-- select id, full_name, employee_code_ciphertext is not null as owner_can_recover from public.team_invites;
-- select branch_id, catalog_item_id, station_id, is_active from public.catalog_item_kitchen_routes;
-- select action, entity_type, entity_id from public.audit_logs where action in ('branch_created','branch_updated','catalog_item_kitchen_route_upserted','restaurant_workflow_device_provisioned') order by created_at desc;
--
-- Forward correction: deactivate an incorrect route or device through its
-- audited update/revoke workflow, then create the corrected mapping. Never
-- delete route, device, order, inventory, financial, or audit history.
