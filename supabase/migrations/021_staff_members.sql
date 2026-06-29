-- 021: Staff members with login codes (Tekka-style permission distribution)
-- Each staff member gets a generated login code (W/C/K/M-####) tied to a role,
-- so a manager can distribute access per department without passwords.

CREATE TABLE IF NOT EXISTS public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'staff'
    CHECK (role IN ('waiter', 'cashier', 'kitchen', 'bar', 'shisha', 'manager')),
  login_code text NOT NULL,
  linked_device_key_id uuid REFERENCES public.department_api_keys(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (organization_id, login_code)
);

CREATE INDEX IF NOT EXISTS staff_members_org_idx
  ON public.staff_members (organization_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS staff_members_branch_idx
  ON public.staff_members (branch_id);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff members org read" ON public.staff_members;
CREATE POLICY "staff members org read" ON public.staff_members
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "staff members manager write" ON public.staff_members;
CREATE POLICY "staff members manager write" ON public.staff_members
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_org_role(organization_id, array['organization_owner','branch_manager']::app_role[]) OR public.is_super_admin());

COMMENT ON TABLE public.staff_members IS
  'Restaurant staff with short login codes (Tekka-style) for quick department login. Each code is unique per organization.';
