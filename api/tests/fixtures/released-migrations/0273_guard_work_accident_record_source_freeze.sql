CREATE TRIGGER work_accidents_source_freeze_insert
BEFORE INSERT ON work_accidents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'work-accident' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'work_accident_record_source_frozen'); END;

CREATE TRIGGER work_accidents_source_freeze_update
BEFORE UPDATE ON work_accidents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'work-accident' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'work_accident_record_source_frozen'); END;

CREATE TRIGGER work_accidents_source_freeze_delete
BEFORE DELETE ON work_accidents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'work-accident' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'work_accident_record_source_frozen'); END;
