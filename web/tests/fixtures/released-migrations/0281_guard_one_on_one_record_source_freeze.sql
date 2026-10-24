CREATE TRIGGER one_on_ones_source_freeze_insert
BEFORE INSERT ON one_on_ones
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'one-on-one' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'one_on_one_record_source_frozen'); END;

CREATE TRIGGER one_on_ones_source_freeze_update
BEFORE UPDATE ON one_on_ones
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'one-on-one' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'one_on_one_record_source_frozen'); END;

CREATE TRIGGER one_on_ones_source_freeze_delete
BEFORE DELETE ON one_on_ones
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'one-on-one' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'one_on_one_record_source_frozen'); END;
