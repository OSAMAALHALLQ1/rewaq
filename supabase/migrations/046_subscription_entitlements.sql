-- Rawaq commercial plans and server-enforced module entitlements.
-- Review this migration first. Do not apply it to production automatically.

alter table public.plans
  add column if not exists currency text not null default 'USD',
  add column if not exists limits jsonb not null default '{}'::jsonb;

alter table public.plans
  drop constraint if exists plans_currency_check;

alter table public.plans
  add constraint plans_currency_check check (currency = 'USD');

insert into public.plans (code, name, monthly_price, currency, features, limits, status)
values
  (
    'starter',
    'رواق تشغيل',
    150,
    'USD',
    '["dashboard","pos","shifts","tables","kitchen","expo","sales","customers","reports","administration"]'::jsonb,
    '{"maxBranches":1,"maxUsers":8,"maxDevices":4}'::jsonb,
    'active'
  ),
  (
    'growth',
    'رواق إدارة',
    250,
    'USD',
    '["dashboard","pos","shifts","tables","kitchen","expo","sales","customers","reports","administration","inventory","recipes","waste","purchasing","suppliers","transfers","production"]'::jsonb,
    '{"maxBranches":3,"maxUsers":25,"maxDevices":12}'::jsonb,
    'active'
  ),
  (
    'scale',
    'رواق متكامل',
    350,
    'USD',
    '["dashboard","pos","shifts","tables","kitchen","expo","sales","customers","inventory","recipes","waste","purchasing","suppliers","transfers","production","reports","accounting","financial_services","marketing","automation","administration"]'::jsonb,
    '{"maxBranches":null,"maxUsers":null,"maxDevices":null}'::jsonb,
    'active'
  )
on conflict (code) do update
set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  currency = excluded.currency,
  features = excluded.features,
  limits = excluded.limits,
  status = excluded.status,
  updated_at = now();

-- Subscription history is append-only. Parent rows use RESTRICT so deleting a
-- plan, organization, or subscription cannot erase its commercial history.
create table if not exists public.subscription_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null
    references public.subscriptions(id) on delete restrict,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  plan_id uuid references public.plans(id) on delete restrict,
  operation text not null check (operation in ('insert', 'update')),
  status text not null,
  current_period_start date,
  current_period_end date,
  old_data jsonb,
  new_data jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists subscription_history_subscription_changed_idx
  on public.subscription_history (subscription_id, changed_at desc);

create index if not exists subscription_history_organization_changed_idx
  on public.subscription_history (organization_id, changed_at desc);

alter table public.subscription_history enable row level security;

drop policy if exists "subscription history org read"
  on public.subscription_history;
create policy "subscription history org read"
  on public.subscription_history
  for select
  to authenticated
  using (
    public.is_super_admin()
    or public.is_org_member(organization_id)
  );

revoke all on table public.subscription_history from anon;
revoke insert, update, delete on table public.subscription_history
  from authenticated;
grant select on table public.subscription_history to authenticated;
grant select on table public.subscription_history to service_role;

create or replace function public.reject_subscription_history_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Subscription history is append-only and cannot be updated or deleted.';
end;
$$;

revoke all on function public.reject_subscription_history_mutation()
  from public;

drop trigger if exists reject_subscription_history_mutation
  on public.subscription_history;
create trigger reject_subscription_history_mutation
  before update or delete on public.subscription_history
  for each row
  execute function public.reject_subscription_history_mutation();

create or replace function public.capture_subscription_history_and_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  old_snapshot jsonb;
  new_snapshot jsonb := to_jsonb(new);
  audit_action text;
begin
  if tg_op = 'INSERT' then
    old_snapshot := null;
    audit_action := 'subscription_created';
  elsif tg_op = 'UPDATE' then
    old_snapshot := to_jsonb(old);
    audit_action := 'subscription_updated';
  else
    raise exception using
      errcode = '0A000',
      message = 'Unsupported subscription history operation.';
  end if;

  insert into public.subscription_history (
    subscription_id,
    organization_id,
    plan_id,
    operation,
    status,
    current_period_start,
    current_period_end,
    old_data,
    new_data,
    changed_by
  )
  values (
    new.id,
    new.organization_id,
    new.plan_id,
    lower(tg_op),
    new.status,
    new.current_period_start,
    new.current_period_end,
    old_snapshot,
    new_snapshot,
    actor_id
  );

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  )
  values (
    new.organization_id,
    actor_id,
    audit_action,
    'subscription',
    new.id,
    old_snapshot,
    new_snapshot
  );

  return new;
end;
$$;

revoke all on function public.capture_subscription_history_and_audit()
  from public;

drop trigger if exists capture_subscription_history_and_audit
  on public.subscriptions;
create trigger capture_subscription_history_and_audit
  after insert or update on public.subscriptions
  for each row
  execute function public.capture_subscription_history_and_audit();

create or replace function public.reject_subscription_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Subscriptions cannot be deleted. Change the status to cancelled instead.';
end;
$$;

revoke all on function public.reject_subscription_delete() from public;

drop trigger if exists reject_subscription_delete on public.subscriptions;
create trigger reject_subscription_delete
  before delete on public.subscriptions
  for each row
  execute function public.reject_subscription_delete();

-- Replace every legacy subscription policy. Members may read their own
-- organization, while only a super administrator may create or change plans.
alter table public.subscriptions enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
  loop
    execute format(
      'drop policy if exists %I on public.subscriptions',
      existing_policy.policyname
    );
  end loop;
end;
$$;

create policy "subscriptions org read"
  on public.subscriptions
  for select
  to authenticated
  using (
    public.is_super_admin()
    or public.is_org_member(organization_id)
  );

create policy "subscriptions super admin insert"
  on public.subscriptions
  for insert
  to authenticated
  with check (public.is_super_admin());

create policy "subscriptions super admin update"
  on public.subscriptions
  for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

revoke delete on table public.subscriptions from authenticated;

-- Keep the newest current subscription and cancel every older duplicate before
-- installing the invariant. The update is captured in history and audit_logs.
with ranked_current_subscriptions as (
  select
    id,
    row_number() over (
      partition by organization_id
      order by
        created_at desc nulls last,
        updated_at desc nulls last,
        id desc
    ) as current_rank
  from public.subscriptions
  where status in ('trial', 'active', 'past_due')
)
update public.subscriptions subscription
set
  status = 'cancelled',
  updated_at = now()
from ranked_current_subscriptions ranked
where subscription.id = ranked.id
  and ranked.current_rank > 1;

create unique index if not exists subscriptions_one_current_per_organization_uidx
  on public.subscriptions (organization_id)
  where status in ('trial', 'active', 'past_due');

create index if not exists subscriptions_organization_status_idx
  on public.subscriptions (organization_id, status, updated_at desc);

insert into public.subscriptions (
  organization_id,
  plan_id,
  status,
  current_period_start,
  current_period_end
)
select
  organization.id,
  plan.id,
  case
    when organization.status = 'active' then 'active'
    else 'trial'
  end,
  current_date,
  current_date + 30
from public.organizations organization
join public.plans plan
  on plan.code = case
    when organization.plan in ('starter', 'growth', 'scale') then organization.plan
    else 'starter'
  end
where not exists (
  select 1
  from public.subscriptions subscription
  where subscription.organization_id = organization.id
    and subscription.status in ('trial', 'active', 'past_due')
);

create or replace function public.organization_has_module(
  target_organization_id uuid,
  target_module text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    (
      public.is_super_admin()
      or public.is_org_member(target_organization_id)
    )
    and coalesce(
      (
        select plan.features ? target_module
        from public.subscriptions subscription
        join public.plans plan on plan.id = subscription.plan_id
        where subscription.organization_id = target_organization_id
          and subscription.status in ('trial', 'active')
        order by
          case subscription.status
            when 'active' then 1
            else 2
          end,
          subscription.updated_at desc
        limit 1
      ),
      false
    );
$$;

revoke all on function public.organization_has_module(uuid, text) from public;
grant execute on function public.organization_has_module(uuid, text) to authenticated;
grant execute on function public.organization_has_module(uuid, text) to service_role;

comment on function public.organization_has_module(uuid, text)
  is 'Checks a trial or active organization subscription before allowing a Rawaq module.';
