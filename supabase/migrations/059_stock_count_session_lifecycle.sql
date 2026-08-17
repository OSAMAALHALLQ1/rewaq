-- Stock count sessions: snapshot -> count -> review/recount -> approve -> post -> close.
-- Existing approved counts remain valid. No historical row is deleted or rewritten.

alter table public.stock_counts
  add column if not exists count_number text,
  add column if not exists warehouse text not null default 'all',
  add column if not exists category_id uuid references public.inventory_categories(id) on delete restrict,
  add column if not exists blind_count boolean not null default true,
  add column if not exists variance_approval_threshold numeric(14,4) not null default 0,
  add column if not exists snapshot_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists posted_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists posted_by uuid references auth.users(id) on delete set null;

-- Before this lifecycle existed, the only supported flow (migration 056) wrote
-- stock movements and the journal atomically while leaving the document named
-- "approved". Mark those already-posted documents truthfully so they can never
-- be posted a second time through the new lifecycle. Preserve an audit event.
insert into public.audit_logs (
  organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
)
select
  sc.organization_id, sc.branch_id, sc.created_by,
  'stock_count_legacy_status_normalized', 'stock_count', sc.id,
  jsonb_build_object('status', sc.status),
  jsonb_build_object('status', 'posted', 'reason', 'migration_056_already_posted')
from public.stock_counts sc
where sc.status = 'approved'
  and exists (
    select 1 from public.stock_movements sm
    where sm.organization_id = sc.organization_id
      and sm.source_doc_type = 'stock_count'
      and sm.source_doc_id = sc.id
  );

update public.stock_counts sc
set status = 'posted',
    posted_at = coalesce(sc.approved_at, sc.created_at),
    posted_by = sc.created_by,
    updated_at = now()
where sc.status = 'approved'
  and exists (
    select 1 from public.stock_movements sm
    where sm.organization_id = sc.organization_id
      and sm.source_doc_type = 'stock_count'
      and sm.source_doc_id = sc.id
  );

alter table public.stock_counts
  drop constraint if exists stock_counts_warehouse_check,
  add constraint stock_counts_warehouse_check
    check (warehouse in ('all', 'general', 'kitchen')) not valid;
alter table public.stock_counts validate constraint stock_counts_warehouse_check;

alter table public.stock_counts
  drop constraint if exists stock_counts_status_check,
  add constraint stock_counts_status_check check (
    status in (
      'draft', 'counting', 'review', 'recount', 'pending_approval',
      'approved', 'posted', 'closed', 'cancelled'
    )
  ) not valid;
alter table public.stock_counts validate constraint stock_counts_status_check;

alter table public.stock_count_items
  alter column counted_quantity drop not null,
  alter column counted_quantity drop default;

alter table public.stock_count_items
  add column if not exists first_count_quantity numeric(14,4),
  add column if not exists second_count_quantity numeric(14,4),
  add column if not exists unit_cost_snapshot numeric(14,4) not null default 0,
  add column if not exists variance_reason text,
  add column if not exists count_state text not null default 'pending',
  add column if not exists first_counted_by uuid references auth.users(id) on delete set null,
  add column if not exists recounted_by uuid references auth.users(id) on delete set null,
  add column if not exists first_counted_at timestamptz,
  add column if not exists recounted_at timestamptz;

alter table public.stock_count_items
  drop constraint if exists stock_count_items_count_state_check,
  add constraint stock_count_items_count_state_check
    check (count_state in ('pending', 'counted', 'recount_required', 'resolved')) not valid;
alter table public.stock_count_items validate constraint stock_count_items_count_state_check;

alter table public.stock_count_items
  drop constraint if exists stock_count_items_quantities_nonnegative,
  add constraint stock_count_items_quantities_nonnegative check (
    (first_count_quantity is null or first_count_quantity >= 0)
    and (second_count_quantity is null or second_count_quantity >= 0)
    and (counted_quantity is null or counted_quantity >= 0)
  ) not valid;
alter table public.stock_count_items validate constraint stock_count_items_quantities_nonnegative;

create table if not exists public.stock_count_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  stock_count_id uuid not null references public.stock_counts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  participant_role text not null default 'counter',
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  constraint stock_count_participants_role_check
    check (participant_role in ('counter', 'reviewer', 'approver')),
  constraint stock_count_participants_unique
    unique (organization_id, stock_count_id, user_id, participant_role)
);

create unique index if not exists stock_counts_org_number_unique
  on public.stock_counts (organization_id, count_number)
  where count_number is not null;
create index if not exists stock_counts_org_status_idx
  on public.stock_counts (organization_id, status, created_at desc);
create index if not exists stock_count_items_session_state_idx
  on public.stock_count_items (organization_id, stock_count_id, count_state);
create index if not exists stock_count_participants_user_idx
  on public.stock_count_participants (organization_id, user_id, stock_count_id);

alter table public.stock_count_participants enable row level security;

create policy stock_count_participants_org_read on public.stock_count_participants
for select to authenticated
using (public.is_org_member(organization_id));

create policy stock_count_participants_privileged_insert on public.stock_count_participants
for insert to authenticated
with check (
  exists (
    select 1 from public.organization_memberships om
    where om.organization_id = stock_count_participants.organization_id
      and om.user_id = auth.uid()
      and om.role::text in ('super_admin', 'organization_owner', 'branch_manager', 'inventory_manager')
  )
);

create policy stock_count_participants_privileged_update on public.stock_count_participants
for update to authenticated
using (
  exists (
    select 1 from public.organization_memberships om
    where om.organization_id = stock_count_participants.organization_id
      and om.user_id = auth.uid()
      and om.role::text in ('super_admin', 'organization_owner', 'branch_manager', 'inventory_manager')
  )
)
with check (
  exists (
    select 1 from public.organization_memberships om
    where om.organization_id = stock_count_participants.organization_id
      and om.user_id = auth.uid()
      and om.role::text in ('super_admin', 'organization_owner', 'branch_manager', 'inventory_manager')
  )
);

create or replace function public.assert_stock_count_actor(
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_user_id uuid,
  p_requires_approval_role boolean default false
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
  where om.organization_id = p_organization_id
    and om.user_id = p_actor_user_id
    and (om.branch_id is null or om.branch_id = p_branch_id)
  order by case when om.branch_id = p_branch_id then 0 else 1 end
  limit 1;

  if v_role is null and exists (
    select 1 from public.organization_memberships om
    where om.user_id = p_actor_user_id and om.role::text = 'super_admin'
  ) then v_role := 'super_admin'; end if;

  if v_role not in ('super_admin', 'organization_owner', 'branch_manager', 'inventory_manager') then
    raise exception 'الدور لا يسمح بتنفيذ دورة الجرد.';
  end if;
  if p_requires_approval_role and v_role not in ('super_admin', 'organization_owner', 'branch_manager') then
    raise exception 'اعتماد الجرد وترحيله يحتاج مدير فرع أو مالكاً.';
  end if;
  return v_role;
end;
$$;

create or replace function public.create_stock_count_session_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_counted_at date,
  p_warehouse text,
  p_category_id uuid,
  p_blind_count boolean,
  p_variance_approval_threshold numeric,
  p_notes text,
  p_idempotency_key text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count_id uuid;
  v_count_number text;
  v_item_count integer;
begin
  perform public.assert_stock_count_actor(p_organization_id, p_branch_id, p_actor_user_id, false);
  if p_counted_at is null then raise exception 'تاريخ الجرد مطلوب.'; end if;
  if coalesce(p_warehouse, 'all') not in ('all', 'general', 'kitchen') then
    raise exception 'المستودع المحدد غير صالح.';
  end if;
  if coalesce(p_idempotency_key, '') = '' then raise exception 'مفتاح منع التكرار مطلوب.'; end if;
  if coalesce(p_variance_approval_threshold, 0) < 0 then raise exception 'حد الموافقة لا يمكن أن يكون سالباً.'; end if;
  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.organization_id = p_organization_id and b.status = 'active'
  ) then raise exception 'الفرع غير موجود أو غير نشط.'; end if;
  if p_category_id is not null and not exists (
    select 1 from public.inventory_categories ic
    where ic.id = p_category_id and ic.organization_id = p_organization_id
  ) then raise exception 'فئة المخزون لا تتبع المؤسسة.'; end if;

  select sc.id into v_count_id
  from public.stock_counts sc
  where sc.organization_id = p_organization_id and sc.idempotency_key = p_idempotency_key
  limit 1;
  if found then
    return jsonb_build_object('success', true, 'duplicate', true, 'stock_count_id', v_count_id);
  end if;

  v_count_number := public.get_next_sequence_number(
    p_organization_id, p_branch_id, 'stock_count', 'SC-'
  );
  insert into public.stock_counts (
    organization_id, branch_id, count_number, status, counted_at, warehouse,
    category_id, blind_count, variance_approval_threshold, snapshot_at,
    started_at, notes, idempotency_key, created_by
  ) values (
    p_organization_id, p_branch_id, v_count_number, 'counting', p_counted_at,
    coalesce(p_warehouse, 'all'), p_category_id, coalesce(p_blind_count, true),
    coalesce(p_variance_approval_threshold, 0), now(), now(),
    nullif(btrim(p_notes), ''), p_idempotency_key, p_actor_user_id
  ) returning id into v_count_id;

  insert into public.stock_count_items (
    organization_id, stock_count_id, item_id, system_quantity,
    counted_quantity, unit_cost_snapshot, count_state, created_by
  )
  select
    p_organization_id, v_count_id, ii.id, coalesce(bs.quantity, 0),
    null, coalesce(ii.average_cost, 0), 'pending', p_actor_user_id
  from public.inventory_items ii
  left join public.branch_stock bs
    on bs.organization_id = ii.organization_id
   and bs.branch_id = p_branch_id
   and bs.item_id = ii.id
  where ii.organization_id = p_organization_id
    and ii.status = 'active'
    and (coalesce(p_warehouse, 'all') = 'all' or ii.warehouse = p_warehouse)
    and (p_category_id is null or ii.category_id = p_category_id);
  get diagnostics v_item_count = row_count;
  if v_item_count = 0 then raise exception 'لا توجد مواد مطابقة لنطاق جلسة الجرد.'; end if;

  insert into public.stock_count_participants (
    organization_id, stock_count_id, user_id, participant_role, assigned_by
  ) values (p_organization_id, v_count_id, p_actor_user_id, 'counter', p_actor_user_id)
  on conflict do nothing;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id,
    'stock_count_session_created', 'stock_count', v_count_id,
    jsonb_build_object(
      'count_number', v_count_number, 'warehouse', coalesce(p_warehouse, 'all'),
      'category_id', p_category_id, 'blind_count', coalesce(p_blind_count, true),
      'snapshot_at', now(), 'items_count', v_item_count
    )
  );

  return jsonb_build_object(
    'success', true, 'duplicate', false, 'stock_count_id', v_count_id,
    'count_number', v_count_number, 'items_count', v_item_count
  );
end;
$$;

create or replace function public.save_stock_count_progress_atomic(
  p_organization_id uuid,
  p_stock_count_id uuid,
  p_lines jsonb,
  p_mode text,
  p_submit boolean,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count public.stock_counts%rowtype;
  v_line jsonb;
  v_item_id uuid;
  v_quantity numeric(14,4);
  v_reason text;
  v_saved integer := 0;
begin
  select * into v_count from public.stock_counts sc
  where sc.id = p_stock_count_id and sc.organization_id = p_organization_id
  for update;
  if not found then raise exception 'جلسة الجرد غير موجودة.'; end if;
  perform public.assert_stock_count_actor(p_organization_id, v_count.branch_id, p_actor_user_id, false);
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'بنود الجرد غير صالحة.'; end if;
  if p_mode not in ('first', 'recount') then raise exception 'مرحلة العد غير صالحة.'; end if;
  if p_mode = 'first' and v_count.status <> 'counting' then raise exception 'الجلسة ليست في مرحلة العد الأول.'; end if;
  if p_mode = 'recount' and v_count.status <> 'recount' then raise exception 'الجلسة ليست في مرحلة إعادة العد.'; end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    begin
      v_item_id := (v_line->>'item_id')::uuid;
      v_quantity := round((v_line->>'quantity')::numeric, 4);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'أحد بنود العد غير صالح.';
    end;
    if v_quantity < 0 then raise exception 'كمية العد لا يمكن أن تكون سالبة.'; end if;
    v_reason := nullif(btrim(v_line->>'variance_reason'), '');

    if p_mode = 'first' then
      update public.stock_count_items sci
      set first_count_quantity = v_quantity,
          variance_reason = coalesce(v_reason, sci.variance_reason),
          count_state = 'counted', first_counted_by = p_actor_user_id,
          first_counted_at = now(), updated_at = now()
      where sci.organization_id = p_organization_id
        and sci.stock_count_id = p_stock_count_id and sci.item_id = v_item_id;
    else
      update public.stock_count_items sci
      set second_count_quantity = v_quantity,
          counted_quantity = v_quantity,
          variance_reason = coalesce(v_reason, sci.variance_reason),
          count_state = 'resolved', recounted_by = p_actor_user_id,
          recounted_at = now(), updated_at = now()
      where sci.organization_id = p_organization_id
        and sci.stock_count_id = p_stock_count_id and sci.item_id = v_item_id
        and sci.count_state = 'recount_required';
    end if;
    if found then v_saved := v_saved + 1; end if;
  end loop;

  if coalesce(p_submit, false) then
    if p_mode = 'first' then
      if exists (
        select 1 from public.stock_count_items sci
        where sci.organization_id = p_organization_id
          and sci.stock_count_id = p_stock_count_id
          and sci.first_count_quantity is null
      ) then raise exception 'لا يمكن إنهاء العد قبل تسجيل جميع المواد.'; end if;
      update public.stock_counts set status = 'review', submitted_at = now(), updated_at = now()
      where id = p_stock_count_id and organization_id = p_organization_id;
    else
      if exists (
        select 1 from public.stock_count_items sci
        where sci.organization_id = p_organization_id
          and sci.stock_count_id = p_stock_count_id
          and sci.count_state = 'recount_required'
      ) then raise exception 'أكمل جميع بنود إعادة العد قبل الإرسال.'; end if;
      update public.stock_count_items
      set counted_quantity = coalesce(second_count_quantity, first_count_quantity),
          count_state = 'resolved', updated_at = now()
      where organization_id = p_organization_id and stock_count_id = p_stock_count_id;
      update public.stock_counts set status = 'pending_approval', reviewed_at = now(), updated_at = now()
      where id = p_stock_count_id and organization_id = p_organization_id;
    end if;
  end if;

  insert into public.stock_count_participants (
    organization_id, stock_count_id, user_id, participant_role, assigned_by
  ) values (p_organization_id, p_stock_count_id, p_actor_user_id, 'counter', p_actor_user_id)
  on conflict do nothing;
  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, v_count.branch_id, p_actor_user_id,
    case when p_submit then 'stock_count_stage_submitted' else 'stock_count_progress_saved' end,
    'stock_count', p_stock_count_id,
    jsonb_build_object('mode', p_mode, 'saved_lines', v_saved, 'submitted', coalesce(p_submit, false))
  );
  return jsonb_build_object('success', true, 'saved_lines', v_saved, 'submitted', coalesce(p_submit, false));
end;
$$;

create or replace function public.transition_stock_count_session_atomic(
  p_organization_id uuid,
  p_stock_count_id uuid,
  p_action text,
  p_item_ids jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count public.stock_counts%rowtype;
  v_role text;
  v_changed integer := 0;
begin
  select * into v_count from public.stock_counts sc
  where sc.id = p_stock_count_id and sc.organization_id = p_organization_id
  for update;
  if not found then raise exception 'جلسة الجرد غير موجودة.'; end if;
  v_role := public.assert_stock_count_actor(
    p_organization_id, v_count.branch_id, p_actor_user_id,
    p_action in ('approve', 'cancel', 'close')
  );

  if p_action = 'request_recount' then
    if v_count.status <> 'review' then raise exception 'إعادة العد متاحة من مرحلة المراجعة فقط.'; end if;
    if p_item_ids is not null and jsonb_typeof(p_item_ids) <> 'array' then
      raise exception 'قائمة مواد إعادة العد غير صالحة.';
    end if;
    update public.stock_count_items sci
    set count_state = 'recount_required', updated_at = now()
    where sci.organization_id = p_organization_id and sci.stock_count_id = p_stock_count_id
      and sci.first_count_quantity is distinct from sci.system_quantity
      and (
        p_item_ids is null
        or sci.item_id::text in (select jsonb_array_elements_text(p_item_ids))
      );
    get diagnostics v_changed = row_count;
    if v_changed = 0 then raise exception 'لا توجد بنود فروقات محددة لإعادة العد.'; end if;
    update public.stock_counts set status = 'recount', updated_at = now()
    where id = p_stock_count_id and organization_id = p_organization_id;
  elsif p_action = 'submit_review' then
    if v_count.status <> 'review' then raise exception 'الجلسة ليست في مرحلة المراجعة.'; end if;
    update public.stock_count_items
    set counted_quantity = first_count_quantity, count_state = 'resolved', updated_at = now()
    where organization_id = p_organization_id and stock_count_id = p_stock_count_id;
    update public.stock_counts set status = 'pending_approval', reviewed_at = now(), updated_at = now()
    where id = p_stock_count_id and organization_id = p_organization_id;
  elsif p_action = 'approve' then
    if v_count.status <> 'pending_approval' then raise exception 'الجلسة ليست بانتظار الاعتماد.'; end if;
    if v_count.created_by = p_actor_user_id and v_role not in ('super_admin', 'organization_owner') then
      raise exception 'لا يجوز لمن أنشأ الجرد أن يعتمد جرده بنفسه.';
    end if;
    update public.stock_counts
    set status = 'approved', approved_at = now(), approved_by = p_actor_user_id, updated_at = now()
    where id = p_stock_count_id and organization_id = p_organization_id;
  elsif p_action = 'cancel' then
    if v_count.status not in ('counting', 'review', 'recount', 'pending_approval') then
      raise exception 'لا يمكن إلغاء الجلسة بعد اعتمادها أو ترحيلها.';
    end if;
    update public.stock_counts set status = 'cancelled', updated_at = now()
    where id = p_stock_count_id and organization_id = p_organization_id;
  elsif p_action = 'close' then
    if v_count.status <> 'posted' then raise exception 'يجب ترحيل فروقات الجرد قبل الإغلاق.'; end if;
    update public.stock_counts set status = 'closed', closed_at = now(), updated_at = now()
    where id = p_stock_count_id and organization_id = p_organization_id;
  else
    raise exception 'إجراء جلسة الجرد غير معروف.';
  end if;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, v_count.branch_id, p_actor_user_id,
    'stock_count_' || p_action, 'stock_count', p_stock_count_id,
    jsonb_build_object('previous_status', v_count.status, 'affected_items', v_changed)
  );
  return jsonb_build_object('success', true, 'action', p_action, 'affected_items', v_changed);
end;
$$;

create or replace function public.post_stock_count_session_atomic(
  p_organization_id uuid,
  p_stock_count_id uuid,
  p_idempotency_key text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count public.stock_counts%rowtype;
  v_item record;
  v_current_quantity numeric(14,4);
  v_variance numeric(14,4);
  v_total_variance numeric(18,4) := 0;
  v_variance_count integer := 0;
  v_journal jsonb;
begin
  select * into v_count from public.stock_counts sc
  where sc.id = p_stock_count_id and sc.organization_id = p_organization_id
  for update;
  if not found then raise exception 'جلسة الجرد غير موجودة.'; end if;
  perform public.assert_stock_count_actor(p_organization_id, v_count.branch_id, p_actor_user_id, true);
  if v_count.status in ('posted', 'closed') then
    return jsonb_build_object(
      'success', true, 'duplicate', true, 'stock_count_id', p_stock_count_id,
      'status', v_count.status
    );
  end if;
  if v_count.status <> 'approved' then raise exception 'يجب اعتماد الجرد قبل الترحيل.'; end if;
  if coalesce(p_idempotency_key, '') = '' then raise exception 'مفتاح منع التكرار مطلوب.'; end if;
  if public.is_accounting_period_closed(p_organization_id, v_count.counted_at::date) then
    raise exception 'الفترة المحاسبية لتاريخ الجرد مقفلة.';
  end if;

  for v_item in
    select sci.item_id, sci.system_quantity, sci.counted_quantity, sci.unit_cost_snapshot
    from public.stock_count_items sci
    where sci.organization_id = p_organization_id and sci.stock_count_id = p_stock_count_id
    order by sci.item_id
  loop
    if v_item.counted_quantity is null then raise exception 'توجد مادة بلا كمية نهائية.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || v_item.item_id::text, 0));
    insert into public.branch_stock (
      organization_id, branch_id, item_id, quantity, reserved_quantity, created_by
    ) values (
      p_organization_id, v_count.branch_id, v_item.item_id, 0, 0, p_actor_user_id
    ) on conflict (branch_id, item_id) do nothing;
    select bs.quantity into v_current_quantity
    from public.branch_stock bs
    where bs.organization_id = p_organization_id
      and bs.branch_id = v_count.branch_id and bs.item_id = v_item.item_id
    for update;

    v_variance := round(v_item.counted_quantity - v_item.system_quantity, 4);
    if v_variance <> 0 then
      update public.branch_stock
      set quantity = quantity + v_variance, updated_at = now()
      where organization_id = p_organization_id
        and branch_id = v_count.branch_id and item_id = v_item.item_id;
      insert into public.stock_movements (
        organization_id, branch_id, item_id, movement_type, quantity, unit_cost,
        source_doc_type, source_doc_id, idempotency_key, notes, created_by
      ) values (
        p_organization_id, v_count.branch_id, v_item.item_id, 'stock_count',
        v_variance, v_item.unit_cost_snapshot, 'stock_count', p_stock_count_id,
        p_idempotency_key || ':' || v_item.item_id::text,
        'تسوية جلسة جرد ' || coalesce(v_count.count_number, left(p_stock_count_id::text, 8)),
        p_actor_user_id
      );
      v_total_variance := round(v_total_variance + (v_variance * v_item.unit_cost_snapshot), 4);
      v_variance_count := v_variance_count + 1;
    end if;
  end loop;

  if v_total_variance <> 0 then
    select public.post_balanced_journal_atomic(
      p_organization_id, v_count.branch_id, 'stock_count', p_stock_count_id,
      'تسوية فروقات جلسة جرد ' || coalesce(v_count.count_number, left(p_stock_count_id::text, 8)),
      v_count.counted_at::date,
      case when v_total_variance < 0 then jsonb_build_array(
        jsonb_build_object('system_key', 'cash_over_short', 'debit', abs(v_total_variance), 'credit', 0, 'memo', 'عجز جرد مخزني'),
        jsonb_build_object('system_key', 'inventory', 'debit', 0, 'credit', abs(v_total_variance), 'memo', 'تخفيض المخزون بعجز الجرد')
      ) else jsonb_build_array(
        jsonb_build_object('system_key', 'inventory', 'debit', v_total_variance, 'credit', 0, 'memo', 'زيادة جرد مخزني'),
        jsonb_build_object('system_key', 'cash_over_short', 'debit', 0, 'credit', v_total_variance, 'memo', 'تسوية زيادة الجرد')
      ) end,
      p_actor_user_id
    ) into v_journal;
  end if;

  update public.stock_counts
  set status = 'posted', posted_at = now(), posted_by = p_actor_user_id, updated_at = now()
  where id = p_stock_count_id and organization_id = p_organization_id;
  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, v_count.branch_id, p_actor_user_id,
    'stock_count_posted_atomic', 'stock_count', p_stock_count_id,
    jsonb_build_object(
      'variance_count', v_variance_count, 'financial_variance', v_total_variance,
      'journal_entry_id', v_journal->>'entry_id', 'snapshot_at', v_count.snapshot_at
    )
  );
  return jsonb_build_object(
    'success', true, 'duplicate', false, 'stock_count_id', p_stock_count_id,
    'variance_count', v_variance_count, 'financial_variance', v_total_variance,
    'journal_entry_id', v_journal->>'entry_id', 'status', 'posted'
  );
end;
$$;

revoke all on function public.assert_stock_count_actor(uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.create_stock_count_session_atomic(uuid, uuid, date, text, uuid, boolean, numeric, text, text, uuid) from public, anon, authenticated;
revoke all on function public.save_stock_count_progress_atomic(uuid, uuid, jsonb, text, boolean, uuid) from public, anon, authenticated;
revoke all on function public.transition_stock_count_session_atomic(uuid, uuid, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.post_stock_count_session_atomic(uuid, uuid, text, uuid) from public, anon, authenticated;

grant execute on function public.assert_stock_count_actor(uuid, uuid, uuid, boolean) to service_role;
grant execute on function public.create_stock_count_session_atomic(uuid, uuid, date, text, uuid, boolean, numeric, text, text, uuid) to service_role;
grant execute on function public.save_stock_count_progress_atomic(uuid, uuid, jsonb, text, boolean, uuid) to service_role;
grant execute on function public.transition_stock_count_session_atomic(uuid, uuid, text, jsonb, uuid) to service_role;
grant execute on function public.post_stock_count_session_atomic(uuid, uuid, text, uuid) to service_role;

-- Validation before production push:
-- select organization_id, count_number, count(*) from stock_counts
-- where count_number is not null group by organization_id, count_number having count(*) > 1;
-- select sc.id from stock_counts sc left join stock_count_items sci on sci.stock_count_id = sc.id
-- where sc.status in ('counting','review','recount','pending_approval','approved')
-- group by sc.id having count(sci.id) = 0;
-- Forward correction: cancel an unposted bad session. Posted sessions are corrected by a new adjustment session.
