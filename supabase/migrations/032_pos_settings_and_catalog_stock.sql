-- 032_pos_settings_and_catalog_stock.sql
-- إعدادات نقطة البيع (POS) + عمود صورة الأصناف
-- المبدأ: الكاشير يبيع فقط؛ الإرجاع والخصم للمدير.

-- ═══════════════════════════════════════════════════════
-- 1) جدول إعدادات نقطة البيع لكل منظمة
-- ═══════════════════════════════════════════════════════
create table if not exists public.pos_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  currency text not null default 'ILS',
  tax_rate numeric(8,4) not null default 0,
  receipt_header text,
  receipt_footer text not null default 'شكراً لتعاملكم معنا',
  max_cashier_discount numeric(5,2) not null default 0,
  allow_cashier_refund boolean not null default false,
  require_shift boolean not null default true,
  print_on_checkout boolean not null default true,
  receipt_width text not null default '80mm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pos_settings is
  'إعدادات نقطة البيع لكل منظمة: العملة، الضريبة، نص الإيصال، حد خصم الكاشير، صلاحية الإرجاع، إلزام الوردية.';

-- تفعيل RLS
alter table public.pos_settings enable row level security;

drop policy if exists "pos_settings org read" on public.pos_settings;
create policy "pos_settings org read" on public.pos_settings
  for select to authenticated
  using (public.is_org_member(organization_id) or public.is_super_admin());

drop policy if exists "pos_settings owner write" on public.pos_settings;
create policy "pos_settings owner write" on public.pos_settings
  for all to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[])
    or public.is_super_admin()
  );

-- ═══════════════════════════════════════════════════════
-- 2) عمود صورة الأصناف في catalog_items
-- ═══════════════════════════════════════════════════════
alter table public.catalog_items
  add column if not exists image_url text;

comment on column public.catalog_items.image_url is
  'رابط صورة الصنف لعرضها في نقطة البيع (بديل مكمل لـ image_path).';

-- ═══════════════════════════════════════════════════════
-- 3) تحديث updated_at تلقائياً
-- ═══════════════════════════════════════════════════════
drop trigger if exists trg_pos_settings_updated_at on public.pos_settings;
create trigger trg_pos_settings_updated_at
  before update on public.pos_settings
  for each row execute function set_updated_at();

-- ملاحظة: عكس المخزون عند الإرجاع وتعديل pos_checkout_atomic لدعم الخصم
-- على مستوى الفاتورة مؤجلان لمرحلة لاحقة (يحتاجان RPC عكسي/تعديل).
