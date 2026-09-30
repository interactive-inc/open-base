DROP TRIGGER IF EXISTS expenses_source_freeze_insert;
CREATE TRIGGER expenses_source_freeze_insert
BEFORE INSERT ON expenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
