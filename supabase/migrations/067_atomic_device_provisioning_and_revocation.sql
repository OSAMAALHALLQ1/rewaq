-- Make general device provisioning and revocation atomic and audited. Raw
-- device credentials never enter PostgreSQL; callers provide SHA-256 hashes.
-- Review on staging before applying to production.

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
    select 1
    from public.organization_memberships membership
    where membership.user_id = p_actor_user_id
      and (
        membership.role = 'super_admin'
        or (membership.organization_id = p_organization_id and membership.role = 'organization_owner')
      )
      and membership.is_active
  ) then
    raise exception 'Device provisioning is restricted to the organization owner.';
  end if;

  if p_branch_id is null or not exists (
    select 1 from public.branches branch
    where branch.id = p_branch_id
      and branch.organization_id = p_organization_id
      and branch.status = 'active'
  ) then
    raise exception 'A valid active branch is required.';
  end if;

  if nullif(btrim(p_device_name), '') is null or char_length(btrim(p_device_name)) > 120 then
    raise exception 'A valid device name is required.';
  end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid device key fingerprint.';
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

create or replace function public.revoke_department_device_atomic(
  p_organization_id uuid,
  p_device_id uuid,
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
    select 1
    from public.organization_memberships membership
    where membership.user_id = p_actor_user_id
      and (
        membership.role = 'super_admin'
        or (membership.organization_id = p_organization_id and membership.role = 'organization_owner')
      )
      and membership.is_active
  ) then
    raise exception 'Device revocation is restricted to the organization owner.';
  end if;

  select * into v_device
  from public.department_api_keys device
  where device.id = p_device_id
    and device.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Device not found.';
  end if;
  if not v_device.is_active then
    return jsonb_build_object('success', true, 'already_revoked', true);
  end if;

  update public.department_api_keys
     set is_active = false,
         updated_at = now()
   where id = v_device.id;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    p_organization_id, v_device.branch_id, p_actor_user_id,
    'department_device_revoked', 'department_api_key', v_device.id,
    jsonb_build_object('is_active', true, 'device_name', v_device.device_name),
    jsonb_build_object('is_active', false, 'device_name', v_device.device_name)
  );

  return jsonb_build_object('success', true, 'already_revoked', false);
end;
$$;

revoke all on function public.revoke_department_device_atomic(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_department_device_atomic(uuid, uuid, uuid)
  to service_role;

-- Validation queries (read-only):
-- select id, device_name, is_active, key_hash is not null as has_hash from public.department_api_keys order by created_at desc;
-- select action, entity_id from public.audit_logs where action in ('department_device_provisioned','department_device_revoked') order by created_at desc;
--
-- Forward correction: retain all devices and audit rows. Restore the prior
-- application route only if needed; never delete provisioning/revocation audit.
