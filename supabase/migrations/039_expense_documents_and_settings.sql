-- Expense-cycle document fields + core accounting configuration
-- 1) Expenses become real vouchers: payee, reference number, and an explicit
--    posting account chosen from the chart of accounts (instead of relying on
--    keyword matching of a free-text category).
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payee text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference_no text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_account_id uuid REFERENCES chart_of_accounts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_expense_account ON expenses (expense_account_id);

-- 2) Core accounting configuration (fiscal year, valuation, basis) so the
--    settings page is a real source of truth, not only feature toggles.
ALTER TABLE accounting_settings ADD COLUMN IF NOT EXISTS fiscal_year_start_month int NOT NULL DEFAULT 1
  CHECK (fiscal_year_start_month BETWEEN 1 AND 12);
ALTER TABLE accounting_settings ADD COLUMN IF NOT EXISTS inventory_valuation text NOT NULL DEFAULT 'moving_average';
ALTER TABLE accounting_settings ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'accrual';

-- 3) Manual journal entries: allow a per-line cost center (column already
--    exists on journal_lines since 033; index it for cost-center reports).
CREATE INDEX IF NOT EXISTS idx_journal_lines_cost_center ON journal_lines (cost_center_id) WHERE cost_center_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_lines_org_account ON journal_lines (organization_id, account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_org_date ON journal_entries (organization_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_invoices_org_due_date ON invoices (organization_id, due_date);
