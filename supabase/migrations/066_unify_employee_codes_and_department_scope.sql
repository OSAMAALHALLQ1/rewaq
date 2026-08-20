-- Unify employee access around team_invites, the credential source consumed by
-- employeeCodeLoginAction. Legacy staff_members rows are preserved and migrated
-- forward; no employee, audit, financial, or inventory record is deleted.
-- Review on staging before applying to production.

create extension if not exists "pgcrypto";

alter table public.organization_memberships
  add column if not exists department_id uuid references public.departments(id) on delete restrict,
  add column if not exists permissions text[] not null default '{}'::text[],
  add column if not exists is_active boolean not null default true;

alter table public.team_invites
  add column if not exists full_name text,
  add column if not exists code_hint text,
  add column if not exists department_id uuid references public.departments(id) on delete restrict,
  add column if not exists permissions text[] not null default '{}'::text[],
  add column if not exists code_issued_at timestamptz;

alter table public.team_invites
  drop constraint if exists team_invites_full_name_length_check;

alter table public.team_invites
  add constraint team_invites_full_name_length_check
  check (full_name is null or char_length(btrim(full_name)) between 2 and 120);

create index if not exists organization_memberships_department_idx
  on public.organization_memberships (organization_id, department_id)
  where department_id is not null;

create index if not exists team_invites_department_idx
  on public.team_invites (organization_id, department_id)
  where department_id is not null;

create or replace function public.validate_employee_department_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_department_branch_id uuid;
  v_department_org_id uuid;
begin
  if new.department_id is null then
    return new;
  end if;

  select d.branch_id, b.organization_id
    into v_department_branch_id, v_department_org_id
  from public.departments d
  join public.branches b on b.id = d.branch_id
  where d.id = new.department_id;

  if v_department_org_id is null
    or v_department_org_id <> new.organization_id
    or (new.branch_id is not null and v_department_branch_id <> new.branch_id) then
    raise exception 'Employee department must belong to the selected organization and branch.';
  end if;

  if new.branch_id is null then
    new.branch_id := v_department_branch_id;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_employee_department_scope() from public;

drop trigger if exists validate_team_invite_department_scope on public.team_invites;
create trigger validate_team_invite_department_scope
  before insert or update of organization_id, branch_id, department_id
  on public.team_invites
  for each row execute function public.validate_employee_department_scope();

drop trigger if exists validate_membership_department_scope on public.organization_memberships;
create trigger validate_membership_department_scope
  before insert or update of organization_id, branch_id, department_id
  on public.organization_memberships
  for each row execute function public.validate_employee_department_scope();

-- The accepted invite remains the single source of truth for the employee's
-- role and scope. This also upgrades the existing acceptance RPC without
-- replacing its security-sensitive implementation from migration 057.
create or replace function public.sync_team_invite_access_to_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.accepted_user_id is not null then
    update public.organization_memberships
       set role = new.role,
           branch_id = new.branch_id,
           department_id = new.department_id,
           permissions = new.permissions,
           is_active = new.revoked_at is null and new.status = 'accepted',
           updated_at = now()
     where organization_id = new.organization_id
       and user_id = new.accepted_user_id
       and role not in ('organization_owner', 'super_admin');

    if nullif(btrim(new.full_name), '') is not null then
      update public.profiles
         set full_name = btrim(new.full_name),
             updated_at = now()
       where id = new.accepted_user_id;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_team_invite_access_to_membership() from public;

drop trigger if exists sync_team_invite_access_to_membership on public.team_invites;
create trigger sync_team_invite_access_to_membership
  after insert or update of status, accepted_user_id, role, branch_id, department_id, permissions, full_name, revoked_at
  on public.team_invites
  for each row execute function public.sync_team_invite_access_to_membership();

-- Preserve and activate codes previously created by the disconnected
-- staff_members UI. Their operational roles are mapped to the canonical app
-- roles already enforced by route access and RLS.
insert into public.team_invites (
  organization_id,
  email,
  invite_code,
  role,
  branch_id,
  status,
  expires_at,
  created_at,
  created_by,
  full_name,
  code_hint,
  code_issued_at,
  revoked_at
)
select
  staff.organization_id,
  'staff-' || staff.id::text || '@employees.rewaq.internal',
  encode(extensions.digest(upper(btrim(staff.login_code)), 'sha256'), 'hex'),
  case staff.role
    when 'cashier' then 'cashier'::public.app_role
    when 'kitchen' then 'chef'::public.app_role
    when 'bar' then 'chef'::public.app_role
    when 'shisha' then 'chef'::public.app_role
    when 'manager' then 'branch_manager'::public.app_role
    else 'staff'::public.app_role
  end,
  staff.branch_id,
  case when staff.is_active then 'pending' else 'revoked' end,
  now() + interval '30 days',
  staff.created_at,
  staff.created_by,
  staff.full_name,
  '****' || right(upper(btrim(staff.login_code)), 4),
  coalesce(staff.created_at, now()),
  case when staff.is_active then null else now() end
from public.staff_members staff
where nullif(btrim(staff.login_code), '') is not null
on conflict do nothing;

-- Legacy rows are kept for traceability, but plaintext credentials must not
-- remain recoverable after their fingerprints have been migrated.
update public.staff_members
set login_code = encode(extensions.digest(upper(btrim(login_code)), 'sha256'), 'hex'),
    updated_at = now()
where login_code !~ '^[0-9a-f]{64}$';

comment on table public.staff_members is
  'Legacy employee records retained for history. Authentication is handled exclusively by team_invites.';
comment on column public.team_invites.invite_code is
  'SHA-256 fingerprint of the reusable personal employee code. Plaintext is shown only when issued or rotated.';
comment on column public.team_invites.code_hint is
  'Non-sensitive last-four hint displayed to owners; never sufficient for authentication.';
comment on column public.team_invites.permissions is
  'Optional per-employee capability overrides. Empty means use the canonical role template.';

-- Revocation must apply at the RLS layer too, not only in the UI/session helper.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = auth.uid()
      and membership.role = 'super_admin'
      and membership.is_active
  );
$$;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = target_org_id
      and membership.user_id = auth.uid()
      and membership.is_active
  );
$$;

create or replace function public.is_org_owner(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = target_org_id
      and membership.user_id = auth.uid()
      and membership.role = 'organization_owner'
      and membership.is_active
  );
$$;

create or replace function public.has_org_role(
  target_org_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = target_org_id
      and membership.user_id = auth.uid()
      and membership.role = any (allowed_roles)
      and membership.is_active
  );
$$;

create or replace function public.can_access_branch(
  target_org_id uuid,
  target_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = target_org_id
      and membership.user_id = auth.uid()
      and membership.is_active
      and (
        membership.role = 'organization_owner'
        or membership.branch_id is null
        or membership.branch_id = target_branch_id
      )
  );
$$;

revoke all on function public.is_super_admin() from public;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_owner(uuid) from public;
revoke all on function public.has_org_role(uuid, public.app_role[]) from public;
revoke all on function public.can_access_branch(uuid, uuid) from public;
grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.is_org_owner(uuid) to authenticated, service_role;
grant execute on function public.has_org_role(uuid, public.app_role[]) to authenticated, service_role;
grant execute on function public.can_access_branch(uuid, uuid) to authenticated, service_role;

-- Validation queries (read-only):
-- select count(*) from public.staff_members where login_code !~ '^[0-9a-f]{64}$';
-- select id, full_name, role, branch_id, department_id, code_hint, status from public.team_invites order by created_at desc;
-- select organization_id, user_id, role, branch_id, department_id from public.organization_memberships where department_id is not null;
--
-- Forward correction: keep all added columns and migrated records. Disable the
-- sync triggers only if a reviewed application rollback requires the previous
-- membership behavior; never restore plaintext employee codes.
