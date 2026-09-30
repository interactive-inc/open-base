CREATE TRIGGER commendations_source_freeze_insert
BEFORE INSERT ON commendations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'commendation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'commendation_record_source_frozen'); END;

CREATE TRIGGER commendations_source_freeze_update
BEFORE UPDATE ON commendations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'commendation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'commendation_record_source_frozen'); END;

CREATE TRIGGER commendations_source_freeze_delete
BEFORE DELETE ON commendations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'commendation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'commendation_record_source_frozen'); END;
