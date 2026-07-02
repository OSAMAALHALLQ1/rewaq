-- Create departments table (departments belong to branches/restaurants)
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Members of departments
CREATE TABLE IF NOT EXISTS department_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  permissions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- API keys for departments (used to authenticate API requests scoped to a department)
CREATE TABLE IF NOT EXISTS department_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  key text NOT NULL UNIQUE,
  name text NULL,
  disabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.department_api_keys
ADD COLUMN IF NOT EXISTS "key" text;

CREATE INDEX IF NOT EXISTS idx_department_api_keys_key ON public.department_api_keys ("key");

-- Note: key generation is left to application code. You can insert keys like:
-- INSERT INTO department_api_keys (department_id, key, name) VALUES ('<dept-id>', md5(random()::text || clock_timestamp()::text), 'Kitchen API');
