-- P0-5: Receipt documents with safe idempotency (check before stock change)
CREATE TABLE IF NOT EXISTS goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  purchase_order_id uuid REFERENCES purchase_orders (id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers (id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches (id) ON DELETE SET NULL,
  receipt_number text,
  idempotency_key text UNIQUE,
  received_at date NOT NULL DEFAULT current_date,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'posted',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  goods_receipt_id uuid NOT NULL REFERENCES goods_receipts (id) ON DELETE CASCADE,
  purchase_order_item_id uuid,
  item_id uuid REFERENCES inventory_items (id) ON DELETE SET NULL,
  quantity numeric NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goods_receipts_org ON goods_receipts (organization_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_po ON goods_receipts (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_receipt ON goods_receipt_items (goods_receipt_id);

ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goods_receipts_select ON goods_receipts;
CREATE POLICY goods_receipts_select ON goods_receipts
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS goods_receipts_write ON goods_receipts;
CREATE POLICY goods_receipts_write ON goods_receipts
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS goods_receipt_items_select ON goods_receipt_items;
CREATE POLICY goods_receipt_items_select ON goods_receipt_items
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS goods_receipt_items_write ON goods_receipt_items;
CREATE POLICY goods_receipt_items_write ON goods_receipt_items
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
  );
