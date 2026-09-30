DROP TRIGGER IF EXISTS system_preserved_record_prevent_update;
CREATE TRIGGER system_preserved_record_prevent_update
BEFORE UPDATE ON system_preserved_records
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_immutable');
END;
