-- Restaurant costing integrity: immutable recipe versions and sales cost snapshots.
-- This migration is prepared for review only. Do not apply to production automatically.

create table if not exists public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  activation_key text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  servings numeric(14,4) not null check (servings > 0),
  preparation text,
  target_food_cost_percent numeric(7,4) not null check (target_food_cost_percent > 0 and target_food_cost_percent < 100),
  labor_cost_per_batch numeric(16,4) not null default 0 check (labor_cost_per_batch >= 0),
  overhead_cost_per_batch numeric(16,4) not null default 0 check (overhead_cost_per_batch >= 0),
  material_cost numeric(16,4) not null default 0 check (material_cost >= 0),
  total_cost numeric(16,4) not null default 0 check (total_cost >= 0),
  cost_per_serving numeric(16,4) not null default 0 check (cost_per_serving >= 0),
  activated_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, recipe_id, version_number),
  unique (organization_id, activation_key)
);

create unique index if not exists recipe_versions_one_active_idx
  on public.recipe_versions (organization_id, recipe_id)
  where status = 'active';

create table if not exists public.recipe_version_ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  recipe_version_id uuid not null references public.recipe_versions(id) on delete restrict,
  item_id uuid references public.inventory_items(id) on delete restrict,
  subrecipe_version_id uuid references public.recipe_versions(id) on delete restrict,
  unit_id uuid references public.units(id) on delete restrict,
  item_name_snapshot text not null,
  unit_name_snapshot text,
  quantity numeric(16,6) not null check (quantity > 0),
  yield_percent numeric(7,4) not null check (yield_percent > 0 and yield_percent <= 100),
  unit_cost_snapshot numeric(16,6) not null check (unit_cost_snapshot >= 0),
  extended_cost numeric(18,4) generated always as (
    round(quantity * unit_cost_snapshot / nullif(yield_percent / 100, 0), 4)
  ) stored,
  created_at timestamptz not null default now(),
  check ((item_id is not null)::integer + (subrecipe_version_id is not null)::integer = 1)
);

create index if not exists recipe_version_ingredients_version_idx
  on public.recipe_version_ingredients (organization_id, recipe_version_id);

create table if not exists public.menu_item_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  triggered_by_recipe_version_id uuid not null references public.recipe_versions(id) on delete restrict,
  selling_price_snapshot numeric(16,4) not null check (selling_price_snapshot >= 0),
  material_cost_per_unit numeric(16,4) not null check (material_cost_per_unit >= 0),
  labor_cost_per_unit numeric(16,4) not null check (labor_cost_per_unit >= 0),
  overhead_cost_per_unit numeric(16,4) not null check (overhead_cost_per_unit >= 0),
  total_cost_per_unit numeric(16,4) not null check (total_cost_per_unit >= 0),
  food_cost_percent numeric(9,4),
  contribution_margin numeric(16,4) not null,
  components jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists menu_item_cost_snapshots_latest_idx
  on public.menu_item_cost_snapshots (organization_id, menu_item_id, created_at desc);

create table if not exists public.customer_invoice_item_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  customer_invoice_id uuid not null references public.customer_invoices(id) on delete restrict,
  customer_invoice_item_id uuid not null references public.customer_invoice_items(id) on delete restrict,
  menu_item_id uuid references public.menu_items(id) on delete restrict,
  menu_item_cost_snapshot_id uuid references public.menu_item_cost_snapshots(id) on delete restrict,
  sold_at timestamptz not null,
  quantity numeric(16,4) not null check (quantity > 0),
  net_sales_amount numeric(16,4) not null,
  theoretical_material_cost numeric(16,4) not null check (theoretical_material_cost >= 0),
  full_cost numeric(16,4),
  gross_profit numeric(16,4) not null,
  snapshot_status text not null check (snapshot_status in ('complete', 'material_only', 'unmapped')),
  components jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, customer_invoice_item_id)
);

create index if not exists customer_invoice_item_cost_snapshots_period_idx
  on public.customer_invoice_item_cost_snapshots (organization_id, branch_id, sold_at desc);

alter table public.recipe_versions enable row level security;
alter table public.recipe_version_ingredients enable row level security;
alter table public.menu_item_cost_snapshots enable row level security;
alter table public.customer_invoice_item_cost_snapshots enable row level security;

create or replace function public.can_read_restaurant_costs(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_super_admin() or public.has_org_role(
    p_organization_id,
    array['organization_owner','accountant']::public.app_role[]
  );
$$;

drop policy if exists "recipe versions cost read" on public.recipe_versions;
create policy "recipe versions cost read" on public.recipe_versions
  for select to authenticated using (public.can_read_restaurant_costs(organization_id));
drop policy if exists "recipe version ingredients cost read" on public.recipe_version_ingredients;
create policy "recipe version ingredients cost read" on public.recipe_version_ingredients
  for select to authenticated using (public.can_read_restaurant_costs(organization_id));
drop policy if exists "menu item cost snapshots read" on public.menu_item_cost_snapshots;
create policy "menu item cost snapshots read" on public.menu_item_cost_snapshots
  for select to authenticated using (public.can_read_restaurant_costs(organization_id));
drop policy if exists "invoice item cost snapshots read" on public.customer_invoice_item_cost_snapshots;
create policy "invoice item cost snapshots read" on public.customer_invoice_item_cost_snapshots
  for select to authenticated using (public.can_read_restaurant_costs(organization_id));

create or replace function public.protect_recipe_version_history()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'لا يمكن حذف إصدار وصفة؛ أنشئ إصداراً جديداً.';
  end if;
  if old.status <> 'draft' then
    if old.status = 'active' and new.status = 'retired'
       and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
      return new;
    end if;
    raise exception 'إصدار الوصفة المفعّل غير قابل للتعديل.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_cost_snapshot_history()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'لقطة التكلفة غير قابلة للتعديل أو الحذف.';
end;
$$;

drop trigger if exists protect_recipe_version_history_trigger on public.recipe_versions;
create trigger protect_recipe_version_history_trigger
before update or delete on public.recipe_versions
for each row execute function public.protect_recipe_version_history();

drop trigger if exists protect_recipe_version_ingredients_trigger on public.recipe_version_ingredients;
create trigger protect_recipe_version_ingredients_trigger
before update or delete on public.recipe_version_ingredients
for each row execute function public.protect_cost_snapshot_history();
drop trigger if exists protect_menu_item_cost_snapshots_trigger on public.menu_item_cost_snapshots;
create trigger protect_menu_item_cost_snapshots_trigger
before update or delete on public.menu_item_cost_snapshots
for each row execute function public.protect_cost_snapshot_history();
drop trigger if exists protect_customer_invoice_item_cost_snapshots_trigger on public.customer_invoice_item_cost_snapshots;
create trigger protect_customer_invoice_item_cost_snapshots_trigger
before update or delete on public.customer_invoice_item_cost_snapshots
for each row execute function public.protect_cost_snapshot_history();

create or replace function public.assert_costing_actor(
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role text;
begin
  if p_actor_user_id is null then raise exception 'المستخدم المنفذ مطلوب.'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from p_actor_user_id then
    raise exception 'لا يمكن للمستخدم تمثيل مستخدم آخر.';
  end if;
  select om.role::text into v_role
  from public.organization_memberships om
  where om.organization_id = p_organization_id and om.user_id = p_actor_user_id
  order by case when om.branch_id is null then 0 else 1 end
  limit 1;
  if v_role is null and exists (
    select 1 from public.organization_memberships om
    where om.user_id = p_actor_user_id and om.role::text = 'super_admin'
  ) then
    v_role := 'super_admin';
  end if;
  if v_role not in ('super_admin', 'organization_owner', 'accountant') then
    raise exception 'الدور لا يسمح برؤية التكلفة واعتماد إصدار الوصفة.';
  end if;
  return v_role;
end;
$$;

create or replace function public.activate_recipe_version_atomic(
  p_organization_id uuid,
  p_recipe_id uuid,
  p_name text,
  p_category text,
  p_servings numeric,
  p_preparation text,
  p_target_food_cost_percent numeric,
  p_labor_cost_per_batch numeric,
  p_overhead_cost_per_batch numeric,
  p_ingredients jsonb,
  p_activation_key text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_recipe_id uuid := p_recipe_id;
  v_version_id uuid;
  v_version_number integer;
  v_ingredient jsonb;
  v_item public.inventory_items%rowtype;
  v_subversion public.recipe_versions%rowtype;
  v_unit_name text;
  v_quantity numeric(16,6);
  v_yield numeric(7,4);
  v_material_cost numeric(16,4);
  v_total_cost numeric(16,4);
  v_cost_per_serving numeric(16,4);
  v_menu record;
  v_material_per_unit numeric(16,4);
  v_labor_per_unit numeric(16,4);
  v_overhead_per_unit numeric(16,4);
  v_menu_total numeric(16,4);
  v_components jsonb;
begin
  perform public.assert_costing_actor(p_organization_id, p_actor_user_id);
  if nullif(btrim(p_name), '') is null or nullif(btrim(p_category), '') is null then
    raise exception 'اسم وتصنيف الوصفة مطلوبان.';
  end if;
  if p_servings is null or p_servings <= 0 then raise exception 'عدد الحصص يجب أن يكون موجباً.'; end if;
  if p_target_food_cost_percent is null or p_target_food_cost_percent <= 0 or p_target_food_cost_percent >= 100 then
    raise exception 'نسبة تكلفة الطعام المستهدفة يجب أن تكون بين 0 و100.';
  end if;
  if coalesce(p_labor_cost_per_batch, 0) < 0 or coalesce(p_overhead_cost_per_batch, 0) < 0 then
    raise exception 'تكلفة العمل والتحميل لا يمكن أن تكون سالبة.';
  end if;
  if jsonb_typeof(p_ingredients) <> 'array' or jsonb_array_length(p_ingredients) not between 1 and 200 then
    raise exception 'الوصفة تحتاج من مكوّن واحد إلى 200 مكوّن.';
  end if;
  if nullif(btrim(p_activation_key), '') is null or length(btrim(p_activation_key)) < 8 then
    raise exception 'مفتاح منع التكرار مطلوب (8 أحرف على الأقل).';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':recipe-version:' || coalesce(v_recipe_id::text, lower(btrim(p_name))), 0
  ));
  select rv.id into v_version_id
  from public.recipe_versions rv
  where rv.organization_id = p_organization_id and rv.activation_key = btrim(p_activation_key);
  if found then
    return jsonb_build_object('success', true, 'duplicate', true, 'recipe_version_id', v_version_id);
  end if;

  if v_recipe_id is null then
    insert into public.recipes (
      organization_id, name, category, servings, preparation,
      total_cost, cost_per_serving, status, created_by
    ) values (
      p_organization_id, btrim(p_name), btrim(p_category), p_servings, nullif(btrim(p_preparation), ''),
      0, 0, 'active', p_actor_user_id
    ) returning id into v_recipe_id;
  else
    perform 1 from public.recipes r
    where r.id = v_recipe_id and r.organization_id = p_organization_id for update;
    if not found then raise exception 'الوصفة لا تتبع المؤسسة.'; end if;
  end if;

  select coalesce(max(rv.version_number), 0) + 1 into v_version_number
  from public.recipe_versions rv
  where rv.organization_id = p_organization_id and rv.recipe_id = v_recipe_id;
  v_version_id := gen_random_uuid();
  insert into public.recipe_versions (
    id, organization_id, recipe_id, version_number, activation_key, status,
    servings, preparation, target_food_cost_percent,
    labor_cost_per_batch, overhead_cost_per_batch, created_by
  ) values (
    v_version_id, p_organization_id, v_recipe_id, v_version_number,
    btrim(p_activation_key), 'draft', p_servings, nullif(btrim(p_preparation), ''),
    round(p_target_food_cost_percent, 4), round(coalesce(p_labor_cost_per_batch, 0), 4),
    round(coalesce(p_overhead_cost_per_batch, 0), 4), p_actor_user_id
  );

  for v_ingredient in select value from jsonb_array_elements(p_ingredients)
  loop
    begin
      v_quantity := round((v_ingredient->>'quantity')::numeric, 6);
      v_yield := round(coalesce(nullif(v_ingredient->>'yield_percent', '')::numeric, 100), 4);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'كمية أو نسبة تصافي غير صالحة.';
    end;
    if v_quantity <= 0 or v_yield <= 0 or v_yield > 100 then
      raise exception 'كمية المكوّن ونسبة التصافي غير صالحتين.';
    end if;
    if (nullif(v_ingredient->>'item_id', '') is null) = (nullif(v_ingredient->>'subrecipe_version_id', '') is null) then
      raise exception 'حدد مادة مخزون أو إصدار وصفة فرعية واحداً فقط.';
    end if;

    if nullif(v_ingredient->>'item_id', '') is not null then
      select * into v_item from public.inventory_items i
      where i.id = (v_ingredient->>'item_id')::uuid and i.organization_id = p_organization_id and i.status = 'active';
      if not found then raise exception 'مادة مخزون غير نشطة أو لا تتبع المؤسسة.'; end if;
      if nullif(v_ingredient->>'unit_id', '') is not null and not exists (
        select 1 from public.units u
        where u.id = (v_ingredient->>'unit_id')::uuid and u.organization_id = p_organization_id
      ) then raise exception 'وحدة القياس لا تتبع المؤسسة.'; end if;
      select u.name into v_unit_name from public.units u where u.id = nullif(v_ingredient->>'unit_id', '')::uuid;
      insert into public.recipe_version_ingredients (
        organization_id, recipe_version_id, item_id, unit_id,
        item_name_snapshot, unit_name_snapshot, quantity, yield_percent, unit_cost_snapshot
      ) values (
        p_organization_id, v_version_id, v_item.id, nullif(v_ingredient->>'unit_id', '')::uuid,
        v_item.name, v_unit_name, v_quantity, v_yield, round(coalesce(v_item.average_cost, 0), 6)
      );
    else
      select * into v_subversion from public.recipe_versions rv
      where rv.id = (v_ingredient->>'subrecipe_version_id')::uuid
        and rv.organization_id = p_organization_id and rv.status = 'active';
      if not found then raise exception 'إصدار الوصفة الفرعية غير مفعّل أو لا يتبع المؤسسة.'; end if;
      if v_subversion.recipe_id = v_recipe_id then raise exception 'لا يمكن للوصفة أن تحتوي نفسها.'; end if;
      if exists (
        with recursive dependencies(version_id, subrecipe_version_id, path) as (
          select rvi.recipe_version_id, rvi.subrecipe_version_id, array[rvi.recipe_version_id]
          from public.recipe_version_ingredients rvi
          where rvi.recipe_version_id = v_subversion.id and rvi.subrecipe_version_id is not null
          union all
          select rvi.recipe_version_id, rvi.subrecipe_version_id, d.path || rvi.recipe_version_id
          from dependencies d
          join public.recipe_version_ingredients rvi on rvi.recipe_version_id = d.subrecipe_version_id
          where rvi.subrecipe_version_id is not null and not rvi.recipe_version_id = any(d.path)
        )
        select 1 from dependencies d
        join public.recipe_versions rv on rv.id = d.subrecipe_version_id
        where rv.recipe_id = v_recipe_id
      ) then raise exception 'تم اكتشاف دورة بين الوصفات الفرعية.'; end if;
      insert into public.recipe_version_ingredients (
        organization_id, recipe_version_id, subrecipe_version_id,
        item_name_snapshot, unit_name_snapshot, quantity, yield_percent, unit_cost_snapshot
      ) select
        p_organization_id, v_version_id, v_subversion.id,
        r.name, 'حصة', v_quantity, v_yield, v_subversion.cost_per_serving
      from public.recipes r where r.id = v_subversion.recipe_id;
    end if;
  end loop;

  select round(coalesce(sum(rvi.extended_cost), 0), 4) into v_material_cost
  from public.recipe_version_ingredients rvi
  where rvi.organization_id = p_organization_id and rvi.recipe_version_id = v_version_id;
  v_total_cost := round(v_material_cost + coalesce(p_labor_cost_per_batch, 0) + coalesce(p_overhead_cost_per_batch, 0), 4);
  v_cost_per_serving := round(v_total_cost / p_servings, 4);

  update public.recipe_versions set
    material_cost = v_material_cost, total_cost = v_total_cost,
    cost_per_serving = v_cost_per_serving, status = 'active', activated_at = now()
  where id = v_version_id and status = 'draft';
  update public.recipe_versions set status = 'retired'
  where organization_id = p_organization_id and recipe_id = v_recipe_id
    and id <> v_version_id and status = 'active';

  update public.recipes set
    name = btrim(p_name), category = btrim(p_category), servings = p_servings,
    preparation = nullif(btrim(p_preparation), ''), total_cost = v_material_cost,
    cost_per_serving = round(v_material_cost / p_servings, 4), status = 'active', updated_at = now()
  where id = v_recipe_id and organization_id = p_organization_id;

  -- recipe_ingredients is the current POS/production projection. Historical
  -- components are retained immutably above before this projection is replaced.
  delete from public.recipe_ingredients ri
  where ri.organization_id = p_organization_id and ri.recipe_id = v_recipe_id;
  insert into public.recipe_ingredients (
    organization_id, recipe_id, item_id, quantity, unit_id,
    yield_percent, unit_cost, created_by
  )
  with recursive expanded as (
    select rvi.item_id, rvi.subrecipe_version_id, rvi.unit_id,
           rvi.quantity, rvi.yield_percent, 1::numeric as batch_multiplier,
           array[v_version_id]::uuid[] as path
    from public.recipe_version_ingredients rvi
    where rvi.recipe_version_id = v_version_id
    union all
    select child.item_id, child.subrecipe_version_id, child.unit_id,
           child.quantity, child.yield_percent,
           e.batch_multiplier * (e.quantity / nullif(e.yield_percent / 100, 0)) / parent.servings,
           e.path || parent.id
    from expanded e
    join public.recipe_versions parent on parent.id = e.subrecipe_version_id
    join public.recipe_version_ingredients child on child.recipe_version_id = parent.id
    where e.subrecipe_version_id is not null and not parent.id = any(e.path)
  ), material_rows as (
    select e.item_id, e.unit_id,
           round(sum(e.batch_multiplier * e.quantity / nullif(e.yield_percent / 100, 0)), 6) as gross_quantity
    from expanded e where e.item_id is not null
    group by e.item_id, e.unit_id
  )
  select p_organization_id, v_recipe_id, mr.item_id, mr.gross_quantity,
         mr.unit_id, 100, round(coalesce(i.average_cost, 0), 4), p_actor_user_id
  from material_rows mr
  join public.inventory_items i on i.id = mr.item_id and i.organization_id = p_organization_id;

  for v_menu in
    select distinct m.menu_item_id, mi.selling_price
    from public.menu_item_recipe_mapping m
    join public.menu_items mi on mi.id = m.menu_item_id and mi.organization_id = p_organization_id
    where m.organization_id = p_organization_id and m.recipe_id = v_recipe_id
  loop
    select
      round(coalesce(sum(rv.material_cost / rv.servings * m.portion_multiplier), 0), 4),
      round(coalesce(sum(rv.labor_cost_per_batch / rv.servings * m.portion_multiplier), 0), 4),
      round(coalesce(sum(rv.overhead_cost_per_batch / rv.servings * m.portion_multiplier), 0), 4),
      coalesce(jsonb_agg(jsonb_build_object(
        'recipe_id', m.recipe_id, 'recipe_version_id', rv.id,
        'portion_multiplier', m.portion_multiplier, 'cost_per_serving', rv.cost_per_serving
      ) order by m.recipe_id), '[]'::jsonb)
    into v_material_per_unit, v_labor_per_unit, v_overhead_per_unit, v_components
    from public.menu_item_recipe_mapping m
    join public.recipe_versions rv on rv.organization_id = p_organization_id
      and rv.recipe_id = m.recipe_id and rv.status = 'active'
    where m.organization_id = p_organization_id and m.menu_item_id = v_menu.menu_item_id;
    v_menu_total := round(v_material_per_unit + v_labor_per_unit + v_overhead_per_unit, 4);
    insert into public.menu_item_cost_snapshots (
      organization_id, menu_item_id, triggered_by_recipe_version_id,
      selling_price_snapshot, material_cost_per_unit, labor_cost_per_unit,
      overhead_cost_per_unit, total_cost_per_unit, food_cost_percent,
      contribution_margin, components, created_by
    ) values (
      p_organization_id, v_menu.menu_item_id, v_version_id,
      round(v_menu.selling_price, 4), v_material_per_unit, v_labor_per_unit,
      v_overhead_per_unit, v_menu_total,
      case when v_menu.selling_price > 0 then round(v_material_per_unit / v_menu.selling_price * 100, 4) end,
      round(v_menu.selling_price - v_menu_total, 4), v_components, p_actor_user_id
    );
  end loop;

  insert into public.audit_logs (
    organization_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, p_actor_user_id, 'recipe_version_activated',
    'recipe_version', v_version_id,
    jsonb_build_object(
      'recipe_id', v_recipe_id, 'version_number', v_version_number,
      'material_cost', v_material_cost, 'labor_cost', coalesce(p_labor_cost_per_batch, 0),
      'overhead_cost', coalesce(p_overhead_cost_per_batch, 0),
      'total_cost', v_total_cost, 'cost_per_serving', v_cost_per_serving,
      'target_food_cost_percent', p_target_food_cost_percent,
      'activation_key', btrim(p_activation_key)
    )
  );
  return jsonb_build_object(
    'success', true, 'duplicate', false, 'recipe_id', v_recipe_id,
    'recipe_version_id', v_version_id, 'version_number', v_version_number,
    'material_cost', v_material_cost, 'total_cost', v_total_cost,
    'cost_per_serving', v_cost_per_serving
  );
end;
$$;

create or replace function public.capture_customer_invoice_item_cost_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_invoice public.customer_invoices%rowtype;
  v_menu_snapshot public.menu_item_cost_snapshots%rowtype;
  v_full_cost numeric(16,4);
  v_status text;
begin
  select * into v_invoice from public.customer_invoices ci
  where ci.id = new.customer_invoice_id and ci.organization_id = new.organization_id;
  if not found then raise exception 'تعذر ربط لقطة التكلفة بالفاتورة.'; end if;

  if new.menu_item_id is not null then
    select * into v_menu_snapshot
    from public.menu_item_cost_snapshots mics
    where mics.organization_id = new.organization_id and mics.menu_item_id = new.menu_item_id
      and mics.created_at <= v_invoice.issued_at
    order by mics.created_at desc limit 1;
  end if;
  if v_menu_snapshot.id is not null then
    v_full_cost := round(v_menu_snapshot.total_cost_per_unit * new.quantity, 4);
    v_status := 'complete';
  elsif new.menu_item_id is not null then
    v_full_cost := null;
    v_status := 'material_only';
  else
    v_full_cost := null;
    v_status := 'unmapped';
  end if;

  insert into public.customer_invoice_item_cost_snapshots (
    organization_id, branch_id, customer_invoice_id, customer_invoice_item_id,
    menu_item_id, menu_item_cost_snapshot_id, sold_at, quantity,
    net_sales_amount, theoretical_material_cost, full_cost, gross_profit,
    snapshot_status, components
  ) values (
    new.organization_id, v_invoice.branch_id, new.customer_invoice_id, new.id,
    new.menu_item_id, v_menu_snapshot.id, v_invoice.issued_at, new.quantity,
    round(coalesce(new.cost_total, 0) + coalesce(new.gross_profit, 0), 4),
    round(coalesce(new.cost_total, 0), 4), v_full_cost,
    round(coalesce(new.gross_profit, 0), 4), v_status,
    coalesce(v_menu_snapshot.components, '[]'::jsonb)
  ) on conflict (organization_id, customer_invoice_item_id) do nothing;
  return new;
end;
$$;

drop trigger if exists capture_customer_invoice_item_cost_snapshot_trigger on public.customer_invoice_items;
create trigger capture_customer_invoice_item_cost_snapshot_trigger
after insert on public.customer_invoice_items
for each row execute function public.capture_customer_invoice_item_cost_snapshot();

revoke all on function public.activate_recipe_version_atomic(
  uuid, uuid, text, text, numeric, text, numeric, numeric, numeric, jsonb, text, uuid
) from public, anon, authenticated;
grant execute on function public.activate_recipe_version_atomic(
  uuid, uuid, text, text, numeric, text, numeric, numeric, numeric, jsonb, text, uuid
) to service_role;

-- Pre-deployment validation: review every zero-cost active item and unmapped menu item.
-- select id, organization_id, name from public.inventory_items where status = 'active' and average_cost <= 0;
-- select mi.id, mi.organization_id, mi.name from public.menu_items mi
-- left join public.menu_item_recipe_mapping m on m.menu_item_id = mi.id and m.organization_id = mi.organization_id
-- where mi.status = 'active' group by mi.id having count(m.id) = 0;
-- Existing invoices are intentionally not backfilled: a historical cost without a contemporaneous
-- snapshot would be an estimate. The trigger records exact snapshots for invoices created after rollout.

-- Forward correction only: replace RPC/trigger definitions in a later migration.
-- Never delete or rewrite an activated version or a cost snapshot.
