DROP TRIGGER IF EXISTS system_record_coverage_entries_update;
CREATE TRIGGER system_record_coverage_entries_update BEFORE UPDATE ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;
