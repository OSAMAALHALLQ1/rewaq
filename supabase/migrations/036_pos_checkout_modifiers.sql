-- Extend pos_checkout_atomic to accept per-line modifier selections and a
-- caller-provided unit price (base price + modifier deltas). Modifier info is
-- stored on the invoice line and the kitchen ticket line for display.
CREATE OR REPLACE FUNCTION public.pos_checkout_atomic(
  p_org_id uuid,
  p_branch_id uuid,
  p_device_key_id uuid,
  p_device_name text,
  p_customer_name text,
  p_payment_method text,
  p_idempotency_key text,
  p_items jsonb,
  p_discount numeric DEFAULT 0,
  p_service_fee numeric DEFAULT 0,
  p_delivery_fee numeric DEFAULT 0,
  p_payments jsonb DEFAULT NULL
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
  v_acct_id uuid;

  -- Account IDs
  v_cash_acct_id uuid;
  v_card_acct_id uuid;
  v_receivable_acct_id uuid;
  v_revenue_acct_id uuid;
  v_discount_acct_id uuid;
  v_tax_acct_id uuid;
  v_service_acct_id uuid;
  v_delivery_acct_id uuid;
  v_cogs_acct_id uuid;
  v_inv_acct_id uuid;

  v_impact record;
  v_existing record;
  v_drawer_type text;
  v_pay_line record;
  v_payment_sum numeric(12,4) := 0;

  -- Costing Policy variables
  v_policy text;
  v_allow_negative boolean;
  v_is_negative_stock boolean := false;
  v_is_provisional_cost boolean := false;
  v_any_provisional boolean := false;

  -- Modifier selections (display only; price already folded into unit_price)
  v_modifier_option_ids jsonb := NULL;
  v_modifier_summary text := '';
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب لفواتير الكاشير';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'الفاتورة يجب أن تحتوي على صنف واحد على الأقل';
  END IF;

  -- Load costing policy
  SELECT allow_negative_stock, COALESCE(inventory_costing_policy, 'strict_no_negative')
  INTO v_allow_negative, v_policy
  FROM public.accounting_settings
  WHERE organization_id = p_org_id;

  IF v_policy IS NULL THEN
    v_allow_negative := false;
    v_policy := 'strict_no_negative';
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
    line_cost numeric(12,4) not null default 0,
    modifier_option_ids jsonb,
    modifier_summary text
  ) ON COMMIT DROP;

  DROP TABLE IF EXISTS pg_temp.pos_checkout_impacts;
  CREATE TEMP TABLE pg_temp.pos_checkout_impacts (
    item_id uuid primary key,
    quantity numeric(14,4) not null default 0,
    unit_cost numeric(12,4) not null default 0,
    total_cost numeric(12,4) not null default 0,
    is_negative_stock boolean not null default false,
    is_provisional_cost boolean not null default false
  ) ON COMMIT DROP;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(catalog_item_id uuid, quantity numeric, unit_price numeric, modifier_option_ids jsonb, modifier_summary text)
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

    v_modifier_option_ids := v_item.modifier_option_ids;
    v_modifier_summary := COALESCE(v_item.modifier_summary, '');
    v_unit_price := COALESCE((v_item.unit_price)::numeric, v_catalog.retail_price, 0);
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

          -- Base Costing
          v_unit_cost := COALESCE(NULLIF(v_ingredient.unit_cost, 0), NULLIF(v_inventory.average_cost, 0), v_inventory.last_purchase_price, 0);

          -- Flag if cost is missing (truly zero or provisional fallback)
          v_is_provisional_cost := false;
          IF v_unit_cost = 0 THEN
            v_unit_cost := 0.1; -- fallback recipe cost
            v_is_provisional_cost := true;
          END IF;

          -- Check stock availability
          SELECT quantity INTO v_stock_qty
          FROM public.branch_stock
          WHERE organization_id = p_org_id
            AND branch_id = p_branch_id
            AND item_id = v_ingredient.item_id;

          IF NOT FOUND THEN
            v_stock_qty := 0;
          END IF;

          v_is_negative_stock := false;
          IF v_stock_qty < v_deduct_qty THEN
            v_is_negative_stock := true;
            v_is_provisional_cost := true;
            v_any_provisional := true;
          END IF;

          v_line_cost := v_line_cost + round((v_deduct_qty * v_unit_cost)::numeric, 4);

          INSERT INTO pg_temp.pos_checkout_impacts (item_id, quantity, unit_cost, total_cost, is_negative_stock, is_provisional_cost)
          VALUES (
            v_ingredient.item_id,
            v_deduct_qty,
            v_unit_cost,
            round((v_deduct_qty * v_unit_cost)::numeric, 4),
            v_is_negative_stock,
            v_is_provisional_cost
          )
          ON CONFLICT (item_id) DO UPDATE
            SET quantity = pos_checkout_impacts.quantity + excluded.quantity,
                total_cost = pos_checkout_impacts.total_cost + excluded.total_cost,
                is_negative_stock = pos_checkout_impacts.is_negative_stock OR excluded.is_negative_stock,
                is_provisional_cost = pos_checkout_impacts.is_provisional_cost OR excluded.is_provisional_cost,
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
      tax_rate, line_subtotal, line_tax, line_cost, modifier_option_ids, modifier_summary
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
      v_line_cost,
      v_modifier_option_ids,
      v_modifier_summary
    );

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax;
    v_cost_total := v_cost_total + v_line_cost;
  END LOOP;

  v_subtotal := round(v_subtotal, 4);
  v_tax_total := round(v_tax_total, 4);
  v_cost_total := round(v_cost_total, 4);

  -- Calculate total using formula: Subtotal - Discount + Tax + ServiceFee + DeliveryFee
  v_total := round(v_subtotal - COALESCE(p_discount, 0) + v_tax_total + COALESCE(p_service_fee, 0) + COALESCE(p_delivery_fee, 0), 4);
  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  -- Validate stock constraints under costing policy
  FOR v_impact IN
    SELECT * FROM pg_temp.pos_checkout_impacts
  LOOP
    SELECT quantity INTO v_stock_qty
    FROM public.branch_stock
    WHERE organization_id = p_org_id
      AND branch_id = p_branch_id
      AND item_id = v_impact.item_id;

    IF NOT FOUND THEN
      v_stock_qty := 0;
    END IF;

    IF v_stock_qty < v_impact.quantity THEN
      IF NOT v_allow_negative OR v_policy = 'strict_no_negative' THEN
        RAISE EXCEPTION 'لا توجد كمية كافية في المخزون للمادة %',
          (SELECT name FROM public.inventory_items WHERE id = v_impact.item_id);
      END IF;
    END IF;
  END LOOP;

  -- Validate payments
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    SELECT sum(round((val->>'amount')::numeric, 4))
    INTO v_payment_sum
    FROM jsonb_array_elements(p_payments) AS val;

    IF ABS(v_payment_sum - v_total) > 0.01 THEN
      RAISE EXCEPTION 'مجموع المدفوعات (%) لا يساوي إجمالي الفاتورة (%)', v_payment_sum, v_total;
    END IF;
  END IF;

  -- Open shift or fetch shift
  SELECT id INTO v_shift_id
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

  -- Insert Customer Invoice
  INSERT INTO public.customer_invoices (
    organization_id, branch_id, invoice_number, customer_name, status,
    payment_method, channel, subtotal, discount, tax_total, total,
    cost_total, gross_profit, idempotency_key, shift_id, notes, is_provisional_cogs
  )
  VALUES (
    p_org_id, p_branch_id, v_invoice_number, COALESCE(NULLIF(p_customer_name, ''), 'عميل سفري سريع'), 'paid',
    COALESCE(p_payment_method, 'cash')::payment_method, 'pickup', v_subtotal, COALESCE(p_discount, 0), v_tax_total, v_total,
    v_cost_total, v_total - v_cost_total, p_idempotency_key, v_shift_id, 'فاتورة كاشير ذرية', v_any_provisional
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.customer_invoice_items (
    organization_id, customer_invoice_id, catalog_item_id, menu_item_id,
    name, quantity, unit_price, unit_name, unit_factor, discount,
    tax_rate, cost_total, gross_profit, modifier_option_ids, modifier_summary
  )
  SELECT
    p_org_id, v_invoice_id, catalog_item_id, menu_item_id,
    name, quantity, unit_price, unit_name, 1, 0,
    tax_rate, line_cost, line_subtotal - line_cost, modifier_option_ids, modifier_summary
  FROM pg_temp.pos_checkout_lines
  ORDER BY line_index;

  -- Apply stock deductions and movements
  FOR v_impact IN
    SELECT * FROM pg_temp.pos_checkout_impacts
  LOOP
    SELECT id INTO v_stock_id
    FROM public.branch_stock
    WHERE organization_id = p_org_id
      AND branch_id = p_branch_id
      AND item_id = v_impact.item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity)
      VALUES (p_org_id, p_branch_id, v_impact.item_id, -v_impact.quantity, 0);
    ELSE
      UPDATE public.branch_stock
      SET quantity = quantity - v_impact.quantity,
          updated_at = now()
      WHERE id = v_stock_id;
    END IF;

    INSERT INTO public.stock_movements (
      organization_id, branch_id, item_id, movement_type, quantity,
      unit_cost, source_doc_type, source_doc_id, idempotency_key, notes,
      is_negative_stock, is_provisional_cost
    )
    VALUES (
      p_org_id, p_branch_id, v_impact.item_id, 'sale_usage', -v_impact.quantity,
      v_impact.unit_cost, 'customer_invoice', v_invoice_id,
      v_invoice_id::text || ':' || v_impact.item_id::text || ':sale_usage',
      'خصم تلقائي للمبيعات الذرية - فاتورة ' || v_invoice_number,
      v_impact.is_negative_stock, v_impact.is_provisional_cost
    );
  END LOOP;

  -- Register payments
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    FOR v_pay_line IN SELECT * FROM jsonb_array_elements(p_payments) AS x(method text, amount numeric) LOOP
      IF round(v_pay_line.amount, 4) > 0 THEN
        INSERT INTO public.customer_invoice_payments (
          organization_id, customer_invoice_id, payment_method, amount
        )
        VALUES (
          p_org_id, v_invoice_id, v_pay_line.method::payment_method, round(v_pay_line.amount, 4)
        );

        -- Update shift metrics
        UPDATE public.sales_shifts
        SET cash_sales = cash_sales + CASE WHEN v_pay_line.method = 'cash' THEN round(v_pay_line.amount, 4) ELSE 0 END,
            card_sales = card_sales + CASE WHEN v_pay_line.method = 'card' THEN round(v_pay_line.amount, 4) ELSE 0 END,
            expected_cash = expected_cash + CASE WHEN v_pay_line.method = 'cash' THEN round(v_pay_line.amount, 4) ELSE 0 END,
            updated_at = now()
        WHERE id = v_shift_id;

        IF v_pay_line.method = 'cash' OR v_pay_line.method = 'card' THEN
          INSERT INTO public.cash_drawer_entries (
            organization_id, branch_id, shift_id, entry_type, amount,
            reference_doc_type, reference_doc_id, memo
          )
          VALUES (
            p_org_id, p_branch_id, v_shift_id,
            CASE WHEN v_pay_line.method = 'cash' THEN 'cash_sale' ELSE 'card_sale' END,
            round(v_pay_line.amount, 4),
            'customer_invoice', v_invoice_id, 'تحصيل تلقائي للمبيعات الذرية'
          );
        END IF;
      END IF;
    END LOOP;
  ELSE
    INSERT INTO public.customer_invoice_payments (
      organization_id, customer_invoice_id, payment_method, amount
    )
    VALUES (
      p_org_id, v_invoice_id, COALESCE(p_payment_method, 'cash')::payment_method, v_total
    );

    v_drawer_type := CASE WHEN p_payment_method = 'cash' THEN 'cash_sale' ELSE 'card_sale' END;

    IF p_payment_method = 'cash' OR p_payment_method = 'card' THEN
      INSERT INTO public.cash_drawer_entries (
        organization_id, branch_id, shift_id, entry_type, amount,
        reference_doc_type, reference_doc_id, memo
      )
      VALUES (
        p_org_id, p_branch_id, v_shift_id, v_drawer_type, v_total,
        'customer_invoice', v_invoice_id, 'تحصيل تلقائي للمبيعات الذرية'
      );
    END IF;

    UPDATE public.sales_shifts
    SET cash_sales = cash_sales + CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END,
        card_sales = card_sales + CASE WHEN p_payment_method = 'card' THEN v_total ELSE 0 END,
        expected_cash = expected_cash + CASE WHEN p_payment_method = 'cash' THEN v_total ELSE 0 END,
        updated_at = now()
    WHERE id = v_shift_id;
  END IF;

  -- Daily summary update
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

  -- Seeding and posting balanced journal entries
  PERFORM public.ensure_default_chart_accounts(p_org_id);

  SELECT id INTO v_cash_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cash_on_hand' AND is_active = true;
  SELECT id INTO v_card_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'bank_card' AND is_active = true;
  SELECT id INTO v_receivable_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'accounts_receivable' AND is_active = true;
  SELECT id INTO v_revenue_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_revenue' AND is_active = true;
  SELECT id INTO v_discount_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'sales_discounts' AND is_active = true;
  SELECT id INTO v_tax_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'output_tax_payable' AND is_active = true;
  SELECT id INTO v_service_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'service_fee_revenue' AND is_active = true;
  SELECT id INTO v_delivery_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'delivery_revenue' AND is_active = true;
  SELECT id INTO v_cogs_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'cogs' AND is_active = true;
  SELECT id INTO v_inv_acct_id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND system_key = 'inventory' AND is_active = true;

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

  -- 1. Payments debit lines
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    FOR v_pay_line IN SELECT * FROM jsonb_array_elements(p_payments) AS x(method text, amount numeric) LOOP
      IF round(v_pay_line.amount, 4) > 0 THEN
        v_acct_id := CASE
          WHEN v_pay_line.method = 'cash' THEN v_cash_acct_id
          WHEN v_pay_line.method = 'card' THEN v_card_acct_id
          WHEN v_pay_line.method = 'bank_transfer' THEN v_card_acct_id
          WHEN v_pay_line.method = 'delivery_app' THEN v_card_acct_id
          WHEN v_pay_line.method = 'receivable' THEN v_receivable_acct_id
          WHEN v_pay_line.method = 'wallet' THEN v_card_acct_id
          WHEN v_pay_line.method = 'gift_card' THEN v_card_acct_id
          ELSE v_cash_acct_id
        END;

        INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
        VALUES (p_org_id, v_je_id, v_acct_id, p_branch_id, round(v_pay_line.amount, 4), 0, 'تحصيل دفعة ' || v_pay_line.method || ' فاتورة ' || v_invoice_number);
      END IF;
    END LOOP;
  ELSE
    IF v_total > 0 THEN
      v_acct_id := CASE WHEN p_payment_method = 'cash' THEN v_cash_acct_id ELSE v_card_acct_id END;
      INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
      VALUES (p_org_id, v_je_id, v_acct_id, p_branch_id, v_total, 0, 'تحصيل فاتورة ' || v_invoice_number);
    END IF;
  END IF;

  -- 2. Sales Discounts (debit) line
  IF p_discount > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_discount_acct_id, p_branch_id, round(p_discount, 4), 0, 'خصم مسموح به فاتورة ' || v_invoice_number);
  END IF;

  -- 3. Sales Revenue (credit) line
  IF v_subtotal > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_revenue_acct_id, p_branch_id, 0, v_subtotal, 'مبيعات فاتورة ' || v_invoice_number);
  END IF;

  -- 4. Output Tax (credit) line
  IF v_tax_total > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_tax_acct_id, p_branch_id, 0, v_tax_total, 'ضريبة فاتورة ' || v_invoice_number);
  END IF;

  -- 5. Service Fee Revenue (credit) line
  IF p_service_fee > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_service_acct_id, p_branch_id, 0, round(p_service_fee, 4), 'رسوم خدمة فاتورة ' || v_invoice_number);
  END IF;

  -- 6. Delivery Revenue (credit) line
  IF p_delivery_fee > 0 THEN
    INSERT INTO public.journal_lines (organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo)
    VALUES (p_org_id, v_je_id, v_delivery_acct_id, p_branch_id, 0, round(p_delivery_fee, 4), 'رسوم توصيل فاتورة ' || v_invoice_number);
  END IF;

  -- 7. COGS & Inventory lines
  IF v_cost_total > 0 THEN
    INSERT INTO public.journal_lines (organization_id, branch_id, journal_entry_id, account_id, debit, credit, memo, is_provisional_cost)
    VALUES
      (p_org_id, p_branch_id, v_je_id, v_cogs_acct_id, v_cost_total, 0, 'تكلفة مبيعات فاتورة ' || v_invoice_number, v_any_provisional),
      (p_org_id, p_branch_id, v_je_id, v_inv_acct_id, 0, v_cost_total, 'خصم مخزون فاتورة ' || v_invoice_number, v_any_provisional);
  END IF;

  -- Kitchen ticket generation
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
    organization_id, kitchen_ticket_id, menu_item_id, catalog_item_id, name, quantity, modifier_summary
  )
  SELECT
    p_org_id, v_ticket_id, menu_item_id, catalog_item_id, name, quantity, modifier_summary
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
