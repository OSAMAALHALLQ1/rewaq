-- Canonical Atomic Stock Movement Database Function
-- This function adjusts branch stock and creates a stock movement record in a single transaction.

CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  p_org_id uuid,
  p_branch_id uuid,
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_unit_cost numeric,
  p_reference text,
  p_idempotency_key text,
  p_notes text,
  p_created_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_id uuid;
  v_current_qty numeric;
  v_new_qty numeric;
  v_movement_id uuid;
BEGIN
  -- 1. Check idempotency for stock_movements
  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM stock_movements
    WHERE organization_id = p_org_id
      AND idempotency_key = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  -- 2. Lock and fetch or insert branch_stock row
  SELECT id, quantity INTO v_stock_id, v_current_qty
  FROM branch_stock
  WHERE organization_id = p_org_id
    AND branch_id = p_branch_id
    AND item_id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO branch_stock (organization_id, branch_id, item_id, quantity, reserved_quantity, created_by)
    VALUES (p_org_id, p_branch_id, p_item_id, 0, 0, p_created_by)
    RETURNING id, quantity INTO v_stock_id, v_current_qty;
  END IF;

  v_new_qty := v_current_qty + p_quantity;

  -- 3. Update branch_stock
  UPDATE branch_stock
  SET quantity = v_new_qty,
      updated_at = now()
  WHERE id = v_stock_id;

  -- 4. Insert stock movement
  INSERT INTO stock_movements (
    organization_id, branch_id, item_id, movement_type, quantity,
    unit_cost, total_cost, reference, idempotency_key, notes, created_by
  ) VALUES (
    p_org_id, p_branch_id, p_item_id, p_movement_type::stock_movement_type, p_quantity,
    p_unit_cost, p_quantity * p_unit_cost, p_reference, p_idempotency_key, p_notes, p_created_by
  ) RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object('success', true, 'new_quantity', v_new_qty, 'movement_id', v_movement_id);
END;
$$;
