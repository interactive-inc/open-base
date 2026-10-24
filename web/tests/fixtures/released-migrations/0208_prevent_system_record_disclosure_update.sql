DROP TRIGGER IF EXISTS system_record_disclosure_prevent_update;
CREATE TRIGGER system_record_disclosure_prevent_update
BEFORE UPDATE ON system_record_disclosure_policies
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_history_immutable');
END;
