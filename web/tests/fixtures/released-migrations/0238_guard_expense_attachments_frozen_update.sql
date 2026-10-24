DROP TRIGGER IF EXISTS expense_attachments_source_freeze_update;
CREATE TRIGGER expense_attachments_source_freeze_update
BEFORE UPDATE ON expense_attachments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
