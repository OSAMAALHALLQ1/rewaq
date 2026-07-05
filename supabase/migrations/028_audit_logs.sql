-- Unified Event Log / Audit Log for Critical Restaurant Actions

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid, -- Reference to the acting user
  action text NOT NULL, -- e.g., 'close_shift', 'invite_user', 'change_role', 'manual_stock_override', 'approve_request'
  entity_type text NOT NULL, -- e.g., 'sales_shift', 'user', 'branch_stock', 'account_request'
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow select for org members
DROP POLICY IF EXISTS "audit_logs org read" ON public.audit_logs;
CREATE POLICY "audit_logs org read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships WHERE user_id = auth.uid()
    )
  );

-- Allow insert by system / authenticated users
DROP POLICY IF EXISTS "audit_logs system insert" ON public.audit_logs;
CREATE POLICY "audit_logs system insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships WHERE user_id = auth.uid()
    )
  );
