-- Atomic POS Checkout Database Function
-- This function processes POS checkout in a single atomic database transaction.

CREATE OR REPLACE FUNCTION public.pos_checkout_atomic(
  p_org_id uuid,
  p_branch_id uuid,
  p_device_key_id uuid,
  p_device_name text,
  p_customer_name text,
  p_payment_method text,
  p_idempotency_key text,
  p_items jsonb -- Array of objects: [{"catalog_item_id": "uuid", "quantity": 1.5}]
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
  v_item record;
  v_catalog_id uuid;
  v_quantity numeric;
  v_catalog record;
  v_mapping record;
  v_ingredient record;
  v_deduct_qty numeric;
  v_unit_cost numeric;
  v_line_cost numeric;
  v_cost_total numeric := 0;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_total numeric := 0;
  v_count integer;
  v_today_str text;
  v_je_id uuid;
  v_je_number text;
  v_cash_acct_id uuid;
  v_revenue_acct_id uuid;
  v_tax_acct_id uuid;
  v_cogs_acct_id uuid;
  v_inv_acct_id uuid;
  v_line_index integer := 0;
  v_impact_index integer := 0;
  v_stock_qty numeric;
  v_stock_id uuid;
BEGIN
  -- 1. Check idempotency
  SELECT id, invoice_number, total, shift_id
  INTO v_invoice_id, v_invoice_number, v_total, v_shift_id
  FROM customer_invoices
  WHERE organization_id = p_org_id
    AND branch_id = p_branch_id
    AND idempotency_key = p_idempotency_key;

  IF v_invoice_id IS NOT NULL THEN
    -- Find kitchen ticket
    SELECT id INTO v_ticket_id
    FROM kitchen_tickets
    WHERE customer_invoice_id = v_invoice_id;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'invoiceId', v_invoice_id,
      'invoiceNumber', v_invoice_number,
      'kitchenTicketId', v_ticket_id,
      'shiftId', v_shift_id,
      'total', v_total
    );
  END IF;

  -- 2. Resolve/Ensure sales shift
  SELECT id INTO v_shift_id
  FROM sales_shifts
  WHERE organization_id = p_org_id
    AND branch_id = p_branch_id
    AND status = 'open'
    AND (device_key_id = p_device_key_id OR (device_key_id IS NULL AND p_device_key_id IS NULL))
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_shift_id IS NULL THEN
    INSERT INTO sales_shifts (
      organization_id, branch_id, device_key_id, cashier_name, status, opening_cash, expected_cash
    ) VALUES (
      p_org_id, p_branch_id, p_device_key_id, p_device_name, 'open', 0, 0
    ) RETURNING id INTO v_shift_id;

    INSERT INTO cash_drawer_entries (
      organization_id, branch_id, shift_id, entry_type, amount, memo
    ) VALUES (
      p_org_id, p_branch_id, v_shift_id, 'opening', 0, 'رصيد افتتاحي تلقائي للوردية'
    );
  END IF;

  -- 3. Calculate totals & stock impacts by looping over items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric)
  LOOP
    v_catalog_id := v_item.catalog_item_id;
    v_quantity := v_item.quantity;

    SELECT * INTO v_catalog FROM catalog_items WHERE id = v_catalog_id AND organization_id = p_org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Catalog item % not found', v_catalog_id;
    END IF;
    IF v_catalog.status != 'active' THEN
      RAISE EXCEPTION 'Catalog item % is inactive', v_catalog.name;
    END IF;

    v_subtotal := v_subtotal + (v_catalog.retail_price * v_quantity);
    v_tax_total := v_tax_total + (v_catalog.retail_price * v_quantity * (v_catalog.tax_rate / 100));

    -- Ingredient stock check and calculation
    IF v_catalog.menu_item_id IS NOT NULL THEN
      FOR v_mapping IN SELECT * FROM menu_item_recipe_mapping WHERE menu_item_id = v_catalog.menu_item_id AND organization_id = p_org_id
      LOOP
        FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = v_mapping.recipe_id AND organization_id = p_org_id
        LOOP
          v_deduct_qty := v_ingredient.quantity * v_mapping.portion_multiplier * v_quantity;
          v_unit_cost := COALESCE(v_ingredient.unit_cost, 0);
          IF v_unit_cost = 0 THEN
            SELECT average_cost INTO v_unit_cost FROM inventory_items WHERE id = v_ingredient.item_id;
          END IF;

          v_cost_total := v_cost_total + (v_deduct_qty * COALESCE(v_unit_cost, 0));

          -- Lock branch stock row for update to prevent race conditions
          SELECT id, quantity INTO v_stock_id, v_stock_qty
          FROM branch_stock
          WHERE organization_id = p_org_id
            AND branch_id = p_branch_id
            AND item_id = v_ingredient.item_id
          FOR UPDATE;

          IF NOT FOUND THEN
            -- Initialize stock row
            INSERT INTO branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity)
            VALUES (p_org_id, p_branch_id, v_ingredient.item_id, 0, 0)
            RETURNING id, quantity INTO v_stock_id, v_stock_qty;
          END IF;

          IF v_stock_qty < v_deduct_qty THEN
            RAISE EXCEPTION 'لا توجد كمية كافية في المخزون للمادة %', (SELECT name FROM inventory_items WHERE id = v_ingredient.item_id);
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  v_total := v_subtotal + v_tax_total;

  -- 4. Generate Invoice Number
  v_invoice_number := get_next_sequence_number(p_org_id, p_branch_id, 'invoice', 'POS-');

  -- 5. Insert Invoice
  INSERT INTO customer_invoices (
    organization_id, branch_id, invoice_number, customer_name, status,
    payment_method, channel, subtotal, discount, tax_total, total,
    cost_total, gross_profit, idempotency_key, shift_id, notes
  ) VALUES (
    p_org_id, p_branch_id, v_invoice_number, p_customer_name, 'paid',
    p_payment_method::payment_method, 'pickup', v_subtotal, 0, v_tax_total, v_total,
    v_cost_total, v_subtotal - v_cost_total, p_idempotency_key, v_shift_id,
    'فاتورة كاشير ذرية'
  ) RETURNING id INTO v_invoice_id;

  -- 6. Insert Items & Process stock updates/movements
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric)
  LOOP
    v_catalog_id := v_item.catalog_item_id;
    v_quantity := v_item.quantity;
    v_line_cost := 0;

    SELECT * INTO v_catalog FROM catalog_items WHERE id = v_catalog_id AND organization_id = p_org_id;

    -- Calculate line cost
    IF v_catalog.menu_item_id IS NOT NULL THEN
      FOR v_mapping IN SELECT * FROM menu_item_recipe_mapping WHERE menu_item_id = v_catalog.menu_item_id AND organization_id = p_org_id
      LOOP
        FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = v_mapping.recipe_id AND organization_id = p_org_id
        LOOP
          v_deduct_qty := v_ingredient.quantity * v_mapping.portion_multiplier * v_quantity;
          v_unit_cost := COALESCE(v_ingredient.unit_cost, 0);
          IF v_unit_cost = 0 THEN
            SELECT average_cost INTO v_unit_cost FROM inventory_items WHERE id = v_ingredient.item_id;
          END IF;

          v_line_cost := v_line_cost + (v_deduct_qty * COALESCE(v_unit_cost, 0));

          -- Deduct Stock (row already guaranteed to exist from step 3)
          UPDATE branch_stock
          SET quantity = quantity - v_deduct_qty
          WHERE organization_id = p_org_id
            AND branch_id = p_branch_id
            AND item_id = v_ingredient.item_id;

          -- Insert Stock Movement
          INSERT INTO stock_movements (
            organization_id, branch_id, item_id, movement_type, quantity,
            unit_cost, total_cost, reference, idempotency_key, notes
          ) VALUES (
            p_org_id, p_branch_id, v_ingredient.item_id, 'sale_usage', -v_deduct_qty,
            COALESCE(v_unit_cost, 0), v_deduct_qty * COALESCE(v_unit_cost, 0), v_invoice_number,
            v_invoice_id::text || ':' || v_line_index::text || ':' || v_impact_index::text || ':' || v_ingredient.item_id::text || ':sale_usage',
            'خصم تلقائي للمبيعات الذرية - فاتورة ' || v_invoice_number
          );
          v_impact_index := v_impact_index + 1;
        END LOOP;
      END LOOP;
    END IF;

    -- Insert Invoice Item
    INSERT INTO customer_invoice_items (
      organization_id, customer_invoice_id, catalog_item_id, menu_item_id,
      name, quantity, unit_price, unit_name, unit_factor, discount,
      tax_rate, cost_total, gross_profit
    ) VALUES (
      p_org_id, v_invoice_id, v_catalog.id, v_catalog.menu_item_id,
      v_catalog.name, v_quantity, v_catalog.retail_price, COALESCE(v_catalog.main_unit, 'قطعة'),
      1, 0, v_catalog.tax_rate, v_line_cost, (v_catalog.retail_price * v_quantity) - v_line_cost
    );

    v_line_index := v_line_index + 1;
  END LOOP;

  -- 7. Insert Payment
  INSERT INTO customer_invoice_payments (
    organization_id, customer_invoice_id, payment_method, amount
  ) VALUES (
    p_org_id, v_invoice_id, p_payment_method::payment_method, v_total
  );

  -- 8. Register Shift Sale
  DECLARE
    v_drawer_type text;
    v_sales_field text;
    v_cash_sales numeric;
    v_card_sales numeric;
    v_exp_cash numeric;
  BEGIN
    IF p_payment_method = 'cash' THEN
      v_drawer_type := 'cash_sale';
      v_sales_field := 'cash_sales';
    ELSE
      v_drawer_type := 'card_sale';
      v_sales_field := 'card_sales';
    END IF;

    INSERT INTO cash_drawer_entries (
      organization_id, branch_id, shift_id, entry_type, amount,
      reference_doc_type, reference_doc_id, memo
    ) VALUES (
      p_org_id, p_branch_id, v_shift_id, v_drawer_type::drawer_entry_type, v_total,
      'customer_invoice', v_invoice_id, 'تحصيل تلقائي للمبيعات الذرية'
    );

    SELECT cash_sales, card_sales, expected_cash
    INTO v_cash_sales, v_card_sales, v_exp_cash
    FROM sales_shifts
    WHERE id = v_shift_id;

    IF p_payment_method = 'cash' THEN
      UPDATE sales_shifts
      SET cash_sales = v_cash_sales + v_total,
          expected_cash = v_exp_cash + v_total,
          updated_at = now()
      WHERE id = v_shift_id;
    ELSE
      UPDATE sales_shifts
      SET card_sales = v_card_sales + v_total,
          updated_at = now()
      WHERE id = v_shift_id;
    END IF;
  END;

  -- 9. Post Accounting Journal Entry & Lines (balanced check enforced)
  -- Ensure default accounts
  PERFORM ensure_default_chart_accounts(p_org_id);

  -- Load account ids
  IF p_payment_method = 'cash' THEN
    SELECT id INTO v_cash_acct_id FROM chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cash';
  ELSE
    SELECT id INTO v_cash_acct_id FROM chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'bank';
  END IF;

  SELECT id INTO v_revenue_acct_id FROM chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_revenue';
  SELECT id INTO v_tax_acct_id FROM chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_tax_payable';
  SELECT id INTO v_cogs_acct_id FROM chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cogs';
  SELECT id INTO v_inv_acct_id FROM chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'inventory';

  IF v_cash_acct_id IS NULL OR v_revenue_acct_id IS NULL THEN
    RAISE EXCEPTION 'Required default accounts not found';
  END IF;

  -- Journal entry number
  SELECT count(*) INTO v_count
  FROM journal_entries
  WHERE organization_id = p_org_id
    AND created_at >= date_trunc('day', now())
    AND created_at < date_trunc('day', now() + interval '1 day');

  v_je_number := 'JE-' || v_today_str || '-' || lpad((v_count + 1)::text, 4, '0');

  INSERT INTO journal_entries (
    organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status
  ) VALUES (
    p_org_id, p_branch_id, v_je_number, current_date,
    'customer_invoice', v_invoice_id, 'قيد تلقائي لمبيعات الكاشير - فاتورة ' || v_invoice_number, 'posted'
  ) RETURNING id INTO v_je_id;

  -- Debit Cash/Bank
  INSERT INTO journal_lines (
    organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
  ) VALUES (
    p_org_id, v_je_id, v_cash_acct_id, p_branch_id, v_total, 0, 'تحصيل فاتورة ' || v_invoice_number
  );

  -- Credit Revenue
  INSERT INTO journal_lines (
    organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
  ) VALUES (
    p_org_id, v_je_id, v_revenue_acct_id, p_branch_id, 0, v_subtotal, 'مبيعات فاتورة ' || v_invoice_number
  );

  -- Credit Tax
  IF v_tax_total > 0 THEN
    IF v_tax_acct_id IS NULL THEN
      RAISE EXCEPTION 'Sales tax payable account not found';
    END IF;
    INSERT INTO journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_je_id, v_tax_acct_id, p_branch_id, 0, v_tax_total, 'ضريبة فاتورة ' || v_invoice_number
    );
  END IF;

  -- COGS & Inventory
  IF v_cost_total > 0 THEN
    IF v_cogs_acct_id IS NULL OR v_inv_acct_id IS NULL THEN
      RAISE EXCEPTION 'COGS or Inventory account not found';
    END IF;
    INSERT INTO journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_je_id, v_cogs_acct_id, p_branch_id, v_cost_total, 0, 'تكلفة مبيعات فاتورة ' || v_invoice_number
    );
    INSERT INTO journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_je_id, v_inv_acct_id, p_branch_id, 0, v_cost_total, 'خصم مخزون فاتورة ' || v_invoice_number
    );
  END IF;

  -- 10. Insert Kitchen Ticket
  INSERT INTO kitchen_tickets (
    organization_id, branch_id, customer_invoice_id, shift_id,
    invoice_number, customer_name, channel, status, notes
  ) VALUES (
    p_org_id, p_branch_id, v_invoice_id, v_shift_id,
    v_invoice_number, p_customer_name, 'pickup', 'pending', 'تذكرة مطبخ من جهاز الكاشير الذري'
  ) RETURNING id INTO v_ticket_id;

  -- Kitchen Ticket Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric)
  LOOP
    v_catalog_id := v_item.catalog_item_id;
    v_quantity := v_item.quantity;

    SELECT * INTO v_catalog FROM catalog_items WHERE id = v_catalog_id;

    INSERT INTO kitchen_ticket_items (
      organization_id, kitchen_ticket_id, menu_item_id, catalog_item_id, name, quantity
    ) VALUES (
      p_org_id, v_ticket_id, v_catalog.menu_item_id, v_catalog.id, v_catalog.name, v_quantity
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invoiceId', v_invoice_id,
    'invoiceNumber', v_invoice_number,
    'kitchenTicketId', v_ticket_id,
    'shiftId', v_shift_id,
    'total', v_total
  );
END;
$$;
