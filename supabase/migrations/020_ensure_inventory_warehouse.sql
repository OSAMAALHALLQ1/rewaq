-- 020: Ensure inventory_items.warehouse column exists on the live DB
-- (re-applies the intent of 019 idempotently so /dashboard/inventory?warehouse=kitchen
--  is not empty after a fresh production deploy).

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS warehouse text NOT NULL DEFAULT 'general';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_items_warehouse_check'
  ) THEN
    ALTER TABLE public.inventory_items
      ADD CONSTRAINT inventory_items_warehouse_check
      CHECK (warehouse IN ('general', 'kitchen'));
  END IF;
END $$;

-- Index for the warehouse filter used by the dashboard pages.
CREATE INDEX IF NOT EXISTS inventory_items_org_warehouse_idx
  ON public.inventory_items (organization_id, warehouse);

-- Populate warehouse from the category name when it is still the default 'general'.
-- Kitchen categories: raw proteins, grains, oils, sauces, dairy, fresh produce, frozen, spices.
-- General categories: packaging, disposables, cleaning, operations.
UPDATE public.inventory_items ii
SET warehouse = 'kitchen',
    updated_at = now()
FROM public.inventory_categories ic
WHERE ii.category_id = ic.id
  AND ii.warehouse = 'general'
  AND ic.name IN (
    'بروتين', 'حبوب ونشويات', 'زيوت', 'صوصات', 'أجبان',
    'خضار طازجة', 'فواكه وحمضيات', 'أعشاب طازجة',
    'مجمدات', 'مخبوزات', 'بهارات وتوابل'
  );

-- Keep bread / buns as general warehouse (packaged stockroom item).
UPDATE public.inventory_items
SET warehouse = 'general',
    updated_at = now()
WHERE name = 'خبز برجر';

COMMENT ON COLUMN public.inventory_items.warehouse IS
  'Stockroom grouping: general (packaging/cleaning/ops) vs kitchen (raw food/prep).';
