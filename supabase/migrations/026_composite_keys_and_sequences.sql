-- Composite foreign keys for multi-tenant matching integrity
-- and lock-safe document sequence generator.

-- 1. Ensure composite unique constraints on parent tables
ALTER TABLE customer_invoices ADD CONSTRAINT customer_invoices_org_id_unique UNIQUE (organization_id, id);
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_org_id_unique UNIQUE (organization_id, id);
ALTER TABLE transfers ADD CONSTRAINT transfers_org_id_unique UNIQUE (organization_id, id);
ALTER TABLE stock_counts ADD CONSTRAINT stock_counts_org_id_unique UNIQUE (organization_id, id);
ALTER TABLE kitchen_tickets ADD CONSTRAINT kitchen_tickets_org_id_unique UNIQUE (organization_id, id);

-- 2. Add composite foreign key constraints on child tables
ALTER TABLE customer_invoice_items DROP CONSTRAINT IF EXISTS customer_invoice_items_org_id_fk;
ALTER TABLE customer_invoice_items DROP CONSTRAINT IF EXISTS customer_invoice_items_customer_invoice_id_fkey;
ALTER TABLE customer_invoice_items ADD CONSTRAINT customer_invoice_items_org_id_fk
  FOREIGN KEY (organization_id, customer_invoice_id) REFERENCES customer_invoices(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS journal_lines_org_id_fk;
ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS journal_lines_journal_entry_id_fkey;
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_org_id_fk
  FOREIGN KEY (organization_id, journal_entry_id) REFERENCES journal_entries(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE transfer_items DROP CONSTRAINT IF EXISTS transfer_items_org_id_fk;
ALTER TABLE transfer_items DROP CONSTRAINT IF EXISTS transfer_items_transfer_id_fkey;
ALTER TABLE transfer_items ADD CONSTRAINT transfer_items_org_id_fk
  FOREIGN KEY (organization_id, transfer_id) REFERENCES transfers(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE stock_count_items DROP CONSTRAINT IF EXISTS stock_count_items_org_id_fk;
ALTER TABLE stock_count_items DROP CONSTRAINT IF EXISTS stock_count_items_stock_count_id_fkey;
ALTER TABLE stock_count_items ADD CONSTRAINT stock_count_items_org_id_fk
  FOREIGN KEY (organization_id, stock_count_id) REFERENCES stock_counts(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE kitchen_ticket_items DROP CONSTRAINT IF EXISTS kitchen_ticket_items_org_id_fk;
ALTER TABLE kitchen_ticket_items DROP CONSTRAINT IF EXISTS kitchen_ticket_items_kitchen_ticket_id_fkey;
ALTER TABLE kitchen_ticket_items ADD CONSTRAINT kitchen_ticket_items_org_id_fk
  FOREIGN KEY (organization_id, kitchen_ticket_id) REFERENCES kitchen_tickets(organization_id, id) ON DELETE RESTRICT;


-- 3. Document sequences table
CREATE TABLE IF NOT EXISTS public.document_sequences (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  document_type text NOT NULL, -- 'invoice', 'purchase_order', 'supply_invoice', etc.
  year integer NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  PRIMARY KEY (organization_id, branch_id, document_type, year)
);

-- Enable RLS for sequences
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for org members" ON public.document_sequences;
CREATE POLICY "Allow select for org members" ON public.document_sequences
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id)); -- fallback RLS

-- 4. Next sequence number function
CREATE OR REPLACE FUNCTION public.get_next_sequence_number(
  p_org_id uuid,
  p_branch_id uuid,
  p_doc_type text,
  p_prefix text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer;
  v_next_val integer;
  v_seq_row record;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::integer;

  -- Lock row or insert if not exists
  SELECT * INTO v_seq_row
  FROM document_sequences
  WHERE organization_id = p_org_id
    AND (branch_id = p_branch_id OR (branch_id IS NULL AND p_branch_id IS NULL))
    AND document_type = p_doc_type
    AND year = v_year
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Try to insert the sequence row
    INSERT INTO document_sequences (organization_id, branch_id, document_type, year, current_value)
    VALUES (p_org_id, p_branch_id, p_doc_type, v_year, 1)
    ON CONFLICT (organization_id, branch_id, document_type, year) DO UPDATE
      SET current_value = document_sequences.current_value + 1
    RETURNING current_value INTO v_next_val;
  ELSE
    v_next_val := v_seq_row.current_value + 1;
    UPDATE document_sequences
    SET current_value = v_next_val,
        updated_at = now()
    WHERE organization_id = p_org_id
      AND (branch_id = p_branch_id OR (branch_id IS NULL AND p_branch_id IS NULL))
      AND document_type = p_doc_type
      AND year = v_year;
  END IF;

  RETURN p_prefix || TO_CHAR(now(), 'YYYY') || '-' || LPAD(v_next_val::text, 6, '0');
END;
$$;
