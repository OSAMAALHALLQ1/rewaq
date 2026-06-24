-- Adds GRNI account for purchase receipts that arrive before supplier invoices.

insert into public.chart_of_accounts (organization_id, code, name, account_type, normal_balance, system_key)
select id, '2250', 'بضاعة مستلمة غير مفوترة', 'liability', 'credit', 'goods_received_not_invoiced'
from public.organizations
on conflict (organization_id, system_key) do update
  set code = excluded.code,
      name = excluded.name,
      account_type = excluded.account_type,
      normal_balance = excluded.normal_balance,
      updated_at = now();

create or replace function public.ensure_default_chart_accounts(target_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chart_of_accounts (organization_id, code, name, account_type, normal_balance, system_key)
  values
    (target_org_id, '1010', 'الصندوق', 'asset', 'debit', 'cash'),
    (target_org_id, '1020', 'البنك / بطاقات', 'asset', 'debit', 'bank'),
    (target_org_id, '1150', 'ذمم العملاء', 'asset', 'debit', 'accounts_receivable'),
    (target_org_id, '1300', 'المخزون', 'asset', 'debit', 'inventory'),
    (target_org_id, '2100', 'ضريبة مبيعات مستحقة', 'liability', 'credit', 'sales_tax_payable'),
    (target_org_id, '2200', 'ذمم الموردين', 'liability', 'credit', 'accounts_payable'),
    (target_org_id, '2250', 'بضاعة مستلمة غير مفوترة', 'liability', 'credit', 'goods_received_not_invoiced'),
    (target_org_id, '3000', 'رأس المال', 'equity', 'credit', 'owner_equity'),
    (target_org_id, '4100', 'مبيعات المطعم', 'revenue', 'credit', 'sales_revenue'),
    (target_org_id, '5100', 'تكلفة البضاعة المباعة', 'cogs', 'debit', 'cogs'),
    (target_org_id, '5900', 'فروقات الصندوق', 'expense', 'debit', 'cash_over_short'),
    (target_org_id, '6100', 'مصروفات تشغيلية', 'expense', 'debit', 'operating_expense')
  on conflict (organization_id, system_key) do update
    set name = excluded.name,
        account_type = excluded.account_type,
        normal_balance = excluded.normal_balance,
        updated_at = now();
end;
$$;
