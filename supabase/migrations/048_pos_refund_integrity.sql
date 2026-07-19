-- POS refund integrity hardening.
-- Forward-only migration: do not apply to production before reviewing the
-- validation queries and forward-correction notes at the end of this file.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Values used by the existing POS refund route/RPC were missing from the
-- original enums. Function bodies below are compiled when invoked, after this
-- migration has committed.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.customer_invoice_status ADD VALUE IF NOT EXISTS 'partially_refunded';
ALTER TYPE public.customer_invoice_status ADD VALUE IF NOT EXISTS 'refunded';
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'customer_return';

CREATE TABLE IF NOT EXISTS public.pos_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  customer_invoice_id uuid NOT NULL REFERENCES public.customer_invoices(id) ON DELETE RESTRICT,
  refund_number text NOT NULL,
  refund_date date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'posted' CHECK (status = 'posted'),
  is_full_refund boolean NOT NULL DEFAULT false,
  subtotal numeric(14,4) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount numeric(14,4) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_total numeric(14,4) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  service_fee numeric(14,4) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
  delivery_fee numeric(14,4) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total numeric(14,4) NOT NULL DEFAULT 0 CHECK (total >= 0),
  cost_total numeric(14,4) NOT NULL DEFAULT 0 CHECK (cost_total >= 0),
  payment_allocations jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(payment_allocations) = 'array'),
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 120),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  actor_device_id uuid REFERENCES public.department_api_keys(id) ON DELETE RESTRICT,
  journal_entry_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_refunds_actor_required CHECK (actor_user_id IS NOT NULL OR actor_device_id IS NOT NULL),
  CONSTRAINT pos_refunds_total_formula CHECK (
    abs(total - round((subtotal - discount + tax_total + service_fee + delivery_fee)::numeric, 4)) <= 0.0001
  ),
  CONSTRAINT pos_refunds_org_number_unique UNIQUE (organization_id, refund_number),
  CONSTRAINT pos_refunds_org_idempotency_unique UNIQUE (organization_id, idempotency_key),
  CONSTRAINT pos_refunds_org_id_unique UNIQUE (organization_id, id),
  CONSTRAINT pos_refunds_journal_unique UNIQUE (organization_id, journal_entry_id),
  CONSTRAINT pos_refunds_invoice_org_fk
    FOREIGN KEY (organization_id, customer_invoice_id)
    REFERENCES public.customer_invoices(organization_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT pos_refunds_journal_org_fk
    FOREIGN KEY (organization_id, journal_entry_id)
    REFERENCES public.journal_entries(organization_id, id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

-- A composite unique index is required for tenant-safe invoice-item foreign
-- keys. It does not change or delete any historical invoice line.
CREATE UNIQUE INDEX IF NOT EXISTS customer_invoice_items_org_id_unique
  ON public.customer_invoice_items (organization_id, id);

CREATE TABLE IF NOT EXISTS public.pos_refund_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  refund_id uuid NOT NULL,
  invoice_item_id uuid NOT NULL,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  item_name text NOT NULL,
  quantity numeric(14,4) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,4) NOT NULL CHECK (unit_price >= 0),
  tax_rate numeric(8,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  subtotal numeric(14,4) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount numeric(14,4) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_total numeric(14,4) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  service_fee numeric(14,4) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
  delivery_fee numeric(14,4) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total numeric(14,4) NOT NULL DEFAULT 0 CHECK (total >= 0),
  cost_total numeric(14,4) NOT NULL DEFAULT 0 CHECK (cost_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_refund_items_refund_invoice_item_unique UNIQUE (refund_id, invoice_item_id),
  CONSTRAINT pos_refund_items_refund_org_fk
    FOREIGN KEY (organization_id, refund_id)
    REFERENCES public.pos_refunds(organization_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT pos_refund_items_invoice_item_org_fk
    FOREIGN KEY (organization_id, invoice_item_id)
    REFERENCES public.customer_invoice_items(organization_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT pos_refund_items_total_formula CHECK (
    abs(total - round((subtotal - discount + tax_total + service_fee + delivery_fee)::numeric, 4)) <= 0.0001
  )
);

CREATE INDEX IF NOT EXISTS pos_refunds_invoice_date_idx
  ON public.pos_refunds (organization_id, customer_invoice_id, refund_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS pos_refunds_branch_date_idx
  ON public.pos_refunds (organization_id, branch_id, refund_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS pos_refund_items_invoice_item_idx
  ON public.pos_refund_items (organization_id, invoice_item_id);

ALTER TABLE public.pos_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_refund_items ENABLE ROW LEVEL SECURITY;

-- Branch-scoped reads, matching customer_invoices/stock_movements: a user
-- restricted to one branch must not read another branch's refund documents.
DROP POLICY IF EXISTS "pos refunds org read" ON public.pos_refunds;
CREATE POLICY "pos refunds org read" ON public.pos_refunds
  FOR SELECT TO authenticated
  USING (public.can_access_branch(organization_id, branch_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "pos refund items org read" ON public.pos_refund_items;
CREATE POLICY "pos refund items org read" ON public.pos_refund_items
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.pos_refunds pr
      WHERE pr.organization_id = pos_refund_items.organization_id
        AND pr.id = pos_refund_items.refund_id
        AND public.can_access_branch(pr.organization_id, pr.branch_id)
    )
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pos_refunds FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pos_refund_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pos_refunds TO authenticated;
GRANT SELECT ON public.pos_refund_items TO authenticated;

CREATE OR REPLACE FUNCTION public.block_pos_refund_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'مستندات المرتجعات وآثارها غير قابلة للتعديل أو الحذف. استخدم مستند تصحيح مستقل.';
END;
$$;

DROP TRIGGER IF EXISTS pos_refunds_immutable_rows ON public.pos_refunds;
CREATE TRIGGER pos_refunds_immutable_rows
  BEFORE UPDATE OR DELETE ON public.pos_refunds
  FOR EACH ROW EXECUTE FUNCTION public.block_pos_refund_mutation();

DROP TRIGGER IF EXISTS pos_refunds_immutable_truncate ON public.pos_refunds;
CREATE TRIGGER pos_refunds_immutable_truncate
  BEFORE TRUNCATE ON public.pos_refunds
  FOR EACH STATEMENT EXECUTE FUNCTION public.block_pos_refund_mutation();

DROP TRIGGER IF EXISTS pos_refund_items_immutable_rows ON public.pos_refund_items;
CREATE TRIGGER pos_refund_items_immutable_rows
  BEFORE UPDATE OR DELETE ON public.pos_refund_items
  FOR EACH ROW EXECUTE FUNCTION public.block_pos_refund_mutation();

DROP TRIGGER IF EXISTS pos_refund_items_immutable_truncate ON public.pos_refund_items;
CREATE TRIGGER pos_refund_items_immutable_truncate
  BEFORE TRUNCATE ON public.pos_refund_items
  FOR EACH STATEMENT EXECUTE FUNCTION public.block_pos_refund_mutation();

CREATE OR REPLACE FUNCTION public.pos_refund_v2_atomic(
  p_org_id uuid,
  p_branch_id uuid,
  p_invoice_id uuid,
  p_reason text,
  p_refund_date date,
  p_idempotency_key text,
  p_actor_user_id uuid DEFAULT NULL,
  p_actor_device_id uuid DEFAULT NULL,
  p_items jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_invoice public.customer_invoices%ROWTYPE;
  v_existing public.pos_refunds%ROWTYPE;
  v_request_fingerprint text;
  v_normalized_items jsonb := '[]'::jsonb;
  v_is_full_request boolean := false;
  v_is_final_refund boolean := false;
  v_refund_id uuid := gen_random_uuid();
  v_journal_entry_id uuid := gen_random_uuid();
  v_refund_number text;
  v_journal_number text;
  v_new_invoice_status text;
  v_actor_valid boolean := false;
  v_requested record;
  v_invoice_line record;
  v_mapping record;
  v_ingredient record;
  v_payment record;
  v_impact record;
  v_take_quantity numeric(14,4);
  v_quantity_to_allocate numeric(14,4);
  v_available_quantity numeric(14,4);
  v_remaining_quantity_before numeric(18,4) := 0;
  v_remaining_quantity_after numeric(18,4) := 0;
  v_requested_quantity numeric(18,4) := 0;
  v_previous_subtotal numeric(14,4) := 0;
  v_previous_discount numeric(14,4) := 0;
  v_previous_tax numeric(14,4) := 0;
  v_previous_service_fee numeric(14,4) := 0;
  v_previous_delivery_fee numeric(14,4) := 0;
  v_previous_total numeric(14,4) := 0;
  v_previous_cost numeric(14,4) := 0;
  v_returned_subtotal numeric(14,4) := 0;
  v_returned_discount numeric(14,4) := 0;
  v_returned_tax numeric(14,4) := 0;
  v_returned_service_fee numeric(14,4) := 0;
  v_returned_delivery_fee numeric(14,4) := 0;
  v_returned_total numeric(14,4) := 0;
  v_returned_cost numeric(14,4) := 0;
  v_raw_subtotal numeric(14,4) := 0;
  v_raw_tax numeric(14,4) := 0;
  v_expected_line_cost numeric(14,4) := 0;
  v_payment_offset numeric(14,4) := 0;
  v_payment_remaining numeric(14,4) := 0;
  v_payment_capacity numeric(14,4) := 0;
  v_payment_amount numeric(14,4) := 0;
  v_payment_allocations jsonb := '[]'::jsonb;
  v_shift_id uuid;
  v_cash_refund numeric(14,4) := 0;
  v_card_refund numeric(14,4) := 0;
  v_cash_account_id uuid;
  v_card_account_id uuid;
  v_receivable_account_id uuid;
  v_sales_return_account_id uuid;
  v_discount_account_id uuid;
  v_tax_account_id uuid;
  v_service_account_id uuid;
  v_delivery_account_id uuid;
  v_cogs_account_id uuid;
  v_inventory_account_id uuid;
  v_payment_account_id uuid;
  v_debit_total numeric(18,4) := 0;
  v_credit_total numeric(18,4) := 0;
  v_last_line_id uuid;
  v_difference numeric(14,4);
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'تنفيذ مرتجع نقطة البيع مسموح من خادم رواق فقط.';
  END IF;

  IF p_org_id IS NULL OR p_branch_id IS NULL OR p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'المؤسسة والفرع والفاتورة مطلوبة.';
  END IF;

  IF p_refund_date IS NULL THEN
    RAISE EXCEPTION 'تاريخ المرتجع مطلوب.';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < 2 THEN
    RAISE EXCEPTION 'سبب المرتجع مطلوب.';
  END IF;

  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) NOT BETWEEN 8 AND 120 THEN
    RAISE EXCEPTION 'مفتاح منع التكرار مطلوب وطوله بين 8 و120 حرفاً.';
  END IF;

  IF p_actor_user_id IS NULL AND p_actor_device_id IS NULL THEN
    RAISE EXCEPTION 'هوية منفذ المرتجع مطلوبة.';
  END IF;

  IF p_actor_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.organization_id = p_org_id
        AND om.user_id = p_actor_user_id
        AND om.role::text IN ('organization_owner', 'branch_manager', 'accountant', 'cashier', 'super_admin')
        AND (om.branch_id IS NULL OR om.branch_id = p_branch_id)
    ) INTO v_actor_valid;

    IF NOT v_actor_valid THEN
      RAISE EXCEPTION 'المستخدم غير مخول بتنفيذ مرتجع لهذه المؤسسة.';
    END IF;
  END IF;

  IF p_actor_device_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.department_api_keys dak
      WHERE dak.id = p_actor_device_id
        AND dak.organization_id = p_org_id
        AND dak.branch_id = p_branch_id
        AND dak.is_active = true
        AND dak.role::text IN ('manager', 'branch_manager', 'organization_owner', 'accountant')
        AND 'pos' = ANY(dak.allowed_modules)
    ) INTO v_actor_valid;

    IF NOT v_actor_valid THEN
      RAISE EXCEPTION 'جهاز نقطة البيع غير مخول بتنفيذ مرتجع لهذا الفرع.';
    END IF;
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_refund_requested;
  CREATE TEMP TABLE pg_temp.pos_refund_requested (
    catalog_item_id uuid PRIMARY KEY,
    quantity numeric(14,4) NOT NULL CHECK (quantity > 0)
  ) ON COMMIT DROP;

  IF p_items IS NULL OR p_items = 'null'::jsonb THEN
    v_is_full_request := true;
  ELSIF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'بنود المرتجع يجب أن تكون مصفوفة.';
  ELSIF jsonb_array_length(p_items) = 0 THEN
    v_is_full_request := true;
  ELSE
    BEGIN
      INSERT INTO pg_temp.pos_refund_requested (catalog_item_id, quantity)
      SELECT
        (item ->> 'catalog_item_id')::uuid,
        round(sum((item ->> 'quantity')::numeric), 4)
      FROM jsonb_array_elements(p_items) AS item
      GROUP BY (item ->> 'catalog_item_id')::uuid;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'أحد بنود المرتجع يحتوي معرفاً أو كمية غير صالحة.';
    END;

    IF EXISTS (
      SELECT 1 FROM pg_temp.pos_refund_requested
      WHERE catalog_item_id IS NULL OR quantity <= 0
    ) THEN
      RAISE EXCEPTION 'كل صنف مرتجع يحتاج معرفاً وكمية موجبة.';
    END IF;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('catalog_item_id', catalog_item_id, 'quantity', quantity)
        ORDER BY catalog_item_id
      ),
      '[]'::jsonb
    )
    INTO v_normalized_items
    FROM pg_temp.pos_refund_requested;
  END IF;

  v_request_fingerprint := encode(
    public.digest(
      convert_to(
        concat_ws(
          '|',
          p_org_id::text,
          p_branch_id::text,
          p_invoice_id::text,
          p_refund_date::text,
          btrim(p_reason),
          v_is_full_request::text,
          v_normalized_items::text
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  SELECT * INTO v_existing
  FROM public.pos_refunds pr
  WHERE pr.organization_id = p_org_id
    AND pr.idempotency_key = btrim(p_idempotency_key)
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.request_fingerprint <> v_request_fingerprint THEN
      RAISE EXCEPTION 'مفتاح منع التكرار مستخدم لطلب مرتجع مختلف.';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'refundId', v_existing.id,
      'refundNumber', v_existing.refund_number,
      'invoiceId', v_existing.customer_invoice_id,
      'refundDate', v_existing.refund_date,
      'refundTotal', v_existing.total,
      'costTotal', v_existing.cost_total,
      'reason', v_existing.reason,
      'journalEntryId', v_existing.journal_entry_id
    );
  END IF;

  -- The row lock serializes all refunds for one invoice. The advisory lock is
  -- retained as a second guard for callers using different execution plans.
  SELECT * INTO v_invoice
  FROM public.customer_invoices ci
  WHERE ci.id = p_invoice_id
    AND ci.organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الفاتورة غير موجودة.';
  END IF;

  IF v_invoice.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'الفاتورة لا تتبع الفرع المطلوب.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('pos_refund_v2:' || p_org_id::text || ':' || p_invoice_id::text, 0)
  );

  -- Recheck after locking so concurrent retries return the first committed
  -- document instead of surfacing a unique-index race.
  SELECT * INTO v_existing
  FROM public.pos_refunds pr
  WHERE pr.organization_id = p_org_id
    AND pr.idempotency_key = btrim(p_idempotency_key)
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.request_fingerprint <> v_request_fingerprint THEN
      RAISE EXCEPTION 'مفتاح منع التكرار مستخدم لطلب مرتجع مختلف.';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'refundId', v_existing.id,
      'refundNumber', v_existing.refund_number,
      'invoiceId', v_existing.customer_invoice_id,
      'refundDate', v_existing.refund_date,
      'refundTotal', v_existing.total,
      'costTotal', v_existing.cost_total,
      'reason', v_existing.reason,
      'journalEntryId', v_existing.journal_entry_id
    );
  END IF;

  IF public.is_accounting_period_closed(p_org_id, p_refund_date) THEN
    RAISE EXCEPTION 'الفترة المحاسبية لتاريخ المرتجع مقفلة.';
  END IF;

  IF v_invoice.status::text NOT IN ('paid', 'partially_refunded') THEN
    RAISE EXCEPTION 'لا يمكن إرجاع فاتورة بحالتها الحالية: %', v_invoice.status;
  END IF;

  -- Legacy refunds from migration 034 did not create an item-level refund
  -- document. Further automatic partial refunds would be unsafe until those
  -- invoices are reconciled and backfilled explicitly.
  IF EXISTS (
    SELECT 1
    FROM public.journal_entries je
    WHERE je.organization_id = p_org_id
      AND je.source_doc_type = 'refund'
      AND je.source_doc_id = p_invoice_id
      AND je.status = 'posted'
  ) THEN
    RAISE EXCEPTION 'توجد عملية مرتجع قديمة لهذه الفاتورة بلا مستند تفصيلي؛ يلزم تصحيحها قبل مرتجع جديد.';
  END IF;

  SELECT
    COALESCE(sum(pr.subtotal), 0),
    COALESCE(sum(pr.discount), 0),
    COALESCE(sum(pr.tax_total), 0),
    COALESCE(sum(pr.service_fee), 0),
    COALESCE(sum(pr.delivery_fee), 0),
    COALESCE(sum(pr.total), 0),
    COALESCE(sum(pr.cost_total), 0)
  INTO
    v_previous_subtotal,
    v_previous_discount,
    v_previous_tax,
    v_previous_service_fee,
    v_previous_delivery_fee,
    v_previous_total,
    v_previous_cost
  FROM public.pos_refunds pr
  WHERE pr.organization_id = p_org_id
    AND pr.customer_invoice_id = p_invoice_id
    AND pr.status = 'posted';

  IF v_previous_subtotal > v_invoice.subtotal + 0.0001
     OR v_previous_tax > v_invoice.tax_total + 0.0001
     OR v_previous_total > v_invoice.total + 0.0001
     OR v_previous_cost > v_invoice.cost_total + 0.01 THEN
    RAISE EXCEPTION 'إجماليات المرتجعات السابقة تتجاوز الفاتورة وتحتاج مراجعة.';
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_refund_lines;
  CREATE TEMP TABLE pg_temp.pos_refund_lines (
    invoice_item_id uuid PRIMARY KEY,
    catalog_item_id uuid,
    menu_item_id uuid,
    item_name text NOT NULL,
    original_quantity numeric(14,4) NOT NULL,
    quantity numeric(14,4) NOT NULL CHECK (quantity > 0),
    unit_price numeric(14,4) NOT NULL,
    tax_rate numeric(8,4) NOT NULL,
    subtotal numeric(14,4) NOT NULL DEFAULT 0,
    discount numeric(14,4) NOT NULL DEFAULT 0,
    tax_total numeric(14,4) NOT NULL DEFAULT 0,
    service_fee numeric(14,4) NOT NULL DEFAULT 0,
    delivery_fee numeric(14,4) NOT NULL DEFAULT 0,
    total numeric(14,4) NOT NULL DEFAULT 0,
    expected_cost numeric(14,4) NOT NULL DEFAULT 0,
    cost_total numeric(14,4) NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  WITH returned AS (
    SELECT pri.invoice_item_id, sum(pri.quantity) AS quantity
    FROM public.pos_refund_items pri
    JOIN public.pos_refunds pr
      ON pr.organization_id = pri.organization_id
     AND pr.id = pri.refund_id
    WHERE pri.organization_id = p_org_id
      AND pr.customer_invoice_id = p_invoice_id
      AND pr.status = 'posted'
    GROUP BY pri.invoice_item_id
  )
  SELECT COALESCE(sum(cii.quantity - COALESCE(returned.quantity, 0)), 0)
  INTO v_remaining_quantity_before
  FROM public.customer_invoice_items cii
  LEFT JOIN returned ON returned.invoice_item_id = cii.id
  WHERE cii.organization_id = p_org_id
    AND cii.customer_invoice_id = p_invoice_id;

  IF v_remaining_quantity_before <= 0.0001 THEN
    RAISE EXCEPTION 'تم إرجاع جميع بنود الفاتورة مسبقاً.';
  END IF;

  IF v_is_full_request THEN
    INSERT INTO pg_temp.pos_refund_lines (
      invoice_item_id, catalog_item_id, menu_item_id, item_name,
      original_quantity, quantity, unit_price, tax_rate,
      subtotal, tax_total, expected_cost
    )
    SELECT
      cii.id,
      cii.catalog_item_id,
      cii.menu_item_id,
      cii.name,
      cii.quantity,
      round((cii.quantity - COALESCE(returned.quantity, 0))::numeric, 4),
      round(cii.unit_price::numeric, 4),
      round(COALESCE(cii.tax_rate, 0)::numeric, 4),
      round((cii.unit_price * (cii.quantity - COALESCE(returned.quantity, 0)))::numeric, 4),
      round((cii.unit_price * (cii.quantity - COALESCE(returned.quantity, 0)) * COALESCE(cii.tax_rate, 0) / 100)::numeric, 4),
      CASE
        WHEN cii.quantity > 0
          THEN round((cii.cost_total / cii.quantity * (cii.quantity - COALESCE(returned.quantity, 0)))::numeric, 4)
        ELSE 0
      END
    FROM public.customer_invoice_items cii
    LEFT JOIN (
      SELECT pri.invoice_item_id, sum(pri.quantity) AS quantity
      FROM public.pos_refund_items pri
      JOIN public.pos_refunds pr
        ON pr.organization_id = pri.organization_id
       AND pr.id = pri.refund_id
      WHERE pri.organization_id = p_org_id
        AND pr.customer_invoice_id = p_invoice_id
        AND pr.status = 'posted'
      GROUP BY pri.invoice_item_id
    ) returned ON returned.invoice_item_id = cii.id
    WHERE cii.organization_id = p_org_id
      AND cii.customer_invoice_id = p_invoice_id
      AND cii.quantity - COALESCE(returned.quantity, 0) > 0.0001;
  ELSE
    FOR v_requested IN
      SELECT catalog_item_id, quantity
      FROM pg_temp.pos_refund_requested
      ORDER BY catalog_item_id
    LOOP
      SELECT COALESCE(sum(cii.quantity - COALESCE(returned.quantity, 0)), 0)
      INTO v_available_quantity
      FROM public.customer_invoice_items cii
      LEFT JOIN (
        SELECT pri.invoice_item_id, sum(pri.quantity) AS quantity
        FROM public.pos_refund_items pri
        JOIN public.pos_refunds pr
          ON pr.organization_id = pri.organization_id
         AND pr.id = pri.refund_id
        WHERE pri.organization_id = p_org_id
          AND pr.customer_invoice_id = p_invoice_id
          AND pr.status = 'posted'
        GROUP BY pri.invoice_item_id
      ) returned ON returned.invoice_item_id = cii.id
      WHERE cii.organization_id = p_org_id
        AND cii.customer_invoice_id = p_invoice_id
        AND cii.catalog_item_id = v_requested.catalog_item_id;

      IF v_available_quantity <= 0.0001 THEN
        RAISE EXCEPTION 'الصنف % غير موجود أو تم إرجاعه بالكامل.', v_requested.catalog_item_id;
      END IF;

      IF v_requested.quantity > v_available_quantity + 0.0001 THEN
        RAISE EXCEPTION 'كمية المرتجع للصنف % تتجاوز الكمية المتبقية (%).',
          v_requested.catalog_item_id, v_available_quantity;
      END IF;

      v_quantity_to_allocate := v_requested.quantity;

      FOR v_invoice_line IN
        SELECT
          cii.*,
          round((cii.quantity - COALESCE(returned.quantity, 0))::numeric, 4) AS remaining_quantity
        FROM public.customer_invoice_items cii
        LEFT JOIN (
          SELECT pri.invoice_item_id, sum(pri.quantity) AS quantity
          FROM public.pos_refund_items pri
          JOIN public.pos_refunds pr
            ON pr.organization_id = pri.organization_id
           AND pr.id = pri.refund_id
          WHERE pri.organization_id = p_org_id
            AND pr.customer_invoice_id = p_invoice_id
            AND pr.status = 'posted'
          GROUP BY pri.invoice_item_id
        ) returned ON returned.invoice_item_id = cii.id
        WHERE cii.organization_id = p_org_id
          AND cii.customer_invoice_id = p_invoice_id
          AND cii.catalog_item_id = v_requested.catalog_item_id
          AND cii.quantity - COALESCE(returned.quantity, 0) > 0.0001
        ORDER BY cii.created_at, cii.id
      LOOP
        EXIT WHEN v_quantity_to_allocate <= 0.0001;

        v_take_quantity := round(LEAST(v_quantity_to_allocate, v_invoice_line.remaining_quantity)::numeric, 4);

        INSERT INTO pg_temp.pos_refund_lines (
          invoice_item_id, catalog_item_id, menu_item_id, item_name,
          original_quantity, quantity, unit_price, tax_rate,
          subtotal, tax_total, expected_cost
        ) VALUES (
          v_invoice_line.id,
          v_invoice_line.catalog_item_id,
          v_invoice_line.menu_item_id,
          v_invoice_line.name,
          v_invoice_line.quantity,
          v_take_quantity,
          round(v_invoice_line.unit_price::numeric, 4),
          round(COALESCE(v_invoice_line.tax_rate, 0)::numeric, 4),
          round((v_invoice_line.unit_price * v_take_quantity)::numeric, 4),
          round((v_invoice_line.unit_price * v_take_quantity * COALESCE(v_invoice_line.tax_rate, 0) / 100)::numeric, 4),
          CASE
            WHEN v_invoice_line.quantity > 0
              THEN round((v_invoice_line.cost_total / v_invoice_line.quantity * v_take_quantity)::numeric, 4)
            ELSE 0
          END
        );

        v_quantity_to_allocate := round((v_quantity_to_allocate - v_take_quantity)::numeric, 4);
      END LOOP;

      IF v_quantity_to_allocate > 0.0001 THEN
        RAISE EXCEPTION 'تعذر توزيع كامل كمية المرتجع للصنف %.', v_requested.catalog_item_id;
      END IF;
    END LOOP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_temp.pos_refund_lines) THEN
    RAISE EXCEPTION 'لا توجد بنود صالحة للإرجاع.';
  END IF;

  SELECT COALESCE(sum(quantity), 0), COALESCE(sum(subtotal), 0),
         COALESCE(sum(tax_total), 0), COALESCE(sum(expected_cost), 0)
  INTO v_requested_quantity, v_raw_subtotal, v_raw_tax, v_expected_line_cost
  FROM pg_temp.pos_refund_lines;

  v_is_final_refund := abs(v_remaining_quantity_before - v_requested_quantity) <= 0.0001;

  IF v_is_final_refund THEN
    v_returned_subtotal := round(GREATEST(v_invoice.subtotal - v_previous_subtotal, 0)::numeric, 4);
    v_returned_discount := round(GREATEST(v_invoice.discount - v_previous_discount, 0)::numeric, 4);
    v_returned_tax := round(GREATEST(v_invoice.tax_total - v_previous_tax, 0)::numeric, 4);
    v_returned_service_fee := round(GREATEST(v_invoice.service_fee - v_previous_service_fee, 0)::numeric, 4);
    v_returned_delivery_fee := round(GREATEST(v_invoice.delivery_fee - v_previous_delivery_fee, 0)::numeric, 4);
    v_returned_total := round(GREATEST(v_invoice.total - v_previous_total, 0)::numeric, 4);
  ELSE
    v_returned_subtotal := round(LEAST(v_raw_subtotal, GREATEST(v_invoice.subtotal - v_previous_subtotal, 0))::numeric, 4);
    v_returned_tax := round(LEAST(v_raw_tax, GREATEST(v_invoice.tax_total - v_previous_tax, 0))::numeric, 4);

    IF v_invoice.subtotal > 0 THEN
      v_returned_discount := round(LEAST(
        v_invoice.discount * v_returned_subtotal / v_invoice.subtotal,
        GREATEST(v_invoice.discount - v_previous_discount, 0)
      )::numeric, 4);
      v_returned_service_fee := round(LEAST(
        v_invoice.service_fee * v_returned_subtotal / v_invoice.subtotal,
        GREATEST(v_invoice.service_fee - v_previous_service_fee, 0)
      )::numeric, 4);
      v_returned_delivery_fee := round(LEAST(
        v_invoice.delivery_fee * v_returned_subtotal / v_invoice.subtotal,
        GREATEST(v_invoice.delivery_fee - v_previous_delivery_fee, 0)
      )::numeric, 4);
    END IF;

    v_returned_total := round((
      v_returned_subtotal - v_returned_discount + v_returned_tax
      + v_returned_service_fee + v_returned_delivery_fee
    )::numeric, 4);

    IF v_returned_total > GREATEST(v_invoice.total - v_previous_total, 0) + 0.0001 THEN
      RAISE EXCEPTION 'إجمالي المرتجع المحسوب يتجاوز رصيد الفاتورة.';
    END IF;
  END IF;

  IF v_returned_total < 0 THEN
    RAISE EXCEPTION 'إجمالي المرتجع المحسوب غير صالح.';
  END IF;

  -- Reconcile the final line so item totals exactly equal the immutable header.
  SELECT invoice_item_id INTO v_last_line_id
  FROM pg_temp.pos_refund_lines
  ORDER BY invoice_item_id DESC
  LIMIT 1;

  v_difference := round((v_returned_subtotal - v_raw_subtotal)::numeric, 4);
  UPDATE pg_temp.pos_refund_lines
  SET subtotal = round((subtotal + v_difference)::numeric, 4)
  WHERE invoice_item_id = v_last_line_id;

  v_difference := round((v_returned_tax - v_raw_tax)::numeric, 4);
  UPDATE pg_temp.pos_refund_lines
  SET tax_total = round((tax_total + v_difference)::numeric, 4)
  WHERE invoice_item_id = v_last_line_id;

  IF EXISTS (SELECT 1 FROM pg_temp.pos_refund_lines WHERE subtotal < 0 OR tax_total < 0) THEN
    RAISE EXCEPTION 'تعذر توزيع فروقات التقريب على بنود المرتجع بأمان.';
  END IF;

  UPDATE pg_temp.pos_refund_lines
  SET
    discount = CASE WHEN v_returned_subtotal > 0
      THEN round((v_returned_discount * subtotal / v_returned_subtotal)::numeric, 4) ELSE 0 END,
    service_fee = CASE WHEN v_returned_subtotal > 0
      THEN round((v_returned_service_fee * subtotal / v_returned_subtotal)::numeric, 4) ELSE 0 END,
    delivery_fee = CASE WHEN v_returned_subtotal > 0
      THEN round((v_returned_delivery_fee * subtotal / v_returned_subtotal)::numeric, 4) ELSE 0 END;

  SELECT round((v_returned_discount - COALESCE(sum(discount), 0))::numeric, 4)
  INTO v_difference FROM pg_temp.pos_refund_lines;
  UPDATE pg_temp.pos_refund_lines SET discount = discount + v_difference
  WHERE invoice_item_id = v_last_line_id;

  SELECT round((v_returned_service_fee - COALESCE(sum(service_fee), 0))::numeric, 4)
  INTO v_difference FROM pg_temp.pos_refund_lines;
  UPDATE pg_temp.pos_refund_lines SET service_fee = service_fee + v_difference
  WHERE invoice_item_id = v_last_line_id;

  SELECT round((v_returned_delivery_fee - COALESCE(sum(delivery_fee), 0))::numeric, 4)
  INTO v_difference FROM pg_temp.pos_refund_lines;
  UPDATE pg_temp.pos_refund_lines SET delivery_fee = delivery_fee + v_difference
  WHERE invoice_item_id = v_last_line_id;

  UPDATE pg_temp.pos_refund_lines
  SET total = round((subtotal - discount + tax_total + service_fee + delivery_fee)::numeric, 4);

  SELECT round((v_returned_total - COALESCE(sum(total), 0))::numeric, 4)
  INTO v_difference FROM pg_temp.pos_refund_lines;
  UPDATE pg_temp.pos_refund_lines SET total = total + v_difference
  WHERE invoice_item_id = v_last_line_id;

  IF EXISTS (
    SELECT 1 FROM pg_temp.pos_refund_lines
    WHERE discount < 0 OR service_fee < 0 OR delivery_fee < 0 OR total < 0
  ) THEN
    RAISE EXCEPTION 'توزيع إجمالي المرتجع على البنود غير صالح.';
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_refund_raw_impacts;
  CREATE TEMP TABLE pg_temp.pos_refund_raw_impacts (
    item_id uuid PRIMARY KEY,
    quantity numeric(14,4) NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  DROP TABLE IF EXISTS pg_temp.pos_refund_stock_impacts;
  CREATE TEMP TABLE pg_temp.pos_refund_stock_impacts (
    item_id uuid PRIMARY KEY,
    quantity numeric(14,4) NOT NULL CHECK (quantity > 0),
    unit_cost numeric(14,4) NOT NULL CHECK (unit_cost >= 0),
    is_provisional_cost boolean NOT NULL DEFAULT false
  ) ON COMMIT DROP;

  IF v_is_final_refund THEN
    WITH original AS (
      SELECT
        sm.item_id,
        round(sum(abs(sm.quantity))::numeric, 4) AS quantity,
        round((sum(abs(sm.quantity) * sm.unit_cost) / NULLIF(sum(abs(sm.quantity)), 0))::numeric, 4) AS unit_cost,
        bool_or(COALESCE(sm.is_provisional_cost, false)) AS is_provisional_cost
      FROM public.stock_movements sm
      WHERE sm.organization_id = p_org_id
        AND sm.branch_id = p_branch_id
        AND sm.source_doc_type = 'customer_invoice'
        AND sm.source_doc_id = p_invoice_id
        AND sm.movement_type = 'sale_usage'
      GROUP BY sm.item_id
    ), returned AS (
      SELECT sm.item_id, round(sum(sm.quantity)::numeric, 4) AS quantity
      FROM public.stock_movements sm
      JOIN public.pos_refunds pr
        ON pr.organization_id = sm.organization_id
       AND pr.id = sm.source_doc_id
      WHERE sm.organization_id = p_org_id
        AND pr.customer_invoice_id = p_invoice_id
        AND sm.source_doc_type = 'pos_refund'
        AND sm.movement_type = 'customer_return'
      GROUP BY sm.item_id
    )
    INSERT INTO pg_temp.pos_refund_stock_impacts (item_id, quantity, unit_cost, is_provisional_cost)
    SELECT
      original.item_id,
      round((original.quantity - COALESCE(returned.quantity, 0))::numeric, 4),
      original.unit_cost,
      original.is_provisional_cost
    FROM original
    LEFT JOIN returned ON returned.item_id = original.item_id
    WHERE original.quantity - COALESCE(returned.quantity, 0) > 0.0001;
  ELSE
    FOR v_invoice_line IN
      SELECT * FROM pg_temp.pos_refund_lines ORDER BY invoice_item_id
    LOOP
      FOR v_mapping IN
        SELECT *
        FROM public.menu_item_recipe_mapping mirm
        WHERE mirm.organization_id = p_org_id
          AND mirm.menu_item_id = v_invoice_line.menu_item_id
      LOOP
        FOR v_ingredient IN
          SELECT *
          FROM public.recipe_ingredients ri
          WHERE ri.organization_id = p_org_id
            AND ri.recipe_id = v_mapping.recipe_id
        LOOP
          v_take_quantity := round((
            v_ingredient.quantity
            * COALESCE(v_mapping.portion_multiplier, 1)
            * v_invoice_line.quantity
            / NULLIF(COALESCE(v_ingredient.yield_percent, 100) / 100, 0)
          )::numeric, 4);

          IF v_take_quantity > 0 THEN
            INSERT INTO pg_temp.pos_refund_raw_impacts (item_id, quantity)
            VALUES (v_ingredient.item_id, v_take_quantity)
            ON CONFLICT (item_id) DO UPDATE
              SET quantity = round((pos_refund_raw_impacts.quantity + excluded.quantity)::numeric, 4);
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;

    WITH original AS (
      SELECT
        sm.item_id,
        round(sum(abs(sm.quantity))::numeric, 4) AS quantity,
        round((sum(abs(sm.quantity) * sm.unit_cost) / NULLIF(sum(abs(sm.quantity)), 0))::numeric, 4) AS unit_cost,
        bool_or(COALESCE(sm.is_provisional_cost, false)) AS is_provisional_cost
      FROM public.stock_movements sm
      WHERE sm.organization_id = p_org_id
        AND sm.branch_id = p_branch_id
        AND sm.source_doc_type = 'customer_invoice'
        AND sm.source_doc_id = p_invoice_id
        AND sm.movement_type = 'sale_usage'
      GROUP BY sm.item_id
    ), returned AS (
      SELECT sm.item_id, round(sum(sm.quantity)::numeric, 4) AS quantity
      FROM public.stock_movements sm
      JOIN public.pos_refunds pr
        ON pr.organization_id = sm.organization_id
       AND pr.id = sm.source_doc_id
      WHERE sm.organization_id = p_org_id
        AND pr.customer_invoice_id = p_invoice_id
        AND sm.source_doc_type = 'pos_refund'
        AND sm.movement_type = 'customer_return'
      GROUP BY sm.item_id
    )
    INSERT INTO pg_temp.pos_refund_stock_impacts (item_id, quantity, unit_cost, is_provisional_cost)
    SELECT
      raw.item_id,
      round(LEAST(raw.quantity, original.quantity - COALESCE(returned.quantity, 0))::numeric, 4),
      original.unit_cost,
      original.is_provisional_cost
    FROM pg_temp.pos_refund_raw_impacts raw
    JOIN original ON original.item_id = raw.item_id
    LEFT JOIN returned ON returned.item_id = raw.item_id
    WHERE original.quantity - COALESCE(returned.quantity, 0) > 0.0001;

    SELECT round(COALESCE(sum(quantity * unit_cost), 0)::numeric, 4)
    INTO v_returned_cost
    FROM pg_temp.pos_refund_stock_impacts;

    IF abs(v_returned_cost - v_expected_line_cost) > 0.02 THEN
      RAISE EXCEPTION 'تغيرت وصفة أو تكلفة أحد الأصناف منذ البيع؛ يلزم مرتجع كامل أو تسوية مخزون معتمدة.';
    END IF;
  END IF;

  SELECT round(COALESCE(sum(quantity * unit_cost), 0)::numeric, 4)
  INTO v_returned_cost
  FROM pg_temp.pos_refund_stock_impacts;

  UPDATE pg_temp.pos_refund_lines
  SET cost_total = CASE
    WHEN v_expected_line_cost > 0
      THEN round((v_returned_cost * expected_cost / v_expected_line_cost)::numeric, 4)
    ELSE 0
  END;

  SELECT round((v_returned_cost - COALESCE(sum(cost_total), 0))::numeric, 4)
  INTO v_difference FROM pg_temp.pos_refund_lines;
  UPDATE pg_temp.pos_refund_lines SET cost_total = cost_total + v_difference
  WHERE invoice_item_id = v_last_line_id;

  IF EXISTS (SELECT 1 FROM pg_temp.pos_refund_lines WHERE cost_total < 0) THEN
    RAISE EXCEPTION 'تعذر توزيع تكلفة المرتجع على البنود بأمان.';
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_refund_original_payments;
  CREATE TEMP TABLE pg_temp.pos_refund_original_payments (
    line_index integer GENERATED ALWAYS AS IDENTITY,
    payment_method text NOT NULL,
    amount numeric(14,4) NOT NULL CHECK (amount > 0)
  ) ON COMMIT DROP;

  INSERT INTO pg_temp.pos_refund_original_payments (payment_method, amount)
  SELECT cip.payment_method::text, round(cip.amount::numeric, 4)
  FROM public.customer_invoice_payments cip
  WHERE cip.organization_id = p_org_id
    AND cip.customer_invoice_id = p_invoice_id
    AND cip.amount > 0
  ORDER BY cip.created_at, cip.id;

  IF NOT EXISTS (SELECT 1 FROM pg_temp.pos_refund_original_payments) AND v_invoice.total > 0 THEN
    INSERT INTO pg_temp.pos_refund_original_payments (payment_method, amount)
    VALUES (v_invoice.payment_method::text, round(v_invoice.total::numeric, 4));
  END IF;

  DROP TABLE IF EXISTS pg_temp.pos_refund_payment_allocations;
  CREATE TEMP TABLE pg_temp.pos_refund_payment_allocations (
    line_index integer GENERATED ALWAYS AS IDENTITY,
    payment_method text NOT NULL,
    amount numeric(14,4) NOT NULL CHECK (amount > 0)
  ) ON COMMIT DROP;

  v_payment_offset := v_previous_total;
  v_payment_remaining := v_returned_total;

  FOR v_payment IN
    SELECT payment_method, amount
    FROM pg_temp.pos_refund_original_payments
    ORDER BY line_index
  LOOP
    EXIT WHEN v_payment_remaining <= 0.0001;

    IF v_payment_offset >= v_payment.amount - 0.0001 THEN
      v_payment_offset := round(GREATEST(v_payment_offset - v_payment.amount, 0)::numeric, 4);
      CONTINUE;
    END IF;

    v_payment_capacity := round((v_payment.amount - v_payment_offset)::numeric, 4);
    v_payment_offset := 0;
    v_payment_amount := round(LEAST(v_payment_capacity, v_payment_remaining)::numeric, 4);

    IF v_payment_amount > 0 THEN
      INSERT INTO pg_temp.pos_refund_payment_allocations (payment_method, amount)
      VALUES (v_payment.payment_method, v_payment_amount);
      v_payment_remaining := round((v_payment_remaining - v_payment_amount)::numeric, 4);
    END IF;
  END LOOP;

  IF v_payment_remaining > 0.0001 THEN
    RAISE EXCEPTION 'دفعات الفاتورة الأصلية لا تغطي مبلغ المرتجع؛ يلزم تصحيح تسوية الفاتورة.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('method', payment_method, 'amount', amount)
      ORDER BY line_index
    ),
    '[]'::jsonb
  )
  INTO v_payment_allocations
  FROM pg_temp.pos_refund_payment_allocations;

  SELECT
    COALESCE(sum(amount) FILTER (WHERE payment_method = 'cash'), 0),
    COALESCE(sum(amount) FILTER (WHERE payment_method = 'card'), 0)
  INTO v_cash_refund, v_card_refund
  FROM pg_temp.pos_refund_payment_allocations;

  IF v_cash_refund > 0 OR v_card_refund > 0 THEN
    SELECT ss.id INTO v_shift_id
    FROM public.sales_shifts ss
    WHERE ss.organization_id = p_org_id
      AND ss.branch_id = p_branch_id
      AND ss.status = 'open'
      AND (p_actor_device_id IS NULL OR ss.device_key_id = p_actor_device_id)
    ORDER BY ss.opened_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_shift_id IS NULL THEN
      RAISE EXCEPTION 'يجب فتح وردية على الجهاز قبل تنفيذ مرتجع نقدي أو بطاقة.';
    END IF;
  END IF;

  v_refund_number := 'RFD-' || to_char(p_refund_date, 'YYYYMMDD') || '-' ||
    upper(left(replace(v_refund_id::text, '-', ''), 8));
  v_journal_number := 'JE-' || to_char(p_refund_date, 'YYYYMMDD') || '-RFD-' ||
    upper(left(replace(v_journal_entry_id::text, '-', ''), 8));

  -- The immutable source document is inserted before stock, shift, summary,
  -- invoice-status, audit, or journal effects. Its journal FK is deferred;
  -- any later failure rolls back this row and every effect in the same RPC.
  INSERT INTO public.pos_refunds (
    id, organization_id, branch_id, customer_invoice_id,
    refund_number, refund_date, reason, status, is_full_refund,
    subtotal, discount, tax_total, service_fee, delivery_fee, total, cost_total,
    payment_allocations, idempotency_key, request_fingerprint,
    actor_user_id, actor_device_id, journal_entry_id
  ) VALUES (
    v_refund_id, p_org_id, p_branch_id, p_invoice_id,
    v_refund_number, p_refund_date, btrim(p_reason), 'posted', v_is_final_refund,
    v_returned_subtotal, v_returned_discount, v_returned_tax,
    v_returned_service_fee, v_returned_delivery_fee, v_returned_total, v_returned_cost,
    v_payment_allocations, btrim(p_idempotency_key), v_request_fingerprint,
    p_actor_user_id, p_actor_device_id, v_journal_entry_id
  );

  INSERT INTO public.pos_refund_items (
    organization_id, refund_id, invoice_item_id, catalog_item_id,
    item_name, quantity, unit_price, tax_rate,
    subtotal, discount, tax_total, service_fee, delivery_fee, total, cost_total
  )
  SELECT
    p_org_id, v_refund_id, invoice_item_id, catalog_item_id,
    item_name, quantity, unit_price, tax_rate,
    subtotal, discount, tax_total, service_fee, delivery_fee, total, cost_total
  FROM pg_temp.pos_refund_lines
  ORDER BY invoice_item_id;

  FOR v_impact IN
    SELECT * FROM pg_temp.pos_refund_stock_impacts ORDER BY item_id
  LOOP
    INSERT INTO public.branch_stock (
      organization_id, branch_id, item_id, quantity, reserved_quantity
    ) VALUES (
      p_org_id, p_branch_id, v_impact.item_id, v_impact.quantity, 0
    )
    ON CONFLICT (branch_id, item_id) DO UPDATE
      SET quantity = round((public.branch_stock.quantity + excluded.quantity)::numeric, 4),
          updated_at = now();

    INSERT INTO public.stock_movements (
      organization_id, branch_id, item_id, movement_type, quantity,
      unit_cost, source_doc_type, source_doc_id, idempotency_key, notes,
      created_by, is_negative_stock, is_provisional_cost
    ) VALUES (
      p_org_id, p_branch_id, v_impact.item_id, 'customer_return', v_impact.quantity,
      v_impact.unit_cost, 'pos_refund', v_refund_id,
      v_refund_id::text || ':' || v_impact.item_id::text || ':customer_return',
      'استعادة مخزون مرتجع ' || v_refund_number || ' للفاتورة ' || v_invoice.invoice_number,
      p_actor_user_id, false, v_impact.is_provisional_cost
    );
  END LOOP;

  PERFORM public.ensure_default_chart_accounts(p_org_id);

  SELECT id INTO v_cash_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'cash_on_hand' AND is_active = true LIMIT 1;
  SELECT id INTO v_card_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'bank_card' AND is_active = true LIMIT 1;
  SELECT id INTO v_receivable_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'accounts_receivable' AND is_active = true LIMIT 1;
  SELECT id INTO v_sales_return_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key IN ('sales_returns', 'sales_revenue') AND is_active = true
  ORDER BY CASE WHEN system_key = 'sales_returns' THEN 0 ELSE 1 END LIMIT 1;
  SELECT id INTO v_discount_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'sales_discounts' AND is_active = true LIMIT 1;
  SELECT id INTO v_tax_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'output_tax_payable' AND is_active = true LIMIT 1;
  SELECT id INTO v_service_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'service_fee_revenue' AND is_active = true LIMIT 1;
  SELECT id INTO v_delivery_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'delivery_revenue' AND is_active = true LIMIT 1;
  SELECT id INTO v_cogs_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'cogs' AND is_active = true LIMIT 1;
  SELECT id INTO v_inventory_account_id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id AND system_key = 'inventory' AND is_active = true LIMIT 1;

  IF v_sales_return_account_id IS NULL
     OR (v_returned_discount > 0 AND v_discount_account_id IS NULL)
     OR (v_returned_tax > 0 AND v_tax_account_id IS NULL)
     OR (v_returned_service_fee > 0 AND v_service_account_id IS NULL)
     OR (v_returned_delivery_fee > 0 AND v_delivery_account_id IS NULL)
     OR (v_returned_cost > 0 AND (v_cogs_account_id IS NULL OR v_inventory_account_id IS NULL)) THEN
    RAISE EXCEPTION 'حسابات مرتجع المبيعات غير مكتملة في دليل الحسابات.';
  END IF;

  INSERT INTO public.journal_entries (
    id, organization_id, branch_id, entry_number, entry_date,
    source_doc_type, source_doc_id, memo, status, created_by
  ) VALUES (
    v_journal_entry_id, p_org_id, p_branch_id, v_journal_number, p_refund_date,
    'pos_refund', v_refund_id,
    'قيد مرتجع مبيعات ' || v_refund_number || ' للفاتورة ' || v_invoice.invoice_number,
    'draft', p_actor_user_id
  );

  IF v_returned_subtotal > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_journal_entry_id, v_sales_return_account_id, p_branch_id,
      v_returned_subtotal, 0, 'مرتجع مبيعات ' || v_refund_number
    );
  END IF;

  IF v_returned_tax > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_journal_entry_id, v_tax_account_id, p_branch_id,
      v_returned_tax, 0, 'عكس ضريبة مخرجات ' || v_refund_number
    );
  END IF;

  IF v_returned_service_fee > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_journal_entry_id, v_service_account_id, p_branch_id,
      v_returned_service_fee, 0, 'عكس إيراد خدمة ' || v_refund_number
    );
  END IF;

  IF v_returned_delivery_fee > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_journal_entry_id, v_delivery_account_id, p_branch_id,
      v_returned_delivery_fee, 0, 'عكس إيراد توصيل ' || v_refund_number
    );
  END IF;

  FOR v_payment IN
    SELECT payment_method, amount
    FROM pg_temp.pos_refund_payment_allocations
    ORDER BY line_index
  LOOP
    v_payment_account_id := CASE v_payment.payment_method
      WHEN 'cash' THEN v_cash_account_id
      WHEN 'receivable' THEN v_receivable_account_id
      ELSE v_card_account_id
    END;

    IF v_payment_account_id IS NULL THEN
      RAISE EXCEPTION 'حساب وسيلة الدفع % غير معرف.', v_payment.payment_method;
    END IF;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_journal_entry_id, v_payment_account_id, p_branch_id,
      0, v_payment.amount, 'تسوية مرتجع عبر ' || v_payment.payment_method || ' - ' || v_refund_number
    );
  END LOOP;

  IF v_returned_discount > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo
    ) VALUES (
      p_org_id, v_journal_entry_id, v_discount_account_id, p_branch_id,
      0, v_returned_discount, 'عكس خصم مبيعات ' || v_refund_number
    );
  END IF;

  IF v_returned_cost > 0 THEN
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, account_id, branch_id, debit, credit, memo,
      is_provisional_cost
    ) VALUES
      (
        p_org_id, v_journal_entry_id, v_inventory_account_id, p_branch_id,
        v_returned_cost, 0, 'استعادة مخزون ' || v_refund_number,
        EXISTS (SELECT 1 FROM pg_temp.pos_refund_stock_impacts WHERE is_provisional_cost)
      ),
      (
        p_org_id, v_journal_entry_id, v_cogs_account_id, p_branch_id,
        0, v_returned_cost, 'عكس تكلفة مبيعات ' || v_refund_number,
        EXISTS (SELECT 1 FROM pg_temp.pos_refund_stock_impacts WHERE is_provisional_cost)
      );
  END IF;

  SELECT
    round(COALESCE(sum(jl.debit), 0)::numeric, 4),
    round(COALESCE(sum(jl.credit), 0)::numeric, 4)
  INTO v_debit_total, v_credit_total
  FROM public.journal_lines jl
  WHERE jl.organization_id = p_org_id
    AND jl.journal_entry_id = v_journal_entry_id;

  IF abs(v_debit_total - v_credit_total) > 0.0001 THEN
    RAISE EXCEPTION 'قيد المرتجع غير متوازن: مدين % ودائن %.', v_debit_total, v_credit_total;
  END IF;

  UPDATE public.journal_entries
  SET status = 'posted'
  WHERE organization_id = p_org_id
    AND id = v_journal_entry_id
    AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'تعذر ترحيل قيد المرتجع من مسودة إلى مرحل.';
  END IF;

  IF v_shift_id IS NOT NULL THEN
    UPDATE public.sales_shifts
    SET cash_sales = round((cash_sales - v_cash_refund)::numeric, 4),
        card_sales = round((card_sales - v_card_refund)::numeric, 4),
        expected_cash = round((expected_cash - v_cash_refund)::numeric, 4),
        updated_at = now()
    WHERE id = v_shift_id
      AND organization_id = p_org_id
      AND status = 'open';

    IF v_cash_refund > 0 THEN
      INSERT INTO public.cash_drawer_entries (
        organization_id, branch_id, shift_id, entry_type, amount,
        reference_doc_type, reference_doc_id, memo, created_by
      ) VALUES (
        p_org_id, p_branch_id, v_shift_id, 'withdrawal', -v_cash_refund,
        'pos_refund', v_refund_id, 'دفع مرتجع نقدي ' || v_refund_number, p_actor_user_id
      );
    END IF;

    IF v_card_refund > 0 THEN
      INSERT INTO public.cash_drawer_entries (
        organization_id, branch_id, shift_id, entry_type, amount,
        reference_doc_type, reference_doc_id, memo, created_by
      ) VALUES (
        p_org_id, p_branch_id, v_shift_id, 'card_sale', -v_card_refund,
        'pos_refund', v_refund_id, 'عكس تحصيل بطاقة ' || v_refund_number, p_actor_user_id
      );
    END IF;
  END IF;

  INSERT INTO public.sales_daily_summaries (
    organization_id, branch_id, summary_date, channel,
    orders_count, sales_total, ingredient_cost_total
  ) VALUES (
    p_org_id, p_branch_id, p_refund_date, v_invoice.channel,
    0, -v_returned_total, -v_returned_cost
  )
  ON CONFLICT (organization_id, branch_id, summary_date, channel) DO UPDATE
    SET sales_total = round((public.sales_daily_summaries.sales_total + excluded.sales_total)::numeric, 4),
        ingredient_cost_total = round((public.sales_daily_summaries.ingredient_cost_total + excluded.ingredient_cost_total)::numeric, 4),
        updated_at = now();

  SELECT COALESCE(sum(GREATEST(cii.quantity - COALESCE(returned.quantity, 0), 0)), 0)
  INTO v_remaining_quantity_after
  FROM public.customer_invoice_items cii
  LEFT JOIN (
    SELECT pri.invoice_item_id, sum(pri.quantity) AS quantity
    FROM public.pos_refund_items pri
    JOIN public.pos_refunds pr
      ON pr.organization_id = pri.organization_id
     AND pr.id = pri.refund_id
    WHERE pri.organization_id = p_org_id
      AND pr.customer_invoice_id = p_invoice_id
      AND pr.status = 'posted'
    GROUP BY pri.invoice_item_id
  ) returned ON returned.invoice_item_id = cii.id
  WHERE cii.organization_id = p_org_id
    AND cii.customer_invoice_id = p_invoice_id;

  v_new_invoice_status := CASE
    WHEN v_remaining_quantity_after <= 0.0001 THEN 'refunded'
    ELSE 'partially_refunded'
  END;

  UPDATE public.customer_invoices
  SET status = v_new_invoice_status::public.customer_invoice_status,
      updated_at = now()
  WHERE organization_id = p_org_id
    AND id = p_invoice_id;

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, action,
    entity_type, entity_id, old_data, new_data
  ) VALUES (
    p_org_id, p_branch_id, p_actor_user_id, 'pos_refund_posted',
    'pos_refund', v_refund_id,
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'invoice_status', v_invoice.status,
      'remaining_item_quantity', v_remaining_quantity_before
    ),
    jsonb_build_object(
      'refund_number', v_refund_number,
      'refund_date', p_refund_date,
      'refund_total', v_returned_total,
      'cost_total', v_returned_cost,
      'journal_entry_id', v_journal_entry_id,
      'invoice_status', v_new_invoice_status,
      'remaining_item_quantity', v_remaining_quantity_after,
      'actor_device_id', p_actor_device_id,
      'idempotency_key', btrim(p_idempotency_key)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'refundId', v_refund_id,
    'refundNumber', v_refund_number,
    'invoiceId', p_invoice_id,
    'refundDate', p_refund_date,
    'refundTotal', v_returned_total,
    'costTotal', v_returned_cost,
    'reason', btrim(p_reason),
    'journalEntryId', v_journal_entry_id,
    'invoiceStatus', v_new_invoice_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_refund_v2_atomic(
  uuid, uuid, uuid, text, date, text, uuid, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_refund_v2_atomic(
  uuid, uuid, uuid, text, date, text, uuid, uuid, jsonb
) TO service_role;

-- Retire the legacy refund path from migration 034. It has no tenant/role
-- authorization, no idempotency, no balance re-check, and defaults to PUBLIC
-- EXECUTE as SECURITY DEFINER. Historical journal/stock rows it produced are
-- kept untouched (forward-only); only the callable function is removed.
REVOKE ALL ON FUNCTION public.pos_refund_atomic(
  uuid, uuid, uuid, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.pos_refund_atomic(uuid, uuid, uuid, text, uuid, jsonb);

COMMENT ON TABLE public.pos_refunds IS
  'Immutable POS refund source documents. Corrections require a new compensating document.';
COMMENT ON TABLE public.pos_refund_items IS
  'Immutable item-level quantities and rounded values for each POS refund.';
COMMENT ON FUNCTION public.pos_refund_v2_atomic(uuid, uuid, uuid, text, date, text, uuid, uuid, jsonb) IS
  'Creates an idempotent POS refund document and atomically restores stock, posts a balanced journal, updates shift/summary, and derives invoice refund status.';

-- Pre-apply validation queries (run read-only):
-- 1) Legacy refunds that must be reconciled before another partial refund:
-- SELECT organization_id, source_doc_id AS invoice_id, count(*)
-- FROM public.journal_entries
-- WHERE source_doc_type = 'refund' AND status = 'posted'
-- GROUP BY organization_id, source_doc_id;
--
-- 2) Invoice items with invalid quantities/costs:
-- SELECT organization_id, customer_invoice_id, id, quantity, cost_total
-- FROM public.customer_invoice_items
-- WHERE quantity <= 0 OR cost_total < 0;
--
-- Post-apply validation queries (run after staging smoke tests):
-- SELECT pr.id, pr.refund_number,
--        sum(jl.debit) AS debit_total, sum(jl.credit) AS credit_total
-- FROM public.pos_refunds pr
-- JOIN public.journal_entries je ON je.id = pr.journal_entry_id
-- JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
-- GROUP BY pr.id, pr.refund_number
-- HAVING abs(sum(jl.debit) - sum(jl.credit)) > 0.0001;
--
-- SELECT pri.invoice_item_id, sum(pri.quantity) AS refunded, cii.quantity AS invoiced
-- FROM public.pos_refund_items pri
-- JOIN public.customer_invoice_items cii ON cii.id = pri.invoice_item_id
-- GROUP BY pri.invoice_item_id, cii.quantity
-- HAVING sum(pri.quantity) > cii.quantity + 0.0001;
--
-- SELECT sm.id, sm.source_doc_id
-- FROM public.stock_movements sm
-- LEFT JOIN public.pos_refunds pr
--   ON pr.organization_id = sm.organization_id AND pr.id = sm.source_doc_id
-- WHERE sm.source_doc_type = 'pos_refund' AND pr.id IS NULL;
--
-- Forward-correction plan: revoke EXECUTE on pos_refund_v2_atomic first, then
-- deploy a new migration that fixes data/functions in place. Never delete or
-- roll back posted refund, stock, journal, cash-drawer, summary, or audit rows.
