-- Forward-only correction for functions already deployed through 060.
-- Supabase installs pgcrypto in `extensions`; include it in the execution path
-- for functions that calculate idempotency fingerprints.

alter function public.post_balanced_journal_atomic(uuid, uuid, text, uuid, text, date, jsonb, uuid)
  set search_path = pg_catalog, public, extensions;
alter function public.reverse_journal_entry_atomic(uuid, uuid, text, date, uuid)
  set search_path = pg_catalog, public, extensions;
alter function public.create_purchase_order_atomic(uuid, uuid, uuid, date, date, text, text, text, jsonb, numeric, text, uuid, text, jsonb)
  set search_path = pg_catalog, public, extensions;
alter function public.record_purchase_receipt_atomic(uuid, uuid, date, jsonb, text, text, uuid)
  set search_path = pg_catalog, public, extensions;

-- invoice.status is an enum while the lifecycle variable is text. Preserve the
-- existing atomic implementation and add the explicit cast required by PG17.
do $fix_supplier_payment$
declare
  v_oid oid;
  v_definition text;
begin
  select p.oid into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'record_supplier_payment_atomic'
    and pg_get_function_identity_arguments(p.oid) =
      'p_organization_id uuid, p_invoice_id uuid, p_amount numeric, p_payment_method text, p_payment_date date, p_reference text, p_idempotency_key text, p_created_by uuid';

  if v_oid is null then
    raise exception 'record_supplier_payment_atomic was not found';
  end if;

  v_definition := pg_get_functiondef(v_oid);
  v_definition := regexp_replace(
    v_definition,
    '(\mstatus\M[[:space:]]*=[[:space:]]*v_new_status)([;,[:space:]])',
    '\1::public.invoice_status\2',
    'g'
  );
  if position('status = v_new_status::public.invoice_status' in v_definition) = 0 then
    raise exception 'supplier payment status cast patch did not match';
  end if;
  execute v_definition;
end;
$fix_supplier_payment$;
