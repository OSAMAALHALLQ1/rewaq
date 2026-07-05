-- 1. Tables Table
CREATE TABLE IF NOT EXISTS public.tables (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    seats INTEGER DEFAULT 4,
    area TEXT,
    status TEXT DEFAULT 'empty',
    current_order JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    subtotal NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    service_charge NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    waiter_code TEXT,
    seated_at BIGINT,
    guests INTEGER DEFAULT 0,
    restaurant_id TEXT DEFAULT 'taka-main',
    CONSTRAINT tables_managed_id_check CHECK (id ~ '^([1-9]|[1-6][0-9]|70)$'),
    CONSTRAINT tables_status_check CHECK (status IN ('empty', 'eating', 'bill_requested', 'unavailable')),
    CONSTRAINT tables_totals_non_negative_check CHECK (
      coalesce(subtotal, 0) >= 0
      AND coalesce(tax, 0) >= 0
      AND coalesce(service_charge, 0) >= 0
      AND coalesce(total, 0) >= 0
      AND coalesce(guests, 0) >= 0
      AND coalesce(seats, 0) > 0
    )
);

-- Keep the restaurant floor plan fixed at exactly tables 1-70.
INSERT INTO public.tables (
  id, name, seats, area, status, current_order, notes,
  subtotal, tax, service_charge, total, waiter_code, seated_at, guests, restaurant_id
)
SELECT
  table_no::text,
  'طاولة ' || table_no,
  CASE WHEN table_no <= 30 THEN 4 WHEN table_no <= 55 THEN 6 ELSE 8 END,
  CASE WHEN table_no <= 35 THEN 'indoor' WHEN table_no <= 55 THEN 'outdoor' ELSE 'terrace' END,
  'empty',
  '[]'::jsonb,
  '',
  0,
  0,
  0,
  0,
  NULL,
  NULL,
  0,
  'taka-main'
FROM generate_series(1, 70) AS table_no
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_fixed_tables_1_to_70()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.id ~ '^([1-9]|[1-6][0-9]|70)$' THEN
      RAISE EXCEPTION 'Tables 1-70 are fixed and cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.id !~ '^([1-9]|[1-6][0-9]|70)$' THEN
    RAISE EXCEPTION 'Table id must be between 1 and 70';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Table id cannot be changed';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fixed_tables_1_to_70_guard ON public.tables;
CREATE TRIGGER fixed_tables_1_to_70_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tables
FOR EACH ROW EXECUTE FUNCTION public.enforce_fixed_tables_1_to_70();

-- 2. Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    role TEXT NOT NULL,
    username TEXT,
    password TEXT,
    code TEXT UNIQUE,
    phone TEXT,
    email TEXT,
    salary NUMERIC DEFAULT 0,
    active BOOLEAN DEFAULT true,
    last_login BIGINT,
    restaurant_id TEXT DEFAULT 'taka-main'
);

-- 3. Menu Table
CREATE TABLE IF NOT EXISTS public.menu (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    name TEXT NOT NULL,
    category TEXT,
    price NUMERIC NOT NULL,
    description TEXT,
    image TEXT,
    department TEXT,
    available BOOLEAN DEFAULT true,
    prep_time INTEGER DEFAULT 15,
    restaurant_id TEXT DEFAULT 'taka-main'
);

-- 4. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    icon TEXT,
    color TEXT,
    description TEXT,
    work_hours TEXT,
    active_orders INTEGER DEFAULT 0,
    last_order_at BIGINT,
    restaurant_id TEXT DEFAULT 'taka-main'
);

-- 5. Bills Table
CREATE TABLE IF NOT EXISTS public.bills (
    id TEXT PRIMARY KEY,
    table_id TEXT,
    table_name TEXT,
    cashier_code TEXT,
    cashier_name TEXT,
    timestamp BIGINT,
    date_formatted TEXT,
    time_formatted TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    subtotal NUMERIC,
    tax NUMERIC,
    service_charge NUMERIC,
    total NUMERIC,
    payment_method TEXT,
    notes TEXT,
    waiter_code TEXT,
    seated_at BIGINT,
    seated_duration INTEGER,
    closed_at BIGINT,
    idempotency_key TEXT,
    restaurant_id TEXT DEFAULT 'taka-main'
);

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT,
    target_roles JSONB DEFAULT '[]'::jsonb,
    target_role TEXT,
    target_department TEXT,
    timestamp BIGINT,
    read BOOLEAN DEFAULT false,
    restaurant_id TEXT DEFAULT 'taka-main'
);

-- 7. Department Orders (Active Orders)
CREATE TABLE IF NOT EXISTS public.dept_orders (
    id TEXT PRIMARY KEY,
    table_id TEXT,
    table_name TEXT,
    waiter_code TEXT,
    waiter_name TEXT,
    timestamp BIGINT,
    items JSONB DEFAULT '[]'::jsonb,
    subtotal NUMERIC,
    tax NUMERIC,
    service_charge NUMERIC,
    total NUMERIC,
    status TEXT,
    idempotency_key TEXT,
    restaurant_id TEXT DEFAULT 'taka-main'
);

-- Load hardening: indexes used by waiter, kitchen/bar/shisha, cashier, realtime recovery.
CREATE UNIQUE INDEX IF NOT EXISTS tables_restaurant_id_uidx
  ON public.tables (restaurant_id, id);

CREATE INDEX IF NOT EXISTS tables_restaurant_status_idx
  ON public.tables (restaurant_id, status);

CREATE INDEX IF NOT EXISTS dept_orders_restaurant_table_idx
  ON public.dept_orders (restaurant_id, table_id);

CREATE INDEX IF NOT EXISTS dept_orders_restaurant_status_idx
  ON public.dept_orders (restaurant_id, status);

CREATE INDEX IF NOT EXISTS dept_orders_restaurant_timestamp_idx
  ON public.dept_orders (restaurant_id, timestamp DESC);

CREATE UNIQUE INDEX IF NOT EXISTS dept_orders_restaurant_idempotency_uidx
  ON public.dept_orders (restaurant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS bills_restaurant_timestamp_idx
  ON public.bills (restaurant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS bills_restaurant_table_timestamp_idx
  ON public.bills (restaurant_id, table_id, timestamp DESC);

CREATE UNIQUE INDEX IF NOT EXISTS bills_restaurant_idempotency_uidx
  ON public.bills (restaurant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_restaurant_timestamp_idx
  ON public.notifications (restaurant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS notifications_restaurant_read_timestamp_idx
  ON public.notifications (restaurant_id, read, timestamp DESC);

CREATE INDEX IF NOT EXISTS menu_restaurant_department_available_idx
  ON public.menu (restaurant_id, department, available);

CREATE OR REPLACE FUNCTION public.submit_order_atomic(
  p_order_id text,
  p_table_id text,
  p_waiter_code text,
  p_waiter_name text,
  p_items jsonb,
  p_notes text DEFAULT '',
  p_guests integer DEFAULT 1,
  p_restaurant_id text DEFAULT 'taka-main'
)
RETURNS public.dept_orders
LANGUAGE plpgsql
SECURITY INVOKER
SET lock_timeout = '5s'
SET statement_timeout = '15s'
AS $$
DECLARE
  v_table public.tables%ROWTYPE;
  v_order public.dept_orders%ROWTYPE;
  v_subtotal numeric := 0;
  v_now bigint := floor(extract(epoch FROM clock_timestamp()) * 1000);
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items cannot be empty';
  END IF;

  SELECT *
  INTO v_order
  FROM public.dept_orders
  WHERE id = p_order_id AND restaurant_id = p_restaurant_id;

  IF FOUND THEN
    RETURN v_order;
  END IF;

  SELECT *
  INTO v_table
  FROM public.tables
  WHERE restaurant_id = p_restaurant_id AND id = p_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table not found';
  END IF;

  SELECT coalesce(sum(
    coalesce((item ->> 'price')::numeric, 0)
    * greatest(coalesce((item ->> 'qty')::integer, 0), 0)
  ), 0)
  INTO v_subtotal
  FROM jsonb_array_elements(p_items) item;

  INSERT INTO public.dept_orders (
    id, table_id, table_name, waiter_code, waiter_name, timestamp,
    items, subtotal, tax, service_charge, total, status, idempotency_key, restaurant_id
  )
  VALUES (
    p_order_id, p_table_id, v_table.name, p_waiter_code, p_waiter_name, v_now,
    p_items, v_subtotal, 0, 0, v_subtotal, 'new', p_order_id, p_restaurant_id
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_order;

  IF NOT FOUND THEN
    SELECT *
    INTO v_order
    FROM public.dept_orders
    WHERE id = p_order_id AND restaurant_id = p_restaurant_id;
    RETURN v_order;
  END IF;

  UPDATE public.tables
  SET
    status = 'eating',
    current_order = coalesce(current_order, '[]'::jsonb) || p_items,
    notes = coalesce(p_notes, ''),
    subtotal = coalesce(subtotal, 0) + v_subtotal,
    tax = 0,
    service_charge = 0,
    total = coalesce(total, 0) + v_subtotal,
    waiter_code = p_waiter_code,
    guests = greatest(coalesce(p_guests, 1), 1),
    seated_at = coalesce(seated_at, v_now)
  WHERE restaurant_id = p_restaurant_id AND id = p_table_id;

  RETURN v_order;
END $$;

CREATE OR REPLACE FUNCTION public.close_table_invoice_atomic(
  p_bill_id text,
  p_table_id text,
  p_payment_method text,
  p_cashier_code text,
  p_cashier_name text,
  p_notes text DEFAULT '',
  p_restaurant_id text DEFAULT 'taka-main'
)
RETURNS public.bills
LANGUAGE plpgsql
SECURITY INVOKER
SET lock_timeout = '5s'
SET statement_timeout = '15s'
AS $$
DECLARE
  v_table public.tables%ROWTYPE;
  v_bill public.bills%ROWTYPE;
  v_now bigint := floor(extract(epoch FROM clock_timestamp()) * 1000);
BEGIN
  SELECT *
  INTO v_bill
  FROM public.bills
  WHERE id = p_bill_id AND restaurant_id = p_restaurant_id;

  IF FOUND THEN
    RETURN v_bill;
  END IF;

  SELECT *
  INTO v_table
  FROM public.tables
  WHERE restaurant_id = p_restaurant_id AND id = p_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table not found';
  END IF;

  INSERT INTO public.bills (
    id, table_id, table_name, cashier_code, cashier_name, waiter_code,
    timestamp, items, subtotal, tax, service_charge, total, payment_method,
    notes, seated_at, seated_duration, closed_at, idempotency_key, restaurant_id
  )
  VALUES (
    p_bill_id, v_table.id, v_table.name, p_cashier_code, p_cashier_name, v_table.waiter_code,
    v_now, coalesce(v_table.current_order, '[]'::jsonb),
    coalesce(v_table.subtotal, 0), coalesce(v_table.tax, 0),
    coalesce(v_table.service_charge, 0), coalesce(v_table.total, 0),
    p_payment_method, coalesce(nullif(p_notes, ''), v_table.notes),
    v_table.seated_at,
    CASE
      WHEN v_table.seated_at IS NULL THEN NULL
      ELSE floor((v_now - v_table.seated_at) / 60000)::integer
    END,
    v_now, p_bill_id, p_restaurant_id
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_bill;

  IF NOT FOUND THEN
    SELECT *
    INTO v_bill
    FROM public.bills
    WHERE id = p_bill_id AND restaurant_id = p_restaurant_id;
    RETURN v_bill;
  END IF;

  UPDATE public.tables
  SET
    status = 'empty',
    current_order = '[]'::jsonb,
    notes = '',
    subtotal = 0,
    tax = 0,
    service_charge = 0,
    total = 0,
    waiter_code = NULL,
    seated_at = NULL,
    guests = 0
  WHERE restaurant_id = p_restaurant_id AND id = p_table_id;

  DELETE FROM public.dept_orders
  WHERE restaurant_id = p_restaurant_id AND table_id = p_table_id;

  RETURN v_bill;
END $$;

-- Realtime Configuration
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE tables, employees, menu, departments, bills, notifications, dept_orders;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
