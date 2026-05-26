-- Migration: 009_fix_rls_infinite_recursion
-- Description: Redefines key security functions as plpgsql instead of sql to prevent planner inlining, resolving infinite recursion loops in RLS.

-- 1. Redefine is_super_admin()
create or replace function public.is_super_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1
    from organization_memberships
    where user_id = auth.uid()
      and role = 'super_admin'
  ) into is_admin;
  return coalesce(is_admin, false);
end;
$$;

-- 2. Redefine is_org_member()
create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  is_member boolean;
begin
  select exists (
    select 1
    from organization_memberships
    where organization_id = target_org_id
      and user_id = auth.uid()
  ) into is_member;
  
  if coalesce(is_member, false) then
    return true;
  end if;
  
  return public.is_super_admin();
end;
$$;

-- 3. Redefine can_access_branch()
create or replace function public.can_access_branch(target_org_id uuid, target_branch_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_access boolean;
begin
  select exists (
    select 1
    from organization_memberships
    where organization_id = target_org_id
      and user_id = auth.uid()
      and (
        role in ('organization_owner', 'inventory_manager', 'purchasing_manager', 'chef', 'marketing_manager', 'accountant')
        or branch_id is null
        or branch_id = target_branch_id
      )
  ) into has_access;
  
  if coalesce(has_access, false) then
    return true;
  end if;
  
  return public.is_super_admin();
end;
$$;
