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
