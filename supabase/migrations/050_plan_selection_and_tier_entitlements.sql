-- First-login plan selection and the 150/250/350 entitlement matrix.
-- Review in staging before production. This migration is intentionally
-- forward-only: subscription and audit history remain immutable.

alter table public.organizations
  add column if not exists plan_selected_at timestamptz,
  add column if not exists plan_selected_by uuid references auth.users(id) on delete set null;

comment on column public.organizations.plan_selected_at
  is 'Timestamp of the one-time onboarding plan choice. Null means the owner must choose a plan.';

comment on column public.organizations.plan_selected_by
  is 'Owner or super administrator who made the onboarding plan choice.';

-- Existing organizations keep their current plan and are not interrupted by
-- the new onboarding screen. Organizations created after this migration start
-- with a null selection and must choose on first entry.
update public.organizations
set
  plan_selected_at = coalesce(updated_at, created_at, now()),
  plan_selected_by = created_by
where plan_selected_at is null;

create or replace function public.protect_organization_plan_columns()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.plan <> 'starter'
      or new.plan_selected_at is not null
      or new.plan_selected_by is not null
    then
      raise exception using
        errcode = '42501',
        message = 'Plan selection must use the protected billing workflow.';
    end if;
  elsif new.plan is distinct from old.plan
    or new.plan_selected_at is distinct from old.plan_selected_at
    or new.plan_selected_by is distinct from old.plan_selected_by
  then
    raise exception using
      errcode = '42501',
      message = 'Plan changes must use the protected billing workflow.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_organization_plan_columns() from public;

drop trigger if exists protect_organization_plan_columns on public.organizations;
create trigger protect_organization_plan_columns
  before insert or update of plan, plan_selected_at, plan_selected_by
  on public.organizations
  for each row
  execute function public.protect_organization_plan_columns();

insert into public.plans (code, name, monthly_price, currency, features, limits, status)
values
  (
    'starter',
    'رواق للمطعم الصغير',
    150,
    'USD',
    '["dashboard","pos","shifts","sales","customers","reports","administration"]'::jsonb,
    '{"maxBranches":1,"maxUsers":8,"maxDevices":4}'::jsonb,
    'active'
  ),
  (
    'growth',
    'رواق للمطعم المتوسط',
    250,
    'USD',
    '["dashboard","pos","shifts","sales","customers","reports","administration","tables","kitchen","expo","restaurant_workflow","digital_presence","inventory","recipes","waste","purchasing","suppliers","transfers","production"]'::jsonb,
    '{"maxBranches":3,"maxUsers":25,"maxDevices":12}'::jsonb,
    'active'
  ),
  (
    'scale',
    'رواق للمطعم الكبير',
    350,
    'USD',
    '["dashboard","pos","shifts","tables","kitchen","expo","restaurant_workflow","digital_presence","sales","customers","inventory","recipes","waste","purchasing","suppliers","transfers","production","reports","accounting","financial_services","marketing","automation","administration"]'::jsonb,
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

create or replace function public.select_trial_plan_atomic(
  p_organization_id uuid,
  p_plan_code text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  selected_organization public.organizations%rowtype;
  selected_plan public.plans%rowtype;
  current_subscription public.subscriptions%rowtype;
  actor_role text;
  previous_plan text;
begin
  if p_organization_id is null or p_actor_user_id is null then
    raise exception using
      errcode = '22004',
      message = 'Organization and actor are required.';
  end if;

  if p_plan_code not in ('starter', 'growth', 'scale') then
    raise exception using
      errcode = '22023',
      message = 'Unknown Rawaq plan code.';
  end if;

  select organization.*
  into selected_organization
  from public.organizations organization
  where organization.id = p_organization_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Organization was not found.';
  end if;

  previous_plan := selected_organization.plan;

  select membership.role::text
  into actor_role
  from public.organization_memberships membership
  where membership.organization_id = p_organization_id
    and membership.user_id = p_actor_user_id
  limit 1;

  if actor_role is null or actor_role not in ('organization_owner', 'super_admin') then
    raise exception using
      errcode = '42501',
      message = 'Only the organization owner may select the onboarding plan.';
  end if;

  select plan.*
  into selected_plan
  from public.plans plan
  where plan.code = p_plan_code
    and plan.status = 'active'
  limit 1;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The selected plan is unavailable.';
  end if;

  select subscription.*
  into current_subscription
  from public.subscriptions subscription
  where subscription.organization_id = p_organization_id
    and subscription.status in ('trial', 'active', 'past_due', 'paused')
  order by subscription.updated_at desc, subscription.id desc
  limit 1
  for update;

  -- A repeated request for the already selected plan is safe and returns the
  -- same result without creating another subscription or audit event.
  if selected_organization.plan_selected_at is not null then
    if selected_organization.plan = p_plan_code then
      return jsonb_build_object(
        'organizationId', selected_organization.id,
        'planCode', selected_organization.plan,
        'subscriptionId', current_subscription.id,
        'selectedAt', selected_organization.plan_selected_at,
        'idempotent', true
      );
    end if;

    raise exception using
      errcode = '55000',
      message = 'The onboarding plan was already selected. Use the billing workflow to change it.';
  end if;

  if current_subscription.id is not null and current_subscription.status <> 'trial' then
    raise exception using
      errcode = '55000',
      message = 'A non-trial subscription already exists. Use the billing workflow to change it.';
  end if;

  if current_subscription.id is null then
    insert into public.subscriptions (
      organization_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      created_by
    )
    values (
      p_organization_id,
      selected_plan.id,
      'trial',
      current_date,
      current_date + 30,
      p_actor_user_id
    )
    returning * into current_subscription;
  else
    update public.subscriptions subscription
    set
      plan_id = selected_plan.id,
      current_period_start = coalesce(subscription.current_period_start, current_date),
      current_period_end = coalesce(subscription.current_period_end, current_date + 30),
      updated_at = now()
    where subscription.id = current_subscription.id
    returning * into current_subscription;
  end if;

  update public.organizations organization
  set
    plan = selected_plan.code,
    plan_selected_at = now(),
    plan_selected_by = p_actor_user_id,
    updated_at = now()
  where organization.id = p_organization_id
  returning * into selected_organization;

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
    p_organization_id,
    p_actor_user_id,
    'trial_plan_selected',
    'organization',
    p_organization_id,
    jsonb_build_object(
      'plan', previous_plan,
      'planSelectedAt', null
    ),
    jsonb_build_object(
      'plan', selected_plan.code,
      'planSelectedAt', selected_organization.plan_selected_at,
      'subscriptionId', current_subscription.id,
      'monthlyPriceUsd', selected_plan.monthly_price
    )
  );

  return jsonb_build_object(
    'organizationId', selected_organization.id,
    'planCode', selected_plan.code,
    'subscriptionId', current_subscription.id,
    'selectedAt', selected_organization.plan_selected_at,
    'idempotent', false
  );
end;
$$;

revoke all on function public.select_trial_plan_atomic(uuid, text, uuid) from public;
grant execute on function public.select_trial_plan_atomic(uuid, text, uuid) to service_role;

comment on function public.select_trial_plan_atomic(uuid, text, uuid)
  is 'Atomically records the owner onboarding choice, opens one trial subscription, and writes immutable history/audit records.';

-- Staging validation queries (run manually after applying):
-- select code, name, monthly_price, currency, features, limits from public.plans order by monthly_price;
-- select id, plan, plan_selected_at, plan_selected_by from public.organizations order by created_at desc;
-- select organization_id, count(*) from public.subscriptions where status in ('trial','active','past_due') group by organization_id having count(*) > 1;
-- select action, entity_type, entity_id, new_data from public.audit_logs where action = 'trial_plan_selected' order by created_at desc;
-- select operation, status, new_data from public.subscription_history order by changed_at desc limit 20;

-- Forward-correction plan:
-- Keep these columns and immutable history if application rollback is needed.
-- Correct a mistaken choice through the reviewed billing change workflow; do
-- not delete the subscription, subscription_history, or audit_logs records.
