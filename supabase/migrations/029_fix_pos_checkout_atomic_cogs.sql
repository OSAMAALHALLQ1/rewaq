-- Forward-fix POS checkout atomic workflow.
-- Replaces the earlier RPC with a schema-aligned version that calculates real COGS,
-- locks aggregate stock requirements, posts balanced journals, updates summaries,
-- and creates kitchen tickets in the same database transaction.

CREATE OR REPLACE FUNCTION public.pos_checkout_atomic(
  p_org_id uuid,
  p_branch_id uuid,
  p_device_key_id uuid,
  p_device_name text,
  p_customer_name text,
  p_payment_method text,
  p_idempotency_key text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_number text;
  v_shift_id uuid;
  v_ticket_id uuid;
  v_ticket_number text;
  v_item record;
  v_catalog catalog_items%rowtype;
  v_mapping record;
  v_ingredient record;
  v_inventory inventory_items%rowtype;
  v_quantity numeric(14,4);
  v_unit_price numeric(12,4);
  v_deduct_qty numeric(14,4);
  v_unit_cost numeric(12,4);
  v_line_subtotal numeric(12,4);
  v_line_tax numeric(12,4);
  v_line_cost numeric(12,4);
  v_subtotal numeric(12,4) := 0;
  v_tax_total numeric(12,4) := 0;
  v_total numeric(12,4) := 0;
  v_cost_total numeric(12,4) := 0;
  v_stock_qty numeric(14,4);
  v_stock_id uuid;
  v_je_id uuid;
  v_je_number text;
  v_cash_acct_id uuid;
  v_revenue_acct_id uuid;
  v_tax_acct_id uuid;
  v_cogs_acct_id uuid;
  v_inv_acct_id uuid;
  v_impact record;
  v_existing record;
  v_drawer_type text;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب لفواتير الكاشير';
  END IF;

  IF p_payment_method NOT IN ('cash', 'card') THEN
    RAISE EXCEPTION 'طريقة الدفع غير مدعومة في جهاز الكاشير: %', p_payment_method;
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'الفاتورة يجب أن تحتوي على صنف واحد على الأقل';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'pos_checkout:' || p_org_id::text || ':' || p_branch_id::text || ':' || COALESCE(p_device_key_id::text, 'no-device'),
      0
    )
  );

  SELECT id, invoice_number, total, cost_total, shift_id
  INTO v_existing
  FROM public.customer_invoices
  WHERE organization_id = p_org_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing.id IS NOT NULL THEN
    SELECT id INTO v_ticket_id
    FROM public.kitchen_tickets
    WHERE organization_id = p_org_id
      AND customer_invoice_id = v_existing.id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'invoiceId', v_existing.id,
      'invoiceNumber', v_existing.invoice_number,
      'kitchenTicketId', v_ticket_id,
      'shiftId', v_existing.shift_id,
      'total', v_existing.total,
      'costTotal', v_existing.cost_total
    );
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_checkout_lines;
  CREATE TEMP TABLE pg_temp.pos_checkout_lines (
    line_index integer generated always as identity,
    catalog_item_id uuid not null,
    menu_item_id uuid,
    name text not null,
    quantity numeric(14,4) not null,
    unit_price numeric(12,4) not null,
    unit_name text not null,
    tax_rate numeric(8,4) not null,
    line_subtotal numeric(12,4) not null,
    line_tax numeric(12,4) not null,
    line_cost numeric(12,4) not null default 0
  ) ON COMMIT DROP;

  DROP TABLE IF EXISTS pg_temp.pos_checkout_impacts;
  CREATE TEMP TABLE pg_temp.pos_checkout_impacts (
    item_id uuid primary key,
    quantity numeric(14,4) not null default 0,
    unit_cost numeric(12,4) not null default 0,
    total_cost numeric(12,4) not null default 0
  ) ON COMMIT DROP;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric)
  LOOP
    v_quantity := v_item.quantity;

    IF v_item.catalog_item_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'كمية أو صنف غير صالح في الفاتورة';
    END IF;

    SELECT *
    INTO v_catalog
    FROM public.catalog_items
    WHERE id = v_item.catalog_item_id
      AND organization_id = p_org_id
      AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الصنف غير موجود أو غير فعال: %', v_item.catalog_item_id;
    END IF;

    v_unit_price := COALESCE(v_catalog.retail_price, 0);
    v_line_subtotal := round((v_unit_price * v_quantity)::numeric, 4);
    v_line_tax := round((v_line_subtotal * COALESCE(v_catalog.tax_rate, 0) / 100)::numeric, 4);
    v_line_cost := 0;

    IF v_catalog.menu_item_id IS NOT NULL THEN
      FOR v_mapping IN
        SELECT *
        FROM public.menu_item_recipe_mapping
        WHERE organization_id = p_org_id
          AND menu_item_id = v_catalog.menu_item_id
      LOOP
        FOR v_ingredient IN
          SELECT *
          FROM public.recipe_ingredients
          WHERE organization_id = p_org_id
            AND recipe_id = v_mapping.recipe_id
        LOOP
          SELECT *
          INTO v_inventory
          FROM public.inventory_items
          WHERE id = v_ingredient.item_id
            AND organization_id = p_org_id
            AND status = 'active';

          IF NOT FOUND THEN
            RAISE EXCEPTION 'مادة وصفة غير موجودة أو غير فعالة: %', v_ingredient.item_id;
          END IF;

          v_deduct_qty :=
            (v_ingredient.quantity * COALESCE(v_mapping.portion_multiplier, 1) * v_quantity)
            / NULLIF(COALESCE(v_ingredient.yield_percent, 100) / 100, 0);
          v_unit_cost := COALESCE(NULLIF(v_ingredient.unit_cost, 0), NULLIF(v_inventory.average_cost, 0), v_inventory.last_purchase_price, 0);
          v_line_cost := v_line_cost + round((v_deduct_qty * v_unit_cost)::numeric, 4);

          INSERT INTO pg_temp.pos_checkout_impacts (item_id, quantity, unit_cost, total_cost)
          VALUES (
            v_ingredient.item_id,
            v_deduct_qty,
            v_unit_cost,
            round((v_deduct_qty * v_unit_cost)::numeric, 4)
          )
          ON CONFLICT (item_id) DO UPDATE
            SET quantity = pos_checkout_impacts.quantity + excluded.quantity,
                total_cost = pos_checkout_impacts.total_cost + excluded.total_cost,
                unit_cost = CASE
                  WHEN pos_checkout_impacts.quantity + excluded.quantity = 0 THEN excluded.unit_cost
                  ELSE round(
                    ((pos_checkout_impacts.total_cost + excluded.total_cost)
                      / NULLIF(pos_checkout_impacts.quantity + excluded.quantity, 0))::numeric,
                    4
                  )
                END;
        END LOOP;
      END LOOP;
    END IF;

    INSERT INTO pg_temp.pos_checkout_lines (
      catalog_item_id, menu_item_id, name, quantity, unit_price, unit_name,
      tax_rate, line_subtotal, line_tax, line_cost
    )
    VALUES (
      v_catalog.id,
      v_catalog.menu_item_id,
      v_catalog.name,
      v_quantity,
      v_unit_price,
      COALESCE(v_catalog.main_unit, 'قطعة'),
      COALESCE(v_catalog.tax_rate, 0),
      v_line_subtotal,
      v_line_tax,
      v_line_cost
    );

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax;
    v_cost_total := v_cost_total + v_line_cost;
  END LOOP;

  v_subtotal := round(v_subtotal, 4);
  v_tax_total := round(v_tax_total, 4);
  v_cost_total := round(v_cost_total, 4);
  v_total := v_subtotal + v_tax_total;

  FOR v_impact IN
    SELECT item_id, quantity, unit_cost, total_cost
    FROM pg_temp.pos_checkout_impacts
    WHERE quantity > 0
    ORDER BY item_id
  LOOP
    SELECT id, quantity
    INTO v_stock_id, v_stock_qty
    FROM public.branch_stock
    WHERE organization_id = p_org_id
      AND branch_id = p_branch_id
      AND item_id = v_impact.item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity)
      VALUES (p_org_id, p_branch_id, v_impact.item_id, 0, 0)
      RETURNING id, quantity INTO v_stock_id, v_stock_qty;
    END IF;

    IF v_stock_qty < v_impact.quantity THEN
      RAISE EXCEPTION 'لا توجد كمية كافية في المخزون للمادة %',
        (SELECT name FROM public.inventory_items WHERE id = v_impact.item_id);
    END IF;
  END LOOP;

  SELECT id
  INTO v_shift_id
  FROM public.sales_shifts
  WHERE organization_id = p_org_id
    AND branch_id = p_branch_id
    AND status = 'open'
    AND device_key_id = p_device_key_id
  ORDER BY opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_shift_id IS NULL THEN
    INSERT INTO public.sales_shifts (
      organization_id, branch_id, device_key_id, cashier_name, status, opening_cash, expected_cash
    )
    VALUES (
      p_org_id, p_branch_id, p_device_key_id, COALESCE(NULLIF(p_device_name, ''), 'كاشير'), 'open', 0, 0
    )
    RETURNING id INTO v_shift_id;

    INSERT INTO public.cash_drawer_entries (
      organization_id, branch_id, shift_id, entry_type, amount, memo
    )
    VALUES (
      p_org_id, p_branch_id, v_shift_id, 'opening', 0, 'رصيد افتتاحي تلقائي للوردية'
    );
  END IF;

  v_invoice_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'invoice', 'POS-');

  INSERT INTO public.customer_invoices (
    organization_id, branch_id, invoice_number, customer_name, status,
    payment_method, channel, subtotal, discount, tax_total, total,
    cost_total, gross_profit, idempotency_key, shift_id, notes
  )
  VALUES (
    p_org_id, p_branch_id, v_invoice_number, COALESCE(NULLIF(p_customer_name, ''), 'عميل سفري سريع'), 'paid',
    p_payment_method::payment_method, 'pickup', v_subtotal, 0, v_tax_total, v_total,
    v_cost_total, v_subtotal - v_cost_total, p_idempotency_key, v_shift_id,
    'فاتورة كاشير ذرية'
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.customer_invoice_items (
    organization_id, customer_invoice_id, catalog_item_id, menu_item_id,
    name, quantity, unit_price, unit_name, unit_factor, discount,
    tax_rate, cost_total, gross_profit
  )
  SELECT
    p_org_id, v_invoice_id, catalog_item_id, menu_item_id,
    name, quantity, unit_price, unit_name, 1, 0,
    tax_rate, line_cost, line_subtotal - line_cost
  FROM pg_temp.pos_checkout_lines
  ORDER BY line_index;

  FOR v_impact IN
    SELECT item_id, quantity, unit_cost, total_cost
    FROM pg_temp.pos_checkout_impacts
    WHERE quantity > 0
    ORDER BY item_id
  LOOP
    UPDATE public.branch_stock
    SET quantity = quantity - v_impact.quantity,
        updated_at = now()
    WHERE organization_id = p_org_id
      AND branch_id = p_branch_id
      AND item_id = v_impact.item_id;

    INSERT INTO public.stock_movements (
      organization_id, branch_id, item_id, movement_type, quantity,
      unit_cost, source_doc_type, source_doc_id, idempotency_key, notes
    )
    VALUES (
      p_org_id, p_branch_id, v_impact.item_id, 'sale_usage', -v_impact.quantity,
      v_impact.unit_cost, 'customer_invoice', v_invoice_id,
      v_invoice_id::text || ':' || v_impact.item_id::text || ':sale_usage',
      'خصم تلقائي للمبيعات الذرية - فاتورة ' || v_invoice_number
    );
  END LOOP;

  INSERT INTO public.customer_invoice_payments (
    organization_id, customer_invoice_id, payment_method, amount
  )
  VALUES (
    p_org_id, v_invoice_id, p_payment_method::payment_method, v_total
  );

  v_drawer_type := CASE WHEN p_payment_method = 'cash' THEN 'cash_sale' ELSE 'card_sale' END;

  INSERT INTO public.cash_drawer_entries (
    organization_id, branch_id, shift_id, entry_type, amount,
    reference_doc_type, reference_doc_id, memo
  )
  VALUES (
    p_org_id, p_branch_id, v_shift_id, v_drawer_type, v_total,
    'customer_invoice', v_invoice_id, 'تحصيل تلقائي للمبيعات الذرية'
  );

  UPDATE public.sales_shifts
  SET cash_sales = cash_sales + CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END,
      card_sales = card_sales + CASE WHEN p_payment_method = 'card' THEN v_total ELSE 0 END,
      expected_cash = expected_cash + CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END,
      updated_at = now()
  WHERE id = v_shift_id
    AND organization_id = p_org_id;

  INSERT INTO public.sales_daily_summaries (
    organization_id, branch_id, summary_date, channel,
    orders_count, sales_total, ingredient_cost_total
  )
  VALUES (
    p_org_id, p_branch_id, current_date, 'pickup',
    1, v_total, v_cost_total
  )
  ON CONFLICT (organization_id, branch_id, summary_date, channel) DO UPDATE
    SET orders_count = public.sales_daily_summaries.orders_count + 1,
        sales_total = public.sales_daily_summaries.sales_total + excluded.sales_total,
        ingredient_cost_total = public.sales_daily_summaries.ingredient_cost_total + excluded.ingredient_cost_total,
        updated_at = now();

  PERFORM public.ensure_default_chart_accounts(p_org_id);

  SELECT id INTO v_cash_acct_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id
    AND system_key = CASE WHEN p_payment_method = 'cash' THEN 'cash' ELSE 'bank' END
    AND is_active = true;

  SELECT id INTO v_revenue_acct_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id
    AND system_key = 'sales_revenue'
    AND is_active = true;

  SELECT id INTO v_tax_acct_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id
    AND system_key = 'sales_tax_payable'
    AND is_active = true;

  SELECT id INTO v_cogs_acct_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id
    AND system_key = 'cogs'
    AND is_active = true;

  SELECT id INTO v_inv_acct_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id
    AND system_key = 'inventory'
    AND is_active = true;

  IF v_cash_acct_id IS NULL OR v_revenue_acct_id IS NULL THEN
    RAISE EXCEPTION 'Required POS revenue or cash account not found';
  END IF;

  IF v_cost_total > 0 AND (v_cogs_acct_id IS NULL OR v_inv_acct_id IS NULL) THEN
    RAISE EXCEPTION 'COGS or inventory account not found';
  END IF;

  v_je_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'journal_entry', 'JE-');

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status
  )
  VALUES (
    p_org_id, p_branch_id, v_je_number, current_date,
    'customer_invoice', v_invoice_id, 'قيد تلقائي لمبيعات الكاشير - فاتورة ' || v_invoice_number, 'posted'
  )
  RETURNING id INTO v_je_id;

  INSERT INTO public.journal_lines (
    organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
  )
  VALUES
    (p_org_id, v_je_id, v_cash_acct_id, p_branch_id, v_total, 0, 'تحصيل فاتورة ' || v_invoice_number),
    (p_org_id, v_je_id, v_revenue_acct_id, p_branch_id, 0, v_subtotal, 'مبيعات فاتورة ' || v_invoice_number);

  IF v_tax_total > 0 THEN
    IF v_tax_acct_id IS NULL THEN
      RAISE EXCEPTION 'Sales tax payable account not found';
    END IF;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    )
    VALUES (
      p_org_id, v_je_id, v_tax_acct_id, p_branch_id, 0, v_tax_total, 'ضريبة فاتورة ' || v_invoice_number
    );
  END IF;

  IF v_cost_total > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    )
    VALUES
      (p_org_id, v_je_id, v_cogs_acct_id, p_branch_id, v_cost_total, 0, 'تكلفة مبيعات فاتورة ' || v_invoice_number),
      (p_org_id, v_je_id, v_inv_acct_id, p_branch_id, 0, v_cost_total, 'خصم مخزون فاتورة ' || v_invoice_number);
  END IF;

  v_ticket_number := public.get_next_sequence_number(p_org_id, p_branch_id, 'kitchen_ticket', 'KOT-');

  INSERT INTO public.kitchen_tickets (
    organization_id, branch_id, customer_invoice_id, shift_id,
    ticket_number, customer_name, channel, status, notes
  )
  VALUES (
    p_org_id, p_branch_id, v_invoice_id, v_shift_id,
    v_ticket_number, COALESCE(NULLIF(p_customer_name, ''), 'عميل سفري سريع'), 'pickup', 'pending',
    'تذكرة مطبخ من جهاز الكاشير الذري - فاتورة ' || v_invoice_number
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.kitchen_ticket_items (
    organization_id, kitchen_ticket_id, menu_item_id, catalog_item_id, name, quantity
  )
  SELECT
    p_org_id, v_ticket_id, menu_item_id, catalog_item_id, name, quantity
  FROM pg_temp.pos_checkout_lines
  WHERE menu_item_id IS NOT NULL
  ORDER BY line_index;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'invoiceId', v_invoice_id,
    'invoiceNumber', v_invoice_number,
    'kitchenTicketId', v_ticket_id,
    'shiftId', v_shift_id,
    'total', v_total,
    'costTotal', v_cost_total
  );
END;
$$;
