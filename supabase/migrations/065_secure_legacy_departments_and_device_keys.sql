-- Secure legacy department tables and retire plaintext device credentials.
-- The current device flow uses organization-scoped SHA-256 key hashes only.

-- Avoid recursive organization_memberships policies. Policy helpers must be
-- SECURITY DEFINER so their membership lookup is not evaluated through the
-- table's own RLS policy again.
create or replace function public.is_org_owner(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = target_org_id
      and om.user_id = auth.uid()
      and om.role = 'organization_owner'
  );
$$;

revoke all on function public.is_org_owner(uuid) from public;
grant execute on function public.is_org_owner(uuid) to authenticated, service_role;

drop policy if exists "memberships managed by owners" on public.organization_memberships;
create policy "memberships managed by owners" on public.organization_memberships
  for all to authenticated
  using (public.is_super_admin() or public.is_org_owner(organization_id))
  with check (public.is_super_admin() or public.is_org_owner(organization_id));

alter table public.departments enable row level security;
alter table public.department_members enable row level security;

drop policy if exists "departments scoped read" on public.departments;
create policy "departments scoped read" on public.departments
  for select to authenticated
  using (
    exists (
      select 1
      from public.branches b
      where b.id = departments.branch_id
        and public.can_access_branch(b.organization_id, b.id)
    )
  );

drop policy if exists "departments owner write" on public.departments;
create policy "departments owner write" on public.departments
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.branches b
      where b.id = departments.branch_id
        and public.is_org_owner(b.organization_id)
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1
      from public.branches b
      where b.id = departments.branch_id
        and public.is_org_owner(b.organization_id)
    )
  );

drop policy if exists "department members owner read" on public.department_members;
create policy "department members owner read" on public.department_members
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.departments d
      join public.branches b on b.id = d.branch_id
      where d.id = department_members.department_id
        and public.is_org_owner(b.organization_id)
    )
  );

drop policy if exists "department members owner write" on public.department_members;
create policy "department members owner write" on public.department_members
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.departments d
      join public.branches b on b.id = d.branch_id
      where d.id = department_members.department_id
        and public.is_org_owner(b.organization_id)
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1
      from public.departments d
      join public.branches b on b.id = d.branch_id
      where d.id = department_members.department_id
        and public.is_org_owner(b.organization_id)
    )
  );

-- Authenticated organization members must not be able to read device hashes.
-- Device management is performed through server routes after capability checks.
drop policy if exists "Org members read keys" on public.department_api_keys;
drop policy if exists "Owners manage keys" on public.department_api_keys;
create policy "Owners manage keys" on public.department_api_keys
  for all to authenticated
  using (public.is_super_admin() or public.is_org_owner(organization_id))
  with check (public.is_super_admin() or public.is_org_owner(organization_id));

-- Preserve legacy rows while converting and clearing any plaintext credentials.
update public.department_api_keys
set key_hash = coalesce(
      key_hash,
      encode(extensions.digest(upper(trim("key")), 'sha256'), 'hex')
    ),
    "key" = null,
    updated_at = now()
where "key" is not null;

alter table public.department_api_keys
  drop constraint if exists department_api_keys_no_plaintext_key_check;

alter table public.department_api_keys
  add constraint department_api_keys_no_plaintext_key_check
  check ("key" is null);

-- Validation queries:
-- select relname, relrowsecurity from pg_class where relname in ('departments', 'department_members');
-- select count(*) from public.department_api_keys where "key" is not null;
-- select policyname from pg_policies where schemaname = 'public' and tablename in ('departments', 'department_members', 'department_api_keys');

-- Forward correction: drop the check only if an audited legacy integration must
-- temporarily write plaintext keys again. Existing values are intentionally not restored.
