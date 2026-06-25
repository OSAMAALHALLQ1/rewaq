-- Add warehouse column to inventory_items table
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS warehouse text NOT NULL DEFAULT 'general';

-- Add check constraint to ensure only general or kitchen are used
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

-- Update existing items by category to make it realistic
-- Raw protein, grains, dairy, vegetables, herbs, frozen are kitchen
-- Packaging, disposables, operations, cleaning are general
UPDATE public.inventory_items ii
SET warehouse = 'kitchen'
FROM public.inventory_categories ic
WHERE ii.category_id = ic.id
  AND ic.name IN ('بروتين', 'حبوب ونشويات', 'زيوت', 'صوصات', 'أجبان', 'خضار طازجة', 'فواكه وحمضيات', 'أعشاب طازجة', 'مجمدات', 'مخبوزات', 'بهارات وتوابل');

-- Exception: make sure buns remain general if any
UPDATE public.inventory_items 
SET warehouse = 'general' 
WHERE name = 'خبز برجر';
