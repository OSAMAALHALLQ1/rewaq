-- Admin User Setup Migration
-- This migration sets up the admin profile after the user is created via Auth

-- Create admin profile
do $$
begin
  -- Insert profile for admin user if it doesn't exist
  insert into profiles (id, full_name, locale)
  select id, 'Osama Alhallq', 'ar'
  from auth.users
  where email = 'osama.alhallq.14@gmail.com'
    and not exists (select 1 from profiles where id = auth.users.id)
  on conflict (id) do update set full_name = 'Osama Alhallq';

  -- Create admin organization
  insert into organizations (id, name, slug, plan, status, created_by)
  select gen_random_uuid(), 'Admin Organization', 'admin-org', 'scale', 'active', id
  from auth.users
  where email = 'osama.alhallq.14@gmail.com'
    and not exists (
      select 1 from organizations 
      where name = 'Admin Organization'
    )
  limit 1;

  -- Add admin to organization with super_admin role
  insert into organization_memberships (organization_id, user_id, role, created_by)
  select 
    (select id from organizations where slug = 'admin-org' limit 1),
    id,
    'super_admin'::app_role,
    id
  from auth.users
  where email = 'osama.alhallq.14@gmail.com'
    and (select id from organizations where slug = 'admin-org' limit 1) is not null
  on conflict (organization_id, user_id)
  do update set role = 'super_admin'::app_role;
end $$;
