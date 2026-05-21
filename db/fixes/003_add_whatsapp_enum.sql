-- Ensure 'whatsapp' is present in social_platform enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'social_platform' AND e.enumlabel = 'whatsapp'
  ) THEN
    ALTER TYPE social_platform ADD VALUE 'whatsapp';
  END IF;
END$$;