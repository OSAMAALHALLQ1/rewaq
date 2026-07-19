-- P0 hardening: purchase orders, goods receipts, and supplier invoices must
-- commit their document, stock, accounting, and audit effects together.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_org_idempotency_unique
  ON public.purchase_orders (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_org_idempotency_unique
  ON public.invoices (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_purchase_order_atomic(
  p_organization_id uuid,
  p_supplier_id uuid,
  p_branch_id uuid,
  p_item_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_order_date date,
  p_status public.purchase_order_status DEFAULT 'sent',
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_order_id uuid;
  v_total numeric(14,4);
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى هذه المؤسسة.';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب.';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'كمية أمر الشراء يجب أن تكون أكبر من صفر.';
  END IF;
  IF p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION 'سعر أمر الشراء غير صالح.';
  END IF;
  IF p_order_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ أمر الشراء مطلوب.';
  END IF;
  IF p_status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'يمكن إنشاء أمر الشراء بحالة مسودة أو مرسل فقط.';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.purchase_orders
  WHERE organization_id = p_organization_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'purchase_order_id', v_existing_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE id = p_supplier_id AND organization_id = p_organization_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'المورد غير موجود أو غير نشط.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_branch_id AND organization_id = p_organization_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'الفرع غير موجود أو غير نشط.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_items
    WHERE id = p_item_id AND organization_id = p_organization_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'صنف المخزون غير موجود أو غير نشط.';
  END IF;

  v_total := round(p_quantity::numeric * p_unit_price::numeric, 4);

  INSERT INTO public.purchase_orders (
    organization_id, supplier_id, branch_id, status, order_date, total,
    notes, idempotency_key, created_by
  ) VALUES (
    p_organization_id, p_supplier_id, p_branch_id, p_status, p_order_date,
    v_total, NULLIF(btrim(p_notes), ''), p_idempotency_key, p_created_by
  )
  ON CONFLICT (organization_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    SELECT id INTO v_existing_id
    FROM public.purchase_orders
    WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'purchase_order_id', v_existing_id);
  END IF;

  INSERT INTO public.purchase_order_items (
    organization_id, purchase_order_id, item_id, quantity,
    expected_unit_price, received_quantity, created_by
  ) VALUES (
    p_organization_id, v_order_id, p_item_id, round(p_quantity::numeric, 4),
    round(p_unit_price::numeric, 4), 0, p_created_by
  );

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) VALUES (
    p_organization_id, p_branch_id, p_created_by, 'purchase_order_created',
    'purchase_order', v_order_id,
    jsonb_build_object('supplier_id', p_supplier_id, 'item_id', p_item_id,
      'quantity', p_quantity, 'unit_price', p_unit_price, 'total', v_total, 'status', p_status)
  );

  RETURN jsonb_build_object(
    'success', true, 'duplicate', false, 'purchase_order_id', v_order_id, 'total', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_purchase_receipt_atomic(
  p_organization_id uuid,
  p_purchase_order_id uuid,
  p_received_at date,
  p_idempotency_key text,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_item record;
  v_existing_receipt record;
  v_receipt_id uuid;
  v_journal_entry_id uuid;
  v_inventory_account_id uuid;
  v_grni_account_id uuid;
  v_receipt_total numeric(14,4) := 0;
  v_quantity_to_receive numeric(14,4);
  v_line_total numeric(14,4);
  v_old_org_stock numeric(14,4);
  v_old_average_cost numeric(14,4);
  v_new_average_cost numeric(14,4);
  v_lines_count integer := 0;
  v_all_received boolean;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى هذه المؤسسة.';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب.';
  END IF;
  IF p_received_at IS NULL THEN
    RAISE EXCEPTION 'تاريخ الاستلام مطلوب.';
  END IF;

  SELECT id, purchase_order_id, total INTO v_existing_receipt
  FROM public.goods_receipts
  WHERE organization_id = p_organization_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'duplicate', true, 'receipt_id', v_existing_receipt.id,
      'purchase_order_id', v_existing_receipt.purchase_order_id, 'total', v_existing_receipt.total
    );
  END IF;

  SELECT po.id, po.supplier_id, po.branch_id, po.status
    INTO v_order
  FROM public.purchase_orders po
  WHERE po.id = p_purchase_order_id
    AND po.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'أمر الشراء غير موجود.';
  END IF;
  IF v_order.status IN ('draft', 'cancelled') THEN
    RAISE EXCEPTION 'يجب إرسال أمر الشراء قبل استلامه ولا يمكن استلام أمر ملغى.';
  END IF;

  SELECT id, purchase_order_id, total INTO v_existing_receipt
  FROM public.goods_receipts
  WHERE organization_id = p_organization_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'duplicate', true, 'receipt_id', v_existing_receipt.id,
      'purchase_order_id', v_existing_receipt.purchase_order_id, 'total', v_existing_receipt.total
    );
  END IF;

  IF public.is_accounting_period_closed(p_organization_id, p_received_at) THEN
    RAISE EXCEPTION 'هذه الفترة المحاسبية مقفلة. أعد فتحها قبل تسجيل الاستلام.';
  END IF;

  INSERT INTO public.goods_receipts (
    organization_id, purchase_order_id, supplier_id, branch_id, receipt_number,
    idempotency_key, received_at, total, status, created_by
  ) VALUES (
    p_organization_id, p_purchase_order_id, v_order.supplier_id, v_order.branch_id,
    'GR-' || to_char(p_received_at, 'YYYYMMDD') || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8),
    p_idempotency_key, p_received_at, 0, 'posted', p_created_by
  ) RETURNING id INTO v_receipt_id;

  FOR v_item IN
    SELECT poi.id, poi.item_id, poi.quantity, poi.received_quantity, poi.expected_unit_price
    FROM public.purchase_order_items poi
    WHERE poi.organization_id = p_organization_id
      AND poi.purchase_order_id = p_purchase_order_id
    ORDER BY poi.id
    FOR UPDATE
  LOOP
    v_quantity_to_receive := round(GREATEST(0,
      COALESCE(v_item.quantity, 0) - COALESCE(v_item.received_quantity, 0))::numeric, 4);
    IF v_quantity_to_receive <= 0 THEN
      CONTINUE;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || v_item.item_id::text, 0));

    SELECT COALESCE(sum(bs.quantity), 0), COALESCE(ii.average_cost, 0)
      INTO v_old_org_stock, v_old_average_cost
    FROM public.inventory_items ii
    LEFT JOIN public.branch_stock bs
      ON bs.organization_id = ii.organization_id AND bs.item_id = ii.id
    WHERE ii.id = v_item.item_id AND ii.organization_id = p_organization_id
    GROUP BY ii.average_cost;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'أحد أصناف أمر الشراء غير موجود.';
    END IF;

    INSERT INTO public.branch_stock (
      organization_id, branch_id, item_id, quantity, reserved_quantity, created_by
    ) VALUES (
      p_organization_id, v_order.branch_id, v_item.item_id, 0, 0, p_created_by
    ) ON CONFLICT (branch_id, item_id) DO NOTHING;

    PERFORM 1 FROM public.branch_stock
    WHERE organization_id = p_organization_id
      AND branch_id = v_order.branch_id
      AND item_id = v_item.item_id
    FOR UPDATE;

    UPDATE public.branch_stock
    SET quantity = quantity + v_quantity_to_receive, updated_at = now()
    WHERE organization_id = p_organization_id
      AND branch_id = v_order.branch_id
      AND item_id = v_item.item_id;

    v_line_total := round(v_quantity_to_receive * COALESCE(v_item.expected_unit_price, 0), 4);

    INSERT INTO public.stock_movements (
      organization_id, branch_id, item_id, movement_type, quantity, unit_cost,
      source_doc_type, source_doc_id, idempotency_key, notes, created_by
    ) VALUES (
      p_organization_id, v_order.branch_id, v_item.item_id, 'purchase',
      v_quantity_to_receive, COALESCE(v_item.expected_unit_price, 0),
      'goods_receipt', v_receipt_id, v_receipt_id::text || ':' || v_item.id::text,
      'استلام أمر شراء', p_created_by
    );

    INSERT INTO public.goods_receipt_items (
      organization_id, goods_receipt_id, purchase_order_item_id, item_id,
      quantity, unit_cost, total
    ) VALUES (
      p_organization_id, v_receipt_id, v_item.id, v_item.item_id,
      v_quantity_to_receive, COALESCE(v_item.expected_unit_price, 0), v_line_total
    );

    UPDATE public.purchase_order_items
    SET received_quantity = COALESCE(received_quantity, 0) + v_quantity_to_receive,
        updated_at = now()
    WHERE id = v_item.id AND organization_id = p_organization_id;

    INSERT INTO public.supplier_price_history (
      organization_id, supplier_id, item_id, unit_price,
      source_doc_type, source_doc_id, created_by
    )
    SELECT
      p_organization_id, v_order.supplier_id, v_item.item_id,
      COALESCE(v_item.expected_unit_price, 0), 'goods_receipt', v_receipt_id, p_created_by
    WHERE NOT EXISTS (
      SELECT 1 FROM public.supplier_price_history sph
      WHERE sph.organization_id = p_organization_id
        AND sph.source_doc_type = 'goods_receipt'
        AND sph.source_doc_id = v_receipt_id
        AND sph.item_id = v_item.item_id
    );

    v_new_average_cost := CASE
      WHEN v_old_org_stock + v_quantity_to_receive <= 0 THEN COALESCE(v_item.expected_unit_price, 0)
      ELSE round(((v_old_average_cost * v_old_org_stock) + v_line_total)
        / (v_old_org_stock + v_quantity_to_receive), 4)
    END;

    UPDATE public.inventory_items
    SET average_cost = v_new_average_cost,
        last_purchase_price = COALESCE(v_item.expected_unit_price, 0),
        updated_at = now()
    WHERE id = v_item.item_id AND organization_id = p_organization_id;

    v_receipt_total := v_receipt_total + v_line_total;
    v_lines_count := v_lines_count + 1;
  END LOOP;

  IF v_lines_count = 0 THEN
    RAISE EXCEPTION 'لا توجد كميات جديدة لاستلامها في هذا الأمر.';
  END IF;

  UPDATE public.goods_receipts
  SET total = round(v_receipt_total, 4)
  WHERE id = v_receipt_id AND organization_id = p_organization_id;

  SELECT bool_and(COALESCE(received_quantity, 0) >= quantity)
    INTO v_all_received
  FROM public.purchase_order_items
  WHERE organization_id = p_organization_id AND purchase_order_id = p_purchase_order_id;

  UPDATE public.purchase_orders
  SET status = CASE WHEN COALESCE(v_all_received, false) THEN 'received' ELSE 'partially_received' END,
      updated_at = now()
  WHERE id = p_purchase_order_id AND organization_id = p_organization_id;

  PERFORM public.ensure_default_chart_accounts(p_organization_id);
  SELECT id INTO v_inventory_account_id FROM public.chart_of_accounts
    WHERE organization_id = p_organization_id AND system_key = 'inventory' AND is_active LIMIT 1;
  SELECT id INTO v_grni_account_id FROM public.chart_of_accounts
    WHERE organization_id = p_organization_id AND system_key = 'goods_received_not_invoiced' AND is_active LIMIT 1;
  IF v_inventory_account_id IS NULL OR v_grni_account_id IS NULL THEN
    RAISE EXCEPTION 'حسابات استلام المخزون غير مكتملة.';
  END IF;

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_number, entry_date, source_doc_type,
    source_doc_id, memo, status, created_by
  ) VALUES (
    p_organization_id, v_order.branch_id,
    'JE-' || to_char(p_received_at, 'YYYYMMDD') || '-GR-' || left(replace(v_receipt_id::text, '-', ''), 8),
    p_received_at, 'purchase_receipt', v_receipt_id,
    'قيد استلام أمر شراء ' || p_purchase_order_id::text, 'posted', p_created_by
  ) RETURNING id INTO v_journal_entry_id;

  INSERT INTO public.journal_lines (
    organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
  ) VALUES
    (p_organization_id, v_journal_entry_id, v_inventory_account_id, v_order.branch_id,
      round(v_receipt_total, 4), 0, 'استلام مخزون أمر شراء'),
    (p_organization_id, v_journal_entry_id, v_grni_account_id, v_order.branch_id,
      0, round(v_receipt_total, 4), 'بضاعة مستلمة غير مفوترة');

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) VALUES (
    p_organization_id, v_order.branch_id, p_created_by, 'purchase_receipt_posted',
    'goods_receipt', v_receipt_id,
    jsonb_build_object('purchase_order_id', p_purchase_order_id, 'total', v_receipt_total,
      'lines_count', v_lines_count, 'journal_entry_id', v_journal_entry_id)
  );

  RETURN jsonb_build_object(
    'success', true, 'duplicate', false, 'receipt_id', v_receipt_id,
    'purchase_order_id', p_purchase_order_id, 'journal_entry_id', v_journal_entry_id,
    'total', round(v_receipt_total, 4), 'lines_count', v_lines_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_supplier_invoice_atomic(
  p_organization_id uuid,
  p_supplier_id uuid,
  p_branch_id uuid,
  p_invoice_number text,
  p_issued_at date,
  p_due_date date,
  p_item_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_purchase_order_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_expiry_date date DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_invoice record;
  v_order record;
  v_invoice_id uuid;
  v_journal_entry_id uuid;
  v_debit_account_id uuid;
  v_ap_account_id uuid;
  v_total numeric(14,4);
  v_received_quantity numeric(14,4);
  v_previously_invoiced_quantity numeric(14,4);
  v_old_org_stock numeric(14,4);
  v_old_average_cost numeric(14,4);
  v_new_average_cost numeric(14,4);
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى هذه المؤسسة.';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب.';
  END IF;
  IF p_invoice_number IS NULL OR btrim(p_invoice_number) = '' THEN
    RAISE EXCEPTION 'رقم فاتورة المورد مطلوب.';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION 'كمية أو سعر الفاتورة غير صالح.';
  END IF;
  IF p_issued_at IS NULL OR p_due_date IS NULL OR p_due_date < p_issued_at THEN
    RAISE EXCEPTION 'تواريخ الفاتورة أو الاستحقاق غير صالحة.';
  END IF;

  SELECT id, total INTO v_existing_invoice
  FROM public.invoices
  WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true,
      'invoice_id', v_existing_invoice.id, 'total', v_existing_invoice.total);
  END IF;

  IF public.is_accounting_period_closed(p_organization_id, p_issued_at) THEN
    RAISE EXCEPTION 'هذه الفترة المحاسبية مقفلة. أعد فتحها قبل تسجيل الفاتورة.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND organization_id = p_organization_id) THEN
    RAISE EXCEPTION 'المورد غير موجود.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id AND organization_id = p_organization_id) THEN
    RAISE EXCEPTION 'الفرع غير موجود.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE id = p_item_id AND organization_id = p_organization_id) THEN
    RAISE EXCEPTION 'صنف المخزون غير موجود.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE organization_id = p_organization_id
      AND supplier_id = p_supplier_id
      AND invoice_number = p_invoice_number
      AND status <> 'void'
  ) THEN
    RAISE EXCEPTION 'رقم فاتورة المورد مسجل مسبقاً لهذا المورد.';
  END IF;

  v_total := round(p_quantity::numeric * p_unit_price::numeric, 4);

  IF p_purchase_order_id IS NOT NULL THEN
    SELECT po.id, po.supplier_id, po.branch_id, po.status INTO v_order
    FROM public.purchase_orders po
    WHERE po.id = p_purchase_order_id AND po.organization_id = p_organization_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'أمر الشراء المرتبط غير موجود.';
    END IF;
    IF v_order.supplier_id <> p_supplier_id OR v_order.branch_id <> p_branch_id THEN
      RAISE EXCEPTION 'المورد أو الفرع لا يطابق أمر الشراء.';
    END IF;

    SELECT COALESCE(sum(poi.received_quantity), 0) INTO v_received_quantity
    FROM public.purchase_order_items poi
    WHERE poi.organization_id = p_organization_id
      AND poi.purchase_order_id = p_purchase_order_id
      AND poi.item_id = p_item_id;

    SELECT COALESCE(sum(ii.quantity), 0) INTO v_previously_invoiced_quantity
    FROM public.invoice_items ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    WHERE i.organization_id = p_organization_id
      AND i.purchase_order_id = p_purchase_order_id
      AND i.status <> 'void'
      AND ii.item_id = p_item_id;

    IF p_quantity > v_received_quantity - v_previously_invoiced_quantity + 0.0001 THEN
      RAISE EXCEPTION 'كمية الفاتورة تتجاوز الكمية المستلمة غير المفوترة لهذا الصنف.';
    END IF;
  END IF;

  INSERT INTO public.invoices (
    organization_id, supplier_id, branch_id, purchase_order_id, invoice_number,
    status, total, issued_at, due_date, payment_method, payment_status,
    paid_amount, balance_due, idempotency_key, created_by
  ) VALUES (
    p_organization_id, p_supplier_id, p_branch_id, p_purchase_order_id,
    btrim(p_invoice_number), 'posted', v_total, p_issued_at, p_due_date,
    p_payment_method, 'unpaid', 0, v_total, p_idempotency_key, p_created_by
  )
  ON CONFLICT (organization_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_invoice_id;

  IF v_invoice_id IS NULL THEN
    SELECT id, total INTO v_existing_invoice
    FROM public.invoices
    WHERE organization_id = p_organization_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
    RETURN jsonb_build_object('success', true, 'duplicate', true,
      'invoice_id', v_existing_invoice.id, 'total', v_existing_invoice.total);
  END IF;

  INSERT INTO public.invoice_items (
    organization_id, invoice_id, item_id, quantity, unit_price, created_by
  ) VALUES (
    p_organization_id, v_invoice_id, p_item_id, round(p_quantity::numeric, 4),
    round(p_unit_price::numeric, 4), p_created_by
  );

  IF p_purchase_order_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_item_id::text, 0));
    SELECT COALESCE(sum(bs.quantity), 0), COALESCE(ii.average_cost, 0)
      INTO v_old_org_stock, v_old_average_cost
    FROM public.inventory_items ii
    LEFT JOIN public.branch_stock bs
      ON bs.organization_id = ii.organization_id AND bs.item_id = ii.id
    WHERE ii.id = p_item_id AND ii.organization_id = p_organization_id
    GROUP BY ii.average_cost;

    INSERT INTO public.branch_stock (
      organization_id, branch_id, item_id, quantity, reserved_quantity, created_by
    ) VALUES (p_organization_id, p_branch_id, p_item_id, 0, 0, p_created_by)
    ON CONFLICT (branch_id, item_id) DO NOTHING;

    PERFORM 1 FROM public.branch_stock
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND item_id = p_item_id
    FOR UPDATE;

    UPDATE public.branch_stock SET quantity = quantity + p_quantity, updated_at = now()
    WHERE organization_id = p_organization_id AND branch_id = p_branch_id AND item_id = p_item_id;

    INSERT INTO public.stock_movements (
      organization_id, branch_id, item_id, movement_type, quantity, unit_cost,
      source_doc_type, source_doc_id, idempotency_key, notes, created_by
    ) VALUES (
      p_organization_id, p_branch_id, p_item_id, 'purchase', p_quantity, p_unit_price,
      'invoice', v_invoice_id, v_invoice_id::text || ':' || p_item_id::text || ':receive',
      'فاتورة توريد ' || btrim(p_invoice_number) ||
        CASE WHEN p_expiry_date IS NULL THEN '' ELSE ' - انتهاء: ' || p_expiry_date::text END,
      p_created_by
    );

    v_new_average_cost := CASE
      WHEN v_old_org_stock + p_quantity <= 0 THEN p_unit_price
      ELSE round(((v_old_average_cost * v_old_org_stock) + v_total) / (v_old_org_stock + p_quantity), 4)
    END;
    UPDATE public.inventory_items
    SET average_cost = v_new_average_cost, last_purchase_price = p_unit_price, updated_at = now()
    WHERE id = p_item_id AND organization_id = p_organization_id;
  END IF;

  INSERT INTO public.supplier_price_history (
    organization_id, supplier_id, item_id, unit_price, source_doc_type, source_doc_id, created_by
  )
  SELECT
    p_organization_id, p_supplier_id, p_item_id, p_unit_price, 'supplier_invoice', v_invoice_id, p_created_by
  WHERE NOT EXISTS (
    SELECT 1 FROM public.supplier_price_history sph
    WHERE sph.organization_id = p_organization_id
      AND sph.source_doc_type = 'supplier_invoice'
      AND sph.source_doc_id = v_invoice_id
      AND sph.item_id = p_item_id
  );

  PERFORM public.ensure_default_chart_accounts(p_organization_id);
  SELECT id INTO v_debit_account_id FROM public.chart_of_accounts
  WHERE organization_id = p_organization_id
    AND system_key = CASE WHEN p_purchase_order_id IS NULL THEN 'inventory' ELSE 'goods_received_not_invoiced' END
    AND is_active LIMIT 1;
  SELECT id INTO v_ap_account_id FROM public.chart_of_accounts
  WHERE organization_id = p_organization_id AND system_key = 'accounts_payable' AND is_active LIMIT 1;
  IF v_debit_account_id IS NULL OR v_ap_account_id IS NULL THEN
    RAISE EXCEPTION 'حسابات فاتورة المورد غير مكتملة.';
  END IF;

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_number, entry_date, source_doc_type,
    source_doc_id, memo, status, created_by
  ) VALUES (
    p_organization_id, p_branch_id,
    'JE-' || to_char(p_issued_at, 'YYYYMMDD') || '-INV-' || left(replace(v_invoice_id::text, '-', ''), 8),
    p_issued_at, 'supplier_invoice', v_invoice_id,
    'قيد تلقائي لفاتورة مورد ' || btrim(p_invoice_number), 'posted', p_created_by
  ) RETURNING id INTO v_journal_entry_id;

  INSERT INTO public.journal_lines (
    organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
  ) VALUES
    (p_organization_id, v_journal_entry_id, v_debit_account_id, p_branch_id,
      v_total, 0, CASE WHEN p_purchase_order_id IS NULL THEN 'إدخال مخزون فاتورة مورد' ELSE 'تسوية بضاعة مستلمة غير مفوترة' END),
    (p_organization_id, v_journal_entry_id, v_ap_account_id, p_branch_id,
      0, v_total, 'ذمم موردين فاتورة ' || btrim(p_invoice_number));

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, new_data
  ) VALUES (
    p_organization_id, p_branch_id, p_created_by, 'supplier_invoice_posted',
    'invoice', v_invoice_id,
    jsonb_build_object('invoice_number', btrim(p_invoice_number), 'purchase_order_id', p_purchase_order_id,
      'item_id', p_item_id, 'quantity', p_quantity, 'unit_price', p_unit_price,
      'total', v_total, 'journal_entry_id', v_journal_entry_id)
  );

  RETURN jsonb_build_object(
    'success', true, 'duplicate', false, 'invoice_id', v_invoice_id,
    'journal_entry_id', v_journal_entry_id, 'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_purchase_order_atomic(
  uuid, uuid, uuid, uuid, numeric, numeric, date, public.purchase_order_status, text, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_purchase_order_atomic(
  uuid, uuid, uuid, uuid, numeric, numeric, date, public.purchase_order_status, text, text, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_order_atomic(
  uuid, uuid, uuid, uuid, numeric, numeric, date, public.purchase_order_status, text, text, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.record_purchase_receipt_atomic(
  uuid, uuid, date, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_purchase_receipt_atomic(
  uuid, uuid, date, text, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_purchase_receipt_atomic(
  uuid, uuid, date, text, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.create_supplier_invoice_atomic(
  uuid, uuid, uuid, text, date, date, uuid, numeric, numeric, uuid, text, date, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_supplier_invoice_atomic(
  uuid, uuid, uuid, text, date, date, uuid, numeric, numeric, uuid, text, date, text, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_supplier_invoice_atomic(
  uuid, uuid, uuid, text, date, date, uuid, numeric, numeric, uuid, text, date, text, uuid
) TO service_role;
