DROP TRIGGER IF EXISTS expense_budgets_source_freeze_insert;
CREATE TRIGGER expense_budgets_source_freeze_insert
BEFORE INSERT ON expense_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
