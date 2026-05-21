-- Admin User Seed Data
-- This file creates the admin user profile and assigns super_admin role
-- Prerequisites: The auth.users entry must be created via Supabase Auth/Admin API
-- Email: osama.alhallq.14@gmail.com
-- The actual user creation should be done via: 
-- 1. Supabase Dashboard > Authentication > Users > "Add User"
-- 2. Or via Admin API with proper credentials

-- After creating the auth user with email: osama.alhallq.14@gmail.com
-- Run these commands to complete the admin setup:

-- 1. Create admin profile (replace {admin-user-uuid} with actual user ID from auth.users)
insert into profiles (id, full_name, locale)
select id, 'Osama Alhallq', 'ar'
from auth.users
where email = 'osama.alhallq.14@gmail.com'
  and not exists (select 1 from profiles where id = auth.users.id)
on conflict (id) do update set full_name = 'Osama Alhallq';

-- 2. Create admin organization
insert into organizations (id, name, slug, plan, status, created_by)
select gen_random_uuid(), 'Admin Organization', 'admin-org', 'scale', 'active', id
from auth.users
where email = 'osama.alhallq.14@gmail.com'
  and not exists (
    select 1 from organizations 
    where name = 'Admin Organization'
  )
limit 1;

-- 3. Add admin to organization_memberships with super_admin role
insert into organization_memberships (organization_id, user_id, role, created_by)
select 
  (select id from organizations where slug = 'admin-org' limit 1),
  id,
  'super_admin'::app_role,
  id
from auth.users
where email = 'osama.alhallq.14@gmail.com'
  and not exists (
    select 1 from organization_memberships
    where user_id = auth.users.id
      and role = 'super_admin'::app_role
  )
limit 1;

-- Verify admin user was created
select 
  u.id,
  u.email,
  p.full_name,
  om.role,
  o.name as organization
from auth.users u
left join profiles p on u.id = p.id
left join organization_memberships om on u.id = om.user_id
left join organizations o on om.organization_id = o.id
where u.email = 'osama.alhallq.14@gmail.com';
