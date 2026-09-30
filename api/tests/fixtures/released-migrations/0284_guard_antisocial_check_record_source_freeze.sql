CREATE TRIGGER antisocial_checks_source_freeze_insert
BEFORE INSERT ON antisocial_checks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'antisocial-check' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'antisocial_check_record_source_frozen'); END;

CREATE TRIGGER antisocial_checks_source_freeze_update
BEFORE UPDATE ON antisocial_checks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'antisocial-check' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'antisocial_check_record_source_frozen'); END;

CREATE TRIGGER antisocial_checks_source_freeze_delete
BEFORE DELETE ON antisocial_checks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'antisocial-check' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'antisocial_check_record_source_frozen'); END;
