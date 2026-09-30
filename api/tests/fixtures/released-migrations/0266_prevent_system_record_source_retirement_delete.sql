CREATE TRIGGER system_record_source_retirements_delete BEFORE DELETE ON system_record_source_retirements
BEGIN
  SELECT RAISE(ABORT,'record_source_retirement_immutable');
END;
