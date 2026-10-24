DROP TRIGGER IF EXISTS system_preserved_record_prevent_delete;
CREATE TRIGGER system_preserved_record_prevent_delete
BEFORE DELETE ON system_preserved_records
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_immutable');
END;
