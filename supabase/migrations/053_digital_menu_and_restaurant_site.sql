-- One digital presence source: the public website renders operational menu_items.
-- Publication rows store presentation only; names, status and prices stay linked.

create table public.restaurant_sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  slug text not null,
  display_name text not null,
  tagline text,
  description text,
  logo_url text,
  cover_url text,
  primary_color text not null default '#0f766e',
  contact_phone text,
  whatsapp_phone text,
  address text,
  status text not null default 'draft',
  published_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_sites_branch_fk
    foreign key (organization_id, branch_id)
    references public.branches(organization_id, id) on delete restrict,
  constraint restaurant_sites_org_unique unique (organization_id),
  constraint restaurant_sites_slug_unique unique (slug),
  constraint restaurant_sites_slug_check check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 80
  ),
  constraint restaurant_sites_name_check check (btrim(display_name) <> '' and length(display_name) <= 160),
  constraint restaurant_sites_color_check check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint restaurant_sites_status_check check (status in ('draft', 'published', 'archived')),
  constraint restaurant_sites_publish_check check (
    (status = 'published' and published_at is not null) or status <> 'published'
  ),
  constraint restaurant_sites_org_id_unique unique (organization_id, id)
);

create table public.restaurant_site_menu_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null,
  menu_item_id uuid not null,
  category_name text not null default 'القائمة',
  public_description text,
  image_url text,
  display_order integer not null default 0,
  is_featured boolean not null default false,
  is_visible boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_site_menu_site_fk
    foreign key (organization_id, site_id)
    references public.restaurant_sites(organization_id, id) on delete restrict,
  constraint restaurant_site_menu_item_fk
    foreign key (organization_id, menu_item_id)
    references public.menu_items(organization_id, id) on delete restrict,
  constraint restaurant_site_menu_category_check check (
    btrim(category_name) <> '' and length(category_name) <= 100
  ),
  constraint restaurant_site_menu_unique unique (organization_id, site_id, menu_item_id)
);

create index restaurant_site_menu_visible_idx
  on public.restaurant_site_menu_items (organization_id, site_id, is_visible, display_order);

create trigger set_restaurant_sites_updated_at
before update on public.restaurant_sites
for each row execute function public.set_updated_at();
create trigger set_restaurant_site_menu_items_updated_at
before update on public.restaurant_site_menu_items
for each row execute function public.set_updated_at();

create or replace function public.prevent_digital_presence_hard_delete()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'لا تحذف سجل الموقع أو نشر المنيو؛ استخدم الأرشفة أو إخفاء الصنف.';
end;
$$;

create trigger prevent_restaurant_sites_delete
before delete on public.restaurant_sites
for each row execute function public.prevent_digital_presence_hard_delete();
create trigger prevent_restaurant_site_menu_items_delete
before delete on public.restaurant_site_menu_items
for each row execute function public.prevent_digital_presence_hard_delete();

create or replace function public.assert_digital_presence_actor(
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
  if v_role not in ('super_admin', 'organization_owner', 'branch_manager', 'marketing_manager') then
    raise exception 'الدور لا يسمح بإدارة الموقع والمنيو الإلكتروني.';
  end if;
  return v_role;
end;
$$;

create or replace function public.save_restaurant_site_atomic(
  p_organization_id uuid,
  p_site_id uuid,
  p_branch_id uuid,
  p_slug text,
  p_display_name text,
  p_tagline text,
  p_description text,
  p_logo_url text,
  p_cover_url text,
  p_primary_color text,
  p_contact_phone text,
  p_whatsapp_phone text,
  p_address text,
  p_status text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_site public.restaurant_sites%rowtype;
  v_old jsonb;
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_status text := lower(btrim(coalesce(p_status, 'draft')));
begin
  perform public.assert_digital_presence_actor(p_organization_id, p_actor_user_id);
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) not between 3 and 80 then
    raise exception 'رابط الموقع يقبل أحرفاً إنجليزية صغيرة وأرقاماً وشرطات فقط.';
  end if;
  if nullif(btrim(p_display_name), '') is null or length(btrim(p_display_name)) > 160 then
    raise exception 'اسم المطعم مطلوب وبحد أقصى 160 حرفاً.';
  end if;
  if coalesce(p_primary_color, '') !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'اللون الرئيسي يجب أن يكون بصيغة #RRGGBB.';
  end if;
  if v_status not in ('draft', 'published', 'archived') then
    raise exception 'حالة الموقع غير صالحة.';
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.organization_id = p_organization_id
  ) then
    raise exception 'الفرع لا يتبع هذه المؤسسة.';
  end if;

  select * into v_site
  from public.restaurant_sites rs
  where rs.organization_id = p_organization_id
  for update;
  if found then
    if p_site_id is not null and p_site_id <> v_site.id then
      raise exception 'معرف الموقع لا يطابق موقع المؤسسة.';
    end if;
    v_old := to_jsonb(v_site);
  elsif p_site_id is not null then
    raise exception 'الموقع المحدد غير موجود.';
  end if;

  if v_status = 'published' and not exists (
    select 1 from public.restaurant_site_menu_items rsmi
    where rsmi.organization_id = p_organization_id
      and rsmi.site_id = v_site.id and rsmi.is_visible = true
  ) then
    raise exception 'أضف صنفاً ظاهراً واحداً على الأقل قبل نشر الموقع.';
  end if;

  if v_site.id is null then
    insert into public.restaurant_sites (
      organization_id, branch_id, slug, display_name, tagline, description,
      logo_url, cover_url, primary_color, contact_phone, whatsapp_phone,
      address, status, published_at, created_by_user_id
    ) values (
      p_organization_id, p_branch_id, v_slug, btrim(p_display_name),
      nullif(btrim(p_tagline), ''), nullif(btrim(p_description), ''),
      nullif(btrim(p_logo_url), ''), nullif(btrim(p_cover_url), ''),
      lower(p_primary_color), nullif(btrim(p_contact_phone), ''),
      nullif(btrim(p_whatsapp_phone), ''), nullif(btrim(p_address), ''),
      v_status, case when v_status = 'published' then now() else null end,
      p_actor_user_id
    ) returning * into v_site;
  else
    update public.restaurant_sites
    set branch_id = p_branch_id,
        slug = v_slug,
        display_name = btrim(p_display_name),
        tagline = nullif(btrim(p_tagline), ''),
        description = nullif(btrim(p_description), ''),
        logo_url = nullif(btrim(p_logo_url), ''),
        cover_url = nullif(btrim(p_cover_url), ''),
        primary_color = lower(p_primary_color),
        contact_phone = nullif(btrim(p_contact_phone), ''),
        whatsapp_phone = nullif(btrim(p_whatsapp_phone), ''),
        address = nullif(btrim(p_address), ''),
        status = v_status,
        published_at = case when v_status = 'published' then coalesce(published_at, now()) else published_at end
    where id = v_site.id and organization_id = p_organization_id
    returning * into v_site;
  end if;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    p_organization_id, p_branch_id, p_actor_user_id,
    case when v_old is null then 'restaurant_site_created' else 'restaurant_site_updated' end,
    'restaurant_site', v_site.id, v_old,
    jsonb_build_object('slug', v_site.slug, 'status', v_site.status, 'display_name', v_site.display_name)
  );

  return jsonb_build_object(
    'success', true, 'site_id', v_site.id, 'slug', v_site.slug,
    'status', v_site.status, 'published_at', v_site.published_at
  );
end;
$$;

create or replace function public.set_restaurant_site_menu_item_atomic(
  p_organization_id uuid,
  p_site_id uuid,
  p_menu_item_id uuid,
  p_category_name text,
  p_public_description text,
  p_image_url text,
  p_display_order integer,
  p_is_featured boolean,
  p_is_visible boolean,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_site public.restaurant_sites%rowtype;
  v_menu public.menu_items%rowtype;
  v_publication public.restaurant_site_menu_items%rowtype;
  v_old jsonb;
begin
  perform public.assert_digital_presence_actor(p_organization_id, p_actor_user_id);
  select * into v_site from public.restaurant_sites rs
  where rs.id = p_site_id and rs.organization_id = p_organization_id for update;
  if not found then raise exception 'موقع المؤسسة غير موجود.'; end if;

  select * into v_menu from public.menu_items mi
  where mi.id = p_menu_item_id and mi.organization_id = p_organization_id;
  if not found then raise exception 'صنف المنيو لا يتبع المؤسسة.'; end if;
  if p_is_visible and v_menu.status::text <> 'active' then
    raise exception 'لا يمكن نشر صنف متوقف أو مؤرشف.';
  end if;
  if v_site.branch_id is not null and v_menu.branch_id is not null and v_menu.branch_id <> v_site.branch_id then
    raise exception 'صنف المنيو يتبع فرعاً مختلفاً عن الموقع.';
  end if;
  if nullif(btrim(p_category_name), '') is null or length(btrim(p_category_name)) > 100 then
    raise exception 'تصنيف المنيو مطلوب وبحد أقصى 100 حرف.';
  end if;

  select to_jsonb(rsmi) into v_old
  from public.restaurant_site_menu_items rsmi
  where rsmi.organization_id = p_organization_id and rsmi.site_id = p_site_id
    and rsmi.menu_item_id = p_menu_item_id
  for update;

  insert into public.restaurant_site_menu_items (
    organization_id, site_id, menu_item_id, category_name, public_description,
    image_url, display_order, is_featured, is_visible, created_by_user_id
  ) values (
    p_organization_id, p_site_id, p_menu_item_id, btrim(p_category_name),
    nullif(btrim(p_public_description), ''), nullif(btrim(p_image_url), ''),
    coalesce(p_display_order, 0), coalesce(p_is_featured, false),
    coalesce(p_is_visible, true), p_actor_user_id
  )
  on conflict (organization_id, site_id, menu_item_id) do update
  set category_name = excluded.category_name,
      public_description = excluded.public_description,
      image_url = excluded.image_url,
      display_order = excluded.display_order,
      is_featured = excluded.is_featured,
      is_visible = excluded.is_visible,
      updated_at = now()
  returning * into v_publication;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    p_organization_id, v_site.branch_id, p_actor_user_id,
    'restaurant_site_menu_item_set', 'restaurant_site_menu_item', v_publication.id,
    v_old,
    jsonb_build_object(
      'site_id', p_site_id, 'menu_item_id', p_menu_item_id,
      'is_visible', v_publication.is_visible, 'is_featured', v_publication.is_featured,
      'display_order', v_publication.display_order
    )
  );

  return jsonb_build_object(
    'success', true, 'publication_id', v_publication.id,
    'menu_item_id', p_menu_item_id, 'is_visible', v_publication.is_visible
  );
end;
$$;

create or replace function public.get_public_restaurant_site(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_site public.restaurant_sites%rowtype;
  v_items jsonb;
begin
  select * into v_site from public.restaurant_sites rs
  where rs.slug = lower(btrim(p_slug)) and rs.status = 'published';
  if not found then return null; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', mi.id,
      'name', mi.name,
      'selling_price', mi.selling_price,
      'image_url', coalesce(rsmi.image_url, mi.image_path),
      'category_name', rsmi.category_name,
      'description', rsmi.public_description,
      'is_featured', rsmi.is_featured,
      'display_order', rsmi.display_order
    ) order by rsmi.category_name, rsmi.display_order, mi.name
  ), '[]'::jsonb) into v_items
  from public.restaurant_site_menu_items rsmi
  join public.menu_items mi
    on mi.organization_id = rsmi.organization_id and mi.id = rsmi.menu_item_id
  where rsmi.organization_id = v_site.organization_id
    and rsmi.site_id = v_site.id
    and rsmi.is_visible = true
    and mi.status::text = 'active'
    and (v_site.branch_id is null or mi.branch_id is null or mi.branch_id = v_site.branch_id);

  return jsonb_build_object(
    'id', v_site.id,
    'slug', v_site.slug,
    'display_name', v_site.display_name,
    'tagline', v_site.tagline,
    'description', v_site.description,
    'logo_url', v_site.logo_url,
    'cover_url', v_site.cover_url,
    'primary_color', v_site.primary_color,
    'contact_phone', v_site.contact_phone,
    'whatsapp_phone', v_site.whatsapp_phone,
    'address', v_site.address,
    'items', v_items
  );
end;
$$;

alter table public.restaurant_sites enable row level security;
alter table public.restaurant_site_menu_items enable row level security;

create policy restaurant_sites_org_read on public.restaurant_sites
for select to authenticated
using (
  organization_id in (
    select om.organization_id from public.organization_memberships om where om.user_id = auth.uid()
  )
);
create policy restaurant_sites_privileged_write on public.restaurant_sites
for all to authenticated
using (
  exists (
    select 1 from public.organization_memberships om
    where om.organization_id = restaurant_sites.organization_id and om.user_id = auth.uid()
      and om.role::text in ('super_admin','organization_owner','branch_manager','marketing_manager')
  )
)
with check (
  exists (
    select 1 from public.organization_memberships om
    where om.organization_id = restaurant_sites.organization_id and om.user_id = auth.uid()
      and om.role::text in ('super_admin','organization_owner','branch_manager','marketing_manager')
  )
);
create policy restaurant_site_menu_org_read on public.restaurant_site_menu_items
for select to authenticated
using (
  organization_id in (
    select om.organization_id from public.organization_memberships om where om.user_id = auth.uid()
  )
);
create policy restaurant_site_menu_privileged_write on public.restaurant_site_menu_items
for all to authenticated
using (
  exists (
    select 1 from public.organization_memberships om
    where om.organization_id = restaurant_site_menu_items.organization_id and om.user_id = auth.uid()
      and om.role::text in ('super_admin','organization_owner','branch_manager','marketing_manager')
  )
)
with check (
  exists (
    select 1 from public.organization_memberships om
    where om.organization_id = restaurant_site_menu_items.organization_id and om.user_id = auth.uid()
      and om.role::text in ('super_admin','organization_owner','branch_manager','marketing_manager')
  )
);

revoke all on table public.restaurant_sites from anon;
revoke all on table public.restaurant_site_menu_items from anon;
revoke all on function public.save_restaurant_site_atomic(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, uuid
) from public, anon;
grant execute on function public.save_restaurant_site_atomic(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, uuid
) to authenticated, service_role;
revoke all on function public.set_restaurant_site_menu_item_atomic(
  uuid, uuid, uuid, text, text, text, integer, boolean, boolean, uuid
) from public, anon;
grant execute on function public.set_restaurant_site_menu_item_atomic(
  uuid, uuid, uuid, text, text, text, integer, boolean, boolean, uuid
) to authenticated, service_role;
revoke all on function public.get_public_restaurant_site(text) from public;
grant execute on function public.get_public_restaurant_site(text) to anon, authenticated, service_role;

-- Validation before production push:
-- select slug, count(*) from public.restaurant_sites group by slug having count(*) > 1;
-- select rsmi.* from public.restaurant_site_menu_items rsmi
-- left join public.menu_items mi on mi.organization_id = rsmi.organization_id and mi.id = rsmi.menu_item_id
-- where mi.id is null;

-- Forward correction: archive a wrong site or hide a publication through the RPCs.
-- Never delete site/publication history after go-live.
