-- Create Invoice Archives Table
CREATE TABLE IF NOT EXISTS public.invoice_archives (
    id TEXT PRIMARY KEY,
    archive_name TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    invoice_count INTEGER NOT NULL,
    total_amount NUMERIC NOT NULL,
    pdf_data TEXT NOT NULL, -- Base64 string of the PDF
    restaurant_id TEXT DEFAULT 'taka-main'
);

-- Enable RLS
ALTER TABLE public.invoice_archives ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DROP POLICY IF EXISTS "Enable all operations for users of the same restaurant" ON public.invoice_archives;
CREATE POLICY "Enable all operations for users of the same restaurant" 
ON public.invoice_archives FOR ALL USING (true);

-- Add to Realtime Publication if possible
-- Note: Run this if you want to receive realtime updates in the manager dashboard
-- ALTER PUBLICATION supabase_realtime ADD TABLE invoice_archives;
