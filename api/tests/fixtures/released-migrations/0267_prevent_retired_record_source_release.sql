CREATE TRIGGER system_record_source_retirement_prevents_release BEFORE UPDATE ON system_record_source_freezes
WHEN EXISTS (SELECT 1 FROM system_record_source_retirements WHERE freeze_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'record_source_already_retired');
END;
