DROP TRIGGER IF EXISTS system_record_coverage_pages_delete;
CREATE TRIGGER system_record_coverage_pages_delete BEFORE DELETE ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;
