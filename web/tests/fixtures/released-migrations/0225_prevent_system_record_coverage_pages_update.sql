DROP TRIGGER IF EXISTS system_record_coverage_pages_update;
CREATE TRIGGER system_record_coverage_pages_update BEFORE UPDATE ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;
