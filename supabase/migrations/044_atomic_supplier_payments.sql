-- P0 hardening: supplier payments must be atomic, idempotent, and linked to
-- the payment document, not the invoice. Do not apply to production before
-- reviewing the validation queries in docs/audits/REWAQ_AUDIT_REMEDIATION_PLAN_AR.md.

ALTER TABLE public.supplier_payments
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_payments_org_idempotency_unique
  ON public.supplier_payments (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS supplier_payments_journal_entry_idx
  ON public.supplier_payments (organization_id, journal_entry_id);

CREATE OR REPLACE FUNCTION public.record_supplier_payment_atomic(
  p_organization_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_reference text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_payment record;
  v_invoice record;
  v_supplier_name text;
  v_amount numeric(14,4);
  v_new_paid numeric(14,4);
  v_new_balance numeric(14,4);
  v_new_status text;
  v_payment_id uuid;
  v_journal_entry_id uuid;
  v_journal_number text;
  v_ap_account_id uuid;
  v_credit_account_id uuid;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى هذه المؤسسة.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'المبلغ يجب أن يكون أكبر من صفر.';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب.';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ الدفع مطلوب.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT sp.id, sp.invoice_id, sp.amount, sp.journal_entry_id
      INTO v_existing_payment
    FROM public.supplier_payments sp
    WHERE sp.organization_id = p_organization_id
      AND sp.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'duplicate', true,
        'payment_id', v_existing_payment.id,
        'invoice_id', v_existing_payment.invoice_id,
        'journal_entry_id', v_existing_payment.journal_entry_id
      );
    END IF;
  END IF;

  IF public.is_accounting_period_closed(p_organization_id, p_payment_date) THEN
    RAISE EXCEPTION 'هذه الفترة المحاسبية مقفلة. أعد فتح الفترة قبل تسجيل دفعة المورد.';
  END IF;

  SELECT i.id, i.invoice_number, i.supplier_id, i.branch_id, i.total,
         i.paid_amount, i.balance_due, i.status, i.payment_status
    INTO v_invoice
  FROM public.invoices i
  WHERE i.id = p_invoice_id
    AND i.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الفاتورة غير موجودة.';
  END IF;

  -- Recheck after the invoice lock so two concurrent retries with the same
  -- key return the first payment instead of racing into the unique index.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT sp.id, sp.invoice_id, sp.amount, sp.journal_entry_id
      INTO v_existing_payment
    FROM public.supplier_payments sp
    WHERE sp.organization_id = p_organization_id
      AND sp.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'duplicate', true,
        'payment_id', v_existing_payment.id,
        'invoice_id', v_existing_payment.invoice_id,
        'journal_entry_id', v_existing_payment.journal_entry_id
      );
    END IF;
  END IF;

  IF v_invoice.status = 'void' THEN
    RAISE EXCEPTION 'لا يمكن دفع فاتورة ملغاة.';
  END IF;

  v_amount := round(p_amount::numeric, 4);
  v_new_balance := round(COALESCE(v_invoice.balance_due, v_invoice.total, 0)::numeric - v_amount, 4);

  IF v_new_balance < -0.001 THEN
    RAISE EXCEPTION 'المبلغ أكبر من الرصيد المستحق.';
  END IF;

  v_new_balance := GREATEST(0, v_new_balance);
  v_new_paid := round(COALESCE(v_invoice.paid_amount, 0)::numeric + v_amount, 4);
  v_new_status := CASE WHEN v_new_balance <= 0.001 THEN 'paid' ELSE 'partially_paid' END;

  SELECT COALESCE(s.name, 'مورد')
    INTO v_supplier_name
  FROM public.suppliers s
  WHERE s.id = v_invoice.supplier_id
  LIMIT 1;

  v_supplier_name := COALESCE(v_supplier_name, 'مورد');

  PERFORM public.ensure_default_chart_accounts(p_organization_id);

  SELECT id INTO v_ap_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_organization_id
    AND system_key = 'accounts_payable'
    AND is_active = true
  LIMIT 1;

  SELECT id INTO v_credit_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_organization_id
    AND system_key = CASE WHEN p_payment_method = 'cash' THEN 'cash_on_hand' ELSE 'bank_card' END
    AND is_active = true
  LIMIT 1;

  IF v_ap_account_id IS NULL OR v_credit_account_id IS NULL THEN
    RAISE EXCEPTION 'حسابات الدفع المحاسبية غير مكتملة.';
  END IF;

  INSERT INTO public.supplier_payments (
    organization_id,
    invoice_id,
    supplier_id,
    branch_id,
    amount,
    payment_method,
    payment_date,
    reference,
    idempotency_key,
    created_by
  ) VALUES (
    p_organization_id,
    p_invoice_id,
    v_invoice.supplier_id,
    v_invoice.branch_id,
    v_amount,
    p_payment_method,
    p_payment_date,
    p_reference,
    p_idempotency_key,
    p_created_by
  )
  RETURNING id INTO v_payment_id;

  v_journal_number := 'JE-' || to_char(current_date, 'YYYYMMDD') || '-SUP-' || left(replace(v_payment_id::text, '-', ''), 8);

  INSERT INTO public.journal_entries (
    organization_id,
    branch_id,
    entry_number,
    entry_date,
    source_doc_type,
    source_doc_id,
    memo,
    status,
    created_by
  ) VALUES (
    p_organization_id,
    v_invoice.branch_id,
    v_journal_number,
    p_payment_date,
    'supplier_payment',
    v_payment_id,
    'دفع فاتورة مورد ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text) || ' - ' || v_supplier_name,
    'posted',
    p_created_by
  )
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO public.journal_lines (
    organization_id,
    journal_entry_id,
    account_id,
    branch_id,
    debit,
    credit,
    memo
  ) VALUES
    (
      p_organization_id,
      v_journal_entry_id,
      v_ap_account_id,
      v_invoice.branch_id,
      v_amount,
      0,
      'سداد ذمم مورد ' || v_supplier_name
    ),
    (
      p_organization_id,
      v_journal_entry_id,
      v_credit_account_id,
      v_invoice.branch_id,
      0,
      v_amount,
      'دفع نقدي/بنكي فاتورة مورد ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text)
    );

  UPDATE public.supplier_payments
  SET journal_entry_id = v_journal_entry_id
  WHERE id = v_payment_id
    AND organization_id = p_organization_id;

  UPDATE public.invoices
  SET paid_amount = v_new_paid,
      balance_due = v_new_balance,
      payment_status = v_new_status,
      status = v_new_status
  WHERE id = p_invoice_id
    AND organization_id = p_organization_id;

  INSERT INTO public.audit_logs (
    organization_id,
    branch_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) VALUES (
    p_organization_id,
    v_invoice.branch_id,
    p_created_by,
    'supplier_payment',
    'invoice',
    p_invoice_id,
    jsonb_build_object('balance_due', v_invoice.balance_due, 'paid_amount', v_invoice.paid_amount),
    jsonb_build_object('payment_id', v_payment_id, 'amount', v_amount, 'balance_due', v_new_balance, 'paid_amount', v_new_paid)
  );

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'payment_id', v_payment_id,
    'invoice_id', p_invoice_id,
    'journal_entry_id', v_journal_entry_id,
    'balance_due', v_new_balance,
    'paid_amount', v_new_paid,
    'payment_status', v_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_supplier_payment_atomic(uuid, uuid, numeric, text, date, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_supplier_payment_atomic(uuid, uuid, numeric, text, date, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_supplier_payment_atomic(uuid, uuid, numeric, text, date, text, text, uuid) TO service_role;
