alter table public.profiles
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists role text not null default 'user',
  add column if not exists status text not null default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check check (status in ('pending', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('user', 'admin', 'super_admin'));
  end if;
end $$;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    status,
    locale
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    lower(new.email),
    nullif(new.raw_user_meta_data->>'phone', ''),
    coalesce(nullif(new.raw_user_meta_data->>'profile_role', ''), 'user'),
    coalesce(nullif(new.raw_user_meta_data->>'profile_status', ''), 'pending'),
    'ar'
  )
  on conflict (id) do update
    set full_name = coalesce(public.profiles.full_name, excluded.full_name),
        email = coalesce(public.profiles.email, excluded.email),
        phone = coalesce(public.profiles.phone, excluded.phone),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_profile();

update public.profiles p
set email = lower(u.email),
    full_name = coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    phone = coalesce(p.phone, nullif(u.raw_user_meta_data->>'phone', '')),
    status = coalesce(nullif(p.status, ''), 'pending'),
    role = coalesce(nullif(p.role, ''), 'user')
from auth.users u
where p.id = u.id;

update public.profiles p
set status = 'approved',
    approved_at = coalesce(p.approved_at, p.created_at),
    role = case
      when exists (
        select 1 from public.organization_memberships m
        where m.user_id = p.id and m.role = 'super_admin'::app_role
      ) then 'super_admin'
      else p.role
    end
where exists (
  select 1 from public.organization_memberships m
  where m.user_id = p.id
);

alter table public.profiles enable row level security;

drop policy if exists "profiles own row" on public.profiles;
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_super_admin());

drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create index if not exists profiles_status_idx on public.profiles (status, created_at desc);
create index if not exists profiles_email_idx on public.profiles (email);

comment on column public.profiles.status is 'Manual account activation status: pending, approved, or rejected.';
comment on column public.profiles.role is 'Platform profile role for manual activation: user, admin, or super_admin.';
