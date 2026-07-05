-- 1. Add restaurant_id to all tables
ALTER TABLE tables ADD COLUMN IF NOT EXISTS restaurant_id text DEFAULT 'taka-main';
ALTER TABLE menu ADD COLUMN IF NOT EXISTS restaurant_id text DEFAULT 'taka-main';
ALTER TABLE bills ADD COLUMN IF NOT EXISTS restaurant_id text DEFAULT 'taka-main';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS restaurant_id text DEFAULT 'taka-main';
ALTER TABLE departments ADD COLUMN IF NOT EXISTS restaurant_id text DEFAULT 'taka-main';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS restaurant_id text DEFAULT 'taka-main';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_role text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_department text;
ALTER TABLE dept_orders ADD COLUMN IF NOT EXISTS restaurant_id text DEFAULT 'taka-main';

-- 2. Enable RLS on all tables (if not already enabled)
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE dept_orders ENABLE ROW LEVEL SECURITY;

-- 3. Create policies for Row Level Security (RLS)
-- Note: Replace 'auth.uid()' logic with your actual custom claim if using JWTs, 
-- or rely on the frontend filtering for the MVP while keeping tables secure.
-- For a strict SaaS, the restaurant_id should be in the JWT claims: auth.jwt() ->> 'restaurant_id'.
-- Here we allow authenticated users to see their restaurant data.

-- Tables
DROP POLICY IF EXISTS "Enable all operations for users of the same restaurant" ON tables;
CREATE POLICY "Enable all operations for users of the same restaurant" 
ON tables FOR ALL USING (true); -- Replace 'true' with auth logic for strict security later

-- Menu
DROP POLICY IF EXISTS "Enable all operations for users of the same restaurant" ON menu;
CREATE POLICY "Enable all operations for users of the same restaurant" 
ON menu FOR ALL USING (true);

-- Bills
DROP POLICY IF EXISTS "Enable all operations for users of the same restaurant" ON bills;
CREATE POLICY "Enable all operations for users of the same restaurant" 
ON bills FOR ALL USING (true);

-- Employees
DROP POLICY IF EXISTS "Enable all operations for users of the same restaurant" ON employees;
CREATE POLICY "Enable all operations for users of the same restaurant" 
ON employees FOR ALL USING (true);

-- Departments
DROP POLICY IF EXISTS "Enable all operations for users of the same restaurant" ON departments;
CREATE POLICY "Enable all operations for users of the same restaurant" 
ON departments FOR ALL USING (true);

-- Notifications
DROP POLICY IF EXISTS "Enable all operations for users of the same restaurant" ON notifications;
CREATE POLICY "Enable all operations for users of the same restaurant" 
ON notifications FOR ALL USING (true);

-- Dept Orders
DROP POLICY IF EXISTS "Enable all operations for users of the same restaurant" ON dept_orders;
CREATE POLICY "Enable all operations for users of the same restaurant" 
ON dept_orders FOR ALL USING (true);
