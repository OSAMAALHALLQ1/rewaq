-- Inventory-count approval is a financial posting.  The count document, stock
-- movements, branch balances, audit event, and balanced journal must commit or
-- roll back together.  This migration intentionally does not rewrite history.

ALTER TABLE public.stock_counts
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS stock_counts_org_idempotency_unique
  ON public.stock_counts (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.post_stock_count_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_counted_at date,
  p_lines jsonb,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_existing_id uuid;
  v_count_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_counted_quantity numeric(14,4);
  v_system_quantity numeric(14,4);
  v_variance numeric(14,4);
  v_unit_cost numeric(14,4);
  v_total_variance numeric(14,4) := 0;
  v_lines_count integer := 0;
  v_variance_count integer := 0;
  v_journal jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى هذه المؤسسة.';
  END IF;
  IF p_counted_at IS NULL THEN RAISE EXCEPTION 'تاريخ الجرد مطلوب.'; END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب.';
  END IF;
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'أضف مادة واحدة على الأقل إلى الجرد.';
  END IF;
  IF jsonb_array_length(p_lines) > 1000 THEN RAISE EXCEPTION 'عدد بنود الجرد كبير جداً.'; END IF;
  IF public.is_accounting_period_closed(p_organization_id, p_counted_at) THEN
    RAISE EXCEPTION 'هذه الفترة المحاسبية مقفلة. أعد فتحها قبل اعتماد الجرد.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id AND organization_id = p_organization_id AND status = 'active') THEN
    RAISE EXCEPTION 'الفرع غير موجود أو غير نشط.';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.stock_counts
  WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'stock_count_id', v_existing_id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_lines) AS x(value)
    GROUP BY value->>'item_id'
    HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'لا يمكن تكرار المادة في وثيقة جرد واحدة.'; END IF;

  INSERT INTO public.stock_counts (
    organization_id, branch_id, status, counted_at, approved_at, notes, idempotency_key, created_by
  ) VALUES (
    p_organization_id, p_branch_id, 'approved', p_counted_at, now(),
    NULLIF(btrim(p_notes), ''), p_idempotency_key, p_created_by
  ) RETURNING id INTO v_count_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    BEGIN
      v_item_id := (v_line->>'item_id')::uuid;
      v_counted_quantity := round((v_line->>'counted_quantity')::numeric, 4);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'أحد بنود الجرد غير صالح.';
    END;
    IF v_counted_quantity < 0 THEN RAISE EXCEPTION 'كمية الجرد لا يمكن أن تكون سالبة.'; END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || v_item_id::text, 0));
    IF NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE id = v_item_id AND organization_id = p_organization_id AND status = 'active') THEN
      RAISE EXCEPTION 'إحدى مواد الجرد غير موجودة أو غير نشطة.';
    END IF;
    INSERT INTO public.branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity, created_by)
    VALUES (p_organization_id, p_branch_id, v_item_id, 0, 0, p_created_by)
    ON CONFLICT (branch_id, item_id) DO NOTHING;
    SELECT bs.quantity, ii.average_cost INTO v_system_quantity, v_unit_cost
    FROM public.branch_stock bs
    JOIN public.inventory_items ii ON ii.id = bs.item_id AND ii.organization_id = bs.organization_id
    WHERE bs.organization_id = p_organization_id AND bs.branch_id = p_branch_id AND bs.item_id = v_item_id
    FOR UPDATE OF bs;

    v_system_quantity := COALESCE(v_system_quantity, 0);
    v_unit_cost := COALESCE(v_unit_cost, 0);
    v_variance := round(v_counted_quantity - v_system_quantity, 4);
    INSERT INTO public.stock_count_items (
      organization_id, stock_count_id, item_id, system_quantity, counted_quantity, created_by
    ) VALUES (p_organization_id, v_count_id, v_item_id, v_system_quantity, v_counted_quantity, p_created_by);

    IF v_variance <> 0 THEN
      UPDATE public.branch_stock SET quantity = quantity + v_variance, updated_at = now()
      WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND item_id = v_item_id;
      INSERT INTO public.stock_movements (
        organization_id, branch_id, item_id, movement_type, quantity, unit_cost,
        source_doc_type, source_doc_id, idempotency_key, notes, created_by
      ) VALUES (
        p_organization_id, p_branch_id, v_item_id, 'stock_count', v_variance, v_unit_cost,
        'stock_count', v_count_id, v_count_id::text || ':' || v_item_id::text, 'تسوية فرق جرد', p_created_by
      );
      v_total_variance := round(v_total_variance + (v_variance * v_unit_cost), 4);
      v_variance_count := v_variance_count + 1;
    END IF;
    v_lines_count := v_lines_count + 1;
  END LOOP;

  IF v_total_variance <> 0 THEN
    SELECT public.post_balanced_journal_atomic(
      p_organization_id, p_branch_id, 'stock_count', v_count_id,
      'تسوية فروقات جرد مخزن - وثيقة رقم ' || left(v_count_id::text, 8), p_counted_at,
      CASE WHEN v_total_variance < 0 THEN jsonb_build_array(
        jsonb_build_object('system_key', 'cash_over_short', 'debit', abs(v_total_variance), 'credit', 0, 'memo', 'عجز جرد مخزني'),
        jsonb_build_object('system_key', 'inventory', 'debit', 0, 'credit', abs(v_total_variance), 'memo', 'تخفيض قيمة المخزون بالعجز')
      ) ELSE jsonb_build_array(
        jsonb_build_object('system_key', 'inventory', 'debit', v_total_variance, 'credit', 0, 'memo', 'زيادة جرد مخزني'),
        jsonb_build_object('system_key', 'cash_over_short', 'debit', 0, 'credit', v_total_variance, 'memo', 'تسوية زيادة الجرد')
      ) END,
      p_created_by
    ) INTO v_journal;
  END IF;

  INSERT INTO public.audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, new_data)
  VALUES (
    p_organization_id, p_branch_id, p_created_by, 'stock_count_approved_atomic', 'stock_count', v_count_id,
    jsonb_build_object('counted_at', p_counted_at, 'lines_count', v_lines_count, 'variance_count', v_variance_count,
      'financial_variance', v_total_variance, 'journal_entry_id', v_journal->>'entry_id')
  );
  RETURN jsonb_build_object('success', true, 'duplicate', false, 'stock_count_id', v_count_id,
    'lines_count', v_lines_count, 'variance_count', v_variance_count, 'financial_variance', v_total_variance,
    'journal_entry_id', v_journal->>'entry_id');
END;
$$;

REVOKE ALL ON FUNCTION public.post_stock_count_atomic(uuid, uuid, date, jsonb, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_stock_count_atomic(uuid, uuid, date, jsonb, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.post_stock_count_atomic(uuid, uuid, date, jsonb, text, text, uuid) TO service_role;
