-- Block destructive deletes for financial and inventory history at the final
-- migration position. Operational corrections must be represented by
-- archive/void/reversal/update workflows, not by physical row removal.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'branch_stock',
    'stock_movements',
    'stock_counts',
    'stock_count_items',
    'waste_logs',
    'transfers',
    'transfer_items',
    'purchase_orders',
    'purchase_order_items',
    'invoices',
    'invoice_items',
    'customer_invoices',
    'customer_invoice_items',
    'customer_invoice_payments',
    'supplier_price_history',
    'sales_shifts',
    'cash_drawer_entries',
    'chart_of_accounts',
    'journal_entries',
    'journal_lines',
    'kitchen_tickets',
    'kitchen_ticket_items',
    'production_orders',
    'production_order_materials'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('drop policy if exists %I on public.%I', target_table || ' org delete', target_table);
      execute format('drop policy if exists %I on public.%I', target_table || ' branch delete', target_table);
      execute format('drop policy if exists %I on public.%I', target_table || ' org scoped', target_table);
    end if;
  end loop;
end $$;

drop policy if exists "sales shifts owner write" on public.sales_shifts;
drop policy if exists "cash drawer owner write" on public.cash_drawer_entries;
drop policy if exists "kitchen tickets kitchen write" on public.kitchen_tickets;
drop policy if exists "kitchen ticket items kitchen write" on public.kitchen_ticket_items;
drop policy if exists "production orders kitchen write" on public.production_orders;
drop policy if exists "production materials kitchen write" on public.production_order_materials;

create policy "sales shifts owner insert" on public.sales_shifts
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[])
    or public.is_super_admin()
  );

create policy "sales shifts owner update" on public.sales_shifts
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[])
    or public.is_super_admin()
  );

create policy "cash drawer owner insert" on public.cash_drawer_entries
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[])
    or public.is_super_admin()
  );

create policy "cash drawer owner update" on public.cash_drawer_entries
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','accountant','cashier']::app_role[])
    or public.is_super_admin()
  );

create policy "production orders kitchen insert" on public.production_orders
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[])
    or public.is_super_admin()
  );

create policy "production orders kitchen update" on public.production_orders
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[])
    or public.is_super_admin()
  );

create policy "kitchen tickets kitchen insert" on public.kitchen_tickets
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[])
    or public.is_super_admin()
  );

create policy "kitchen tickets kitchen update" on public.kitchen_tickets
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[])
    or public.is_super_admin()
  );

create policy "kitchen ticket items kitchen insert" on public.kitchen_ticket_items
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[])
    or public.is_super_admin()
  );

create policy "kitchen ticket items kitchen update" on public.kitchen_ticket_items
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','chef','staff']::app_role[])
    or public.is_super_admin()
  );

create policy "production materials kitchen insert" on public.production_order_materials
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[])
    or public.is_super_admin()
  );

create policy "production materials kitchen update" on public.production_order_materials
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','chef','accountant']::app_role[])
    or public.is_super_admin()
  );

alter table public.customer_invoice_items
  drop constraint if exists customer_invoice_items_customer_invoice_id_fkey,
  drop constraint if exists customer_invoice_items_org_id_fk,
  add constraint customer_invoice_items_org_id_fk
    foreign key (organization_id, customer_invoice_id)
    references public.customer_invoices(organization_id, id)
    on delete restrict;

alter table public.customer_invoice_payments
  drop constraint if exists customer_invoice_payments_customer_invoice_id_fkey,
  drop constraint if exists customer_invoice_payments_org_id_fk,
  add constraint customer_invoice_payments_org_id_fk
    foreign key (organization_id, customer_invoice_id)
    references public.customer_invoices(organization_id, id)
    on delete restrict;

alter table public.invoice_items
  drop constraint if exists invoice_items_invoice_id_fkey,
  add constraint invoice_items_invoice_id_fkey
    foreign key (invoice_id)
    references public.invoices(id)
    on delete restrict;

alter table public.journal_lines
  drop constraint if exists journal_lines_journal_entry_id_fkey,
  drop constraint if exists journal_lines_org_id_fk,
  add constraint journal_lines_org_id_fk
    foreign key (organization_id, journal_entry_id)
    references public.journal_entries(organization_id, id)
    on delete restrict;

alter table public.transfer_items
  drop constraint if exists transfer_items_transfer_id_fkey,
  drop constraint if exists transfer_items_org_id_fk,
  add constraint transfer_items_org_id_fk
    foreign key (organization_id, transfer_id)
    references public.transfers(organization_id, id)
    on delete restrict;

alter table public.stock_count_items
  drop constraint if exists stock_count_items_stock_count_id_fkey,
  drop constraint if exists stock_count_items_org_id_fk,
  add constraint stock_count_items_org_id_fk
    foreign key (organization_id, stock_count_id)
    references public.stock_counts(organization_id, id)
    on delete restrict;

alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_purchase_order_id_fkey,
  add constraint purchase_order_items_purchase_order_id_fkey
    foreign key (purchase_order_id)
    references public.purchase_orders(id)
    on delete restrict;

alter table public.cash_drawer_entries
  drop constraint if exists cash_drawer_entries_shift_id_fkey,
  add constraint cash_drawer_entries_shift_id_fkey
    foreign key (shift_id)
    references public.sales_shifts(id)
    on delete restrict;

alter table public.kitchen_tickets
  drop constraint if exists kitchen_tickets_customer_invoice_id_fkey,
  add constraint kitchen_tickets_customer_invoice_id_fkey
    foreign key (customer_invoice_id)
    references public.customer_invoices(id)
    on delete set null;

alter table public.kitchen_ticket_items
  drop constraint if exists kitchen_ticket_items_kitchen_ticket_id_fkey,
  drop constraint if exists kitchen_ticket_items_org_id_fk,
  add constraint kitchen_ticket_items_org_id_fk
    foreign key (organization_id, kitchen_ticket_id)
    references public.kitchen_tickets(organization_id, id)
    on delete restrict;

alter table public.production_order_materials
  drop constraint if exists production_order_materials_production_order_id_fkey,
  add constraint production_order_materials_production_order_id_fkey
    foreign key (production_order_id)
    references public.production_orders(id)
    on delete restrict;
