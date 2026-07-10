-- P0-4: Proper supplier-invoice lifecycle and payments
-- Extend invoice status enum (keep existing values for compatibility)
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'posted';
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'void';

-- Payment tracking columns on invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due numeric NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method text;

-- Supplier payments (separate from invoice creation)
CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers (id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches (id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL,
  payment_date date NOT NULL,
  reference text,
  journal_entry_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_org ON supplier_payments (organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_invoice ON supplier_payments (invoice_id);

ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_payments_select ON supplier_payments;
CREATE POLICY supplier_payments_select ON supplier_payments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS supplier_payments_write ON supplier_payments;
CREATE POLICY supplier_payments_write ON supplier_payments
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  );
