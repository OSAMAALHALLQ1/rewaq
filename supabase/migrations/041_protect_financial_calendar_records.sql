-- Financial calendar rows are accounting-report evidence. Corrections must be
-- represented by updated/reversal data, never by deleting historical rows.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'financial_calendar_days',
    'financial_calendar_sales',
    'financial_calendar_expenses'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', target_table || ' branch delete', target_table);
  end loop;
end $$;
