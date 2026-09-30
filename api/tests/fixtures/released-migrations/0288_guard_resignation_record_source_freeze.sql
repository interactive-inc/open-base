DROP TRIGGER IF EXISTS resignations_source_freeze_insert;
CREATE TRIGGER resignations_source_freeze_insert
BEFORE INSERT ON resignations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'resignation' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'resignation_record_source_frozen');
END;

DROP TRIGGER IF EXISTS resignations_source_freeze_update;
CREATE TRIGGER resignations_source_freeze_update
BEFORE UPDATE ON resignations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'resignation' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'resignation_record_source_frozen');
END;

DROP TRIGGER IF EXISTS resignations_source_freeze_delete;
CREATE TRIGGER resignations_source_freeze_delete
BEFORE DELETE ON resignations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'resignation' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'resignation_record_source_frozen');
END;
