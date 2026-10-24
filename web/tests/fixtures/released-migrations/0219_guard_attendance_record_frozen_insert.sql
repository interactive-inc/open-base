DROP TRIGGER IF EXISTS attendance_records_source_freeze_insert;
CREATE TRIGGER attendance_records_source_freeze_insert
BEFORE INSERT ON attendance_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'attendance' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'attendance_record_source_frozen');
END;
