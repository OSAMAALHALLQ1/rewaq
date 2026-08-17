-- P0 purchasing lifecycle hardening.
--
-- Extends the existing purchase_orders -> goods_receipts -> stock_movements ->
-- journal_entries flow.  It deliberately does not create a second inventory or
-- accounting ledger.  Accepted receipt quantities update the canonical
-- branch_stock/stock_movements projection and the journal is posted through
-- post_balanced_journal_atomic in the same PostgreSQL transaction.

-- ---------------------------------------------------------------------------
-- 1. Purchase-order commercial, destination, approval, and idempotency data.
-- ---------------------------------------------------------------------------

alter table public.purchase_orders
  alter column total type numeric(16,4),
  add column if not exists destination_warehouse text not null default 'general',
  add column if not exists destination_location text not null default 'منطقة الاستلام',
  add column if not exists payment_terms text not null default 'حسب الاتفاق',
  add column if not exists subtotal numeric(16,4) not null default 0,
  add column if not exists discount_total numeric(16,4) not null default 0,
  add column if not exists tax_total numeric(16,4) not null default 0,
  add column if not exists shipping_total numeric(16,4) not null default 0,
  add column if not exists attachment_metadata jsonb not null default '[]'::jsonb,
  add column if not exists approval_status text not null default 'not_submitted',
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists submit_idempotency_key text,
  add column if not exists approval_idempotency_key text,
  add column if not exists request_fingerprint text;

alter table public.purchase_order_items
  alter column expected_unit_price type numeric(16,4),
  add column if not exists discount_amount numeric(16,4) not null default 0,
  add column if not exists tax_rate numeric(8,4) not null default 0,
  add column if not exists tax_amount numeric(16,4) not null default 0,
  add column if not exists line_total numeric(16,4) not null default 0,
  add column if not exists rejected_quantity numeric(14,4) not null default 0;

do $constraints$
begin
  if not exists (select 1 from pg_constraint where conname = 'purchase_orders_destination_warehouse_check') then
    alter table public.purchase_orders add constraint purchase_orders_destination_warehouse_check
      check (destination_warehouse in ('general', 'kitchen'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_orders_dates_check') then
    alter table public.purchase_orders add constraint purchase_orders_dates_check
      check (expected_date is null or expected_date >= order_date);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_orders_commercial_totals_check') then
    alter table public.purchase_orders add constraint purchase_orders_commercial_totals_check
      check (
        subtotal >= 0 and discount_total >= 0 and discount_total <= subtotal
        and tax_total >= 0 and shipping_total >= 0 and total >= 0
        and total = round(subtotal - discount_total + tax_total + shipping_total, 4)
      ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_orders_attachment_metadata_check') then
    alter table public.purchase_orders add constraint purchase_orders_attachment_metadata_check
      check (jsonb_typeof(attachment_metadata) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_orders_approval_status_check') then
    alter table public.purchase_orders add constraint purchase_orders_approval_status_check
      check (approval_status in ('not_submitted', 'pending', 'approved'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_order_items_commercial_values_check') then
    alter table public.purchase_order_items add constraint purchase_order_items_commercial_values_check
      check (
        quantity > 0 and expected_unit_price >= 0 and discount_amount >= 0
        and discount_amount <= round(quantity * expected_unit_price, 4)
        and tax_rate >= 0 and tax_rate <= 100 and tax_amount >= 0
        and line_total = round(quantity * expected_unit_price - discount_amount + tax_amount, 4)
        and received_quantity >= 0 and received_quantity <= quantity
        and rejected_quantity >= 0
      ) not valid;
  end if;
end
$constraints$;

update public.purchase_order_items
set line_total = round(quantity * expected_unit_price - discount_amount + tax_amount, 4)
where line_total <> round(quantity * expected_unit_price - discount_amount + tax_amount, 4);

with item_totals as (
  select poi.organization_id, poi.purchase_order_id,
         round(sum(poi.quantity * poi.expected_unit_price), 4) as subtotal,
         round(sum(poi.discount_amount), 4) as discount_total,
         round(sum(poi.tax_amount), 4) as tax_total
  from public.purchase_order_items poi
  group by poi.organization_id, poi.purchase_order_id
)
update public.purchase_orders po
set subtotal = totals.subtotal,
    discount_total = totals.discount_total,
    tax_total = totals.tax_total,
    shipping_total = greatest(coalesce(po.total, 0)
      - totals.subtotal + totals.discount_total - totals.tax_total, 0),
    total = round(totals.subtotal - totals.discount_total + totals.tax_total
      + greatest(coalesce(po.total, 0) - totals.subtotal + totals.discount_total - totals.tax_total, 0), 4)
from item_totals totals
where totals.organization_id = po.organization_id
  and totals.purchase_order_id = po.id;

update public.purchase_orders
set approval_status = 'approved',
    submitted_at = coalesce(submitted_at, created_at),
    submitted_by = coalesce(submitted_by, created_by),
    approved_at = coalesce(approved_at, updated_at, created_at),
    approved_by = coalesce(approved_by, created_by)
where status <> 'draft' and approval_status = 'not_submitted';

create unique index if not exists purchase_orders_org_submit_key_unique
  on public.purchase_orders (organization_id, submit_idempotency_key)
  where submit_idempotency_key is not null;
create unique index if not exists purchase_orders_org_idempotency_unique
  on public.purchase_orders (organization_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists purchase_orders_org_approval_key_unique
  on public.purchase_orders (organization_id, approval_idempotency_key)
  where approval_idempotency_key is not null;
create index if not exists purchase_orders_org_approval_status_idx
  on public.purchase_orders (organization_id, approval_status, order_date desc);

-- ---------------------------------------------------------------------------
-- 2. Receipt inspection, lot/expiry/location traceability, and journal link.
-- ---------------------------------------------------------------------------

alter table public.goods_receipts
  alter column total type numeric(16,4),
  add column if not exists destination_warehouse text not null default 'general',
  add column if not exists destination_location text not null default 'منطقة الاستلام',
  add column if not exists notes text,
  add column if not exists inventory_total numeric(16,4) not null default 0,
  add column if not exists tax_total numeric(16,4) not null default 0,
  add column if not exists accepted_quantity numeric(14,4) not null default 0,
  add column if not exists rejected_quantity numeric(14,4) not null default 0,
  add column if not exists journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  add column if not exists request_fingerprint text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.goods_receipt_items
  alter column quantity type numeric(14,4),
  alter column unit_cost type numeric(16,4),
  alter column total type numeric(16,4),
  add column if not exists accepted_quantity numeric(14,4) not null default 0,
  add column if not exists rejected_quantity numeric(14,4) not null default 0,
  add column if not exists rejection_reason text,
  add column if not exists batch_number text,
  add column if not exists expiry_date date,
  add column if not exists destination_warehouse text not null default 'general',
  add column if not exists destination_location text not null default 'منطقة الاستلام',
  add column if not exists inventory_total numeric(16,4) not null default 0,
  add column if not exists tax_amount numeric(16,4) not null default 0;

alter table public.stock_movements
  add column if not exists goods_receipt_item_id uuid references public.goods_receipt_items(id) on delete restrict,
  add column if not exists batch_number text,
  add column if not exists expiry_date date,
  add column if not exists destination_warehouse text,
  add column if not exists destination_location text;

update public.goods_receipt_items
set accepted_quantity = quantity,
    inventory_total = case when inventory_total = 0 then total else inventory_total end
where accepted_quantity = 0 and rejected_quantity = 0 and quantity > 0;

update public.goods_receipts gr
set accepted_quantity = totals.accepted_quantity,
    rejected_quantity = totals.rejected_quantity,
    inventory_total = totals.inventory_total,
    tax_total = totals.tax_total,
    updated_at = coalesce(gr.updated_at, gr.created_at)
from (
  select gri.organization_id, gri.goods_receipt_id,
         round(sum(gri.accepted_quantity), 4) as accepted_quantity,
         round(sum(gri.rejected_quantity), 4) as rejected_quantity,
         round(sum(gri.inventory_total), 4) as inventory_total,
         round(sum(gri.tax_amount), 4) as tax_total
  from public.goods_receipt_items gri
  group by gri.organization_id, gri.goods_receipt_id
) totals
where totals.organization_id = gr.organization_id and totals.goods_receipt_id = gr.id;

do $receipt_constraints$
begin
  if not exists (select 1 from pg_constraint where conname = 'goods_receipts_destination_warehouse_check') then
    alter table public.goods_receipts add constraint goods_receipts_destination_warehouse_check
      check (destination_warehouse in ('general', 'kitchen'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goods_receipts_totals_check') then
    alter table public.goods_receipts add constraint goods_receipts_totals_check
      check (
        inventory_total >= 0 and tax_total >= 0
        and total = round(inventory_total + tax_total, 4)
        and accepted_quantity >= 0 and rejected_quantity >= 0
      ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goods_receipt_items_destination_warehouse_check') then
    alter table public.goods_receipt_items add constraint goods_receipt_items_destination_warehouse_check
      check (destination_warehouse in ('general', 'kitchen'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goods_receipt_items_inspection_check') then
    alter table public.goods_receipt_items add constraint goods_receipt_items_inspection_check
      check (
        quantity = accepted_quantity and accepted_quantity >= 0 and rejected_quantity >= 0
        and accepted_quantity + rejected_quantity > 0
        and (rejected_quantity = 0 or nullif(btrim(rejection_reason), '') is not null)
        and unit_cost >= 0 and inventory_total >= 0 and tax_amount >= 0
        and total = round(inventory_total + tax_amount, 4)
        and (expiry_date is null or nullif(btrim(batch_number), '') is not null)
      ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stock_movements_destination_warehouse_check') then
    alter table public.stock_movements add constraint stock_movements_destination_warehouse_check
      check (destination_warehouse is null or destination_warehouse in ('general', 'kitchen'));
  end if;
end
$receipt_constraints$;

alter table public.goods_receipts
  drop constraint if exists goods_receipts_idempotency_key_key;
create unique index if not exists goods_receipts_org_idempotency_unique
  on public.goods_receipts (organization_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists goods_receipt_items_receipt_po_line_unique
  on public.goods_receipt_items (goods_receipt_id, purchase_order_item_id)
  where purchase_order_item_id is not null;
create index if not exists goods_receipt_items_batch_expiry_idx
  on public.goods_receipt_items (organization_id, item_id, expiry_date, batch_number)
  where accepted_quantity > 0;
create index if not exists stock_movements_receipt_lot_idx
  on public.stock_movements (organization_id, goods_receipt_item_id, item_id, expiry_date)
  where goods_receipt_item_id is not null;

create or replace function public.prevent_purchasing_history_delete()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'لا يمكن حذف سجل شراء أو استلام؛ استخدم الإلغاء أو العكس أو التسوية الموثقة.';
end;
$$;

drop trigger if exists prevent_purchase_order_delete on public.purchase_orders;
create trigger prevent_purchase_order_delete before delete on public.purchase_orders
  for each row execute function public.prevent_purchasing_history_delete();
drop trigger if exists prevent_purchase_order_item_delete on public.purchase_order_items;
create trigger prevent_purchase_order_item_delete before delete on public.purchase_order_items
  for each row execute function public.prevent_purchasing_history_delete();
drop trigger if exists prevent_goods_receipt_delete on public.goods_receipts;
create trigger prevent_goods_receipt_delete before delete on public.goods_receipts
  for each row execute function public.prevent_purchasing_history_delete();
drop trigger if exists prevent_goods_receipt_item_delete on public.goods_receipt_items;
create trigger prevent_goods_receipt_item_delete before delete on public.goods_receipt_items
  for each row execute function public.prevent_purchasing_history_delete();

-- Composite keys make a child unable to reference a row from another tenant.
do $tenant_keys$
begin
  if not exists (select 1 from pg_constraint where conname = 'purchase_orders_org_id_unique') then
    alter table public.purchase_orders add constraint purchase_orders_org_id_unique unique (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_order_items_org_id_unique') then
    alter table public.purchase_order_items add constraint purchase_order_items_org_id_unique unique (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goods_receipts_org_id_unique') then
    alter table public.goods_receipts add constraint goods_receipts_org_id_unique unique (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goods_receipt_items_org_id_unique') then
    alter table public.goods_receipt_items add constraint goods_receipt_items_org_id_unique unique (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_order_items_parent_org_fk') then
    alter table public.purchase_order_items add constraint purchase_order_items_parent_org_fk
      foreign key (organization_id, purchase_order_id)
      references public.purchase_orders(organization_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goods_receipts_purchase_order_org_fk') then
    alter table public.goods_receipts add constraint goods_receipts_purchase_order_org_fk
      foreign key (organization_id, purchase_order_id)
      references public.purchase_orders(organization_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goods_receipt_items_receipt_org_fk') then
    alter table public.goods_receipt_items add constraint goods_receipt_items_receipt_org_fk
      foreign key (organization_id, goods_receipt_id)
      references public.goods_receipts(organization_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goods_receipt_items_po_item_org_fk') then
    alter table public.goods_receipt_items add constraint goods_receipt_items_po_item_org_fk
      foreign key (organization_id, purchase_order_item_id)
      references public.purchase_order_items(organization_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goods_receipts_journal_org_fk') then
    alter table public.goods_receipts add constraint goods_receipts_journal_org_fk
      foreign key (organization_id, journal_entry_id)
      references public.journal_entries(organization_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stock_movements_receipt_item_org_fk') then
    alter table public.stock_movements add constraint stock_movements_receipt_item_org_fk
      foreign key (organization_id, goods_receipt_item_id)
      references public.goods_receipt_items(organization_id, id) on delete restrict not valid;
  end if;
end
$tenant_keys$;

-- Purchasing history is read through branch scope and mutated only by the
-- service-role RPCs below.  No direct client insert/update/delete policy remains.
drop policy if exists "purchase_orders branch insert" on public.purchase_orders;
drop policy if exists "purchase_orders branch update" on public.purchase_orders;
drop policy if exists "purchase_order_items org insert" on public.purchase_order_items;
drop policy if exists "purchase_order_items org update" on public.purchase_order_items;
drop policy if exists "purchase_order_items org read" on public.purchase_order_items;
create policy "purchase_order_items branch read" on public.purchase_order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.purchase_orders po
      where po.organization_id = purchase_order_items.organization_id
        and po.id = purchase_order_items.purchase_order_id
        and public.can_access_branch(po.organization_id, po.branch_id)
    )
  );

drop policy if exists goods_receipts_select on public.goods_receipts;
drop policy if exists goods_receipts_write on public.goods_receipts;
create policy goods_receipts_branch_select on public.goods_receipts
  for select to authenticated
  using (branch_id is not null and public.can_access_branch(organization_id, branch_id));

drop policy if exists goods_receipt_items_select on public.goods_receipt_items;
drop policy if exists goods_receipt_items_write on public.goods_receipt_items;
create policy goods_receipt_items_branch_select on public.goods_receipt_items
  for select to authenticated
  using (
    exists (
      select 1 from public.goods_receipts gr
      where gr.organization_id = goods_receipt_items.organization_id
        and gr.id = goods_receipt_items.goods_receipt_id
        and gr.branch_id is not null
        and public.can_access_branch(gr.organization_id, gr.branch_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Multi-line draft creation.  A PO has no stock/accounting effect.
-- ---------------------------------------------------------------------------

drop function if exists public.create_purchase_order_atomic(
  uuid, uuid, uuid, uuid, numeric, numeric, date,
  public.purchase_order_status, text, text, uuid
);

create or replace function public.create_purchase_order_atomic(
  p_organization_id uuid,
  p_supplier_id uuid,
  p_branch_id uuid,
  p_order_date date,
  p_expected_date date,
  p_destination_warehouse text,
  p_destination_location text,
  p_payment_terms text,
  p_items jsonb,
  p_shipping_amount numeric,
  p_idempotency_key text,
  p_created_by uuid,
  p_notes text,
  p_attachment_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_actor_branch uuid;
  v_existing public.purchase_orders%rowtype;
  v_order_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_item_ids uuid[] := '{}'::uuid[];
  v_quantity numeric(14,4);
  v_unit_price numeric(16,4);
  v_discount numeric(16,4);
  v_tax_rate numeric(8,4);
  v_line_subtotal numeric(16,4);
  v_line_tax numeric(16,4);
  v_line_total numeric(16,4);
  v_subtotal numeric(16,4) := 0;
  v_discount_total numeric(16,4) := 0;
  v_tax_total numeric(16,4) := 0;
  v_shipping_total numeric(16,4);
  v_total numeric(16,4);
  v_fingerprint text;
begin
  select m.role::text, m.branch_id into v_actor_role, v_actor_branch
  from public.organization_memberships m
  where m.organization_id = p_organization_id and m.user_id = p_created_by
  limit 1;
  if not found or v_actor_role not in ('super_admin', 'organization_owner', 'branch_manager', 'purchasing_manager') then
    raise exception 'ليس لديك صلاحية إنشاء أمر شراء لهذه المؤسسة.';
  end if;
  if v_actor_role not in ('super_admin', 'organization_owner')
     and (v_actor_branch is null or v_actor_branch <> p_branch_id) then
    raise exception 'لا يمكنك إنشاء أمر شراء خارج فرعك المخصص.';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null or length(btrim(p_idempotency_key)) < 8 then
    raise exception 'مفتاح منع التكرار مطلوب.';
  end if;
  if p_order_date is null or p_expected_date is null or p_expected_date < p_order_date then
    raise exception 'تاريخ الأمر والتسليم المتوقع غير صالحين.';
  end if;
  if p_destination_warehouse is null or p_destination_warehouse not in ('general', 'kitchen') then
    raise exception 'المستودع الوجهة غير صالح.';
  end if;
  if nullif(btrim(p_destination_location), '') is null then
    raise exception 'موقع الاستلام داخل المستودع مطلوب.';
  end if;
  if nullif(btrim(p_payment_terms), '') is null then
    raise exception 'شروط الدفع مطلوبة.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 200 then
    raise exception 'أمر الشراء يحتاج من بند واحد إلى 200 بند.';
  end if;
  if jsonb_typeof(coalesce(p_attachment_metadata, '[]'::jsonb)) <> 'array' then
    raise exception 'بيانات المرفقات يجب أن تكون مصفوفة.';
  end if;
  v_shipping_total := round(coalesce(p_shipping_amount, 0), 4);
  if v_shipping_total < 0 then raise exception 'تكلفة الشحن لا يمكن أن تكون سالبة.'; end if;

  if not exists (
    select 1 from public.suppliers s
    where s.id = p_supplier_id and s.organization_id = p_organization_id and s.status = 'active'
  ) then raise exception 'المورد غير موجود أو غير نشط.'; end if;
  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.organization_id = p_organization_id and b.status = 'active'
  ) then raise exception 'الفرع غير موجود أو غير نشط.'; end if;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_line) <> 'object' then raise exception 'صيغة أحد بنود أمر الشراء غير صالحة.'; end if;
    begin
      v_item_id := (v_line->>'item_id')::uuid;
      v_quantity := round((v_line->>'quantity')::numeric, 4);
      v_unit_price := round((v_line->>'unit_price')::numeric, 4);
      v_discount := round(coalesce(nullif(v_line->>'discount_amount', '')::numeric, 0), 4);
      v_tax_rate := round(coalesce(nullif(v_line->>'tax_rate', '')::numeric, 0), 4);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'معرف الصنف أو الكمية أو السعر أو الضريبة غير صالح.';
    end;
    if v_item_id is null or v_quantity is null or v_unit_price is null
       or v_discount is null or v_tax_rate is null then
      raise exception 'أحد بنود أمر الشراء غير مكتمل.';
    end if;
    if v_item_id = any(v_item_ids) then raise exception 'لا يمكن تكرار الصنف نفسه داخل أمر الشراء.'; end if;
    v_item_ids := array_append(v_item_ids, v_item_id);
    if v_quantity <= 0 or v_unit_price < 0 then raise exception 'كمية أو سعر أحد البنود غير صالح.'; end if;
    if v_tax_rate < 0 or v_tax_rate > 100 then raise exception 'نسبة الضريبة يجب أن تكون بين صفر و100.'; end if;
    v_line_subtotal := round(v_quantity * v_unit_price, 4);
    if v_discount < 0 or v_discount > v_line_subtotal then raise exception 'خصم أحد البنود يتجاوز قيمته.'; end if;
    if not exists (
      select 1 from public.inventory_items ii
      where ii.id = v_item_id and ii.organization_id = p_organization_id and ii.status = 'active'
    ) then raise exception 'أحد أصناف أمر الشراء غير موجود أو غير نشط.'; end if;
    v_line_tax := round((v_line_subtotal - v_discount) * v_tax_rate / 100, 4);
    v_subtotal := round(v_subtotal + v_line_subtotal, 4);
    v_discount_total := round(v_discount_total + v_discount, 4);
    v_tax_total := round(v_tax_total + v_line_tax, 4);
  end loop;
  v_total := round(v_subtotal - v_discount_total + v_tax_total + v_shipping_total, 4);
  v_fingerprint := encode(digest(concat_ws('|',
    p_organization_id::text, p_supplier_id::text, p_branch_id::text,
    p_order_date::text, p_expected_date::text, p_destination_warehouse,
    btrim(p_destination_location), btrim(p_payment_terms), p_items::text,
    v_shipping_total::text, coalesce(btrim(p_notes), ''),
    coalesce(p_attachment_metadata, '[]'::jsonb)::text
  ), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':purchase-order:' || btrim(p_idempotency_key), 0
  ));
  select * into v_existing from public.purchase_orders po
  where po.organization_id = p_organization_id and po.idempotency_key = btrim(p_idempotency_key)
  for update;
  if found then
    if v_existing.request_fingerprint is not null and v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'أعيد استخدام مفتاح أمر الشراء ببيانات مختلفة.';
    end if;
    return jsonb_build_object('success', true, 'duplicate', true,
      'purchase_order_id', v_existing.id, 'status', v_existing.status, 'total', v_existing.total);
  end if;

  insert into public.purchase_orders (
    organization_id, supplier_id, branch_id, status, order_date, expected_date,
    destination_warehouse, destination_location, payment_terms,
    subtotal, discount_total, tax_total, shipping_total, total,
    notes, attachment_metadata, approval_status, idempotency_key,
    request_fingerprint, created_by
  ) values (
    p_organization_id, p_supplier_id, p_branch_id, 'draft', p_order_date, p_expected_date,
    p_destination_warehouse, btrim(p_destination_location), btrim(p_payment_terms),
    v_subtotal, v_discount_total, v_tax_total, v_shipping_total, v_total,
    nullif(btrim(p_notes), ''), coalesce(p_attachment_metadata, '[]'::jsonb),
    'not_submitted', btrim(p_idempotency_key), v_fingerprint, p_created_by
  ) returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := (v_line->>'item_id')::uuid;
    v_quantity := round((v_line->>'quantity')::numeric, 4);
    v_unit_price := round((v_line->>'unit_price')::numeric, 4);
    v_discount := round(coalesce(nullif(v_line->>'discount_amount', '')::numeric, 0), 4);
    v_tax_rate := round(coalesce(nullif(v_line->>'tax_rate', '')::numeric, 0), 4);
    v_line_subtotal := round(v_quantity * v_unit_price, 4);
    v_line_tax := round((v_line_subtotal - v_discount) * v_tax_rate / 100, 4);
    v_line_total := round(v_line_subtotal - v_discount + v_line_tax, 4);
    insert into public.purchase_order_items (
      organization_id, purchase_order_id, item_id, quantity, expected_unit_price,
      discount_amount, tax_rate, tax_amount, line_total,
      received_quantity, rejected_quantity, created_by
    ) values (
      p_organization_id, v_order_id, v_item_id, v_quantity, v_unit_price,
      v_discount, v_tax_rate, v_line_tax, v_line_total, 0, 0, p_created_by
    );
  end loop;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, p_branch_id, p_created_by, 'purchase_order_draft_created',
    'purchase_order', v_order_id,
    jsonb_build_object(
      'supplier_id', p_supplier_id, 'item_count', jsonb_array_length(p_items),
      'order_date', p_order_date, 'expected_date', p_expected_date,
      'destination_warehouse', p_destination_warehouse,
      'destination_location', btrim(p_destination_location),
      'subtotal', v_subtotal, 'discount_total', v_discount_total,
      'tax_total', v_tax_total, 'shipping_total', v_shipping_total, 'total', v_total,
      'attachment_count', jsonb_array_length(coalesce(p_attachment_metadata, '[]'::jsonb)),
      'idempotency_key', btrim(p_idempotency_key)
    )
  );
  return jsonb_build_object('success', true, 'duplicate', false,
    'purchase_order_id', v_order_id, 'status', 'draft', 'total', v_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Explicit submit -> approve/send lifecycle with segregation of duties.
-- ---------------------------------------------------------------------------

create or replace function public.submit_purchase_order_atomic(
  p_organization_id uuid,
  p_purchase_order_id uuid,
  p_idempotency_key text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_role text;
  v_actor_branch uuid;
begin
  select m.role::text, m.branch_id into v_role, v_actor_branch
  from public.organization_memberships m
  where m.organization_id = p_organization_id and m.user_id = p_actor_user_id
  limit 1;
  if not found or v_role not in ('super_admin', 'organization_owner', 'branch_manager', 'purchasing_manager') then
    raise exception 'ليس لديك صلاحية إرسال أمر الشراء للموافقة.';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null or length(btrim(p_idempotency_key)) < 8 then
    raise exception 'مفتاح منع التكرار مطلوب.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':purchase-order-submit:' || p_purchase_order_id::text, 0
  ));
  select * into v_order from public.purchase_orders po
  where po.organization_id = p_organization_id and po.id = p_purchase_order_id
  for update;
  if not found then raise exception 'أمر الشراء غير موجود.'; end if;
  if v_role not in ('super_admin', 'organization_owner')
     and (v_actor_branch is null or v_actor_branch <> v_order.branch_id) then
    raise exception 'لا يمكنك إرسال أمر شراء خارج فرعك المخصص.';
  end if;
  if v_order.submit_idempotency_key = btrim(p_idempotency_key)
     and v_order.approval_status in ('pending', 'approved') then
    return jsonb_build_object('success', true, 'duplicate', true,
      'purchase_order_id', v_order.id, 'approval_status', v_order.approval_status);
  end if;
  if v_order.status <> 'draft' or v_order.approval_status <> 'not_submitted' then
    raise exception 'لا يمكن إرسال أمر الشراء من حالته الحالية.';
  end if;
  update public.purchase_orders
  set approval_status = 'pending', submitted_at = now(), submitted_by = p_actor_user_id,
      submit_idempotency_key = btrim(p_idempotency_key), updated_at = now()
  where organization_id = p_organization_id and id = p_purchase_order_id;
  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, v_order.branch_id, p_actor_user_id,
    'purchase_order_submitted', 'purchase_order', p_purchase_order_id,
    jsonb_build_object('total', v_order.total, 'submitted_at', now(),
      'idempotency_key', btrim(p_idempotency_key))
  );
  return jsonb_build_object('success', true, 'duplicate', false,
    'purchase_order_id', p_purchase_order_id, 'approval_status', 'pending');
end;
$$;

create or replace function public.approve_purchase_order_atomic(
  p_organization_id uuid,
  p_purchase_order_id uuid,
  p_idempotency_key text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_role text;
  v_actor_branch uuid;
begin
  select m.role::text, m.branch_id into v_role, v_actor_branch
  from public.organization_memberships m
  where m.organization_id = p_organization_id and m.user_id = p_actor_user_id
  limit 1;
  if not found or v_role not in ('super_admin', 'organization_owner', 'purchasing_manager') then
    raise exception 'ليس لديك صلاحية اعتماد أمر الشراء.';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null or length(btrim(p_idempotency_key)) < 8 then
    raise exception 'مفتاح منع التكرار مطلوب.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':purchase-order-approve:' || p_purchase_order_id::text, 0
  ));
  select * into v_order from public.purchase_orders po
  where po.organization_id = p_organization_id and po.id = p_purchase_order_id
  for update;
  if not found then raise exception 'أمر الشراء غير موجود.'; end if;
  if v_role not in ('super_admin', 'organization_owner')
     and (v_actor_branch is null or v_actor_branch <> v_order.branch_id) then
    raise exception 'لا يمكنك اعتماد أمر شراء خارج فرعك المخصص.';
  end if;
  if v_order.approval_idempotency_key = btrim(p_idempotency_key)
     and v_order.approval_status = 'approved' and v_order.status = 'sent' then
    return jsonb_build_object('success', true, 'duplicate', true,
      'purchase_order_id', v_order.id, 'status', v_order.status);
  end if;
  if v_order.status <> 'draft' or v_order.approval_status <> 'pending' then
    raise exception 'أمر الشراء ليس بانتظار الموافقة.';
  end if;
  if v_order.submitted_by = p_actor_user_id then
    raise exception 'لا يجوز لمُرسل أمر الشراء اعتماد معاملته بنفسه.';
  end if;
  update public.purchase_orders
  set approval_status = 'approved', status = 'sent', approved_at = now(),
      approved_by = p_actor_user_id, approval_idempotency_key = btrim(p_idempotency_key),
      updated_at = now()
  where organization_id = p_organization_id and id = p_purchase_order_id;
  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    p_organization_id, v_order.branch_id, p_actor_user_id,
    'purchase_order_approved_and_sent', 'purchase_order', p_purchase_order_id,
    jsonb_build_object('status', 'draft', 'approval_status', 'pending'),
    jsonb_build_object('status', 'sent', 'approval_status', 'approved',
      'total', v_order.total, 'approved_at', now(),
      'idempotency_key', btrim(p_idempotency_key))
  );
  return jsonb_build_object('success', true, 'duplicate', false,
    'purchase_order_id', p_purchase_order_id, 'status', 'sent');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Partial inspection/receipt.  Rejected stock never enters branch_stock.
-- ---------------------------------------------------------------------------

drop function if exists public.record_purchase_receipt_atomic(uuid, uuid, date, text, uuid);

create or replace function public.record_purchase_receipt_atomic(
  p_organization_id uuid,
  p_purchase_order_id uuid,
  p_received_at date,
  p_lines jsonb,
  p_notes text,
  p_idempotency_key text,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_actor_branch uuid;
  v_order public.purchase_orders%rowtype;
  v_existing public.goods_receipts%rowtype;
  v_receipt_id uuid;
  v_receipt_item_id uuid;
  v_receipt_number text;
  v_journal_entry_id uuid;
  v_posting_result jsonb;
  v_journal_lines jsonb;
  v_line jsonb;
  v_po_item_id uuid;
  v_seen_po_item_ids uuid[] := '{}'::uuid[];
  v_item record;
  v_accepted numeric(14,4);
  v_rejected numeric(14,4);
  v_outstanding numeric(14,4);
  v_rejection_reason text;
  v_batch_number text;
  v_expiry_date date;
  v_destination_warehouse text;
  v_destination_location text;
  v_order_net_total numeric(16,4);
  v_total_order_quantity numeric(18,4);
  v_line_net_total numeric(16,4);
  v_base_inventory_total numeric(16,4);
  v_shipping_allocation numeric(16,4);
  v_line_inventory_total numeric(16,4);
  v_line_tax numeric(16,4);
  v_line_total numeric(16,4);
  v_landed_unit_cost numeric(16,4);
  v_inventory_total numeric(16,4) := 0;
  v_tax_total numeric(16,4) := 0;
  v_receipt_total numeric(16,4) := 0;
  v_accepted_total numeric(14,4) := 0;
  v_rejected_total numeric(14,4) := 0;
  v_old_org_stock numeric(18,4);
  v_old_average_cost numeric(16,4);
  v_new_average_cost numeric(16,4);
  v_lines_count integer := 0;
  v_all_received boolean;
  v_fingerprint text;
begin
  select m.role::text, m.branch_id into v_actor_role, v_actor_branch
  from public.organization_memberships m
  where m.organization_id = p_organization_id and m.user_id = p_created_by
  limit 1;
  if not found or v_actor_role not in (
    'super_admin', 'organization_owner', 'branch_manager', 'inventory_manager', 'purchasing_manager'
  ) then raise exception 'ليس لديك صلاحية تسجيل استلام مشتريات.'; end if;
  if nullif(btrim(p_idempotency_key), '') is null or length(btrim(p_idempotency_key)) < 8 then
    raise exception 'مفتاح منع التكرار مطلوب.';
  end if;
  if p_received_at is null or p_received_at > current_date + 1 then
    raise exception 'تاريخ الاستلام غير صالح أو مستقبلي.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 200 then
    raise exception 'إيصال الاستلام يحتاج من بند واحد إلى 200 بند.';
  end if;
  v_fingerprint := encode(digest(concat_ws('|',
    p_organization_id::text, p_purchase_order_id::text, p_received_at::text,
    p_lines::text, coalesce(btrim(p_notes), '')
  ), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':goods-receipt-key:' || btrim(p_idempotency_key), 0
  ));
  select * into v_existing from public.goods_receipts gr
  where gr.organization_id = p_organization_id and gr.idempotency_key = btrim(p_idempotency_key)
  for update;
  if found then
    if v_existing.request_fingerprint is not null and v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'أعيد استخدام مفتاح الاستلام ببيانات مختلفة.';
    end if;
    return jsonb_build_object('success', true, 'duplicate', true,
      'receipt_id', v_existing.id, 'purchase_order_id', v_existing.purchase_order_id,
      'journal_entry_id', v_existing.journal_entry_id, 'total', v_existing.total);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':purchase-order-receipt:' || p_purchase_order_id::text, 0
  ));
  select * into v_order from public.purchase_orders po
  where po.organization_id = p_organization_id and po.id = p_purchase_order_id
  for update;
  if not found then raise exception 'أمر الشراء غير موجود.'; end if;
  if v_actor_role not in ('super_admin', 'organization_owner')
     and (v_actor_branch is null or v_actor_branch <> v_order.branch_id) then
    raise exception 'لا يمكنك استلام أمر شراء خارج فرعك المخصص.';
  end if;
  if v_order.status not in ('sent', 'partially_received') or v_order.approval_status <> 'approved' then
    raise exception 'لا يمكن الاستلام قبل اعتماد وإرسال أمر الشراء.';
  end if;

  v_order_net_total := round(v_order.subtotal - v_order.discount_total, 4);
  select coalesce(sum(poi.quantity), 0) into v_total_order_quantity
  from public.purchase_order_items poi
  where poi.organization_id = p_organization_id and poi.purchase_order_id = p_purchase_order_id;
  v_receipt_id := gen_random_uuid();
  v_receipt_number := public.get_next_sequence_number(
    p_organization_id, v_order.branch_id, 'goods_receipt', 'GR-'
  );
  insert into public.goods_receipts (
    id, organization_id, purchase_order_id, supplier_id, branch_id, receipt_number,
    idempotency_key, received_at, destination_warehouse, destination_location,
    notes, inventory_total, tax_total, total, accepted_quantity, rejected_quantity,
    status, request_fingerprint, created_by
  ) values (
    v_receipt_id, p_organization_id, p_purchase_order_id, v_order.supplier_id,
    v_order.branch_id, v_receipt_number, btrim(p_idempotency_key), p_received_at,
    v_order.destination_warehouse, v_order.destination_location, nullif(btrim(p_notes), ''),
    0, 0, 0, 0, 0, 'posted', v_fingerprint, p_created_by
  );

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_line) <> 'object' then raise exception 'صيغة أحد بنود الاستلام غير صالحة.'; end if;
    begin
      v_po_item_id := (v_line->>'purchase_order_item_id')::uuid;
      v_accepted := round(coalesce(nullif(v_line->>'accepted_quantity', '')::numeric, 0), 4);
      v_rejected := round(coalesce(nullif(v_line->>'rejected_quantity', '')::numeric, 0), 4);
      v_expiry_date := nullif(v_line->>'expiry_date', '')::date;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'معرف بند الاستلام أو الكميات أو تاريخ الصلاحية غير صالح.';
    end;
    if v_po_item_id = any(v_seen_po_item_ids) then raise exception 'تكرر بند أمر الشراء داخل إيصال الاستلام.'; end if;
    v_seen_po_item_ids := array_append(v_seen_po_item_ids, v_po_item_id);
    if v_accepted < 0 or v_rejected < 0 or v_accepted + v_rejected <= 0 then
      raise exception 'أدخل كمية مقبولة أو مرفوضة موجبة لكل بند مرسل.';
    end if;
    v_rejection_reason := nullif(btrim(v_line->>'rejection_reason'), '');
    if v_rejected > 0 and v_rejection_reason is null then raise exception 'سبب رفض الكمية مطلوب.'; end if;
    v_batch_number := nullif(btrim(v_line->>'batch_number'), '');
    if v_expiry_date is not null and v_batch_number is null then raise exception 'رقم التشغيلة مطلوب عند إدخال الصلاحية.'; end if;
    if v_accepted > 0 and v_expiry_date is not null and v_expiry_date < p_received_at then
      raise exception 'لا يمكن قبول كمية منتهية الصلاحية.';
    end if;
    v_destination_warehouse := coalesce(nullif(v_line->>'destination_warehouse', ''), v_order.destination_warehouse);
    v_destination_location := coalesce(nullif(btrim(v_line->>'destination_location'), ''), v_order.destination_location);
    if v_destination_warehouse not in ('general', 'kitchen') or v_destination_location is null then
      raise exception 'وجهة أحد بنود الاستلام غير صالحة.';
    end if;

    select poi.id, poi.item_id, poi.quantity, poi.received_quantity,
           poi.expected_unit_price, poi.discount_amount, poi.tax_amount,
           ii.average_cost
      into v_item
    from public.purchase_order_items poi
    join public.inventory_items ii
      on ii.organization_id = poi.organization_id and ii.id = poi.item_id
    where poi.organization_id = p_organization_id
      and poi.purchase_order_id = p_purchase_order_id
      and poi.id = v_po_item_id
    for update of poi;
    if not found then raise exception 'أحد بنود الاستلام لا يتبع أمر الشراء.'; end if;
    v_outstanding := round(v_item.quantity - v_item.received_quantity, 4);
    if v_accepted + v_rejected > v_outstanding + 0.0001 then
      raise exception 'الكمية المفحوصة تتجاوز الكمية المفتوحة لأحد البنود.';
    end if;

    v_line_net_total := round(v_item.quantity * v_item.expected_unit_price - v_item.discount_amount, 4);
    v_base_inventory_total := round(v_accepted * v_line_net_total / v_item.quantity, 4);
    if v_order.shipping_total > 0 and v_accepted > 0 then
      if v_order_net_total > 0 then
        v_shipping_allocation := round(v_order.shipping_total * v_base_inventory_total / v_order_net_total, 4);
      elsif v_total_order_quantity > 0 then
        v_shipping_allocation := round(v_order.shipping_total * v_accepted / v_total_order_quantity, 4);
      else
        v_shipping_allocation := 0;
      end if;
    else
      v_shipping_allocation := 0;
    end if;
    v_line_inventory_total := round(v_base_inventory_total + v_shipping_allocation, 4);
    v_line_tax := round(v_accepted * v_item.tax_amount / v_item.quantity, 4);
    v_line_total := round(v_line_inventory_total + v_line_tax, 4);
    v_landed_unit_cost := case when v_accepted > 0
      then round(v_line_inventory_total / v_accepted, 4) else 0 end;
    v_receipt_item_id := gen_random_uuid();

    insert into public.goods_receipt_items (
      id, organization_id, goods_receipt_id, purchase_order_item_id, item_id,
      quantity, accepted_quantity, rejected_quantity, rejection_reason,
      batch_number, expiry_date, destination_warehouse, destination_location,
      unit_cost, inventory_total, tax_amount, total
    ) values (
      v_receipt_item_id, p_organization_id, v_receipt_id, v_po_item_id, v_item.item_id,
      v_accepted, v_accepted, v_rejected, v_rejection_reason,
      v_batch_number, v_expiry_date, v_destination_warehouse, v_destination_location,
      v_landed_unit_cost, v_line_inventory_total, v_line_tax, v_line_total
    );

    update public.purchase_order_items
    set received_quantity = round(received_quantity + v_accepted, 4),
        rejected_quantity = round(rejected_quantity + v_rejected, 4),
        updated_at = now()
    where organization_id = p_organization_id and id = v_po_item_id;

    if v_accepted > 0 then
      perform pg_advisory_xact_lock(hashtextextended(
        p_organization_id::text || ':inventory-item:' || v_item.item_id::text, 0
      ));
      select coalesce(sum(bs.quantity), 0), coalesce(ii.average_cost, 0)
        into v_old_org_stock, v_old_average_cost
      from public.inventory_items ii
      left join public.branch_stock bs
        on bs.organization_id = ii.organization_id and bs.item_id = ii.id
      where ii.organization_id = p_organization_id and ii.id = v_item.item_id
      group by ii.average_cost;

      insert into public.branch_stock (
        organization_id, branch_id, item_id, quantity, reserved_quantity, created_by
      ) values (
        p_organization_id, v_order.branch_id, v_item.item_id, 0, 0, p_created_by
      ) on conflict (branch_id, item_id) do nothing;
      perform 1 from public.branch_stock bs
      where bs.organization_id = p_organization_id
        and bs.branch_id = v_order.branch_id and bs.item_id = v_item.item_id
      for update;
      update public.branch_stock
      set quantity = round(quantity + v_accepted, 4), updated_at = now()
      where organization_id = p_organization_id
        and branch_id = v_order.branch_id and item_id = v_item.item_id;

      insert into public.stock_movements (
        organization_id, branch_id, item_id, movement_type, quantity, unit_cost,
        source_doc_type, source_doc_id, goods_receipt_item_id, idempotency_key,
        batch_number, expiry_date, destination_warehouse, destination_location,
        notes, created_by
      ) values (
        p_organization_id, v_order.branch_id, v_item.item_id, 'purchase',
        v_accepted, v_landed_unit_cost, 'goods_receipt', v_receipt_id,
        v_receipt_item_id, v_receipt_id::text || ':' || v_po_item_id::text,
        v_batch_number, v_expiry_date, v_destination_warehouse, v_destination_location,
        'استلام جزئي لأمر شراء ' || p_purchase_order_id::text, p_created_by
      );

      insert into public.supplier_price_history (
        organization_id, supplier_id, item_id, unit_price,
        source_doc_type, source_doc_id, created_by
      ) values (
        p_organization_id, v_order.supplier_id, v_item.item_id,
        v_item.expected_unit_price, 'goods_receipt', v_receipt_id, p_created_by
      );

      v_new_average_cost := case
        when v_old_org_stock + v_accepted <= 0 then v_landed_unit_cost
        else round(((v_old_average_cost * v_old_org_stock) + v_line_inventory_total)
          / (v_old_org_stock + v_accepted), 4)
      end;
      update public.inventory_items
      set average_cost = v_new_average_cost,
          last_purchase_price = v_item.expected_unit_price,
          updated_at = now()
      where organization_id = p_organization_id and id = v_item.item_id;
    end if;

    v_inventory_total := round(v_inventory_total + v_line_inventory_total, 4);
    v_tax_total := round(v_tax_total + v_line_tax, 4);
    v_accepted_total := round(v_accepted_total + v_accepted, 4);
    v_rejected_total := round(v_rejected_total + v_rejected, 4);
    v_lines_count := v_lines_count + 1;
  end loop;

  v_receipt_total := round(v_inventory_total + v_tax_total, 4);
  update public.goods_receipts
  set inventory_total = v_inventory_total, tax_total = v_tax_total,
      total = v_receipt_total, accepted_quantity = v_accepted_total,
      rejected_quantity = v_rejected_total, updated_at = now()
  where organization_id = p_organization_id and id = v_receipt_id;

  select bool_and(poi.received_quantity >= poi.quantity)
    into v_all_received
  from public.purchase_order_items poi
  where poi.organization_id = p_organization_id and poi.purchase_order_id = p_purchase_order_id;
  update public.purchase_orders
  set status = case when coalesce(v_all_received, false) then 'received' else 'partially_received' end,
      updated_at = now()
  where organization_id = p_organization_id and id = p_purchase_order_id;

  if v_inventory_total > 0 then
    v_journal_lines := jsonb_build_array(
      jsonb_build_object('system_key', 'inventory', 'debit', v_inventory_total,
        'credit', 0, 'memo', 'مخزون مقبول بإيصال ' || v_receipt_number)
    );
    if v_tax_total > 0 then
      v_journal_lines := v_journal_lines || jsonb_build_array(
        jsonb_build_object('system_key', 'input_tax_receivable', 'debit', v_tax_total,
          'credit', 0, 'memo', 'ضريبة مدخلات إيصال ' || v_receipt_number)
      );
    end if;
    v_journal_lines := v_journal_lines || jsonb_build_array(
      jsonb_build_object('system_key', 'goods_received_not_invoiced',
        'debit', 0, 'credit', v_receipt_total,
        'memo', 'بضاعة مستلمة غير مفوترة ' || v_receipt_number)
    );
    v_posting_result := public.post_balanced_journal_atomic(
      p_organization_id, v_order.branch_id, 'purchase_receipt', v_receipt_id,
      'قيد استلام أمر شراء ' || p_purchase_order_id::text,
      p_received_at, v_journal_lines, p_created_by
    );
    v_journal_entry_id := nullif(v_posting_result->>'entry_id', '')::uuid;
    if v_journal_entry_id is null then raise exception 'تعذر ربط قيد استلام المشتريات.'; end if;
    update public.goods_receipts
    set journal_entry_id = v_journal_entry_id, updated_at = now()
    where organization_id = p_organization_id and id = v_receipt_id;
  end if;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) values (
    p_organization_id, v_order.branch_id, p_created_by,
    'purchase_receipt_inspected_and_posted', 'goods_receipt', v_receipt_id,
    jsonb_build_object(
      'purchase_order_id', p_purchase_order_id, 'receipt_number', v_receipt_number,
      'received_at', p_received_at, 'lines_count', v_lines_count,
      'accepted_quantity', v_accepted_total, 'rejected_quantity', v_rejected_total,
      'inventory_total', v_inventory_total, 'tax_total', v_tax_total,
      'total', v_receipt_total, 'journal_entry_id', v_journal_entry_id,
      'idempotency_key', btrim(p_idempotency_key)
    )
  );
  return jsonb_build_object(
    'success', true, 'duplicate', false, 'receipt_id', v_receipt_id,
    'receipt_number', v_receipt_number, 'purchase_order_id', p_purchase_order_id,
    'journal_entry_id', v_journal_entry_id, 'accepted_quantity', v_accepted_total,
    'rejected_quantity', v_rejected_total, 'inventory_total', v_inventory_total,
    'tax_total', v_tax_total, 'total', v_receipt_total, 'lines_count', v_lines_count
  );
end;
$$;

revoke all on function public.create_purchase_order_atomic(
  uuid, uuid, uuid, date, date, text, text, text, jsonb, numeric, text, uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_purchase_order_atomic(
  uuid, uuid, uuid, date, date, text, text, text, jsonb, numeric, text, uuid, text, jsonb
) to service_role;
revoke all on function public.submit_purchase_order_atomic(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_purchase_order_atomic(uuid, uuid, text, uuid)
  to service_role;
revoke all on function public.approve_purchase_order_atomic(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.approve_purchase_order_atomic(uuid, uuid, text, uuid)
  to service_role;
revoke all on function public.record_purchase_receipt_atomic(
  uuid, uuid, date, jsonb, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.record_purchase_receipt_atomic(
  uuid, uuid, date, jsonb, text, text, uuid
) to service_role;

comment on function public.record_purchase_receipt_atomic(
  uuid, uuid, date, jsonb, text, text, uuid
) is 'Atomic partial PO inspection: accepted stock + immutable movement + moving average + central journal + audit; rejected quantities never enter stock.';

-- ---------------------------------------------------------------------------
-- Pre-deployment validation (read-only).  Review every returned row before
-- applying 058; do not run db:push automatically from an agent.
-- ---------------------------------------------------------------------------
-- Cross-tenant/orphan checks (must return zero rows):
-- select poi.id from public.purchase_order_items poi
-- left join public.purchase_orders po
--   on po.id = poi.purchase_order_id and po.organization_id = poi.organization_id
-- where po.id is null;
-- select gri.id from public.goods_receipt_items gri
-- left join public.goods_receipts gr
--   on gr.id = gri.goods_receipt_id and gr.organization_id = gri.organization_id
-- where gr.id is null;
--
-- Quantity/totals checks (must return zero rows):
-- select id, quantity, received_quantity from public.purchase_order_items
-- where received_quantity < 0 or received_quantity > quantity;
-- select id, subtotal, discount_total, tax_total, shipping_total, total
-- from public.purchase_orders
-- where total <> round(subtotal - discount_total + tax_total + shipping_total, 4);
--
-- Receipt-to-ledger reconciliation (must return zero rows after deployment):
-- select gr.id, gr.total, coalesce(sum(jl.debit),0) debits, coalesce(sum(jl.credit),0) credits
-- from public.goods_receipts gr
-- left join public.journal_entries je
--   on je.organization_id = gr.organization_id and je.id = gr.journal_entry_id and je.status = 'posted'
-- left join public.journal_lines jl
--   on jl.organization_id = je.organization_id and jl.journal_entry_id = je.id
-- where gr.accepted_quantity > 0
-- group by gr.id
-- having coalesce(sum(jl.debit),0) <> gr.total or coalesce(sum(jl.credit),0) <> gr.total;
--
-- Forward-correction plan: replace the affected RPC in a later migration and
-- post reversal/adjustment documents for financial or stock corrections.
-- Never delete receipts, movements, audit rows, or posted journals.  The new
-- nullable traceability columns can remain in place if application rollout is
-- paused; restore compatibility with a forward wrapper only after review.
