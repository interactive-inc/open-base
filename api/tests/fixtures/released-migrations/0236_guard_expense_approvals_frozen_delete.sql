DROP TRIGGER IF EXISTS expense_approvals_source_freeze_delete;
CREATE TRIGGER expense_approvals_source_freeze_delete
BEFORE DELETE ON expense_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
