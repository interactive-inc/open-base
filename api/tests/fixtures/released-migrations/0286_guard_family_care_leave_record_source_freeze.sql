DROP TRIGGER IF EXISTS family_care_leaves_source_freeze_insert;
CREATE TRIGGER family_care_leaves_source_freeze_insert
BEFORE INSERT ON family_care_leaves
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'family-care-leave' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'family_care_leave_record_source_frozen');
END;

DROP TRIGGER IF EXISTS family_care_leaves_source_freeze_update;
CREATE TRIGGER family_care_leaves_source_freeze_update
BEFORE UPDATE ON family_care_leaves
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'family-care-leave' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'family_care_leave_record_source_frozen');
END;

DROP TRIGGER IF EXISTS family_care_leaves_source_freeze_delete;
CREATE TRIGGER family_care_leaves_source_freeze_delete
BEFORE DELETE ON family_care_leaves
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'family-care-leave' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'family_care_leave_record_source_frozen');
END;
