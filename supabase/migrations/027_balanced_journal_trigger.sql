-- Database-level Balance Enforcement for Journal Entries
-- This enforces that the sum of debits equals the sum of credits for any journal entry.

CREATE OR REPLACE FUNCTION public.verify_journal_entry_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debit_sum numeric;
  v_credit_sum numeric;
  v_je_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_je_id := OLD.journal_entry_id;
  ELSE
    v_je_id := NEW.journal_entry_id;
  END IF;

  -- Calculate the sums for this journal entry
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO v_debit_sum, v_credit_sum
  FROM journal_lines
  WHERE journal_entry_id = v_je_id;

  -- Enforce balance
  IF v_debit_sum <> v_credit_sum THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced: debits (%) must equal credits (%)',
      v_je_id, v_debit_sum, v_credit_sum;
  END IF;

  RETURN NULL;
END;
$$;

-- Create constraint trigger that fires at commit time (DEFERRED)
DROP TRIGGER IF EXISTS trg_verify_journal_entry_balance ON public.journal_lines;
CREATE CONSTRAINT TRIGGER trg_verify_journal_entry_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_journal_entry_balance();
