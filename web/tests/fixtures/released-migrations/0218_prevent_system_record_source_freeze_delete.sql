DROP TRIGGER IF EXISTS system_record_source_freezes_delete;
CREATE TRIGGER system_record_source_freezes_delete
BEFORE DELETE ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_immutable');
END;
