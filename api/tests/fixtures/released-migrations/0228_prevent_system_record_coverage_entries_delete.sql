DROP TRIGGER IF EXISTS system_record_coverage_entries_delete;
CREATE TRIGGER system_record_coverage_entries_delete BEFORE DELETE ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;
