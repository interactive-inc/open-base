CREATE TRIGGER health_checkups_source_freeze_insert
BEFORE INSERT ON health_checkups
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'health-checkup' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'health_checkup_record_source_frozen'); END;

CREATE TRIGGER health_checkups_source_freeze_update
BEFORE UPDATE ON health_checkups
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'health-checkup' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'health_checkup_record_source_frozen'); END;

CREATE TRIGGER health_checkups_source_freeze_delete
BEFORE DELETE ON health_checkups
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'health-checkup' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'health_checkup_record_source_frozen'); END;
