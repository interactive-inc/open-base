DROP TRIGGER IF EXISTS document_ledger_entries_source_freeze_insert;
CREATE TRIGGER document_ledger_entries_source_freeze_insert
BEFORE INSERT ON document_ledger_entries
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'document' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'document_record_source_frozen');
END;

DROP TRIGGER IF EXISTS document_ledger_entries_source_freeze_update;
CREATE TRIGGER document_ledger_entries_source_freeze_update
BEFORE UPDATE ON document_ledger_entries
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'document' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'document_record_source_frozen');
END;

DROP TRIGGER IF EXISTS document_ledger_entries_source_freeze_delete;
CREATE TRIGGER document_ledger_entries_source_freeze_delete
BEFORE DELETE ON document_ledger_entries
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'document' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'document_record_source_frozen');
END;
