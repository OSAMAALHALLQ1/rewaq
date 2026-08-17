-- Durable employee-code credentials, atomic throttling, and immutable login audit.
-- Review and validate on staging first. Do not apply automatically to production.

create extension if not exists "pgcrypto";

alter table public.team_invites
  add column if not exists failed_login_attempts integer not null default 0
    check (failed_login_attempts >= 0),
  add column if not exists locked_until timestamptz,
  add column if not exists last_failed_login_at timestamptz;

-- Preserve every existing employee code while removing plaintext at rest. The
-- application hashes normalized input before lookup, so accepted codes remain
-- reusable until an owner explicitly revokes them.
update public.team_invites
set invite_code = encode(extensions.digest(upper(btrim(invite_code)), 'sha256'), 'hex')
where invite_code !~ '^[0-9a-f]{64}$';

alter table public.team_invites
  alter column invite_code set default encode(
    extensions.digest(gen_random_uuid()::text || gen_random_uuid()::text, 'sha256'),
    'hex'
  );

alter table public.team_invites
  drop constraint if exists team_invites_invite_code_hash_check;

alter table public.team_invites
  add constraint team_invites_invite_code_hash_check
  check (invite_code ~ '^[0-9a-f]{64}$');

comment on column public.team_invites.invite_code is
  'SHA-256 fingerprint of the normalized reusable employee code; plaintext is returned only at issuance.';

create table if not exists public.employee_login_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  team_invite_id uuid references public.team_invites(id) on delete restrict,
  code_fingerprint text not null
    check (code_fingerprint ~ '^[0-9a-f]{64}$'),
  client_fingerprint text not null
    check (client_fingerprint ~ '^[0-9a-f]{64}$'),
  outcome text not null
    check (outcome in ('started', 'success', 'failure', 'rate_limited')),
  attempted_at timestamptz not null default now()
);

create index if not exists employee_login_attempts_client_time_idx
  on public.employee_login_attempts (client_fingerprint, attempted_at desc);

create index if not exists employee_login_attempts_code_time_idx
  on public.employee_login_attempts (code_fingerprint, attempted_at desc);

create index if not exists employee_login_attempts_invite_time_idx
  on public.employee_login_attempts (team_invite_id, attempted_at desc)
  where team_invite_id is not null;

alter table public.employee_login_attempts enable row level security;

revoke all on table public.employee_login_attempts from public, anon, authenticated;
revoke update, delete, truncate on table public.employee_login_attempts from service_role;
grant select, insert on table public.employee_login_attempts to service_role;

create or replace function public.reject_employee_login_attempt_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Employee login attempts are immutable audit records.';
end;
$$;

revoke all on function public.reject_employee_login_attempt_mutation() from public;

drop trigger if exists reject_employee_login_attempt_update
  on public.employee_login_attempts;
create trigger reject_employee_login_attempt_update
  before update on public.employee_login_attempts
  for each row execute function public.reject_employee_login_attempt_mutation();

drop trigger if exists reject_employee_login_attempt_delete
  on public.employee_login_attempts;
create trigger reject_employee_login_attempt_delete
  before delete on public.employee_login_attempts
  for each row execute function public.reject_employee_login_attempt_mutation();

comment on table public.employee_login_attempts is
  'Append-only employee-code authentication audit. Contains only one-way code and client fingerprints.';

-- Reserve an attempt before performing Auth work. The row lock and advisory
-- lock make simultaneous guesses count atomically instead of bypassing limits.
create or replace function public.begin_employee_code_login(
  p_code_hash text,
  p_client_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invite_record public.team_invites%rowtype;
  recent_client_attempts integer := 0;
  recent_code_attempts integer := 0;
  retry_after_seconds integer := 900;
begin
  p_code_hash := lower(btrim(p_code_hash));
  p_client_fingerprint := lower(btrim(p_client_fingerprint));

  if p_code_hash !~ '^[0-9a-f]{64}$'
    or p_client_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid employee login fingerprint.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_code_hash || ':' || p_client_fingerprint, 0)
  );

  select count(*)::integer
    into recent_client_attempts
  from public.employee_login_attempts attempt
  where attempt.client_fingerprint = p_client_fingerprint
    and attempt.outcome = 'started'
    and attempt.attempted_at >= now() - interval '15 minutes';

  select count(*)::integer
    into recent_code_attempts
  from public.employee_login_attempts attempt
  where attempt.code_fingerprint = p_code_hash
    and attempt.outcome = 'started'
    and attempt.attempted_at >= now() - interval '15 minutes';

  select *
    into invite_record
  from public.team_invites invite
  where invite.invite_code = p_code_hash
  for update;

  if recent_client_attempts >= 10
    or recent_code_attempts >= 5
    or (
      invite_record.id is not null
      and invite_record.locked_until is not null
      and invite_record.locked_until > now()
    ) then
    if invite_record.locked_until is not null
      and invite_record.locked_until > now() then
      retry_after_seconds := greatest(
        1,
        ceil(extract(epoch from (invite_record.locked_until - now())))::integer
      );
    end if;

    insert into public.employee_login_attempts (
      organization_id,
      team_invite_id,
      code_fingerprint,
      client_fingerprint,
      outcome
    ) values (
      invite_record.organization_id,
      invite_record.id,
      p_code_hash,
      p_client_fingerprint,
      'rate_limited'
    );

    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', retry_after_seconds
    );
  end if;

  insert into public.employee_login_attempts (
    organization_id,
    team_invite_id,
    code_fingerprint,
    client_fingerprint,
    outcome
  ) values (
    invite_record.organization_id,
    invite_record.id,
    p_code_hash,
    p_client_fingerprint,
    'started'
  );

  if invite_record.id is not null then
    update public.team_invites invite
    set failed_login_attempts = invite.failed_login_attempts + 1,
        last_failed_login_at = now(),
        locked_until = case
          when invite.failed_login_attempts + 1 >= 5
            then now() + interval '15 minutes'
          else invite.locked_until
        end
    where invite.id = invite_record.id;
  end if;

  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

revoke all on function public.begin_employee_code_login(text, text) from public, anon, authenticated;
grant execute on function public.begin_employee_code_login(text, text) to service_role;

create or replace function public.record_employee_code_login_result(
  p_code_hash text,
  p_client_fingerprint text,
  p_succeeded boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invite_record public.team_invites%rowtype;
begin
  p_code_hash := lower(btrim(p_code_hash));
  p_client_fingerprint := lower(btrim(p_client_fingerprint));

  if p_code_hash !~ '^[0-9a-f]{64}$'
    or p_client_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid employee login fingerprint.';
  end if;

  select *
    into invite_record
  from public.team_invites invite
  where invite.invite_code = p_code_hash
  for update;

  insert into public.employee_login_attempts (
    organization_id,
    team_invite_id,
    code_fingerprint,
    client_fingerprint,
    outcome
  ) values (
    invite_record.organization_id,
    invite_record.id,
    p_code_hash,
    p_client_fingerprint,
    case when p_succeeded then 'success' else 'failure' end
  );

  if p_succeeded and invite_record.id is not null then
    update public.team_invites
    set failed_login_attempts = 0,
        locked_until = null,
        last_failed_login_at = null
    where id = invite_record.id;
  end if;
end;
$$;

revoke all on function public.record_employee_code_login_result(text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.record_employee_code_login_result(text, text, boolean)
  to service_role;

-- Keep the established RPC name/signature, but it now receives a normalized
-- SHA-256 fingerprint rather than the plaintext code.
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
  p_invite_code := lower(btrim(p_invite_code));

  if p_user_id is null or p_invite_code !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid employee login request.';
  end if;

  select *
    into invite_record
  from public.team_invites invite
  where invite.invite_code = p_invite_code
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
      last_used_at = now(),
      failed_login_attempts = 0,
      locked_until = null,
      last_failed_login_at = null
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

revoke all on function public.accept_team_invite_by_code(text, uuid)
  from public, anon, authenticated;
grant execute on function public.accept_team_invite_by_code(text, uuid)
  to service_role;

comment on function public.begin_employee_code_login(text, text) is
  'Atomically reserves and rate-limits an employee-code login without revealing whether a code exists.';
comment on function public.record_employee_code_login_result(text, text, boolean) is
  'Appends an immutable login result and clears a lock only after successful authentication.';
comment on function public.accept_team_invite_by_code(text, uuid) is
  'Atomically accepts or reuses a permanent employee credential identified by its SHA-256 fingerprint.';

-- Staging validation (read-only):
-- select count(*) from public.team_invites where invite_code !~ '^[0-9a-f]{64}$';
-- select id, status, failed_login_attempts, locked_until from public.team_invites order by created_at desc limit 20;
-- select outcome, count(*) from public.employee_login_attempts group by outcome;
-- select public.begin_employee_code_login(repeat('a', 64), repeat('b', 64));
--
-- Forward-correction plan: keep the new columns/table (audit data is never
-- deleted), deploy the prior application login flow only if necessary, and
-- restore the RPC body from migration 049 while continuing hash lookups.
