-- 1. Tighten catalog_items write permissions
DROP POLICY IF EXISTS "catalog_items org write" ON catalog_items;
CREATE POLICY "catalog_items org write" ON catalog_items
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','accountant']::app_role[]))
  WITH CHECK (public.has_org_role(organization_id, array['organization_owner','branch_manager','inventory_manager','accountant']::app_role[]));

-- 2. Create invoice_counters for concurrency-safe invoice numbers
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  last_invoice_number integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (organization_id, branch_id)
);

-- Enable RLS
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

-- Allow read for org members
DROP POLICY IF EXISTS "invoice_counters org read" ON invoice_counters;
CREATE POLICY "invoice_counters org read" ON invoice_counters
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

-- Allow write for system/authenticated users within org
DROP POLICY IF EXISTS "invoice_counters org write" ON invoice_counters;
CREATE POLICY "invoice_counters org write" ON invoice_counters
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','inventory_manager']::app_role[]))
  WITH CHECK (public.has_org_role(organization_id, array['organization_owner','branch_manager','cashier','inventory_manager']::app_role[]));

-- Function to safely get next invoice number
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_org_id uuid, p_branch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_num integer;
BEGIN
  INSERT INTO public.invoice_counters (organization_id, branch_id, last_invoice_number)
  VALUES (p_org_id, p_branch_id, 1)
  ON CONFLICT (organization_id, branch_id)
  DO UPDATE SET
    last_invoice_number = public.invoice_counters.last_invoice_number + 1,
    updated_at = now()
  RETURNING last_invoice_number INTO v_next_num;

  RETURN v_next_num;
END;
$$;
