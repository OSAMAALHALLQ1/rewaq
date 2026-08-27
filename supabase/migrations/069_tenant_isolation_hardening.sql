-- 069: Comprehensive Tenant Isolation Hardening
-- Forward-only migration enforcing composite unique constraints and composite foreign keys
-- to make cross-tenant data references impossible at the database engine boundary.

create extension if not exists "pgcrypto";

-- Step 1: Ensure composite unique constraints exist on all master entity tables
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recipes_org_id_unique') then
    alter table public.recipes
      add constraint recipes_org_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'inventory_items_org_id_unique') then
    alter table public.inventory_items
      add constraint inventory_items_org_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'suppliers_org_id_unique') then
    alter table public.suppliers
      add constraint suppliers_org_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'purchase_orders_org_id_unique') then
    alter table public.purchase_orders
      add constraint purchase_orders_org_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'goods_receipts_org_id_unique') then
    alter table public.goods_receipts
      add constraint goods_receipts_org_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'invoices_org_id_unique') then
    alter table public.invoices
      add constraint invoices_org_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'modifier_groups_org_id_unique') then
    alter table public.modifier_groups
      add constraint modifier_groups_org_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transfers_org_id_unique') then
    alter table public.transfers
      add constraint transfers_org_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'stock_counts_org_id_unique') then
    alter table public.stock_counts
      add constraint stock_counts_org_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chart_of_accounts_org_id_unique') then
    alter table public.chart_of_accounts
      add constraint chart_of_accounts_org_id_unique unique (organization_id, id);
  end if;
end;
$$;

-- Step 2: Enforce composite foreign keys on all child and mapping tables
do $$
begin
  -- menu_item_recipe_mapping
  if not exists (select 1 from pg_constraint where conname = 'mirm_recipe_org_fk') then
    alter table public.menu_item_recipe_mapping
      add constraint mirm_recipe_org_fk
      foreign key (organization_id, recipe_id)
      references public.recipes(organization_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'mirm_menu_item_org_fk') then
    alter table public.menu_item_recipe_mapping
      add constraint mirm_menu_item_org_fk
      foreign key (organization_id, menu_item_id)
      references public.menu_items(organization_id, id) on delete cascade;
  end if;

  -- recipe_ingredients
  if not exists (select 1 from pg_constraint where conname = 'recipe_ingredients_recipe_org_fk') then
    alter table public.recipe_ingredients
      add constraint recipe_ingredients_recipe_org_fk
      foreign key (organization_id, recipe_id)
      references public.recipes(organization_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'recipe_ingredients_item_org_fk') then
    alter table public.recipe_ingredients
      add constraint recipe_ingredients_item_org_fk
      foreign key (organization_id, item_id)
      references public.inventory_items(organization_id, id) on delete restrict;
  end if;

  -- catalog_item_modifier_groups
  if not exists (select 1 from pg_constraint where conname = 'cimg_catalog_org_fk') then
    alter table public.catalog_item_modifier_groups
      add constraint cimg_catalog_org_fk
      foreign key (organization_id, catalog_item_id)
      references public.catalog_items(organization_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cimg_modifier_group_org_fk') then
    alter table public.catalog_item_modifier_groups
      add constraint cimg_modifier_group_org_fk
      foreign key (organization_id, modifier_group_id)
      references public.modifier_groups(organization_id, id) on delete cascade;
  end if;

  -- modifier_options
  if not exists (select 1 from pg_constraint where conname = 'modifier_options_group_org_fk') then
    alter table public.modifier_options
      add constraint modifier_options_group_org_fk
      foreign key (organization_id, modifier_group_id)
      references public.modifier_groups(organization_id, id) on delete cascade;
  end if;

  -- item_barcodes
  if not exists (select 1 from pg_constraint where conname = 'item_barcodes_catalog_org_fk') then
    alter table public.item_barcodes
      add constraint item_barcodes_catalog_org_fk
      foreign key (organization_id, catalog_item_id)
      references public.catalog_items(organization_id, id) on delete cascade;
  end if;

  -- branch_stock
  if not exists (select 1 from pg_constraint where conname = 'branch_stock_branch_org_fk') then
    alter table public.branch_stock
      add constraint branch_stock_branch_org_fk
      foreign key (organization_id, branch_id)
      references public.branches(organization_id, id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'branch_stock_item_org_fk') then
    alter table public.branch_stock
      add constraint branch_stock_item_org_fk
      foreign key (organization_id, item_id)
      references public.inventory_items(organization_id, id) on delete restrict;
  end if;

  -- waste_logs
  if not exists (select 1 from pg_constraint where conname = 'waste_logs_branch_org_fk') then
    alter table public.waste_logs
      add constraint waste_logs_branch_org_fk
      foreign key (organization_id, branch_id)
      references public.branches(organization_id, id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'waste_logs_item_org_fk') then
    alter table public.waste_logs
      add constraint waste_logs_item_org_fk
      foreign key (organization_id, item_id)
      references public.inventory_items(organization_id, id) on delete restrict;
  end if;

  -- purchase_orders
  if not exists (select 1 from pg_constraint where conname = 'purchase_orders_branch_org_fk') then
    alter table public.purchase_orders
      add constraint purchase_orders_branch_org_fk
      foreign key (organization_id, branch_id)
      references public.branches(organization_id, id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'purchase_orders_supplier_org_fk') then
    alter table public.purchase_orders
      add constraint purchase_orders_supplier_org_fk
      foreign key (organization_id, supplier_id)
      references public.suppliers(organization_id, id) on delete restrict;
  end if;

  -- purchase_order_items
  if not exists (select 1 from pg_constraint where conname = 'poi_purchase_order_org_fk') then
    alter table public.purchase_order_items
      add constraint poi_purchase_order_org_fk
      foreign key (organization_id, purchase_order_id)
      references public.purchase_orders(organization_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'poi_item_org_fk') then
    alter table public.purchase_order_items
      add constraint poi_item_org_fk
      foreign key (organization_id, item_id)
      references public.inventory_items(organization_id, id) on delete restrict;
  end if;

  -- goods_receipts
  if not exists (select 1 from pg_constraint where conname = 'goods_receipts_branch_org_fk') then
    alter table public.goods_receipts
      add constraint goods_receipts_branch_org_fk
      foreign key (organization_id, branch_id)
      references public.branches(organization_id, id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'goods_receipts_supplier_org_fk') then
    alter table public.goods_receipts
      add constraint goods_receipts_supplier_org_fk
      foreign key (organization_id, supplier_id)
      references public.suppliers(organization_id, id) on delete restrict;
  end if;

  -- goods_receipt_items
  if not exists (select 1 from pg_constraint where conname = 'gri_goods_receipt_org_fk') then
    alter table public.goods_receipt_items
      add constraint gri_goods_receipt_org_fk
      foreign key (organization_id, goods_receipt_id)
      references public.goods_receipts(organization_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'gri_item_org_fk') then
    alter table public.goods_receipt_items
      add constraint gri_item_org_fk
      foreign key (organization_id, item_id)
      references public.inventory_items(organization_id, id) on delete restrict;
  end if;

  -- invoices
  if not exists (select 1 from pg_constraint where conname = 'invoices_branch_org_fk') then
    alter table public.invoices
      add constraint invoices_branch_org_fk
      foreign key (organization_id, branch_id)
      references public.branches(organization_id, id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'invoices_supplier_org_fk') then
    alter table public.invoices
      add constraint invoices_supplier_org_fk
      foreign key (organization_id, supplier_id)
      references public.suppliers(organization_id, id) on delete restrict;
  end if;

  -- invoice_items
  if not exists (select 1 from pg_constraint where conname = 'invoice_items_invoice_org_fk') then
    alter table public.invoice_items
      add constraint invoice_items_invoice_org_fk
      foreign key (organization_id, invoice_id)
      references public.invoices(organization_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'invoice_items_item_org_fk') then
    alter table public.invoice_items
      add constraint invoice_items_item_org_fk
      foreign key (organization_id, item_id)
      references public.inventory_items(organization_id, id) on delete restrict;
  end if;

  -- supplier_payments
  if not exists (select 1 from pg_constraint where conname = 'supplier_payments_supplier_org_fk') then
    alter table public.supplier_payments
      add constraint supplier_payments_supplier_org_fk
      foreign key (organization_id, supplier_id)
      references public.suppliers(organization_id, id) on delete restrict;
  end if;

  -- customer_invoice_items
  if not exists (select 1 from pg_constraint where conname = 'cii_catalog_org_fk') then
    alter table public.customer_invoice_items
      add constraint cii_catalog_org_fk
      foreign key (organization_id, catalog_item_id)
      references public.catalog_items(organization_id, id) on delete restrict;
  end if;

  -- transfers
  if not exists (select 1 from pg_constraint where conname = 'transfers_from_branch_org_fk') then
    alter table public.transfers
      add constraint transfers_from_branch_org_fk
      foreign key (organization_id, from_branch_id)
      references public.branches(organization_id, id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transfers_to_branch_org_fk') then
    alter table public.transfers
      add constraint transfers_to_branch_org_fk
      foreign key (organization_id, to_branch_id)
      references public.branches(organization_id, id) on delete restrict;
  end if;

  -- transfer_items
  if not exists (select 1 from pg_constraint where conname = 'transfer_items_transfer_org_fk') then
    alter table public.transfer_items
      add constraint transfer_items_transfer_org_fk
      foreign key (organization_id, transfer_id)
      references public.transfers(organization_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transfer_items_item_org_fk') then
    alter table public.transfer_items
      add constraint transfer_items_item_org_fk
      foreign key (organization_id, item_id)
      references public.inventory_items(organization_id, id) on delete restrict;
  end if;

  -- stock_counts
  if not exists (select 1 from pg_constraint where conname = 'stock_counts_branch_org_fk') then
    alter table public.stock_counts
      add constraint stock_counts_branch_org_fk
      foreign key (organization_id, branch_id)
      references public.branches(organization_id, id) on delete restrict;
  end if;

  -- stock_count_items
  if not exists (select 1 from pg_constraint where conname = 'sci_stock_count_org_fk') then
    alter table public.stock_count_items
      add constraint sci_stock_count_org_fk
      foreign key (organization_id, stock_count_id)
      references public.stock_counts(organization_id, id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'sci_item_org_fk') then
    alter table public.stock_count_items
      add constraint sci_item_org_fk
      foreign key (organization_id, item_id)
      references public.inventory_items(organization_id, id) on delete restrict;
  end if;
end;
$$;

-- Step 3: RLS hardening verification check for catalog and master data
alter table public.catalog_items enable row level security;
alter table public.menu_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.menu_item_recipe_mapping enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.catalog_item_modifier_groups enable row level security;
alter table public.item_barcodes enable row level security;
alter table public.accounting_settings enable row level security;
alter table public.pos_settings enable row level security;
alter table public.customer_invoices enable row level security;
alter table public.customer_invoice_items enable row level security;
alter table public.restaurant_tables enable row level security;
