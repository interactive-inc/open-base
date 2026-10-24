CREATE TRIGGER system_record_source_retirements_update BEFORE UPDATE ON system_record_source_retirements
BEGIN
  SELECT RAISE(ABORT,'record_source_retirement_immutable');
END;
