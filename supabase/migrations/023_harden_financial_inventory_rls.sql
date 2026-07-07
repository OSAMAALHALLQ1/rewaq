-- Harden financial and inventory RLS without deleting or rewriting history.
-- This is a forward-only safety migration: destructive DELETE access is removed
-- from operational history tables, while correction/void/archive workflows stay
-- possible through INSERT or UPDATE policies.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'branch_stock',
    'stock_movements',
    'stock_counts',
    'waste_logs',
    'purchase_orders',
    'invoices',
    'customer_invoices'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('drop policy if exists %I on public.%I', target_table || ' branch delete', target_table);
    end if;
  end loop;
end $$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'transfer_items',
    'stock_count_items',
    'purchase_order_items',
    'invoice_items',
    'customer_invoice_items',
    'customer_invoice_payments',
    'supplier_price_history'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('drop policy if exists %I on public.%I', target_table || ' org scoped', target_table);
    end if;
  end loop;
end $$;

drop policy if exists "transfers branch write" on public.transfers;
drop policy if exists "stock_movements branch update" on public.stock_movements;
drop policy if exists "stock_count_items org read" on public.stock_count_items;
drop policy if exists "stock_count_items org write" on public.stock_count_items;
drop policy if exists "coa owner write" on public.chart_of_accounts;
drop policy if exists "journal entries accountant write" on public.journal_entries;
drop policy if exists "journal lines accountant write" on public.journal_lines;

-- Chart accounts are financial master data. Disable accounts with is_active=false
-- instead of deleting rows that may be referenced by journal history.
drop policy if exists "coa owner insert" on public.chart_of_accounts;
create policy "coa owner insert" on public.chart_of_accounts
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
    or public.is_super_admin()
  );

drop policy if exists "coa owner update" on public.chart_of_accounts;
create policy "coa owner update" on public.chart_of_accounts
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
    or public.is_super_admin()
  )
  with check (
    public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
    or public.is_super_admin()
  );

-- Transfer headers are workflow records: update is allowed for lifecycle state,
-- but delete is intentionally omitted.
drop policy if exists "transfers branch insert" on public.transfers;
create policy "transfers branch insert" on public.transfers
  for insert to authenticated
  with check (
    public.can_access_branch(organization_id, from_branch_id)
    or public.can_access_branch(organization_id, to_branch_id)
  );

drop policy if exists "transfers branch update" on public.transfers;
create policy "transfers branch update" on public.transfers
  for update to authenticated
  using (
    public.can_access_branch(organization_id, from_branch_id)
    or public.can_access_branch(organization_id, to_branch_id)
  )
  with check (
    public.can_access_branch(organization_id, from_branch_id)
    or public.can_access_branch(organization_id, to_branch_id)
  );

-- Transfer and purchase-order line items can be corrected while their parent
-- workflows are still open, but they should not be deleted through client RLS.
drop policy if exists "transfer_items org read" on public.transfer_items;
create policy "transfer_items org read" on public.transfer_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "transfer_items org insert" on public.transfer_items;
create policy "transfer_items org insert" on public.transfer_items
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "transfer_items org update" on public.transfer_items;
create policy "transfer_items org update" on public.transfer_items
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "purchase_order_items org read" on public.purchase_order_items;
create policy "purchase_order_items org read" on public.purchase_order_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "purchase_order_items org insert" on public.purchase_order_items;
create policy "purchase_order_items org insert" on public.purchase_order_items
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "purchase_order_items org update" on public.purchase_order_items;
create policy "purchase_order_items org update" on public.purchase_order_items
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "stock_count_items org read" on public.stock_count_items;
create policy "stock_count_items org read" on public.stock_count_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "stock_count_items org insert" on public.stock_count_items;
create policy "stock_count_items org insert" on public.stock_count_items
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "stock_count_items org update" on public.stock_count_items;
create policy "stock_count_items org update" on public.stock_count_items
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Supplier invoices, customer invoice lines, and payments are financial
-- history. Corrections should be appended or represented by void/reversal
-- records, so direct client update/delete is omitted.
drop policy if exists "invoice_items org read" on public.invoice_items;
create policy "invoice_items org read" on public.invoice_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "invoice_items org insert" on public.invoice_items;
create policy "invoice_items org insert" on public.invoice_items
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "customer_invoice_items org read" on public.customer_invoice_items;
create policy "customer_invoice_items org read" on public.customer_invoice_items
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "customer_invoice_items org insert" on public.customer_invoice_items;
create policy "customer_invoice_items org insert" on public.customer_invoice_items
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "customer_invoice_payments org read" on public.customer_invoice_payments;
create policy "customer_invoice_payments org read" on public.customer_invoice_payments
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "customer_invoice_payments org insert" on public.customer_invoice_payments;
create policy "customer_invoice_payments org insert" on public.customer_invoice_payments
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "supplier_price_history org read" on public.supplier_price_history;
create policy "supplier_price_history org read" on public.supplier_price_history
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "supplier_price_history org insert" on public.supplier_price_history;
create policy "supplier_price_history org insert" on public.supplier_price_history
  for insert to authenticated
  with check (public.is_org_member(organization_id));

-- Accountants can create draft/posting records through approved workflows.
-- Posted journal entries and lines are not mutable or deletable through RLS.
drop policy if exists "journal entries accountant insert" on public.journal_entries;
create policy "journal entries accountant insert" on public.journal_entries
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
    or public.is_super_admin()
  );

drop policy if exists "journal entries accountant draft update" on public.journal_entries;
create policy "journal entries accountant draft update" on public.journal_entries
  for update to authenticated
  using (
    status = 'draft'
    and (
      public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
      or public.is_super_admin()
    )
  )
  with check (
    status in ('draft', 'void')
    and (
      public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
      or public.is_super_admin()
    )
  );

drop policy if exists "journal lines accountant insert" on public.journal_lines;
create policy "journal lines accountant insert" on public.journal_lines
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
    or public.is_super_admin()
  );

drop policy if exists "journal lines accountant draft update" on public.journal_lines;
create policy "journal lines accountant draft update" on public.journal_lines
  for update to authenticated
  using (
    exists (
      select 1
      from public.journal_entries je
      where je.id = journal_lines.journal_entry_id
        and je.organization_id = journal_lines.organization_id
        and je.status = 'draft'
    )
    and (
      public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
      or public.is_super_admin()
    )
  )
  with check (
    exists (
      select 1
      from public.journal_entries je
      where je.id = journal_lines.journal_entry_id
        and je.organization_id = journal_lines.organization_id
        and je.status = 'draft'
    )
    and (
      public.has_org_role(organization_id, array['organization_owner','accountant']::app_role[])
      or public.is_super_admin()
    )
  );

comment on policy "journal entries accountant draft update" on public.journal_entries is
  'Only draft journal entries may be updated through authenticated RLS. Posted entries require reversal/void workflows.';

comment on policy "journal lines accountant draft update" on public.journal_lines is
  'Only lines attached to draft journal entries may be updated through authenticated RLS.';
